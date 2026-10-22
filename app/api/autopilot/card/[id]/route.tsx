// GET /api/autopilot/card/<id>?s=<signature> — the post design for an Instagram/Facebook item:
// the item's headline on the customer's brand colour, 1080×1350 (Instagram portrait).
// Instagram and Facebook fetch this URL when publishing, so it's public but signed.

import { ImageResponse } from "next/og"
import { signed } from "@/lib/autopilot/crypto"
import { channelFor, itemById } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

type Font = { name: string; data: ArrayBuffer; weight: 700; style: "normal" }
const cache = new Map<string, Promise<ArrayBuffer | null>>()

/** A Google font as TTF (Google serves TTF when the request has no browser user agent). */
function googleFont(family: string): Promise<ArrayBuffer | null> {
  if (!cache.has(family)) {
    cache.set(
      family,
      (async () => {
        try {
          const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@700`, { headers: { "User-Agent": "Mozilla/4.0" } })).text()
          const src = /src:\s*url\(([^)]+)\)\s*format\('(truetype|opentype)'\)/.exec(css)?.[1]
          return src ? await (await fetch(src)).arrayBuffer() : null
        } catch {
          return null
        }
      })(),
    )
  }
  return cache.get(family)!
}

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: raw } = await ctx.params
  const id = Number(raw)
  if (!Number.isInteger(id) || id < 1 || !signed(`card:${id}`, new URL(request.url).searchParams.get("s") || "")) return new Response("Not found", { status: 404 })
  const it = await itemById(id).catch(() => null)
  if (!it || it.product !== "meta") return new Response("Not found", { status: 404 })
  const ch = await channelFor(it.email, "meta").catch(() => null)
  const color = /^#[0-9a-f]{6}$/i.test(String(ch?.settings.color || "")) ? String(ch!.settings.color) : "#24438a"
  const brand = String(ch?.settings.brand || ch?.meta.pageName || "").slice(0, 60)
  const headline = (it.title || it.topic || "").slice(0, 90)
  const deva = /[ऀ-ॿ]/.test(headline + brand)
  const fonts: Font[] = []
  const latin = await googleFont("Poppins")
  if (latin) fonts.push({ name: "Head", data: latin, weight: 700, style: "normal" })
  if (deva) {
    const d = await googleFont("Noto+Sans+Devanagari")
    if (d) fonts.push({ name: "Deva", data: d, weight: 700, style: "normal" })
  }
  const size = headline.length > 60 ? 76 : headline.length > 35 ? 92 : 112
  try {
    return await draw(headline, brand, color, deva, size, fonts)
  } catch {
    // A font that didn't load (or a character it can't draw): fall back to the built-in font.
    return draw(headline.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, ""), brand, color, false, size, [])
  }
}

async function draw(headline: string, brand: string, color: string, deva: boolean, size: number, fonts: Font[]) {
  const res = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "110px 96px 96px",
          backgroundImage: `linear-gradient(160deg, ${shade(color, 1.15)} 0%, ${color} 45%, ${shade(color, 0.55)} 100%)`,
          color: "#ffffff",
          fontFamily: fonts.length ? fonts.map((f) => f.name).join(", ") : "sans-serif",
        }}
      >
        <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: "rgba(255,255,255,0.85)" }} />
        <div style={{ display: "flex", fontSize: size, lineHeight: 1.14, fontWeight: 700, letterSpacing: deva ? 0 : -1.5 }}>{headline}</div>
        <div style={{ display: "flex", alignItems: "center", fontSize: 38, fontWeight: 700, opacity: 0.92 }}>{brand}</div>
      </div>
    ),
    { width: 1080, height: 1350, fonts, headers: { "Cache-Control": "public, max-age=300" } },
  )
  // Render now, so a drawing error is caught here instead of failing the response stream.
  const body = await res.arrayBuffer()
  return new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } })
}
