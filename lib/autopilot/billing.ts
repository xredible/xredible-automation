// lib/autopilot/billing.ts
//
// Server-only. Payments, receipts, coupons, referrals and plan activation, shared by
// manual UPI (admin activates in Customers) and Razorpay.

import { createHash } from "node:crypto"
import { insert, rows, update } from "./db"
import { addNotice, allNotices, EMAILS, noticesFor, realEmail, removeNotice, send } from "./account"
import { asSub, subFor, subsFor } from "./service"
import { cleanExtra, daysOf, extraText, isProduct, limitOf, planOf, PRODUCTS, priceOf, rupees, type Cycle, type PlanKey, type ProductKey, type Subscription } from "./products"
import { SITE } from "./linkedin"
import { cancelSubscription } from "./razorpay"
import { findUser } from "@/lib/dashboard/auth"

// ---------- payments ----------

export type Payment = {
  id: number
  email: string
  product: ProductKey
  plan: PlanKey
  cycle: Cycle
  amount: number
  method: string
  ref: string
  coupon: string
  invoiceNo: string
  periodStart: string | null
  periodEnd: string | null
  at: string | null
  /** Extra profiles this payment covered. */
  extra: number
}

const asPayment = (r: Record<string, unknown>): Payment => ({
  id: Number(r.id),
  email: String(r.email || ""),
  product: (isProduct(r.product) ? r.product : "linkedin") as ProductKey,
  plan: r.plan === "pro" ? "pro" : "starter",
  cycle: r.cycle === "yearly" ? "yearly" : "monthly",
  amount: Number(r.amount) || 0,
  method: String(r.method || ""),
  ref: String(r.ref || ""),
  coupon: String(r.coupon || ""),
  invoiceNo: String(r.invoiceNo || ""),
  periodStart: (r.periodStart as string) || null,
  periodEnd: (r.periodEnd as string) || null,
  at: (r.at as string) || (r.createdAt as string) || null,
  extra: Math.max(0, Math.floor(Number(r.extra) || 0)),
})

export const paymentsFor = async (email: string) => (await rows<Record<string, unknown>>("payments", { col: "email", val: email })).map(asPayment).sort((a, b) => b.id - a.id)
export const allPayments = async () => (await rows<Record<string, unknown>>("payments")).map(asPayment)
export const paymentById = async (id: number) => (await rows<Record<string, unknown>>("payments", { col: "id", val: id })).map(asPayment)[0] || null

export const receiptUrl = (id: number) => `${SITE}/dashboard/receipt/${id}`

async function recordPayment(p: Omit<Payment, "id" | "invoiceNo" | "at">): Promise<Payment> {
  const year = new Date().getFullYear()
  const count = (await allPayments()).filter((x) => x.invoiceNo.startsWith(`XD-${year}-`)).length
  const row = await insert<Record<string, unknown>>("payments", { ...p, invoiceNo: `XD-${year}-${String(count + 1).padStart(4, "0")}`, at: new Date().toISOString() })
  return asPayment(row)
}

// ---------- coupons ----------

export type Coupon = { id: number; code: string; percent: number; products: string; maxUses: number; used: number; expires: string | null; active: boolean }
const asCoupon = (r: Record<string, unknown>): Coupon => ({
  id: Number(r.id),
  code: String(r.code || "").toUpperCase(),
  percent: Number(r.percent) || 0,
  products: String(r.products || ""),
  maxUses: Number(r.maxUses) || 0,
  used: Number(r.used) || 0,
  expires: (r.expires as string) || null,
  active: r.active !== false,
})
export const allCoupons = async () => (await rows<Record<string, unknown>>("coupons")).map(asCoupon).sort((a, b) => b.id - a.id)

export const cleanCode = (v: unknown) => String(v ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20)

/** A usable coupon for this product, or a reason it can't be used. */
export async function findCoupon(code: string, product: ProductKey): Promise<Coupon | string> {
  const c = (await allCoupons()).find((x) => x.code === cleanCode(code))
  if (!c || !c.active) return "That coupon code isn't valid."
  if (c.expires && Date.parse(c.expires) < Date.now()) return "That coupon has expired."
  if (c.maxUses && c.used >= c.maxUses) return "That coupon has been fully used."
  if (c.products && !c.products.split(",").map((s) => s.trim()).includes(product)) return `That coupon isn't for ${PRODUCTS[product].name}.`
  return c
}

export async function saveCoupon(input: Record<string, unknown>): Promise<void> {
  const code = cleanCode(input.code)
  const percent = Math.round(Number(input.percent))
  if (code.length < 3) throw new Error("Use at least 3 letters or numbers for the code.")
  if (!(percent >= 1 && percent <= 100)) throw new Error("Discount must be 1–100%.")
  if ((await allCoupons()).some((c) => c.code === code)) throw new Error("That code already exists.")
  const products = String(input.products || "")
    .split(",")
    .map((s) => s.trim())
    .filter(isProduct)
    .join(",")
  const expires = /^\d{4}-\d{2}-\d{2}$/.test(String(input.expires)) ? new Date(`${input.expires}T23:59:59+05:30`).toISOString() : null
  await insert("coupons", { code, percent, products, maxUses: Math.max(0, Math.round(Number(input.maxUses) || 0)), used: 0, expires, active: true })
}

export const setCouponActive = (id: number, active: boolean) => update("coupons", id, { active })

/** The price to pay (paise), after a coupon. */
export async function quote(product: ProductKey, plan: PlanKey, cycle: Cycle, code: string, extra = 0): Promise<{ amount: number; full: number; coupon: Coupon | null; error?: string }> {
  const full = priceOf(product, plan, cycle, extra)
  if (!cleanCode(code)) return { amount: full, full, coupon: null }
  const c = await findCoupon(code, product)
  if (typeof c === "string") return { amount: full, full, coupon: null, error: c }
  return { amount: Math.max(100, Math.round((full * (100 - c.percent)) / 100 / 100) * 100), full, coupon: c }
}

// ---------- referrals ----------

/** Each person's invite code (made the first time it's shown). */
export async function referralCode(email: string): Promise<string> {
  const me = realEmail(email)
  const have = (await noticesFor(me)).find((n) => n.kind === "refcode")
  if (have) return have.key
  const code = createHash("sha256").update(`xd-ref|${me}`).digest("base64url").replace(/[^A-Za-z0-9]/g, "").slice(0, 7).toUpperCase()
  await addNotice(me, "refcode", code)
  return code
}

export async function noteReferral(email: string, code: string) {
  const c = cleanCode(code)
  if (!c) return
  const owner = (await allNotices()).find((n) => n.kind === "refcode" && n.key === c)
  if (owner && owner.email !== email) await addNotice(email, "referredBy", owner.email)
}

/** Referral status for the Billing page. */
export async function referralInfo(email: string) {
  const me = realEmail(email)
  const all = await allNotices()
  const code = await referralCode(me)
  const joined = all.filter((n) => n.kind === "referredBy" && n.key === me)
  const rewarded = all.filter((n) => n.kind === "referral-rewarded" && n.value === me)
  const credits = all.filter((n) => n.email === me && n.kind === "credit").reduce((s, n) => s + (Number(n.key) || 0), 0)
  return { code, link: `${SITE}/dashboard?signup&ref=${code}`, joined: joined.length, rewarded: rewarded.length, creditDays: credits }
}

/** Free days waiting for this person (from referrals); used up when a plan is activated. */
async function takeCredits(email: string): Promise<number> {
  const me = realEmail(email)
  const credits = (await noticesFor(me)).filter((n) => n.kind === "credit")
  for (const c of credits) await removeNotice(c.id)
  return credits.reduce((s, n) => s + (Number(n.key) || 0), 0)
}

/** On a person's first payment: they get 30 extra days, and whoever invited them gets a free month. */
async function referralBonus(email: string): Promise<number> {
  const me = realEmail(email)
  const mine = await noticesFor(me)
  const by = mine.find((n) => n.kind === "referredBy")
  if (!by || mine.some((n) => n.kind === "referral-done")) return 0
  if ((await paymentsFor(email)).length > 1) return 0
  await addNotice(me, "referral-done", by.key)
  // Reward the inviter: extend an active plan now, or keep a credit for their next one.
  const referrer = by.key
  const subs = (await subsFor(referrer)).filter((s) => s.status === "active" && s.periodEnd && Date.parse(s.periodEnd) > Date.now())
  if (subs[0]) await update("subs", subs[0].id, { periodEnd: new Date(Date.parse(subs[0].periodEnd as string) + 30 * 864e5).toISOString() })
  else await addNotice(referrer, "credit", "30", `from ${me}`)
  await addNotice(referrer, "referral-rewarded", "", referrer)
  const friend = (await findUser(me))?.name || me
  await send(referrer, EMAILS.referral((await findUser(referrer))?.name || "", friend))
  return 30
}

// ---------- activating a paid plan ----------

/**
 * Starts (or extends) a paid plan after a confirmed payment, records the payment,
 * uses the coupon, applies referral days and credits, and emails the receipt.
 */
export async function activatePlan(sub: Subscription, o: { plan: PlanKey; cycle: Cycle; method: "upi" | "razorpay"; ref: string; amount: number; coupon?: string; start?: number; end?: number; rzpSubId?: string; extra?: number }) {
  const p = planOf(sub.product, o.plan)
  if (!p) throw new Error("Unknown plan.")
  const extra = cleanExtra(sub.product, o.extra)
  // The same payment can arrive twice (checkout and webhook): record it once.
  const seen = (await paymentsFor(sub.email)).find((x) => x.ref === o.ref)
  if (seen) return { payment: seen, extraDays: 0 }
  // Changing plan or the number of extra profiles by card starts a new Razorpay subscription;
  // the one it replaces (kept in the checkout note) stops at the end of its paid period.
  const replaced = o.rzpSubId && sub.note.startsWith("checkout:") ? sub.note.split(":")[4] || "" : ""
  if (replaced && replaced !== o.rzpSubId) await cancelSubscription(replaced).catch(() => {})
  const now = Date.now()
  const samePlan = sub.status === "active" && sub.plan === o.plan && sub.cycle === o.cycle && (sub.extra || 0) === extra && sub.periodEnd && Date.parse(sub.periodEnd) > now
  // Paying again for the same plan extends it; a new or changed plan starts today.
  const start = o.start ? o.start * 1000 : samePlan ? Date.parse(sub.periodEnd as string) : now
  let end = o.end ? o.end * 1000 : start + daysOf(o.cycle) * 864e5
  const pay = await recordPayment({
    email: sub.email,
    product: sub.product,
    plan: o.plan,
    cycle: o.cycle,
    amount: o.amount,
    method: o.method,
    ref: o.ref,
    coupon: o.coupon || "",
    periodStart: new Date(start).toISOString(),
    periodEnd: new Date(end).toISOString(),
    extra,
  })
  const bonusDays = (await referralBonus(sub.email)) + (await takeCredits(sub.email))
  end += bonusDays * 864e5
  await update("subs", sub.id, {
    status: "active",
    plan: o.plan,
    cycle: o.cycle,
    postLimit: limitOf(sub.product, o.plan, o.cycle, extra),
    extra,
    used: samePlan ? sub.used : 0,
    periodStart: new Date(samePlan ? Date.parse(sub.periodStart || "") || start : start).toISOString(),
    periodEnd: new Date(end).toISOString(),
    note: "",
    ...(o.rzpSubId ? { rzpSubId: o.rzpSubId } : {}),
  })
  if (o.coupon) {
    const c = (await allCoupons()).find((x) => x.code === o.coupon)
    if (c) await update("coupons", c.id, { used: c.used + 1 })
  }
  const who = await findUser(realEmail(sub.email))
  const what = `${PRODUCTS[sub.product].name} ${p.name} (${o.cycle})${extra ? ` ${extraText(sub.product, extra)}` : ""}`
  const until = new Date(end).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })
  await send(sub.email, EMAILS.receipt(who?.name || "", what, rupees(o.amount), until, receiptUrl(pay.id)))
  return { payment: pay, extraDays: bonusDays }
}

export async function subById(id: number): Promise<Subscription | null> {
  return (await rows<Record<string, unknown>>("subs", { col: "id", val: id })).map(asSub)[0] || null
}

export { subFor }
