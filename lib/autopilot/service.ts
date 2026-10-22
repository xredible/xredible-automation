// lib/autopilot/service.ts
//
// Server-only business rules for LinkedIn Autopilot: trials, plan limits,
// LinkedIn connection, the post calendar and publishing.

import { insert, rows, update, type Table } from "./db"
import { open, seal } from "./crypto"
import { planOf, PRODUCTS, canPublish, isProduct, type PlanKey, type ProductKey, type Subscription } from "./products"
import { publishPost, postUrl } from "./linkedin"

export type LiProfile = {
  id: number
  email: string
  about: string
  audience: string
  topics: string
  tone: string
  language: string
  postsPerWeek: number
  postTime: string
  liName: string
  liSub: string
  tokenEnc: string
  tokenExpires: string | null
  connected: boolean
}

export type LiPost = {
  id: number
  email: string
  status: "draft" | "approved" | "posted" | "failed" | "rejected" | "blocked"
  text: string
  topic: string
  scheduledAt: string | null
  postedAt: string | null
  postUrn: string
  error: string
  createdAt?: string
}

/** What the browser gets: never the token. */
export type LiProfileView = Omit<LiProfile, "tokenEnc" | "liSub"> & { tokenExpiringSoon: boolean }

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

function asSub(r: Record<string, unknown>): Subscription {
  return {
    id: num(r.id),
    email: String(r.email || ""),
    product: (isProduct(r.product) ? r.product : "linkedin") as ProductKey,
    plan: (r.plan === "starter" || r.plan === "pro" ? r.plan : "trial") as Subscription["plan"],
    status: (["trial", "pending", "active", "halted", "cancelled"].includes(String(r.status)) ? r.status : "trial") as Subscription["status"],
    postLimit: num(r.postLimit),
    used: num(r.used),
    periodStart: (r.periodStart as string) || null,
    periodEnd: (r.periodEnd as string) || null,
    rzpSubId: String(r.rzpSubId || ""),
    note: String(r.note || ""),
  }
}

// ---------- subscriptions ----------

export async function subsFor(email: string): Promise<Subscription[]> {
  return (await rows<Record<string, unknown>>("subs", { col: "email", val: email })).map(asSub)
}

export async function subFor(email: string, product: ProductKey): Promise<Subscription | null> {
  return (await subsFor(email)).find((s) => s.product === product) || null
}

/** Every customer gets one free trial per product. */
export async function ensureTrial(email: string, product: ProductKey): Promise<Subscription> {
  const have = await subFor(email, product)
  if (have) return have
  const row = await insert<Record<string, unknown>>("subs", { email, product, plan: "trial", status: "trial", postLimit: PRODUCTS[product].trial, used: 0, rzpSubId: "", note: "" })
  return asSub(row)
}

export async function markPending(sub: Subscription, rzpSubId: string, plan: PlanKey) {
  await update("subs", sub.id, { rzpSubId, note: `checkout:${plan}` })
}

/** From Razorpay (checkout success or webhook). */
export async function applySubscription(event: { rzpSubId: string; email?: string; product?: string; plan?: string; status: "active" | "halted" | "cancelled"; start?: number; end?: number; charged?: boolean }) {
  const all = await rows<Record<string, unknown>>("subs", { col: "rzpSubId", val: event.rzpSubId })
  let sub = all.map(asSub)[0]
  if (!sub && event.email && isProduct(event.product)) sub = (await subFor(event.email, event.product)) || (await ensureTrial(event.email, event.product))
  if (!sub) return
  const plan = (event.plan === "starter" || event.plan === "pro" ? event.plan : sub.plan === "trial" ? "starter" : sub.plan) as PlanKey
  const p = planOf(sub.product, plan)
  const periodStart = event.start ? new Date(event.start * 1000).toISOString() : sub.periodStart
  const periodEnd = event.end ? new Date(event.end * 1000).toISOString() : sub.periodEnd
  const patch: Record<string, unknown> = { status: event.status, rzpSubId: event.rzpSubId, note: "" }
  if (event.status === "active") {
    patch.plan = plan
    patch.postLimit = p?.posts ?? sub.postLimit
    patch.periodStart = periodStart
    patch.periodEnd = periodEnd
    // A new billing period (or the first one) starts with a fresh allowance.
    if (sub.status !== "active" || (event.charged && periodStart !== sub.periodStart)) patch.used = 0
  }
  await update("subs", sub.id, patch)
}

// ---------- LinkedIn profile ----------

function asProfile(r: Record<string, unknown>): LiProfile {
  return {
    id: num(r.id),
    email: String(r.email || ""),
    about: String(r.about || ""),
    audience: String(r.audience || ""),
    topics: String(r.topics || ""),
    tone: String(r.tone || ""),
    language: String(r.language || "English"),
    postsPerWeek: num(r.postsPerWeek, 3) || 3,
    postTime: /^\d{2}:\d{2}$/.test(String(r.postTime)) ? String(r.postTime) : "09:05",
    liName: String(r.liName || ""),
    liSub: String(r.liSub || ""),
    tokenEnc: String(r.tokenEnc || ""),
    tokenExpires: (r.tokenExpires as string) || null,
    connected: r.connected === true,
  }
}

export async function profileFor(email: string): Promise<LiProfile | null> {
  const r = (await rows<Record<string, unknown>>("li_profiles", { col: "email", val: email }))[0]
  return r ? asProfile(r) : null
}

export function viewProfile(p: LiProfile | null): LiProfileView | null {
  if (!p) return null
  const { tokenEnc: _t, liSub: _s, ...rest } = p
  void _t
  void _s
  const exp = p.tokenExpires ? Date.parse(p.tokenExpires) : 0
  return { ...rest, connected: p.connected && exp > Date.now(), tokenExpiringSoon: p.connected && exp - Date.now() < 7 * 864e5 }
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

export async function saveProfile(email: string, input: Record<string, unknown>): Promise<LiProfile> {
  const fields = {
    about: clip(input.about, 1200),
    audience: clip(input.audience, 600),
    topics: clip(input.topics, 800),
    tone: clip(input.tone, 300),
    language: ["English", "Hinglish", "Hindi"].includes(String(input.language)) ? String(input.language) : "English",
    postsPerWeek: Math.min(7, Math.max(1, num(input.postsPerWeek, 3))),
    postTime: /^\d{2}:\d{2}$/.test(String(input.postTime)) ? String(input.postTime) : "09:05",
  }
  const have = await profileFor(email)
  if (have) {
    await update("li_profiles", have.id, fields)
    return { ...have, ...fields }
  }
  return asProfile(await insert("li_profiles", { email, ...fields, liName: "", liSub: "", tokenEnc: "", connected: false }))
}

/** After LinkedIn sign-in. One free trial per LinkedIn account, whatever email signs up. */
export async function connectLinkedIn(email: string, li: { token: string; expiresAt: string; sub: string; name: string }) {
  const p = (await profileFor(email)) || (await saveProfile(email, {}))
  await update("li_profiles", p.id, { tokenEnc: seal(li.token), tokenExpires: li.expiresAt, liSub: li.sub, liName: li.name, connected: true })
  const others = (await rows<Record<string, unknown>>("li_profiles", { col: "liSub", val: li.sub })).map(asProfile).filter((x) => x.email !== email)
  if (others.length) {
    const mine = await ensureTrial(email, "linkedin")
    if (mine.status === "trial" && mine.used === 0) {
      for (const o of others) {
        const s = await subFor(o.email, "linkedin")
        if (s && (s.used > 0 || s.status !== "trial")) {
          await update("subs", mine.id, { postLimit: 0, note: "Free trial already used by this LinkedIn account." })
          break
        }
      }
    }
  }
}

export async function disconnectLinkedIn(email: string) {
  const p = await profileFor(email)
  if (p) await update("li_profiles", p.id, { tokenEnc: "", connected: false })
}

// ---------- posts ----------

function asPost(r: Record<string, unknown>): LiPost {
  return {
    id: num(r.id),
    email: String(r.email || ""),
    status: (["draft", "approved", "posted", "failed", "rejected", "blocked"].includes(String(r.status)) ? r.status : "draft") as LiPost["status"],
    text: String(r.text || ""),
    topic: String(r.topic || ""),
    scheduledAt: (r.scheduledAt as string) || null,
    postedAt: (r.postedAt as string) || null,
    postUrn: String(r.postUrn || ""),
    error: String(r.error || ""),
    createdAt: (r.createdAt as string) || undefined,
  }
}

export async function postsFor(email: string): Promise<LiPost[]> {
  return (await rows<Record<string, unknown>>("li_posts", { col: "email", val: email }))
    .map(asPost)
    .sort((a, b) => String(a.scheduledAt || a.createdAt).localeCompare(String(b.scheduledAt || b.createdAt)))
}

async function ownPost(email: string, id: number): Promise<LiPost> {
  const p = (await rows<Record<string, unknown>>("li_posts", { col: "id", val: id })).map(asPost)[0]
  if (!p || p.email !== email) throw new Error("That post isn't yours.")
  return p
}

const inFuture = (iso: string | null) => (iso && Date.parse(iso) > Date.now() + 5 * 60_000 ? iso : new Date(Date.now() + 15 * 60_000).toISOString())

export async function postAction(email: string, input: Record<string, unknown>) {
  const id = num(input.id)
  const op = String(input.op || "")
  const post = await ownPost(email, id)
  if (post.status === "posted") throw new Error("This post is already live on LinkedIn.")
  if (op === "approve") return update("li_posts", id, { status: "approved", scheduledAt: inFuture(post.scheduledAt), error: "" })
  if (op === "unapprove") return update("li_posts", id, { status: "draft" })
  if (op === "reject") return update("li_posts", id, { status: "rejected" })
  if (op === "edit") {
    const text = String(input.text ?? "").trim()
    if (text.length < 20) throw new Error("A post needs at least a couple of sentences.")
    if (text.length > 2900) throw new Error("LinkedIn posts can be at most 3,000 characters.")
    return update("li_posts", id, { text })
  }
  if (op === "reschedule") {
    const when = String(input.when || "")
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) throw new Error("Pick a date and time.")
    const iso = new Date(when + ":00+05:30").toISOString()
    if (Date.parse(iso) < Date.now()) throw new Error("Pick a time in the future.")
    return update("li_posts", id, { scheduledAt: iso })
  }
  throw new Error("Unknown change.")
}

/** Called by n8n for each approved post that is due. Checks the plan, posts, counts it. */
export async function publishOne(id: number): Promise<{ ok: boolean; status: string; error?: string; url?: string }> {
  const post = (await rows<Record<string, unknown>>("li_posts", { col: "id", val: id })).map(asPost)[0]
  if (!post) return { ok: false, status: "missing" }
  if (post.status !== "approved") return { ok: true, status: post.status }
  if (post.scheduledAt && Date.parse(post.scheduledAt) > Date.now() + 60_000) return { ok: true, status: "not-due" }
  const sub = await subFor(post.email, "linkedin")
  if (!canPublish(sub)) {
    const why = sub?.note || (sub?.status === "trial" ? "Your 3 free posts are used. Subscribe to keep posting." : "Your subscription isn't active. Renew to keep posting.")
    await update("li_posts", id, { status: "blocked", error: why })
    return { ok: false, status: "blocked", error: why }
  }
  const prof = await profileFor(post.email)
  try {
    if (!prof || !prof.connected || !prof.tokenEnc) throw new Error("LinkedIn isn't connected. Connect LinkedIn on the Autopilot page.")
    if (prof.tokenExpires && Date.parse(prof.tokenExpires) < Date.now()) throw new Error("LinkedIn access expired. Reconnect LinkedIn.")
    const urn = await publishPost(open(prof.tokenEnc), prof.liSub, post.text)
    await update("li_posts", id, { status: "posted", postedAt: new Date().toISOString(), postUrn: urn, error: "" })
    // Count it (re-read so two posts at once don't overwrite each other's count by much).
    const fresh = await subFor(post.email, "linkedin")
    if (fresh) await update("subs", fresh.id, { used: fresh.used + 1 })
    return { ok: true, status: "posted", url: postUrl(urn) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Posting failed."
    await update("li_posts", id, { status: "failed", error: msg.slice(0, 300) })
    return { ok: false, status: "failed", error: msg }
  }
}

export type { Table }
