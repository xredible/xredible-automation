// POST /dashboard/billing — the signed-in customer's payments (for the brand they have open).
//   { op: "quote", product, plan, cycle, coupon }        → price after coupon, and a UPI QR for it
//   { op: "upi", product, plan, cycle, coupon, utr }     → "I've paid by UPI"; an admin checks and activates
//   { op: "subscribe", product, plan, cycle }            → Razorpay subscription for Checkout
//   { op: "confirm", razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
//   { op: "cancel", product }                            → Razorpay plan stops at the end of the paid period

import { NextResponse } from "next/server"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { isCycle, isProduct, planOf, priceOf, PRODUCTS, rupees, type Cycle, type PlanKey } from "@/lib/autopilot/products"
import { upiConfigured, upiId, upiLink, upiQr, validUtr } from "@/lib/autopilot/upi"
import { notify, update } from "@/lib/autopilot/db"
import { cancelSubscription, checkoutSignatureOk, createSubscription, razorpayConfigured, razorpayKeyId } from "@/lib/autopilot/razorpay"
import { ensureTrial, markPending, subFor, subsFor } from "@/lib/autopilot/service"
import { activatePlan, cleanCode, quote } from "@/lib/autopilot/billing"
import { isVerified, noticesFor, realEmail } from "@/lib/autopilot/account"
import { ownerKey } from "@/lib/autopilot/brands"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const NEED_VERIFY = "Confirm your email first (check your inbox, or resend the link from the banner at the top of Overview). We send receipts there."

export async function POST(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    const cycle: Cycle = isCycle(b.cycle) ? b.cycle : "monthly"
    const verified = async () => me.role !== "customer" || isVerified(await noticesFor(realEmail(owner)))

    if (op === "quote" || op === "upi") {
      if (!isProduct(b.product) || !PRODUCTS[b.product].live) return json({ ok: false, error: "That product isn't available yet." }, 400)
      const plan = String(b.plan) as PlanKey
      const p = planOf(b.product, plan)
      if (!p) return json({ ok: false, error: "Pick a plan." }, 400)
      const q = await quote(b.product, plan, cycle, String(b.coupon || ""))
      if (op === "quote") {
        const link = upiConfigured() ? upiLink(q.amount, `${PRODUCTS[b.product].name.split(" ")[0]} ${p.name} ${cycle}`) : null
        return json({ ok: true, amount: q.amount, full: q.full, couponError: q.error || null, percent: q.coupon?.percent || 0, upi: link ? { id: upiId(), link, qr: await upiQr(link) } : null })
      }
      if (!upiConfigured()) return json({ ok: false, error: "UPI payments aren't switched on yet." }, 503)
      if (!(await verified())) return json({ ok: false, error: NEED_VERIFY }, 400)
      if (q.error) return json({ ok: false, error: q.error }, 400)
      const utr = String(b.utr || "").replace(/\s/g, "")
      if (!validUtr(utr)) return json({ ok: false, error: "Enter the 12-digit UTR / reference number from your UPI app." }, 400)
      const sub = await ensureTrial(owner, b.product)
      const code = q.coupon ? q.coupon.code : ""
      await update("subs", sub.id, { note: `upi:${plan}:${utr}:${new Date().toISOString()}|${cycle}|${code}|${q.amount}` })
      await notify(`💳 UPI payment to check: ${me.name} <${owner}> · ${PRODUCTS[b.product].name} ${p.name} ${cycle} ${rupees(q.amount)}${code ? ` (coupon ${code})` : ""} · UTR ${utr}. Activate it in xredible.in/dashboard → Customers.`)
      return json({ ok: true })
    }

    if (!razorpayConfigured()) return json({ ok: false, error: "Card payments aren't switched on yet. Use UPI for now." }, 503)
    if (op === "subscribe") {
      if (!isProduct(b.product) || !PRODUCTS[b.product].live) return json({ ok: false, error: "That product isn't available yet." }, 400)
      const plan = String(b.plan) as PlanKey
      if (!planOf(b.product, plan)) return json({ ok: false, error: "Pick a plan." }, 400)
      if (!(await verified())) return json({ ok: false, error: NEED_VERIFY }, 400)
      if (cleanCode(b.coupon)) return json({ ok: false, error: "Coupon codes work with UPI payments for now." }, 400)
      const sub = await ensureTrial(owner, b.product)
      if (sub.status === "active" && sub.plan === plan && sub.cycle === cycle && sub.rzpSubId) return json({ ok: false, error: "You're already on this plan." }, 400)
      const r = await createSubscription(b.product, plan, owner, cycle)
      await markPending(sub, r.id, `${plan}:${cycle}` as PlanKey)
      return json({ ok: true, subscriptionId: r.id, key: razorpayKeyId(), name: me.name, email: realEmail(owner) })
    }
    if (op === "confirm") {
      const pay = String(b.razorpay_payment_id || "")
      const sid = String(b.razorpay_subscription_id || "")
      if (!checkoutSignatureOk(pay, sid, String(b.razorpay_signature || ""))) return json({ ok: false, error: "We couldn't verify that payment. If money was taken, it will show up within a few minutes." }, 400)
      const mine = (await subsFor(owner)).find((x) => x.rzpSubId === sid)
      if (!mine) return json({ ok: false, error: "We couldn't match that payment. It will show up within a few minutes." }, 400)
      const [plan, cyc] = (mine.note.startsWith("checkout:") ? mine.note.slice(9) : "starter:monthly").split(":")
      const pl = (plan === "pro" ? "pro" : "starter") as PlanKey
      const cy: Cycle = cyc === "yearly" ? "yearly" : "monthly"
      await activatePlan(mine, { plan: pl, cycle: cy, method: "razorpay", ref: pay, amount: priceOf(mine.product, pl, cy), rzpSubId: sid })
      return json({ ok: true })
    }
    if (op === "cancel") {
      if (!isProduct(b.product)) return json({ ok: false, error: "Unknown product." }, 400)
      const sub = await subFor(owner, b.product)
      if (!sub?.rzpSubId || sub.status !== "active") return json({ ok: false, error: "No card subscription to cancel." }, 400)
      await cancelSubscription(sub.rzpSubId)
      await update("subs", sub.id, { note: "Cancels at the end of this period." })
      return json({ ok: true })
    }
    return json({ ok: false, error: "Unknown request." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}
