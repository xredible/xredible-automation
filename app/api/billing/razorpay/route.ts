// POST /api/billing/razorpay — Razorpay webhook (Settings → Webhooks). Verified with RAZORPAY_WEBHOOK_SECRET.
// Events: subscription.activated, subscription.charged, subscription.halted, subscription.cancelled, payment.failed

import { NextResponse } from "next/server"
import { webhookSignatureOk } from "@/lib/autopilot/razorpay"
import { applySubscription } from "@/lib/autopilot/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

type SubEntity = { id: string; current_start?: number; current_end?: number; notes?: Record<string, string> }

export async function POST(request: Request) {
  const raw = await request.text()
  if (!webhookSignatureOk(raw, request.headers.get("x-razorpay-signature") || "")) return NextResponse.json({ ok: false }, { status: 401 })
  let ev: { event?: string; payload?: { subscription?: { entity?: SubEntity } } } = {}
  try {
    ev = JSON.parse(raw)
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const s = ev.payload?.subscription?.entity
  const map: Record<string, "active" | "halted" | "cancelled"> = {
    "subscription.activated": "active",
    "subscription.charged": "active",
    "subscription.resumed": "active",
    "subscription.halted": "halted",
    "subscription.cancelled": "cancelled",
    "subscription.completed": "cancelled",
  }
  const status = map[ev.event || ""]
  if (s?.id && status) {
    try {
      await applySubscription({
        rzpSubId: s.id,
        email: s.notes?.email,
        product: s.notes?.product,
        plan: s.notes?.plan,
        status,
        start: s.current_start,
        end: s.current_end,
        charged: ev.event === "subscription.charged",
      })
    } catch {
      // Ask Razorpay to retry later.
      return NextResponse.json({ ok: false }, { status: 503 })
    }
  }
  return NextResponse.json({ ok: true })
}
