// lib/autopilot/razorpay.ts
//
// Server-only. Monthly subscriptions through Razorpay.
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET   Razorpay → Settings → API Keys (test keys work before KYC)
//   RAZORPAY_WEBHOOK_SECRET                the secret typed in Razorpay → Settings → Webhooks
// Plans are created in Razorpay automatically the first time someone subscribes,
// tagged with notes.xd = "<product>-<plan>", and reused after that.

import { createHmac, timingSafeEqual } from "node:crypto"
import { PRODUCTS, planOf, priceOf, limitOf, type Cycle, type PlanKey, type ProductKey } from "./products"

const API = "https://api.razorpay.com/v1"

export const razorpayConfigured = () => Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
export const razorpayKeyId = () => process.env.RAZORPAY_KEY_ID || ""

async function rp<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const auth = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")
  const res = await fetch(API + path, {
    method: init?.method || "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  })
  const j = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } }
  if (!res.ok) throw new Error(j.error?.description || `Razorpay answered with HTTP ${res.status}.`)
  return j
}

type RpPlan = { id: string; notes?: Record<string, string> }
const planIds = new Map<string, string>()

async function planId(product: ProductKey, plan: PlanKey, cycle: Cycle = "monthly"): Promise<string> {
  const tag = cycle === "yearly" ? `${product}-${plan}-yearly` : `${product}-${plan}`
  const known = planIds.get(tag)
  if (known) return known
  const list = await rp<{ items: RpPlan[] }>("/plans?count=100")
  const found = list.items.find((p) => p.notes?.xd === tag)
  if (found) {
    planIds.set(tag, found.id)
    return found.id
  }
  const p = planOf(product, plan)
  if (!p) throw new Error("Unknown plan.")
  const made = await rp<RpPlan>("/plans", {
    method: "POST",
    body: {
      period: cycle === "yearly" ? "yearly" : "monthly",
      interval: 1,
      item: {
        name: `${PRODUCTS[product].name} ${p.name}${cycle === "yearly" ? " (yearly)" : ""}`,
        amount: priceOf(product, plan, cycle),
        currency: "INR",
        description: cycle === "yearly" ? `${limitOf(product, plan, cycle)} ${PRODUCTS[product].unit} a year` : `${p.posts} ${PRODUCTS[product].unit} a month`,
      },
      notes: { xd: tag },
    },
  })
  planIds.set(tag, made.id)
  return made.id
}

export async function createSubscription(product: ProductKey, plan: PlanKey, email: string, cycle: Cycle = "monthly"): Promise<{ id: string; shortUrl: string }> {
  const s = await rp<{ id: string; short_url: string }>("/subscriptions", {
    method: "POST",
    body: { plan_id: await planId(product, plan, cycle), total_count: cycle === "yearly" ? 10 : 120, quantity: 1, customer_notify: 1, notes: { email, product, plan, cycle } },
  })
  return { id: s.id, shortUrl: s.short_url }
}

export async function cancelSubscription(id: string): Promise<void> {
  await rp(`/subscriptions/${id}/cancel`, { method: "POST", body: { cancel_at_cycle_end: 1 } })
}

const hmac = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest("hex")
const same = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** Checkout success: signature = HMAC(payment_id + "|" + subscription_id, key secret). */
export function checkoutSignatureOk(paymentId: string, subscriptionId: string, signature: string): boolean {
  return same(hmac(`${paymentId}|${subscriptionId}`, process.env.RAZORPAY_KEY_SECRET || ""), signature)
}

export function webhookSignatureOk(raw: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || ""
  return !!secret && !!signature && same(hmac(raw, secret), signature)
}
