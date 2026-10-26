// lib/autopilot/admin.ts
//
// Server-only. Numbers and lists for the Admin section of the dashboard: revenue, customers,
// one customer's full picture, payments, system health and announcements.

import { rows } from "./db"
import { addNotice, allNotices, isVerified, mailConfigured, realEmail, removeNotice, send, type Notice } from "./account"
import { asSub } from "./service"
import { allPayments, type Payment } from "./billing"
import { isFree, pendingUpi, priceOf, PRODUCTS, rupees, type ProductKey, type Subscription } from "./products"
import { listUsers, type StoredUser } from "@/lib/dashboard/auth"
import { linkedinConfigured } from "./linkedin"
import { metaConfigured } from "./meta"
import { razorpayConfigured } from "./razorpay"
import { upiConfigured } from "./upi"
import { tokenKeySet } from "./crypto"

const DAY = 864e5
const istDay = (t: number) => new Date(t + 330 * 60_000).toISOString().slice(0, 10)

// ---------- revenue ----------

export function revenueStats(all: Subscription[], payments: Payment[]) {
  const now = Date.now()
  // Free access (given by an admin) isn't revenue, and isn't a lost customer when it ends.
  const subs = all.filter((s) => !isFree(s) && !(s.plan !== "trial" && s.status === "cancelled" && !payments.some((p) => p.email === s.email && p.product === s.product)))
  const live = subs.filter((s) => s.status === "active" && s.periodEnd && Date.parse(s.periodEnd) > now && s.plan !== "trial")
  const mrr = live.reduce((t, s) => t + (s.plan === "trial" ? 0 : priceOf(s.product, s.plan, s.cycle) / (s.cycle === "yearly" ? 12 : 1)), 0)
  const people = new Set(subs.map((s) => realEmail(s.email)))
  const payers = new Set(payments.map((p) => realEmail(p.email)))
  const last30 = payments.filter((p) => p.at && Date.parse(p.at) > now - 30 * DAY)
  const prev30 = payments.filter((p) => p.at && Date.parse(p.at) <= now - 30 * DAY && Date.parse(p.at) > now - 60 * DAY)
  const ended = subs.filter((s) => s.plan !== "trial" && s.periodEnd && Date.parse(s.periodEnd) < now && Date.parse(s.periodEnd) > now - 30 * DAY)
  // Daily revenue for the last 90 days.
  const byDay = new Map<string, number>()
  for (const p of payments) if (p.at) byDay.set(istDay(Date.parse(p.at)), (byDay.get(istDay(Date.parse(p.at))) || 0) + p.amount / 100)
  const series = Array.from({ length: 90 }, (_, i) => {
    const d = istDay(now - (89 - i) * DAY)
    return { d, v: byDay.get(d) || 0 }
  })
  const products = (Object.keys(PRODUCTS) as ProductKey[]).map((k) => ({
    product: PRODUCTS[k].name,
    trials: subs.filter((s) => s.product === k && s.status === "trial").length,
    paid: live.filter((s) => s.product === k).length,
    mrr: Math.round(live.filter((s) => s.product === k).reduce((t, s) => t + priceOf(s.product, s.plan as "starter" | "pro", s.cycle) / (s.cycle === "yearly" ? 12 : 1), 0)),
    revenue: payments.filter((p) => p.product === k).reduce((t, p) => t + p.amount, 0),
  }))
  return {
    mrr: Math.round(mrr),
    arr: Math.round(mrr * 12),
    activePaid: live.length,
    yearly: live.filter((s) => s.cycle === "yearly").length,
    trials: subs.filter((s) => s.status === "trial").length,
    customers: people.size,
    payers: payers.size,
    conversion: people.size ? payers.size / people.size : 0,
    revenue30: last30.reduce((t, p) => t + p.amount, 0),
    revenuePrev30: prev30.reduce((t, p) => t + p.amount, 0),
    revenueAll: payments.reduce((t, p) => t + p.amount, 0),
    arpu: payers.size ? Math.round(payments.reduce((t, p) => t + p.amount, 0) / payers.size) : 0,
    churn30: live.length + ended.length ? ended.length / (live.length + ended.length) : 0,
    pending: subs.filter((s) => pendingUpi(s)).length,
    series,
    products,
  }
}

// ---------- customers ----------

type Row = Record<string, unknown>

export async function loadAll() {
  const [subsRaw, payments, notices, { users }, liProfiles, liPosts, channels, items] = await Promise.all([
    rows<Row>("subs"),
    allPayments(),
    allNotices(),
    listUsers(true),
    rows<Row>("li_profiles"),
    rows<Row>("li_posts"),
    rows<Row>("ap_channels"),
    rows<Row>("ap_items"),
  ])
  return { subs: subsRaw.map(asSub), payments, notices, users: users || [], liProfiles, liPosts, channels, items }
}

export type Person = {
  email: string
  name: string
  role: string
  active: boolean
  verified: boolean
  lastLogin: string | null
  brands: number
  tools: { product: string; plan: string; status: string; brand: string }[]
  paid: number
  pendingUpi: boolean
  posted: number
  drafts: number
  failed: number
}

export function people(all: Awaited<ReturnType<typeof loadAll>>): Person[] {
  const keysOf = (email: string) => {
    const set = new Set<string>([email])
    for (const s of all.subs) if (realEmail(s.email) === email) set.add(s.email)
    return set
  }
  const list = all.users.filter((u) => u.role === "customer" || all.subs.some((s) => realEmail(s.email) === u.email))
  return list
    .map((u: StoredUser) => {
      const keys = keysOf(u.email)
      const n = all.notices.filter((x) => x.email === u.email)
      const subs = all.subs.filter((s) => keys.has(s.email))
      const mine = (r: Row) => keys.has(String(r.email))
      return {
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
        verified: u.role !== "customer" || isVerified(n),
        lastLogin: u.lastLogin,
        brands: 1 + n.filter((x) => x.kind === "brand").length,
        tools: subs.map((s) => ({ product: PRODUCTS[s.product].name, plan: s.plan === "trial" ? "Trial" : `${s.plan === "pro" ? "Pro" : "Starter"}${s.cycle === "yearly" ? " yearly" : ""}`, status: s.status, brand: s.email.includes("::") ? s.email.split("::")[1] : "1" })),
        paid: all.payments.filter((p) => keys.has(p.email)).reduce((t, p) => t + p.amount, 0),
        pendingUpi: subs.some((s) => pendingUpi(s)),
        posted: all.liPosts.filter((p) => mine(p) && p.status === "posted").length + all.items.filter((i) => mine(i) && i.status === "posted").length,
        drafts: all.liPosts.filter((p) => mine(p) && p.status === "draft").length + all.items.filter((i) => mine(i) && i.status === "draft").length,
        failed: all.liPosts.filter((p) => mine(p) && (p.status === "failed" || p.status === "blocked")).length + all.items.filter((i) => mine(i) && (i.status === "failed" || i.status === "blocked")).length,
      }
    })
    .sort((a, b) => Number(b.pendingUpi) - Number(a.pendingUpi) || String(b.lastLogin).localeCompare(String(a.lastLogin)))
}

const SECRET = ["tokenEnc", "secretEnc", "passHash", "liSub"]
const strip = (r: Row) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET.includes(k)))

/** One customer, everything (no secrets): brands, plans, connections, recent items, payments, notes. */
export function person(all: Awaited<ReturnType<typeof loadAll>>, email: string) {
  const u = all.users.find((x) => x.email === email)
  if (!u) return null
  const brandNotes = all.notices.filter((n) => n.email === email && (n.kind === "brand" || n.kind === "brand-name"))
  const brands = [{ n: 1, key: email, name: brandNotes.find((b) => b.kind === "brand-name")?.value || "Main brand" }, ...brandNotes.filter((b) => b.kind === "brand").map((b) => ({ n: Number(b.key), key: `${email}::${b.key}`, name: b.value }))]
  const keys = new Set(brands.map((b) => b.key))
  return {
    email,
    name: u.name,
    role: u.role,
    active: u.active,
    lastLogin: u.lastLogin,
    verified: isVerified(all.notices.filter((n) => n.email === email)),
    brands: brands.map((b) => ({
      ...b,
      subs: all.subs.filter((s) => s.email === b.key).map((s) => ({ ...s, upi: pendingUpi(s) })),
      linkedin: (() => {
        const p = all.liProfiles.find((x) => x.email === b.key)
        return p ? { name: String(p.liName || ""), connected: p.connected === true, about: String(p.about || "").slice(0, 200) } : null
      })(),
      channels: all.channels.filter((c) => c.email === b.key).map((c) => ({ product: String(c.product), name: String(c.connName || ""), connected: c.connected === true })),
    })),
    items: [
      ...all.liPosts.filter((p) => keys.has(String(p.email))).map((p) => ({ tool: "LinkedIn", id: Number(p.id), status: String(p.status), title: String(p.topic || p.text || "").split("\n")[0].slice(0, 90), when: (p.postedAt || p.scheduledAt || p.createdAt) as string, error: String(p.error || "") })),
      ...all.items.filter((i) => keys.has(String(i.email))).map((i) => ({ tool: PRODUCTS[i.product as ProductKey]?.name || String(i.product), id: Number(i.id), status: String(i.status), title: String(i.title || "").slice(0, 90), when: (i.postedAt || i.scheduledAt || i.createdAt) as string, error: String(i.error || "") })),
    ]
      .sort((a, b) => String(b.when).localeCompare(String(a.when)))
      .slice(0, 40),
    payments: all.payments.filter((p) => keys.has(p.email)).map((p) => ({ ...p, amountText: rupees(p.amount) })),
    notes: all.notices.filter((n) => n.email === email && !["voice"].includes(n.kind)).map(strip),
  }
}

// ---------- system health ----------

export async function health(all: Awaited<ReturnType<typeof loadAll>>) {
  const now = Date.now()
  const late = (r: Row) => r.status === "approved" && r.scheduledAt && Date.parse(String(r.scheduledAt)) < now - 30 * 60_000 && !(Number(r.progress) > 0)
  const recentFail = (r: Row) => (r.status === "failed" || r.status === "blocked") && Date.parse(String(r.updatedAt || r.createdAt || 0)) > now - 7 * DAY
  const cron = all.notices.filter((n) => n.email === "__system__" && n.kind === "cron").map((n) => n.at || "").sort().pop() || null
  const checks: { name: string; ok: boolean; note: string }[] = [
    { name: "n8n gateway", ok: true, note: "Answering (this page loaded through it)." },
    { name: "Encryption key (XD_TOKEN_KEY)", ok: tokenKeySet(), note: tokenKeySet() ? "Set." : "Missing: customers can't connect accounts." },
    { name: "Email sending (XD_SMTP_PASS)", ok: mailConfigured(), note: mailConfigured() ? "Set." : "Missing: no emails go out." },
    { name: "Hourly emails (XD-AP-C)", ok: !!cron && Date.parse(cron) > now - 2 * 3600e3, note: cron ? `Last ran ${new Date(cron).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}.` : "Hasn't run with email sending on yet." },
    { name: "UPI payments", ok: upiConfigured(), note: upiConfigured() ? "On." : "XD_UPI_ID missing." },
    { name: "Card payments (Razorpay)", ok: razorpayConfigured(), note: razorpayConfigured() ? (String(process.env.RAZORPAY_KEY_ID).startsWith("rzp_test") ? "On, in TEST mode." : "On, live.") : "Keys missing." },
    { name: "LinkedIn app", ok: linkedinConfigured(), note: linkedinConfigured() ? "Keys set." : "LINKEDIN_CLIENT_ID / SECRET missing." },
    { name: "Meta app", ok: metaConfigured(), note: metaConfigured() ? "Keys set." : "META_APP_ID / SECRET missing." },
  ]
  const lateList = [...all.liPosts.filter(late).map((p) => ({ tool: "LinkedIn", email: String(p.email), title: String(p.topic || p.text || "").slice(0, 70), when: String(p.scheduledAt) })), ...all.items.filter(late).map((i) => ({ tool: PRODUCTS[i.product as ProductKey]?.name || "", email: String(i.email), title: String(i.title || "").slice(0, 70), when: String(i.scheduledAt) }))]
  const fails = [...all.liPosts.filter(recentFail).map((p) => ({ tool: "LinkedIn", email: String(p.email), error: String(p.error || "").slice(0, 160) })), ...all.items.filter(recentFail).map((i) => ({ tool: PRODUCTS[i.product as ProductKey]?.name || "", email: String(i.email), error: String(i.error || "").slice(0, 160) }))]
  const day = (r: Row) => Date.parse(String(r.createdAt || 0)) > now - DAY
  return {
    checks,
    numbers: {
      draftsToday: all.liPosts.filter(day).length + all.items.filter(day).length,
      postedToday: all.liPosts.filter((p) => p.status === "posted" && Date.parse(String(p.postedAt || 0)) > now - DAY).length + all.items.filter((i) => i.status === "posted" && Date.parse(String(i.postedAt || 0)) > now - DAY).length,
      waitingApproval: all.liPosts.filter((p) => p.status === "draft").length + all.items.filter((i) => i.status === "draft").length,
      scheduled: all.liPosts.filter((p) => p.status === "approved").length + all.items.filter((i) => i.status === "approved").length,
    },
    late: lateList,
    failures: fails.slice(0, 30),
  }
}

export async function noteCronRun() {
  const old = (await allNotices()).filter((n) => n.email === "__system__" && n.kind === "cron")
  for (const o of old) await removeNotice(o.id)
  await addNotice("__system__", "cron", new Date().toISOString())
}

// ---------- announcements ----------

export type Announcement = { id: number; title: string; message: string; until: string | null; audience: "all" | "trial" | "paid"; at: string | null }

const asAnnouncement = (n: Notice): Announcement => {
  let v: Partial<Announcement> = {}
  try {
    v = JSON.parse(n.value)
  } catch {}
  return { id: n.id, title: String(v.title || ""), message: String(v.message || ""), until: v.until || null, audience: v.audience === "trial" || v.audience === "paid" ? v.audience : "all", at: n.at }
}

export async function announcements(): Promise<Announcement[]> {
  return (await allNotices()).filter((n) => n.email === "__all__" && n.kind === "announce").map(asAnnouncement).sort((a, b) => b.id - a.id)
}

export async function createAnnouncement(input: Record<string, unknown>, all: Awaited<ReturnType<typeof loadAll>>) {
  const title = String(input.title || "").trim().slice(0, 100)
  const message = String(input.message || "").trim().slice(0, 1000)
  if (!title || !message) throw new Error("Add a title and a message.")
  const audience = input.audience === "trial" || input.audience === "paid" ? input.audience : "all"
  const until = /^\d{4}-\d{2}-\d{2}$/.test(String(input.until)) ? new Date(`${input.until}T23:59:59+05:30`).toISOString() : null
  await addNotice("__all__", "announce", "", JSON.stringify({ title, message, until, audience }))
  let emailed = 0
  if (input.email === true && mailConfigured()) {
    for (const p of people(all)) {
      if (!p.active || !p.verified) continue
      const paid = p.tools.some((t) => t.status === "active" && t.plan !== "Trial")
      if ((audience === "paid" && !paid) || (audience === "trial" && paid)) continue
      if (await send(p.email, { subject: title, md: `Hi ${p.name.split(" ")[0] || "there"},\n\n${message}`, cta: { label: "Open dashboard", url: "https://www.xredible.in/dashboard?biz=autopilot" } })) emailed++
    }
  }
  return emailed
}

/** Announcements this customer should see now (not dismissed, right audience, not expired). */
export function activeAnnouncements(list: Announcement[], notes: Notice[], paid: boolean) {
  const seen = new Set(notes.filter((n) => n.kind === "announce-seen").map((n) => Number(n.key)))
  return list.filter((a) => !seen.has(a.id) && (!a.until || Date.parse(a.until) > Date.now()) && (a.audience === "all" || (a.audience === "paid") === paid))
}
