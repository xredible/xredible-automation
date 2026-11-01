// /dashboard/accounts — admins only.
// GET  → every account (never password hashes)
// POST { op: "create", email, name, password, role, businesses }
//      { op: "update", email, name?, role?, businesses?, active? }
//      { op: "reset", email, password }      new password; signs that account out everywhere
//      { op: "delete", email }
//      { op: "free", email, on }             free access: every Autopilot tool on Pro without payment

import { NextResponse } from "next/server"
import { isBusiness } from "@/lib/dashboard/businesses"
import {
  currentUser,
  deleteUser,
  hashPassword,
  listUsers,
  normEmail,
  passwordProblem,
  saveUser,
  toPublic,
  validEmail,
  type Role,
  type StoredUser,
} from "@/lib/dashboard/auth"
import { allNotices, realEmail } from "@/lib/autopilot/account"
import { rows } from "@/lib/autopilot/db"
import { setFreeAccess } from "@/lib/autopilot/free"
import { asSub } from "@/lib/autopilot/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })

async function admin() {
  const me = await currentUser()
  return me && me.role === "admin" ? me : null
}

export async function GET() {
  if (!(await admin())) return json({ ok: false, error: "Only admins can manage accounts." }, 403)
  const [{ users, error }, notes] = await Promise.all([listUsers(true), allNotices().catch(() => [])])
  if (!users) return json({ ok: false, error }, 502)
  const free = new Set(notes.filter((n) => n.kind === "free-access").map((n) => n.email))
  return json({ ok: true, users: users.map((u) => ({ ...toPublic(u), free: free.has(u.email) })).sort((a, b) => a.name.localeCompare(b.name)) })
}

export async function POST(request: Request) {
  const me = await admin()
  if (!me) return json({ ok: false, error: "Only admins can manage accounts." }, 403)
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (origin && host && new URL(origin).host !== host) return json({ ok: false, error: "Not allowed." }, 403)

  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  const op = String(b.op || "")
  const email = normEmail(b.email)
  if (!validEmail(email)) return json({ ok: false, error: "Enter a valid email." }, 400)
  const { users, error } = await listUsers(true)
  if (!users) return json({ ok: false, error }, 502)
  const existing = users.find((u) => u.email === email)
  const admins = users.filter((u) => u.role === "admin" && u.active)
  const role: Role | undefined = b.role === "admin" ? "admin" : b.role === "member" ? "member" : undefined
  const businesses = Array.isArray(b.businesses) ? (b.businesses as unknown[]).map(String).filter(isBusiness) : undefined

  if (op === "create") {
    if (existing) return json({ ok: false, error: "An account with this email already exists." }, 400)
    const name = String(b.name || "").trim().slice(0, 80)
    if (!name) return json({ ok: false, error: "Enter a name." }, 400)
    const password = String(b.password || "")
    const bad = passwordProblem(password)
    if (bad) return json({ ok: false, error: bad }, 400)
    const r = role || "member"
    if (r === "member" && !businesses?.length) return json({ ok: false, error: "Pick at least one business." }, 400)
    const u: StoredUser = { email, name, passHash: await hashPassword(password), role: r, businesses: businesses || [], active: true, sessionVersion: 1, lastLogin: null }
    const err = await saveUser(u)
    return err ? json({ ok: false, error: err }, 502) : json({ ok: true })
  }

  if (!existing) return json({ ok: false, error: "No account with this email." }, 404)
  const self = existing.email === me.email
  const lastAdmin = existing.role === "admin" && admins.length <= 1

  if (op === "update") {
    const next: StoredUser = { ...existing }
    if (typeof b.name === "string" && b.name.trim()) next.name = b.name.trim().slice(0, 80)
    if (role) next.role = role
    if (businesses) next.businesses = businesses
    // A self sign-up customer only ever sees their own automations; giving them a business makes them a member.
    if (next.role === "customer" && next.businesses.some((x) => x !== "autopilot")) {
      next.role = "member"
      if (!next.businesses.includes("autopilot")) next.businesses = [...next.businesses, "autopilot"]
    }
    if (typeof b.active === "boolean") next.active = b.active
    if ((self || lastAdmin) && (next.role !== "admin" || !next.active)) return json({ ok: false, error: self ? "You can't remove your own admin access." : "Keep at least one active admin." }, 400)
    if (next.role === "member" && !next.businesses.length) return json({ ok: false, error: "Pick at least one business." }, 400)
    // Losing access or a business signs that account out everywhere.
    const narrowed = !next.active || (existing.role === "admin" && next.role !== "admin") || existing.businesses.some((x) => !next.businesses.includes(x))
    if (narrowed) next.sessionVersion = existing.sessionVersion + 1
    const err = await saveUser(next)
    return err ? json({ ok: false, error: err }, 502) : json({ ok: true })
  }

  if (op === "reset") {
    const password = String(b.password || "")
    const bad = passwordProblem(password)
    if (bad) return json({ ok: false, error: bad }, 400)
    const err = await saveUser({ ...existing, passHash: await hashPassword(password), sessionVersion: existing.sessionVersion + 1 })
    return err ? json({ ok: false, error: err }, 502) : json({ ok: true })
  }

  if (op === "free") {
    try {
      const subs = (await rows<Record<string, unknown>>("subs")).map(asSub).filter((s) => realEmail(s.email) === email)
      await setFreeAccess(email, b.on === true, me.email, subs)
      return json({ ok: true })
    } catch (e) {
      return json({ ok: false, error: e instanceof Error ? e.message : "Could not change free access." }, 502)
    }
  }

  if (op === "delete") {
    if (self) return json({ ok: false, error: "You can't remove your own account." }, 400)
    if (lastAdmin) return json({ ok: false, error: "Keep at least one active admin." }, 400)
    const err = await deleteUser(email)
    return err ? json({ ok: false, error: err }, 502) : json({ ok: true })
  }

  return json({ ok: false, error: "Unknown request." }, 400)
}
