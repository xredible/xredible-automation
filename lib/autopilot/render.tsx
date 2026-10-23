// lib/autopilot/render.tsx
//
// Server-only. Draws post designs as 1080×1350 PNGs (Instagram portrait, also used for LinkedIn
// images and carousel pages): a single headline card, or carousel slides (cover, numbered slides,
// closing slide), in the customer's brand colour. Also packs carousel slides into a PDF for LinkedIn.

import { ImageResponse } from "next/og"
import { PDFDocument } from "pdf-lib"
import type { ReactNode } from "react"
import type { Slide } from "./formats"

export const W = 1080
export const H = 1350

type Font = { name: string; data: ArrayBuffer; weight: 500 | 700; style: "normal" }
const cache = new Map<string, Promise<ArrayBuffer | null>>()

/** A Google font as TTF (Google serves TTF when the request has no browser user agent). */
function googleFont(family: string, weight: 500 | 700): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        try {
          const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`, { headers: { "User-Agent": "Mozilla/4.0" } })).text()
          const src = /src:\s*url\(([^)]+)\)\s*format\('(truetype|opentype)'\)/.exec(css)?.[1]
          return src ? await (await fetch(src)).arrayBuffer() : null
        } catch {
          return null
        }
      })(),
    )
  }
  return cache.get(key)!
}

async function fontsFor(text: string): Promise<Font[]> {
  const out: Font[] = []
  const [b, m] = await Promise.all([googleFont("Poppins", 700), googleFont("Poppins", 500)])
  if (b) out.push({ name: "Poppins", data: b, weight: 700, style: "normal" })
  if (m) out.push({ name: "Poppins", data: m, weight: 500, style: "normal" })
  if (/[ऀ-ॿ]/.test(text)) {
    const [db, dm] = await Promise.all([googleFont("Noto+Sans+Devanagari", 700), googleFont("Noto+Sans+Devanagari", 500)])
    if (db) out.push({ name: "Deva", data: db, weight: 700, style: "normal" })
    if (dm) out.push({ name: "Deva", data: dm, weight: 500, style: "normal" })
  }
  return out
}

const shade = (hex: string, f: number) => {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)))
  return `rgb(${c(n >> 16)}, ${c((n >> 8) & 255)}, ${c(n & 255)})`
}
export const safeColor = (v: unknown, d = "#24438a") => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v) : d)

export type Look = { color: string; brand: string }
export type Card =
  | { kind: "single"; title: string }
  | { kind: "cover"; title: string; body: string; total: number }
  | { kind: "slide"; title: string; body: string; n: number; total: number }
  | { kind: "end"; title: string; body: string; total: number }

const fit = (t: string, sizes: [number, number][]) => sizes.find(([max]) => t.length <= max)?.[1] ?? sizes[sizes.length - 1][1]

function layout(card: Card, look: Look, family: string) {
  const bg = `linear-gradient(160deg, ${shade(look.color, 1.15)} 0%, ${look.color} 45%, ${shade(look.color, 0.55)} 100%)`
  const base = { width: "100%", height: "100%", display: "flex", flexDirection: "column" as const, color: "#ffffff", backgroundImage: bg, fontFamily: family, padding: "96px 92px 88px" }
  const brand = <div style={{ display: "flex", fontSize: 34, fontWeight: 700, opacity: 0.92 }}>{look.brand}</div>
  const bar = <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: "rgba(255,255,255,0.85)" }} />
  if (card.kind === "single") {
    return (
      <div style={{ ...base, justifyContent: "space-between" }}>
        {bar}
        <div style={{ display: "flex", fontSize: fit(card.title, [[35, 112], [60, 92], [999, 76]]), lineHeight: 1.14, fontWeight: 700, letterSpacing: -1.5 }}>{card.title}</div>
        {brand}
      </div>
    )
  }
  const dots = (
    <div style={{ display: "flex", gap: 10 }}>
      {Array.from({ length: card.total }, (_, i) => (
        <div key={i} style={{ display: "flex", width: (card.kind === "slide" ? card.n : card.kind === "cover" ? 0 : card.total - 1) === i ? 34 : 12, height: 12, borderRadius: 6, background: "rgba(255,255,255,0.85)", opacity: (card.kind === "slide" ? card.n : card.kind === "cover" ? 0 : card.total - 1) === i ? 1 : 0.4 }} />
      ))}
    </div>
  )
  const foot = (right: ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      {brand}
      {right}
    </div>
  )
  if (card.kind === "cover") {
    return (
      <div style={{ ...base, justifyContent: "space-between" }}>
        {bar}
        <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
          <div style={{ display: "flex", fontSize: fit(card.title, [[30, 108], [55, 90], [999, 74]]), lineHeight: 1.12, fontWeight: 700, letterSpacing: -1.5 }}>{card.title}</div>
          {card.body ? <div style={{ display: "flex", fontSize: 40, lineHeight: 1.35, fontWeight: 500, opacity: 0.88 }}>{card.body}</div> : null}
        </div>
        {foot(<div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 32, fontWeight: 700, padding: "16px 30px", borderRadius: 999, background: "rgba(255,255,255,0.16)" }}>Swipe →</div>)}
      </div>
    )
  }
  if (card.kind === "slide") {
    return (
      <div style={{ ...base, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 96, height: 96, borderRadius: 48, background: "rgba(255,255,255,0.95)", color: look.color, fontSize: 40, fontWeight: 700 }}>{String(card.n).padStart(2, "0")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ display: "flex", fontSize: fit(card.title, [[30, 78], [55, 66], [999, 56]]), lineHeight: 1.15, fontWeight: 700, letterSpacing: -1 }}>{card.title}</div>
          {card.body ? <div style={{ display: "flex", fontSize: fit(card.body, [[120, 44], [190, 39], [999, 35]]), lineHeight: 1.42, fontWeight: 500, opacity: 0.9 }}>{card.body}</div> : null}
        </div>
        {foot(dots)}
      </div>
    )
  }
  return (
    <div style={{ ...base, justifyContent: "space-between" }}>
      {bar}
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", fontSize: fit(card.title, [[30, 92], [55, 76], [999, 62]]), lineHeight: 1.14, fontWeight: 700, letterSpacing: -1.2 }}>{card.title}</div>
        {card.body ? <div style={{ display: "flex", fontSize: 42, lineHeight: 1.4, fontWeight: 500, opacity: 0.9 }}>{card.body}</div> : null}
      </div>
      {foot(dots)}
    </div>
  )
}

/** One design as PNG bytes. Falls back to the built-in font if a web font can't draw the text. */
export async function renderCard(card: Card, look: Look): Promise<ArrayBuffer> {
  const all = [card.title, "body" in card ? card.body : "", look.brand].join(" ")
  const fonts = await fontsFor(all)
  const draw = async (f: Font[], c: Card) => {
    const family = f.length ? [...new Set(f.map((x) => x.name))].join(", ") : "sans-serif"
    return new ImageResponse(layout(c, look, family), { width: W, height: H, ...(f.length ? { fonts: f } : {}) }).arrayBuffer()
  }
  try {
    return await draw(fonts, card)
  } catch {
    const strip = (t: string) => t.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, "")
    return draw([], { ...card, title: strip(card.title), ...("body" in card ? { body: strip(card.body) } : {}) } as Card)
  }
}

/** The card for slide n of a carousel (first = cover, last = closing slide). */
export function slideCard(slides: Slide[], n: number): Card {
  const total = slides.length
  const s = slides[Math.max(0, Math.min(total - 1, n))] || { title: "", body: "" }
  if (n <= 0) return { kind: "cover", title: s.title, body: s.body, total }
  if (n >= total - 1) return { kind: "end", title: s.title, body: s.body, total }
  return { kind: "slide", title: s.title, body: s.body, n, total }
}

/** All slides as one PDF (LinkedIn shows a PDF document as a swipeable carousel). */
export async function carouselPdf(slides: Slide[], look: Look): Promise<Uint8Array> {
  const pngs = await Promise.all(slides.map((_, i) => renderCard(slideCard(slides, i), look)))
  const pdf = await PDFDocument.create()
  pdf.setTitle(slides[0]?.title || "Carousel")
  for (const png of pngs) {
    const img = await pdf.embedPng(png)
    const page = pdf.addPage([W, H])
    page.drawImage(img, { x: 0, y: 0, width: W, height: H })
  }
  return pdf.save()
}
