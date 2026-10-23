"use server"

import { timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { BUSINESS_KEYS } from "@/lib/dashboard/businesses"
import { gatewaySecret } from "@/lib/dashboard/gateway"
import { addNotice, EMAILS, makeToken, noticesFor, readToken, removeNotice, send, verifyUrl } from "@/lib/autopilot/account"

const LOCK_AFTER = 8
const LOCK_MINUTES = 15
import { noteReferral } from "@/lib/autopilot/billing"
import { SITE } from "@/lib/autopilot/linkedin"
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
  // A lasting lock for real accounts (the in-memory one above resets whenever Vercel starts a new server).
  const fails = u ? (await noticesFor(email).catch(() => [])).filter((n) => n.kind === "loginfail") : []
  const recent = fails.filter((n) => n.at && Date.parse(n.at) > Date.now() - LOCK_MINUTES * 60_000)
  if (recent.length >= LOCK_AFTER) {
    await slow()
    return { error: "Too many wrong tries. Wait 15 minutes, or use Forgot password to set a new one." }
  }
  const pwOk = u?.passHash ? await verifyPassword(password, u.passHash) : false
  if (!u || !pwOk || !u.active) {
    noteFailure(email)
    if (u && !pwOk) await addNotice(email, "loginfail").catch(() => {})
    await slow()
    // Only say an account is switched off to someone who knows its password.
    return { error: u && pwOk && !u.active ? "This account has been switched off. Ask your admin." : "That email and password don't match." }
  }
  clearFailures(email)
  for (const n of fails) await removeNotice(n.id).catch(() => {})
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

/** Self sign-up for Autopilot customers (role "customer": no business dashboards, only their own automations). */
export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!isConfigured()) return { error: "Sign-up isn't open yet." }
  if (String(formData.get("website") ?? "")) return { error: "Please try again." } // bots fill the hidden field
  const name = String(formData.get("name") ?? "").trim().slice(0, 80)
  const email = normEmail(formData.get("email"))
  const password = String(formData.get("password") ?? "")
  if (!name) return { error: "Enter your name." }
  if (!validEmail(email)) return { error: "Enter a valid email." }
  const bad = passwordProblem(password)
  if (bad) return { error: bad }
  if (formData.get("terms") !== "on") return { error: "Please accept the Terms and Privacy Policy." }
  const { users, error } = await listUsers(true)
  if (!users) return { error: error || "Sign-up is busy. Try again in a minute." }
  if (users.some((u) => u.email === email)) {
    await slow()
    return { error: "An account with this email already exists. Sign in instead." }
  }
  const u: StoredUser = { email, name, passHash: await hashPassword(password), role: "customer", businesses: [], active: true, sessionVersion: 1, lastLogin: new Date().toISOString() }
  const err = await saveUser(u)
  if (err) return { error: err }
  await startSession(u)
  await Promise.all([send(email, EMAILS.welcome(name, verifyUrl(email))), noteReferral(email, String(formData.get("ref") ?? ""))]).catch(() => {})
  redirect("/dashboard?biz=autopilot")
}

// ---------- forgot password ----------

const resets = new Map<string, number>()

/** Emails a reset link. Always answers the same, so nobody can test which emails have accounts. */
export async function requestReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normEmail(formData.get("email"))
  const done: FormState = { error: null, ok: "If that email has an account, a reset link is on its way. Check your inbox (and spam) in a minute." }
  if (!validEmail(email)) return { error: "Enter your email." }
  const last = resets.get(email) || 0
  if (Date.now() - last < 120_000) return done
  resets.set(email, Date.now())
  const u = await findUser(email, true)
  if (u && u.active) {
    const t = makeToken("reset", email, 1, u.passHash.slice(-16))
    await send(email, EMAILS.reset(u.name, `${SITE}/dashboard/reset?t=${encodeURIComponent(t)}`))
  } else await slow()
  return done
}

/** Sets a new password from an emailed link (the link stops working once the password changes). */
export async function resetPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const token = String(formData.get("t") ?? "")
  const next = String(formData.get("password") ?? "")
  const email = await readToken("reset", token, async (e) => (await findUser(e, true))?.passHash.slice(-16) || "none")
  if (!email) return { error: "This link has expired or was already used. Ask for a new one from the sign-in page." }
  const bad = passwordProblem(next)
  if (bad) return { error: bad }
  const fresh = await findUser(email, true)
  if (!fresh || !fresh.active) return { error: "This account isn't active." }
  const u = { ...fresh, passHash: await hashPassword(next), sessionVersion: fresh.sessionVersion + 1, lastLogin: new Date().toISOString() }
  const err = await saveUser(u)
  if (err) return { error: err }
  clearFailures(email)
  for (const n of (await noticesFor(email).catch(() => [])).filter((x) => x.kind === "loginfail")) await removeNotice(n.id).catch(() => {})
  await startSession(u)
  redirect("/dashboard")
}

/** Changes the signed-in person's display name. */
export async function changeMyName(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await currentUser()
  if (!me) return { error: "You're signed out. Reload the page." }
  const name = String(formData.get("name") ?? "").trim().slice(0, 80)
  if (!name) return { error: "Enter your name." }
  const fresh = await findUser(me.email, true)
  if (!fresh) return { error: "Account not found." }
  const err = await saveUser({ ...fresh, name })
  return err ? { error: err } : { error: null, ok: "Saved." }
}
