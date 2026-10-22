"use server"

import { timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { BUSINESS_KEYS } from "@/lib/dashboard/businesses"
import { gatewaySecret } from "@/lib/dashboard/gateway"
import {
  COOKIE,
  clearFailures,
  cookieOptions,
  currentUser,
  findUser,
  hashPassword,
  isConfigured,
  listUsers,
  normEmail,
  noteFailure,
  passwordProblem,
  saveUser,
  sessionValue,
  throttled,
  validEmail,
  verifyPassword,
  type StoredUser,
} from "@/lib/dashboard/auth"

export type FormState = { error: string | null; ok?: string | null }

const slow = () => new Promise((r) => setTimeout(r, 900))

async function startSession(u: StoredUser) {
  const value = sessionValue(u)
  if (!value) throw new Error("XD_N8N_SECRET is not set on Vercel.")
  const jar = await cookies()
  jar.set(COOKIE, value, cookieOptions)
}

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isConfigured()) return { error: "The dashboard isn't connected to n8n yet (XD_N8N_SECRET is missing on Vercel)." }
  const email = normEmail(formData.get("email"))
  const password = String(formData.get("password") ?? "")
  if (!validEmail(email) || !password) return { error: "Enter your email and password." }
  if (throttled(email)) return { error: "Too many wrong tries. Wait 15 minutes, or ask your admin to reset your password." }
  const { users, error } = await listUsers(true)
  if (!users) return { error: error || "Could not reach the account list. Try again in a minute." }
  const u = users.find((x) => x.email === email)
  const ok = u && u.active && u.passHash ? await verifyPassword(password, u.passHash) : false
  if (!u || !ok) {
    noteFailure(email)
    await slow()
    return { error: u && !u.active ? "This account has been switched off. Ask your admin." : "That email and password don't match." }
  }
  clearFailures(email)
  await saveUser({ ...u, lastLogin: new Date().toISOString() })
  await startSession(u)
  redirect("/dashboard")
}

export async function signOut() {
  const jar = await cookies()
  jar.delete({ name: COOKIE, path: "/dashboard" })
  redirect("/dashboard")
}

/** Signs this account out on every device (bumps its session version). */
export async function signOutEverywhere() {
  const u = await currentUser()
  if (u) await saveUser({ ...u, sessionVersion: u.sessionVersion + 1 })
  await signOut()
}

/** First run only: creates the first admin. Needs the setup key (the XD_N8N_SECRET value). */
export async function setupFirstAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  const secret = gatewaySecret()
  if (!secret) return { error: "XD_N8N_SECRET is missing on Vercel." }
  const { users, error } = await listUsers(true)
  if (!users) return { error: error || "Could not reach the account list." }
  if (users.length) return { error: "The first account already exists. Sign in instead." }
  const keyIn = Buffer.from(String(formData.get("setupKey") ?? "").trim())
  const keyWant = Buffer.from(secret)
  if (keyIn.length !== keyWant.length || !timingSafeEqual(keyIn, keyWant)) {
    await slow()
    return { error: "That setup key isn't right. It's the same value you saved as XD_N8N_SECRET." }
  }
  const name = String(formData.get("name") ?? "").trim().slice(0, 80)
  const email = normEmail(formData.get("email"))
  const password = String(formData.get("password") ?? "")
  if (!name) return { error: "Enter your name." }
  if (!validEmail(email)) return { error: "Enter a valid email." }
  const bad = passwordProblem(password)
  if (bad) return { error: bad }
  const u: StoredUser = { email, name, passHash: await hashPassword(password), role: "admin", businesses: [...BUSINESS_KEYS], active: true, sessionVersion: 1, lastLogin: new Date().toISOString() }
  const err = await saveUser(u)
  if (err) return { error: err }
  await startSession(u)
  redirect("/dashboard")
}

export async function changeMyPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await currentUser()
  if (!me) return { error: "You're signed out. Reload the page." }
  const current = String(formData.get("current") ?? "")
  const next = String(formData.get("next") ?? "")
  const fresh = await findUser(me.email, true)
  if (!fresh || !(await verifyPassword(current, fresh.passHash))) {
    await slow()
    return { error: "Your current password isn't right." }
  }
  const bad = passwordProblem(next)
  if (bad) return { error: bad }
  const u = { ...fresh, passHash: await hashPassword(next), sessionVersion: fresh.sessionVersion + 1 }
  const err = await saveUser(u)
  if (err) return { error: err }
  // Other devices are signed out; this one gets a new session.
  await startSession(u)
  return { error: null, ok: "Password changed. Other devices have been signed out." }
}
