// GET /api/autopilot/demo?b=<sample brand>&v=cover|slide|end|offer — a design for the public demo page.
// Only fixed sample content (lib/autopilot/demo-samples.ts) is drawn, so nothing here takes free text; images are cached.

import { defaultKit } from "@/lib/autopilot/brand-presets"
import { demoBrand } from "@/lib/autopilot/demo-samples"
import { renderCard, slideCard, type Card } from "@/lib/autopilot/render"

export const runtime = "nodejs"
export const maxDuration = 30

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const b = demoBrand(q.get("b"))
  const v = q.get("v") || "cover"
  const kit = { ...defaultKit({ niche: b.niche, name: b.name }), handle: b.handle, tagline: b.tagline }
  const last = b.carousel.length - 1
  const card: Card = v === "offer" ? { kind: "single", title: b.offer } : slideCard(b.carousel, v === "slide" ? 1 : v === "end" ? last : 0)
  const template = v === "offer" ? b.offerTemplate : b.template
  try {
    const png = await renderCard(card, { kit, template, author: b.name })
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400, s-maxage=604800" } })
  } catch {
    return new Response("Preview unavailable", { status: 500, headers: { "Content-Type": "text/plain" } })
  }
}
