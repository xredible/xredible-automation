// /dashboard/me/ideas — "Ideas" in a customer's dashboard.
// GET  → { moments, news, hours, channels }   (channels: which tools are set up)
// POST { op: "repurpose", input, channels[], angle? } | { op: "moment", id, channels[] } → { results }

import { NextResponse } from "next/server"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { ownerKey } from "@/lib/autopilot/brands"
import { momentsAhead } from "@/lib/autopilot/moments"
import { bestHours, CHANNEL_NAME, CHANNELS, contexts, momentPosts, newsIdeas, repurpose } from "@/lib/autopilot/ideas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

export async function GET(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  try {
    const ctx = await contexts(owner)
    const topics = Object.values(ctx).flatMap((c) => String(c?.topics || "").split(/[,;\n]/))
    const [news, hours] = await Promise.all([newsIdeas(topics), bestHours(owner).catch(() => null)])
    return json({
      ok: true,
      moments: momentsAhead(75),
      news,
      hours,
      channels: CHANNELS.map((c) => ({ key: c, name: CHANNEL_NAME[c], ready: !!ctx[c], connected: !!ctx[c]?.connected })),
    })
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
    if (op === "repurpose") return json({ ok: true, results: await repurpose(owner, String(b.input || ""), b.channels, String(b.angle || "")) })
    if (op === "moment") return json({ ok: true, results: await momentPosts(owner, String(b.id || ""), b.channels) })
    return json({ ok: false, error: "Unknown request." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}
