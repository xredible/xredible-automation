// GET /dashboard/me/brand/preview?t=<template>&v=single|cover|slide|end&k=<kit as base64url JSON>
// A sample design with the kit being edited (signed-in customers only), for the Brand kit page.

import { NextResponse } from "next/server"
import { signedIn } from "@/lib/autopilot/guard"
import { cleanKit, defaultKit, isTemplate } from "@/lib/autopilot/brand-presets"
import { renderCard, type Card } from "@/lib/autopilot/render"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

const SAMPLE: Record<string, Card> = {
  single: { kind: "single", title: "Small changes, steady growth, every single week" },
  cover: { kind: "cover", title: "5 simple ways to win more customers", body: "Save this for your next marketing plan", total: 4 },
  slide: { kind: "slide", title: "Show up every week", body: "Two helpful posts a week build more trust than ten posts followed by a month of silence.", n: 1, total: 4 },
  end: { kind: "end", title: "Start small, stay steady", body: "Follow for one simple tip every week.", total: 4 },
}

export async function GET(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const q = new URL(request.url).searchParams
  const t = q.get("t")
  if (!isTemplate(t)) return new Response("Unknown template", { status: 400 })
  let raw: unknown = {}
  try {
    raw = JSON.parse(Buffer.from(q.get("k") || "", "base64url").toString("utf8") || "{}")
  } catch {}
  const kit = cleanKit(raw, defaultKit())
  const card = SAMPLE[q.get("v") || "single"] || SAMPLE.single
  const png = (k: typeof kit) => renderCard(card, { kit: { ...k, name: k.name || "Your brand" }, template: t })
  try {
    return new Response(await png(kit), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=600" } })
  } catch (e) {
    console.error("brand preview failed", t, e)
    try {
      // Without the logos, in case one of them is what broke it.
      return new Response(await png({ ...kit, logo: "", logoDark: "" }), { headers: { "Content-Type": "image/png", "Cache-Control": "no-store", "X-Preview": "no-logo" } })
    } catch (e2) {
      console.error("brand preview failed again", t, e2)
      return new Response(`Preview failed: ${e2 instanceof Error ? e2.message : "unknown error"}`, { status: 500, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } })
    }
  }
}
