// /dashboard/me/linkedin — the signed-in customer's LinkedIn Autopilot.
// GET  → { profile, sub, posts, ready }
// POST { op: "profile", ...fields } | { op: "approve"|"unapprove"|"reject"|"edit"|"reschedule", id, … }
//      { op: "generate" } | { op: "disconnect" }

import { NextResponse } from "next/server"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { disconnectLinkedIn, ensureTrial, postAction, postsFor, profileFor, saveProfile, viewProfile } from "@/lib/autopilot/service"
import { requestDrafts } from "@/lib/autopilot/db"
import { linkedinConfigured } from "@/lib/autopilot/linkedin"
import { razorpayConfigured, razorpayKeyId } from "@/lib/autopilot/razorpay"
import { tokenKeySet } from "@/lib/autopilot/crypto"
import { PRODUCTS } from "@/lib/autopilot/products"
import { upiConfigured, upiId, upiLink, upiQr } from "@/lib/autopilot/upi"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

async function upiOptions(email: string) {
  if (!upiConfigured()) return null
  const plans = await Promise.all(
    PRODUCTS.linkedin.plans.map(async (p) => {
      const link = upiLink(p.price, `LinkedIn Autopilot ${p.name} ${email}`)
      return { key: p.key, link, qr: await upiQr(link) }
    }),
  )
  return { id: upiId(), plans }
}

async function state(email: string) {
  const [sub, profile, posts, upi] = await Promise.all([ensureTrial(email, "linkedin"), profileFor(email), postsFor(email), upiOptions(email)])
  return {
    ok: true,
    sub,
    profile: viewProfile(profile),
    posts: posts.filter((p) => p.status !== "rejected"),
    ready: { linkedin: linkedinConfigured() && tokenKeySet(), payments: razorpayConfigured(), razorpayKey: razorpayKeyId(), upi },
  }
}

export async function GET(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  try {
    return json(await state(me.email))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}

export async function POST(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    if (op === "profile") {
      const before = await profileFor(me.email)
      const saved = await saveProfile(me.email, b)
      // First time the profile is filled in and LinkedIn is already connected: write the first drafts.
      const posts = await postsFor(me.email)
      if (!before?.about && saved.about && saved.connected && !posts.some((p) => p.status === "draft" || p.status === "approved")) await requestDrafts(me.email, 3).catch(() => {})
    } else if (op === "generate") {
      const prof = await profileFor(me.email)
      if (!prof || !prof.about) return json({ ok: false, error: "Fill in 'About you' first so the drafts sound like you." }, 400)
      await requestDrafts(me.email, Math.min(5, Math.max(1, Number(b.count) || 3)))
    } else if (op === "disconnect") {
      await disconnectLinkedIn(me.email)
    } else {
      await postAction(me.email, b)
    }
    return json(await state(me.email))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}
