// POST /dashboard/billing
//   { op: "subscribe", product, plan }  → { subscriptionId, key } for Razorpay Checkout
//   { op: "confirm", razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
//   { op: "cancel", product }           → stops at the end of the paid month

import { NextResponse } from "next/server"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { isProduct, planOf, PRODUCTS, rupees, type PlanKey } from "@/lib/autopilot/products"
import { upiConfigured, validUtr } from "@/lib/autopilot/upi"
import { notify } from "@/lib/autopilot/db"
import { cancelSubscription, checkoutSignatureOk, createSubscription, razorpayConfigured, razorpayKeyId } from "@/lib/autopilot/razorpay"
import { applySubscription, ensureTrial, markPending, subFor } from "@/lib/autopilot/service"
import { update } from "@/lib/autopilot/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    if (op === "upi") {
      if (!upiConfigured()) return json({ ok: false, error: "UPI payments aren't switched on yet." }, 503)
      if (!isProduct(b.product) || !PRODUCTS[b.product].live) return json({ ok: false, error: "That product isn't available yet." }, 400)
      const plan = String(b.plan) as PlanKey
      const p = planOf(b.product, plan)
      if (!p) return json({ ok: false, error: "Pick a plan." }, 400)
      const utr = String(b.utr || "").replace(/\s/g, "")
      if (!validUtr(utr)) return json({ ok: false, error: "Enter the 12-digit UTR / reference number from your UPI app." }, 400)
      const sub = await ensureTrial(me.email, b.product)
      await update("subs", sub.id, { note: `upi:${plan}:${utr}:${new Date().toISOString()}` })
      await notify(`💳 UPI payment to check: ${me.name} <${me.email}> · ${PRODUCTS[b.product].name} ${p.name} ${rupees(p.price)} · UTR ${utr}. Activate it in xredible.in/dashboard → Customers.`)
      return json({ ok: true })
    }
    if (!razorpayConfigured()) return json({ ok: false, error: "Card payments aren't switched on yet. Use UPI for now." }, 503)
    if (op === "subscribe") {
      if (!isProduct(b.product) || !PRODUCTS[b.product].live) return json({ ok: false, error: "That product isn't available yet." }, 400)
      const plan = String(b.plan) as PlanKey
      if (!planOf(b.product, plan)) return json({ ok: false, error: "Pick a plan." }, 400)
      const sub = await ensureTrial(me.email, b.product)
      if (sub.status === "active" && sub.plan === plan) return json({ ok: false, error: "You're already on this plan." }, 400)
      const r = await createSubscription(b.product, plan, me.email)
      await markPending(sub, r.id, plan)
      return json({ ok: true, subscriptionId: r.id, key: razorpayKeyId(), name: me.name, email: me.email })
    }
    if (op === "confirm") {
      const pay = String(b.razorpay_payment_id || "")
      const sid = String(b.razorpay_subscription_id || "")
      if (!checkoutSignatureOk(pay, sid, String(b.razorpay_signature || ""))) return json({ ok: false, error: "We couldn't verify that payment. If money was taken, it will show up within a few minutes." }, 400)
      const subs = await ensureTrial(me.email, "linkedin")
      const plan = subs.note.startsWith("checkout:") ? subs.note.slice(9) : undefined
      await applySubscription({ rzpSubId: sid, email: me.email, product: subs.product, plan, status: "active", start: Math.floor(Date.now() / 1000), end: Math.floor(Date.now() / 1000) + 30 * 86400 })
      return json({ ok: true })
    }
    if (op === "cancel") {
      if (!isProduct(b.product)) return json({ ok: false, error: "Unknown product." }, 400)
      const sub = await subFor(me.email, b.product)
      if (!sub?.rzpSubId || sub.status !== "active") return json({ ok: false, error: "No active subscription to cancel." }, 400)
      await cancelSubscription(sub.rzpSubId)
      await update("subs", sub.id, { note: "Cancels at the end of this month." })
      return json({ ok: true })
    }
    return json({ ok: false, error: "Unknown request." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}
