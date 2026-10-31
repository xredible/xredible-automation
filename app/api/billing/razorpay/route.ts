// POST /api/billing/razorpay — Razorpay webhook (Settings → Webhooks). Verified with RAZORPAY_WEBHOOK_SECRET.
// Events: subscription.charged (a payment: activate / renew and record it), subscription.halted,
// subscription.cancelled, subscription.completed (plan off). Other events are acknowledged and ignored.

import { NextResponse } from "next/server"
import { webhookSignatureOk } from "@/lib/autopilot/razorpay"
import { applySubscription } from "@/lib/autopilot/service"
import { activatePlan } from "@/lib/autopilot/billing"
import { rows } from "@/lib/autopilot/db"
import { asSub, subFor } from "@/lib/autopilot/service"
import { isProduct, type Cycle, type PlanKey } from "@/lib/autopilot/products"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

type SubEntity = { id: string; current_start?: number; current_end?: number; notes?: Record<string, string> }
type PayEntity = { id: string; amount?: number }

export async function POST(request: Request) {
  const raw = await request.text()
  if (!webhookSignatureOk(raw, request.headers.get("x-razorpay-signature") || "")) return NextResponse.json({ ok: false }, { status: 401 })
  let ev: { event?: string; payload?: { subscription?: { entity?: SubEntity }; payment?: { entity?: PayEntity } } } = {}
  try {
    ev = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const s = ev.payload?.subscription?.entity
  if (!s?.id) return NextResponse.json({ ok: true })
  try {
    if (ev.event === "subscription.charged") {
      const pay = ev.payload?.payment?.entity
      // Matched by subscription id; a renewal of a card plan whose change was never paid for
      // (checkout closed) is matched by the customer and tool it was made for.
      const sub =
        (await rows<Record<string, unknown>>("subs", { col: "rzpSubId", val: s.id })).map(asSub)[0] ||
        (s.notes?.email && isProduct(s.notes.product) ? await subFor(s.notes.email, s.notes.product) : null)
      if (sub && pay?.id) {
        const plan = (s.notes?.plan === "pro" ? "pro" : "starter") as PlanKey
        const cycle = (s.notes?.cycle === "yearly" ? "yearly" : "monthly") as Cycle
        await activatePlan(sub, { plan, cycle, method: "razorpay", ref: pay.id, amount: Number(pay.amount) || 0, start: s.current_start, end: s.current_end, rzpSubId: s.id, extra: Number(s.notes?.extra) || 0 })
      }
    } else {
      const map: Record<string, "halted" | "cancelled"> = { "subscription.halted": "halted", "subscription.cancelled": "cancelled", "subscription.completed": "cancelled" }
      const status = map[ev.event || ""]
      if (status) await applySubscription({ rzpSubId: s.id, email: s.notes?.email, product: s.notes?.product, plan: s.notes?.plan, extra: Number(s.notes?.extra) || 0, status })
    }
  } catch {
    // Ask Razorpay to retry later.
    return NextResponse.json({ ok: false }, { status: 503 })
  }
  return NextResponse.json({ ok: true })
}
