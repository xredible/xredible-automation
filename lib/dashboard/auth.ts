// lib/dashboard/auth.ts
//
// Server-only. Email + password accounts for xredible.in/dashboard.
//
// Accounts live in the n8n data table "XD Dashboard Users" (read and written
// through the gateway). Passwords are stored only as scrypt hashes, made here.
// A signed-in device holds an httpOnly cookie "<payload>.<HMAC>"; the HMAC key
// is derived from XD_N8N_SECRET. Each account has a session version: changing the
// password, removing access or "Sign out everywhere" bumps it, which signs out
// every device that account used.

import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import { cookies } from "next/headers"
import { BUSINESS_KEYS, isBusiness, type BusinessKey } from "./businesses"
import { gateway, gatewaySecret } from "./gateway"

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: { N: number; r: number; p: number }) => Promise<Buffer>

export const COOKIE = "xd_dash"
const SESSION_DAYS = 60

/** admin: every business + accounts. member: chosen businesses. customer: self-signed-up Autopilot customer. */
export type Role = "admin" | "member" | "customer"

export type StoredUser = {
  email: string
  name: string
  passHash: string
  role: Role
  businesses: string[]
  active: boolean
  sessionVersion: number
  lastLogin: string | null
}

/** What the browser may see about an account (never the hash). */
export type PublicUser = { email: string; name: string; role: Role; businesses: BusinessKey[]; active: boolean; lastLogin: string | null }

export const toPublic = (u: StoredUser): PublicUser => ({
  email: u.email,
  name: u.name,
  role: u.role,
  businesses: u.role === "admin" ? [...BUSINESS_KEYS, "autopilot"] : u.role === "customer" ? ["autopilot"] : memberBusinesses(u.businesses),
  active: u.active,
  lastLogin: u.lastLogin,
})

/** A member's businesses; one with none gets their own automations instead of an empty dashboard. */
function memberBusinesses(list: string[]): BusinessKey[] {
  const b = list.filter((x): x is BusinessKey => isBusiness(x) && x !== "autopilot")
  return b.length ? b : ["autopilot"]
}

export const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase().slice(0, 190)
export const validEmail = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)

// ---------- password hashing ----------

const N = 16384

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 32, { N, r: 8, p: 1 })
  return `scrypt$${N}$${salt.toString("base64url")}$${key.toString("base64url")}`
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [kind, n, s, k] = String(stored || "").split("$")
  if (kind !== "scrypt" || !s || !k) return false
  const want = Buffer.from(k, "base64url")
  const got = await scrypt(pw, Buffer.from(s, "base64url"), want.length, { N: Number(n) || N, r: 8, p: 1 })
  return got.length === want.length && timingSafeEqual(got, want)
}

/** Rules shown next to every password box. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use at least 10 characters."
  if (pw.length > 200) return "That password is too long."
  return null
}

// ---------- the account list (cached briefly) ----------

let cache: { at: number; users: StoredUser[] } | null = null

export async function listUsers(fresh = false): Promise<{ users: StoredUser[] | null; error: string | null }> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return { users: cache.users, error: null }
  const r = await gateway({ kind: "users", op: "list" }, 20_000)
  const body = r.body as { ok?: boolean; users?: StoredUser[]; error?: string } | null
  if (r.status !== 200 || !body?.ok || !Array.isArray(body.users)) return { users: null, error: body?.error || "Could not load accounts." }
  const users = body.users.map((u) => ({ ...u, email: normEmail(u.email), role: (u.role === "admin" || u.role === "customer" ? u.role : "member") as Role }))
  cache = { at: Date.now(), users }
  return { users, error: null }
}

export async function saveUser(u: StoredUser): Promise<string | null> {
  const r = await gateway({ kind: "users", op: "save", user: u }, 20_000)
  cache = null
  const body = r.body as { ok?: boolean; error?: string } | null
  return r.status === 200 && body?.ok ? null : body?.error || "Could not save the account."
}

export async function deleteUser(email: string): Promise<string | null> {
  const r = await gateway({ kind: "users", op: "delete", email }, 20_000)
  cache = null
  const body = r.body as { ok?: boolean; error?: string } | null
  return r.status === 200 && body?.ok ? null : body?.error || "Could not remove the account."
}

export async function findUser(email: string, fresh = false): Promise<StoredUser | null> {
  const { users } = await listUsers(fresh)
  return users?.find((u) => u.email === normEmail(email)) ?? null
}

// ---------- sessions ----------

function key(): string | null {
  const s = gatewaySecret()
  return s ? createHmac("sha256", s).update("xd-dashboard-session-v1").digest("base64url") : null
}

const sign = (payload: string, k: string) => createHmac("sha256", k).update(payload).digest("base64url")

export function sessionValue(u: StoredUser): string | null {
  const k = key()
  if (!k) return null
  const payload = Buffer.from(JSON.stringify({ e: u.email, v: u.sessionVersion, x: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url")
  return `${payload}.${sign(payload, k)}`
}

export const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/dashboard", maxAge: SESSION_DAYS * 86400 }

function readSession(value: string | undefined): { e: string; v: number } | null {
  const k = key()
  if (!k || !value) return null
  const [payload, mac] = value.split(".")
  if (!payload || !mac) return null
  const want = Buffer.from(sign(payload, k))
  const got = Buffer.from(mac)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString()) as { e?: string; v?: number; x?: number }
    if (!p.e || !p.x || p.x < Date.now()) return null
    return { e: p.e, v: Number(p.v) || 1 }
  } catch {
    return null
  }
}

/** The signed-in account for this request, or null. */
export async function currentUser(): Promise<StoredUser | null> {
  const jar = await cookies()
  const s = readSession(jar.get(COOKIE)?.value)
  if (!s) return null
  const u = await findUser(s.e)
  if (!u || !u.active || u.sessionVersion !== s.v) return null
  return u
}

/** The businesses the signed-in account may see; empty when signed out. */
export async function access(): Promise<BusinessKey[]> {
  const u = await currentUser()
  return u ? toPublic(u).businesses : []
}

export async function canSee(b: BusinessKey): Promise<boolean> {
  return (await access()).includes(b)
}

export const isConfigured = () => Boolean(gatewaySecret())

// ---------- failed sign-in throttle (per server instance) ----------

const fails = new Map<string, { n: number; until: number }>()

export function throttled(email: string): boolean {
  const f = fails.get(email)
  return !!f && f.until > Date.now()
}

export function noteFailure(email: string) {
  const f = fails.get(email) || { n: 0, until: 0 }
  f.n += 1
  if (f.n >= 5) f.until = Date.now() + Math.min(15, f.n - 4) * 60_000
  fails.set(email, f)
}

export const clearFailures = (email: string) => fails.delete(email)
