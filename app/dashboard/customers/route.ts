// /dashboard/customers — admins only. Autopilot customers, plans, UPI payments to check,
// revenue numbers and coupon codes.
// GET  → { customers: [{ sub, name, liName, connected }], stats, coupons }
// POST { op: "activate", id, plan?, cycle? }   payment checked: plan starts (or extends), receipt emailed
//      { op: "reject", id }                     UPI payment not found
//      { op: "stop", id }                       plan off
//      { op: "trial", id }                      give the free trial again
//      { op: "coupon", code, percent, products?, maxUses?, expires? }   new coupon
//      { op: "coupon-active", couponId, active }

import { NextResponse } from "next/server"
import { currentUser, listUsers } from "@/lib/dashboard/auth"
import { rows, update } from "@/lib/autopilot/db"
import { errText, json } from "@/lib/autopilot/guard"
import { isCycle, pendingUpi, planOf, priceOf, PRODUCTS, type PlanKey, type Subscription } from "@/lib/autopilot/products"
import { asSub } from "@/lib/autopilot/service"
import { activatePlan, allCoupons, allPayments, saveCoupon, setCouponActive, subById } from "@/lib/autopilot/billing"
import { realEmail } from "@/lib/autopilot/account"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

async function admin() {
  const me = await currentUser()
  return me?.role === "admin" ? me : null
}

/** Monthly recurring revenue, conversion and churn from the subscriptions and payments tables. */
function revenue(subs: Subscription[], payments: Awaited<ReturnType<typeof allPayments>>) {
  const now = Date.now()
  const live = subs.filter((s) => s.status === "active" && s.periodEnd && Date.parse(s.periodEnd) > now)
  const mrr = live.reduce((t, s) => t + (s.plan === "trial" ? 0 : priceOf(s.product, s.plan, s.cycle) / (s.cycle === "yearly" ? 12 : 1)), 0)
  const people = new Set(subs.map((s) => realEmail(s.email)))
  const payers = new Set(payments.map((p) => realEmail(p.email)))
  const last30 = payments.filter((p) => p.at && Date.parse(p.at) > now - 30 * 864e5)
  const ended = subs.filter((s) => s.plan !== "trial" && s.periodEnd && Date.parse(s.periodEnd) < now && Date.parse(s.periodEnd) > now - 30 * 864e5 && !(s.status === "active" && Date.parse(s.periodEnd) > now))
  const byProduct = Object.fromEntries(Object.keys(PRODUCTS).map((k) => [k, live.filter((s) => s.product === k).length]))
  return {
    mrr: Math.round(mrr),
    activePaid: live.length,
    trials: subs.filter((s) => s.status === "trial").length,
    customers: people.size,
    conversion: people.size ? payers.size / people.size : 0,
    revenue30: last30.reduce((t, p) => t + p.amount, 0),
    revenueAll: payments.reduce((t, p) => t + p.amount, 0),
    churn30: live.length + ended.length ? ended.length / (live.length + ended.length) : 0,
    pending: subs.filter((s) => pendingUpi(s)).length,
    byProduct,
  }
}

export async function GET() {
  if (!(await admin())) return json({ ok: false, error: "Admins only." }, 403)
  try {
    const [rawSubs, { users }, profiles, channels, payments, coupons] = await Promise.all([rows<Record<string, unknown>>("subs"), listUsers(true), rows<Record<string, unknown>>("li_profiles"), rows<Record<string, unknown>>("ap_channels"), allPayments(), allCoupons()])
    const subs = rawSubs.map(asSub)
    const name = new Map((users || []).map((u) => [u.email, u.name]))
    const prof = new Map(profiles.map((p) => [String(p.email), p]))
    const chan = new Map(channels.map((c) => [`${c.email}|${c.product}`, c]))
    const conn = (s: Subscription) => {
      if (s.product === "linkedin") return { liName: String(prof.get(s.email)?.liName || ""), connected: prof.get(s.email)?.connected === true }
      const c = chan.get(`${s.email}|${s.product}`)
      return { liName: String(c?.connName || ""), connected: c?.connected === true }
    }
    const customers = subs
      .map((s) => ({ sub: s, name: name.get(realEmail(s.email)) || "", ...conn(s), upi: pendingUpi(s) }))
      .sort((a, b) => Number(!!b.upi) - Number(!!a.upi) || b.sub.id - a.sub.id)
    return json({ ok: true, customers, stats: revenue(subs, payments), coupons })
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}

export async function POST(request: Request) {
  if (!(await admin())) return json({ ok: false, error: "Admins only." }, 403)
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (origin && host && new URL(origin).host !== host) return json({ ok: false, error: "Not allowed." }, 403)
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    if (op === "coupon") {
      await saveCoupon(b)
      return json({ ok: true })
    }
    if (op === "coupon-active") {
      await setCouponActive(Number(b.couponId), b.active === true)
      return json({ ok: true })
    }
    const s = await subById(Number(b.id))
    if (!s) return json({ ok: false, error: "Not found." }, 404)
    if (op === "activate") {
      const pend = pendingUpi(s)
      const plan = (String(b.plan || pend?.plan || "") || "starter") as PlanKey
      const cycle = isCycle(b.cycle) ? b.cycle : pend?.cycle || "monthly"
      if (!planOf(s.product, plan)) return json({ ok: false, error: "Pick a plan." }, 400)
      // The amount the customer was quoted (after any coupon); otherwise the list price.
      const amount = pend && pend.plan === plan && pend.cycle === cycle && pend.amount ? pend.amount : priceOf(s.product, plan, cycle)
      const r = await activatePlan(s, { plan, cycle, method: "upi", ref: pend?.utr ? `UTR ${pend.utr}` : `manual ${new Date().toISOString()}`, amount, coupon: pend && pend.plan === plan ? pend.coupon : "" })
      return json({ ok: true, invoice: r.payment.invoiceNo, extraDays: r.extraDays })
    }
    if (op === "reject") {
      await update("subs", s.id, { note: "We couldn't find your UPI payment. Please check the UTR number or message us on WhatsApp." })
      return json({ ok: true })
    }
    if (op === "stop") {
      await update("subs", s.id, { status: "cancelled", note: "" })
      return json({ ok: true })
    }
    if (op === "trial") {
      await update("subs", s.id, { status: "trial", plan: "trial", cycle: "monthly", used: 0, postLimit: PRODUCTS[s.product]?.trial ?? 3, note: "" })
      return json({ ok: true })
    }
    return json({ ok: false, error: "Unknown request." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}
