// lib/autopilot/free.ts
//
// Server-only. "Free access": an admin can let someone use every Autopilot tool on the Pro plan
// without paying (Accounts → Edit → Free access). The person carries a "free-access" notice; each
// of their tool subscriptions is set to Pro with FREE_NOTE and a 30-day period that renews by
// itself (on page loads and in the hourly cron), so the Pro post limit resets every month.
// Free subscriptions never count as revenue and never get renewal or "plan ended" emails.

import { addNotice, noticesFor, realEmail, removeNotice } from "./account"
import { update } from "./db"
import { cancelSubscription, razorpayConfigured } from "./razorpay"
import { FREE_NOTE, isFree, limitOf, type Subscription } from "./products"

const MONTH = 30 * 864e5
const iso = (t: number) => new Date(t).toISOString()

export async function hasFreeAccess(email: string): Promise<boolean> {
  return (await noticesFor(realEmail(email))).some((n) => n.kind === "free-access")
}

/** Puts one subscription on free Pro, or starts its next free month once the current one is over. */
export async function makeFree(s: Subscription): Promise<Subscription> {
  const now = Date.now()
  if (isFree(s) && s.status === "active" && s.periodEnd && Date.parse(s.periodEnd) > now) return s
  // A card plan would keep charging: stop it and forget its id so Razorpay updates can't touch this row.
  if (s.rzpSubId && s.status === "active" && razorpayConfigured()) await cancelSubscription(s.rzpSubId).catch(() => {})
  const patch = {
    plan: "pro" as const,
    cycle: "monthly" as const,
    status: "active" as const,
    postLimit: limitOf(s.product, "pro", "monthly"),
    used: 0,
    periodStart: iso(now),
    periodEnd: iso(now + MONTH),
    rzpSubId: "",
    note: FREE_NOTE,
  }
  await update("subs", s.id, patch)
  return { ...s, ...patch }
}

/** Switches free access on or off for a person (all their brands). `subs` = every subscription of theirs. */
export async function setFreeAccess(email: string, on: boolean, by: string, subs: Subscription[]) {
  const me = realEmail(email)
  const notes = (await noticesFor(me)).filter((n) => n.kind === "free-access")
  if (on) {
    if (!notes.length) await addNotice(me, "free-access", "pro", `by ${by}`)
    for (const s of subs) await makeFree(s)
    return
  }
  for (const n of notes) await removeNotice(n.id)
  // Back to normal: the tool shows the plans to choose from.
  for (const s of subs.filter(isFree)) await update("subs", s.id, { status: "cancelled", note: "", periodEnd: iso(Date.now()) })
}
