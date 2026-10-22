// /dashboard/admin — admins only. Data and actions for the Admin section of the dashboard.
// GET ?section=revenue | people | person&email= | payments | health | announcements
// POST { op: "view-as", key } | { op: "view-as-stop" } | { op: "verify", email } | { op: "reset-link", email }
//      { op: "active", email, active } | { op: "set-used", subId, used } | { op: "extend", subId, days }
//      { op: "announce", title, message, until?, audience, email } | { op: "announce-delete", id }
// (Activate / reject UPI, stop, reset trial and coupons stay on /dashboard/customers.)

import { currentUser, findUser, saveUser } from "@/lib/dashboard/auth"
import { errText, json } from "@/lib/autopilot/guard"
import { announcements, createAnnouncement, health, loadAll, people, person, revenueStats } from "@/lib/autopilot/admin"
import { addNotice, EMAILS, isVerified, makeToken, noticesFor, removeNotice, send } from "@/lib/autopilot/account"
import { startViewAs, stopViewAs } from "@/lib/autopilot/brands"
import { subById } from "@/lib/autopilot/billing"
import { update } from "@/lib/autopilot/db"
import { SITE } from "@/lib/autopilot/linkedin"
import { PRODUCTS, rupees } from "@/lib/autopilot/products"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

async function admin() {
  const me = await currentUser()
  return me?.role === "admin" ? me : null
}

export async function GET(request: Request) {
  if (!(await admin())) return json({ ok: false, error: "Admins only." }, 403)
  const q = new URL(request.url).searchParams
  const section = q.get("section") || "revenue"
  try {
    if (section === "announcements") return json({ ok: true, announcements: await announcements() })
    const all = await loadAll()
    if (section === "revenue") return json({ ok: true, stats: revenueStats(all.subs, all.payments) })
    if (section === "people") return json({ ok: true, people: people(all) })
    if (section === "person") {
      const p = person(all, String(q.get("email") || "").toLowerCase())
      return p ? json({ ok: true, person: p }) : json({ ok: false, error: "Not found." }, 404)
    }
    if (section === "payments")
      return json({
        ok: true,
        payments: all.payments.sort((a, b) => b.id - a.id).map((p) => ({ ...p, amountText: rupees(p.amount), productName: PRODUCTS[p.product].name, name: all.users.find((u) => u.email === p.email.split("::")[0])?.name || "" })),
        pending: all.subs.filter((s) => /^upi:/.test(s.note)).map((s) => ({ id: s.id, email: s.email, product: PRODUCTS[s.product].name, note: s.note, name: all.users.find((u) => u.email === s.email.split("::")[0])?.name || "" })),
      })
    if (section === "health") return json({ ok: true, ...(await health(all)) })
    return json({ ok: false, error: "Unknown section." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}

export async function POST(request: Request) {
  const me = await admin()
  if (!me) return json({ ok: false, error: "Admins only." }, 403)
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (origin && host && new URL(origin).host !== host) return json({ ok: false, error: "Not allowed." }, 403)
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    const email = String(b.email || "").toLowerCase()
    if (op === "view-as") {
      const key = String(b.key || "").toLowerCase()
      if (!(await findUser(key.split("::")[0]))) return json({ ok: false, error: "Customer not found." }, 404)
      await startViewAs(me.email, key)
      return json({ ok: true })
    }
    if (op === "view-as-stop") {
      await stopViewAs()
      return json({ ok: true })
    }
    if (op === "verify") {
      if (!isVerified(await noticesFor(email))) await addNotice(email, "verified", "", `by admin ${me.email}`)
      return json({ ok: true })
    }
    if (op === "reset-link") {
      const u = await findUser(email, true)
      if (!u) return json({ ok: false, error: "Not found." }, 404)
      const t = makeToken("reset", email, 24, u.passHash.slice(-16))
      const ok = await send(email, EMAILS.reset(u.name, `${SITE}/dashboard/reset?t=${encodeURIComponent(t)}`))
      return ok ? json({ ok: true }) : json({ ok: false, error: "The email didn't send (is XD_SMTP_PASS set?)." }, 502)
    }
    if (op === "active") {
      const u = await findUser(email, true)
      if (!u || u.role === "admin") return json({ ok: false, error: "Not allowed for this account." }, 400)
      const err = await saveUser({ ...u, active: b.active === true, sessionVersion: u.sessionVersion + (b.active === true ? 0 : 1) })
      return err ? json({ ok: false, error: err }, 502) : json({ ok: true })
    }
    if (op === "set-used" || op === "extend") {
      const s = await subById(Number(b.subId))
      if (!s) return json({ ok: false, error: "Not found." }, 404)
      if (op === "set-used") await update("subs", s.id, { used: Math.max(0, Math.round(Number(b.used) || 0)) })
      else {
        const days = Math.max(1, Math.min(366, Math.round(Number(b.days) || 0)))
        const from = s.periodEnd && Date.parse(s.periodEnd) > Date.now() ? Date.parse(s.periodEnd) : Date.now()
        await update("subs", s.id, { periodEnd: new Date(from + days * 864e5).toISOString(), ...(s.status !== "active" && s.plan !== "trial" ? { status: "active" } : {}) })
      }
      return json({ ok: true })
    }
    if (op === "announce") {
      const emailed = await createAnnouncement(b, await loadAll())
      return json({ ok: true, emailed, announcements: await announcements() })
    }
    if (op === "announce-delete") {
      await removeNotice(Number(b.id))
      return json({ ok: true, announcements: await announcements() })
    }
    return json({ ok: false, error: "Unknown request." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}

