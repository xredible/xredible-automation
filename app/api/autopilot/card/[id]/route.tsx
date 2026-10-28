// GET /api/autopilot/card/<id>?s=<signature>[&k=li][&n=<slide>] — a post design as a 1080×1350 PNG:
// the single headline image, or slide n of a carousel, in the customer's brand colour.
// Instagram and Facebook fetch these addresses when publishing, so they're public but signed.

import { createHash } from "node:crypto"
import { signed } from "@/lib/autopilot/crypto"
import { channelFor, itemById } from "@/lib/autopilot/tools"
import { liLook, postsFor, profileFor } from "@/lib/autopilot/service"
import { renderCard, slideCard, type Card, type Look } from "@/lib/autopilot/render"
import { kitFor } from "@/lib/autopilot/brandkit"
import { templateFor } from "@/lib/autopilot/brand-presets"
import { rows } from "@/lib/autopilot/db"
import { isFormat, parseDesign, type Design, type Format } from "@/lib/autopilot/formats"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// "no-cache" + ETag: browsers and Instagram/Facebook check back each time, so a brand kit change
// (tagline, colours, logo) or an edited post shows at once; unchanged designs answer 304 without redrawing.
const png = (body: ArrayBuffer, etag: string) => new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, no-cache", ETag: etag } })
/** Bump when the design templates change, so old copies are drawn again. */
const RENDER_VERSION = 3

const missing = () => new Response("Not found", { status: 404 })

function cardFor(format: Format, d: Design, fallback: string, n: number): Card {
  if (format === "carousel" && d.slides && d.slides.length >= 2) return slideCard(d.slides, n)
  return { kind: "single", title: (d.headline || fallback).slice(0, 90) }
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params
  const id = Number(raw)
  const q = new URL(request.url).searchParams
  const li = q.get("k") === "li"
  const n = Math.max(0, Math.min(9, Number(q.get("n")) || 0))
  if (!Number.isInteger(id) || id < 1 || !signed(li ? `cardli:${id}` : `card:${id}`, q.get("s") || "")) return missing()

  let look: Look
  let card: Card
  if (li) {
    const r = (await rows<Record<string, unknown>>("li_posts", { col: "id", val: id }).catch(() => []))[0]
    if (!r) return missing()
    const email = String(r.email || "")
    const post = (await postsFor(email)).find((p) => p.id === id)
    if (!post) return missing()
    look = await liLook(post, await profileFor(email))
    card = cardFor(post.format === "text" ? "image" : post.format, post.design, post.topic || post.text.split("\n")[0], n)
  } else {
    const it = await itemById(id).catch(() => null)
    if (!it || it.product !== "meta") return missing()
    const ch = await channelFor(it.email, "meta").catch(() => null)
    const kit = await kitFor(it.email, { name: String(ch?.settings.brand || ch?.meta.pageName || "").slice(0, 60), color: String(ch?.settings.color || "") })
    look = { kit, template: templateFor(kit, it.design.template, it.id) }
    const format = isFormat(it.format) ? it.format : "image"
    card = cardFor(format, { ...parseDesign(it.design), headline: it.title || it.design.headline }, it.topic, n)
  }
  const etag = `"${createHash("sha1").update(JSON.stringify([RENDER_VERSION, look, card])).digest("base64url")}"`
  if ((request.headers.get("if-none-match") || "").split(/\s*,\s*/).includes(etag)) return new Response(null, { status: 304, headers: { ETag: etag, "Cache-Control": "public, no-cache" } })
  try {
    return png(await renderCard(card, look), etag)
  } catch {
    return new Response("Couldn't draw this design", { status: 500 })
  }
}
