// /dashboard/customers — admins only. Autopilot customers, their plans and UPI payments to check.
// GET  → { customers: [{ sub, name, liName, connected }] }
// POST { op: "activate", id, plan }   paid month starts now (or extends the current one)
//      { op: "reject", id }           UPI payment not found
//      { op: "stop", id }             plan off
//      { op: "trial", id }            give 3 free posts again

import { NextResponse } from "next/server"
import { currentUser, listUsers } from "@/lib/dashboard/auth"
import { rows, update } from "@/lib/autopilot/db"
import { errText, json } from "@/lib/autopilot/guard"
import { planOf, PRODUCTS, type PlanKey, type Subscription } from "@/lib/autopilot/products"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

async function admin() {
  const me = await currentUser()
  return me?.role === "admin" ? me : null
}

export async function GET() {
  if (!(await admin())) return json({ ok: false, error: "Admins only." }, 403)
  try {
    const [subs, { users }, profiles] = await Promise.all([rows<Subscription>("subs"), listUsers(true), rows<Record<string, unknown>>("li_profiles")])
    const name = new Map((users || []).map((u) => [u.email, u.name]))
    const prof = new Map(profiles.map((p) => [String(p.email), p]))
    const customers = subs
      .map((s) => ({ sub: s, name: name.get(s.email) || "", liName: String(prof.get(s.email)?.liName || ""), connected: prof.get(s.email)?.connected === true }))
      .sort((a, b) => Number(b.sub.note.startsWith("upi:")) - Number(a.sub.note.startsWith("upi:")) || b.sub.id - a.sub.id)
    return json({ ok: true, customers })
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
    const id = Number(b.id)
    const s = (await rows<Subscription>("subs", { col: "id", val: id }))[0]
    if (!s) return json({ ok: false, error: "Not found." }, 404)
    const op = String(b.op || "")
    if (op === "activate") {
      const plan = String(b.plan || "") as PlanKey
      const p = planOf(s.product, plan)
      if (!p) return json({ ok: false, error: "Pick a plan." }, 400)
      const now = Date.now()
      const stillPaid = s.status === "active" && s.periodEnd && Date.parse(s.periodEnd) > now
      const start = stillPaid ? Date.parse(s.periodEnd as string) : now
      await update("subs", s.id, {
        status: "active",
        plan,
        postLimit: p.posts,
        used: stillPaid ? s.used : 0,
        periodStart: new Date(stillPaid ? Date.parse(s.periodStart || "") || now : now).toISOString(),
        periodEnd: new Date(start + 30 * 864e5).toISOString(),
        note: "",
      })
      return json({ ok: true })
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
      await update("subs", s.id, { status: "trial", plan: "trial", used: 0, postLimit: PRODUCTS[s.product]?.trial ?? 3, note: "" })
      return json({ ok: true })
    }
    return json({ ok: false, error: "Unknown request." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}
