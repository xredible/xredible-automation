// /dashboard/me/brand — the brand kit used on every image and carousel.
// GET  → { kit, niches, fonts, templates }
// POST { op: "save", kit } | { op: "website", url } (read logo, colours, fonts) | { op: "suggest", niche?, about? }

import { NextResponse } from "next/server"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { ownerKey } from "@/lib/autopilot/brands"
import { kitFor, readWebsite, saveKit, suggestNiche } from "@/lib/autopilot/brandkit"
import { cleanKit, NICHES } from "@/lib/autopilot/brand-presets"
import { profileFor } from "@/lib/autopilot/service"
import { channelFor } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

async function current(owner: string) {
  const [li, meta] = await Promise.all([profileFor(owner).catch(() => null), channelFor(owner, "meta").catch(() => null)])
  const name = String(meta?.settings.brand || li?.prefs.brand || li?.liName || meta?.meta.pageName || "")
  const color = String(meta?.settings.color || "")
  return { kit: await kitFor(owner, { name, color }), about: String(li?.about || meta?.settings.about || "") }
}

export async function GET(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  try {
    const { kit } = await current(owner)
    return json({ ok: true, kit })
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
    const { kit, about } = await current(owner)
    if (op === "save") return json({ ok: true, kit: { ...(await saveKit(owner, b.kit)), saved: true } })
    if (op === "website") {
      const got = await readWebsite(String(b.url || "").trim())
      const { found, ...rest } = got
      // A suggestion only: shown in the form, saved when they press Save.
      return json({ ok: true, kit: { ...cleanKit(rest, kit), saved: kit.saved }, found })
    }
    if (op === "suggest") {
      const niche = typeof b.niche === "string" && NICHES[b.niche] ? b.niche : await suggestNiche(String(b.about || about || kit.name))
      const p = NICHES[niche]
      return json({ ok: true, kit: { ...cleanKit({ niche, primary: p.primary, secondary: p.secondary, accent: p.accent, headFont: p.headFont, bodyFont: p.bodyFont, template: "rotate" }, kit), saved: kit.saved }, niche })
    }
    return json({ ok: false, error: "Unknown request." }, 400)
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}
