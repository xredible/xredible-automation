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
import { makeHeadline, makeSlides, rememberVoice, rewrite, voiceOf } from "@/lib/autopilot/ai"
import { liCardUrl } from "@/lib/autopilot/tools"
import { isFormat, type Format } from "@/lib/autopilot/formats"
import type { LiPost } from "@/lib/autopilot/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/** The images a post will show (designed image, carousel slides or the customer's photos). */
function previews(p: LiPost): string[] {
  const v = p.updatedAt || ""
  if (p.format === "image") return p.design.photos?.length ? [p.design.photos[0]] : [liCardUrl(p.id, 0, v)]
  if (p.format === "carousel") return (p.design.slides || []).map((_, n) => liCardUrl(p.id, n, v))
  if (p.format === "photo") return p.design.photos || []
  return []
}

async function state(email: string) {
  const [sub, profile, posts, upi] = await Promise.all([ensureTrial(email, "linkedin"), profileFor(email), postsFor(email), upiOptions("linkedin", email)])
  return {
    ok: true,
    sub,
    profile: viewProfile(profile),
    posts: posts.filter((p) => p.status !== "rejected").map((p) => ({ ...p, previews: previews(p) })),
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
      const waiting = (list: LiPost[]) => list.filter((p) => p.status === "draft" || (p.status === "approved" && Date.parse(p.scheduledAt || "") > Date.now())).length
      const [sub, before] = await Promise.all([ensureTrial(owner, "linkedin"), postsFor(owner)])
      const room = Math.max(0, sub.postLimit - sub.used) + 2 - waiting(before)
      if (room <= 0) return json({ ok: false, error: `Your queue is full for your plan (${waiting(before)} posts waiting). Approve or discard a draft first, or upgrade for more posts a month.` }, 400)
      await requestDrafts(owner, Math.min(5, Math.max(1, Number(b.count) || 3)))
      const after = await postsFor(owner)
      if (after.filter((p) => p.status === "draft").length <= before.filter((p) => p.status === "draft").length)
        return json({ ...(await state(owner)), ok: false, error: "No new drafts this time: the AI writer is busy. Try again in a few minutes. New drafts are also written for you every morning." })
    } else if (op === "disconnect") {
      await disconnectLinkedIn(owner)
    } else if (op === "format") {
      // Switch a draft's type; writes the image headline or the carousel slides it needs.
      const post = (await postsFor(owner)).find((p) => p.id === Number(b.id))
      if (!post) throw new Error("That post isn't yours.")
      if (!isFormat(b.format)) throw new Error("Pick a post type.")
      const format: Format = b.format
      const design = { ...post.design }
      if (format === "image" && !design.headline && !design.photos?.length) design.headline = await makeHeadline(post.text)
      if (format === "carousel" && !(design.slides && design.slides.length >= 2)) design.slides = await makeSlides(post.text)
      await postAction(owner, { op: "design", id: post.id, format, design })
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
