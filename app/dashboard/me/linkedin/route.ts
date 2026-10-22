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
import { upiOptions } from "@/lib/autopilot/upi"
import { ownerKey } from "@/lib/autopilot/brands"
import { rememberVoice, rewrite, voiceOf } from "@/lib/autopilot/ai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

async function state(email: string) {
  const [sub, profile, posts, upi] = await Promise.all([ensureTrial(email, "linkedin"), profileFor(email), postsFor(email), upiOptions("linkedin", email)])
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
  const owner = await ownerKey(me.email)
  try {
    return json(await state(owner))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}

export async function POST(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    if (op === "profile") {
      const before = await profileFor(owner)
      const saved = await saveProfile(owner, b)
      // First time the profile is filled in and LinkedIn is already connected: write the first drafts.
      const posts = await postsFor(owner)
      if (!before?.about && saved.about && saved.connected && !posts.some((p) => p.status === "draft" || p.status === "approved")) await requestDrafts(owner, 3).catch(() => {})
    } else if (op === "generate") {
      const prof = await profileFor(owner)
      if (!prof || !prof.about) return json({ ok: false, error: "Fill in 'About you' first so the drafts sound like you." }, 400)
      await requestDrafts(owner, Math.min(5, Math.max(1, Number(b.count) || 3)))
    } else if (op === "disconnect") {
      await disconnectLinkedIn(owner)
    } else if (op === "rewrite") {
      // A suggestion only: the dashboard shows it in the editor and nothing changes until they save.
      const post = (await postsFor(owner)).find((p) => p.id === Number(b.id))
      if (!post) throw new Error("That post isn't yours.")
      const out = await rewrite({ kind: "LinkedIn post", text: String(b.text || post.text), how: String(b.how || ""), custom: String(b.custom || ""), samples: await voiceOf(owner, "linkedin"), limit: 2900 })
      return json({ ok: true, rewrite: out })
    } else {
      await postAction(owner, b)
      if (op === "edit") await rememberVoice(owner, "linkedin", String(b.text || "")).catch(() => {})
    }
    return json(await state(owner))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}
