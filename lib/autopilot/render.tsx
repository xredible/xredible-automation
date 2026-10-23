// lib/autopilot/render.tsx
//
// Server-only. Draws post designs as 1080×1350 PNGs (Instagram portrait, also used for LinkedIn
// images and carousel pages) in one of five templates, using the customer's brand kit: logo,
// three colours, heading and body fonts. Cards: a single headline image, or carousel slides
// (cover, numbered slides, closing slide). Also packs carousel slides into a PDF for LinkedIn.

import { ImageResponse } from "next/og"
import { PDFDocument } from "pdf-lib"
import type { ReactElement, ReactNode } from "react"
import type { Slide } from "./formats"
import type { BrandKit, TemplateKey } from "./brand-presets"
import { safeFetch } from "./safe-fetch"

export const W = 1080
export const H = 1350
const INK = "#15171c"

// ---------- fonts ----------

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }
const fontCache = new Map<string, Promise<ArrayBuffer | null>>()

/** A Google font as TTF (Google serves TTF when the request has no browser user agent). */
function googleFont(family: string, weight: 400 | 700): Promise<ArrayBuffer | null> {
  const key = `${family}:${weight}`
  if (!fontCache.has(key)) {
    fontCache.set(
      key,
      (async () => {
        try {
          const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, { headers: { "User-Agent": "Mozilla/4.0" } })).text()
          const src = /src:\s*url\(([^)]+)\)\s*format\('(truetype|opentype)'\)/.exec(css)?.[1]
          return src ? await (await fetch(src)).arrayBuffer() : null
        } catch {
          return null
        }
      })(),
    )
  }
  return fontCache.get(key)!
}

async function fontsFor(kit: BrandKit, text: string): Promise<Font[]> {
  const out: Font[] = []
  const want: [string, 400 | 700][] = [
    [kit.headFont, 700],
    [kit.bodyFont, 400],
    [kit.bodyFont, 700],
  ]
  if (/[ऀ-ॿ]/.test(text)) want.push(["Noto Sans Devanagari", 700], ["Noto Sans Devanagari", 400])
  const got = await Promise.all(want.map(([f, w]) => googleFont(f, w)))
  got.forEach((data, i) => {
    if (data) out.push({ name: want[i][0], data, weight: want[i][1], style: "normal" })
  })
  return out
}

// ---------- colours ----------

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}
const hexOf = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")
const mix = (a: string, b: string, t: number) => hexOf(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t))
const lum = (hex: string) => {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const textOn = (bg: string) => (lum(bg) > 0.45 ? INK : "#ffffff")
export const safeColor = (v: unknown, d = "#24438a") => (/^#[0-9a-f]{6}$/i.test(String(v || "")) ? String(v) : d)

// ---------- logo ----------

type Logo = { src: string; w: number; h: number }
const logoCache = new Map<string, Promise<Logo | null>>()

/** Width and height from a PNG, JPEG, GIF, WebP or SVG file's header. */
function dims(b: Uint8Array, type: string): [number, number] | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (b[0] === 0x89 && b[1] === 0x50) return [dv.getUint32(16), dv.getUint32(20)]
  if (b[0] === 0x47 && b[1] === 0x49) return [dv.getUint16(6, true), dv.getUint16(8, true)]
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i < b.length - 9) {
      if (b[i] !== 0xff) return null
      const m = b[i + 1]
      const len = dv.getUint16(i + 2)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [dv.getUint16(i + 7), dv.getUint16(i + 5)]
      i += 2 + len
    }
    return null
  }
  if (type.includes("webp") && b.length > 30) {
    const chunk = String.fromCharCode(b[12], b[13], b[14], b[15])
    if (chunk === "VP8X") return [1 + (b[24] | (b[25] << 8) | (b[26] << 16)), 1 + (b[27] | (b[28] << 8) | (b[29] << 16))]
    if (chunk === "VP8 ") return [dv.getUint16(26, true) & 0x3fff, dv.getUint16(28, true) & 0x3fff]
    if (chunk === "VP8L") {
      const bits = dv.getUint32(21, true)
      return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1]
    }
  }
  if (type.includes("svg")) {
    const t = new TextDecoder().decode(b.slice(0, 2000))
    const vb = t.match(/viewBox=["'][\d.\-]+[\s,]+[\d.\-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/)
    if (vb) return [Number(vb[1]), Number(vb[2])]
    const w = t.match(/\swidth=["']([\d.]+)/)?.[1]
    const h = t.match(/\sheight=["']([\d.]+)/)?.[1]
    if (w && h) return [Number(w), Number(h)]
  }
  return null
}

function loadLogo(url: string): Promise<Logo | null> {
  if (!/^https:\/\//.test(url)) return Promise.resolve(null)
  if (!logoCache.has(url)) {
    logoCache.set(
      url,
      (async () => {
        try {
          const { res: r, bytes } = await safeFetch(url, { signal: AbortSignal.timeout(6000) }, 3_000_000)
          if (!r.ok) return null
          const type = (r.headers.get("content-type") || "").split(";")[0] || (url.endsWith(".svg") ? "image/svg+xml" : "image/png")
          if (!/image\/(png|jpe?g|gif|webp|svg\+xml)/.test(type)) return null
          const b = new Uint8Array(bytes)
          const d = dims(b, type) || [1, 1]
          return { src: `data:${type};base64,${Buffer.from(b).toString("base64")}`, w: d[0] || 1, h: d[1] || 1 }
        } catch {
          return null
        }
      })(),
    )
  }
  return logoCache.get(url)!
}

// ---------- cards ----------

export type Card =
  | { kind: "single"; title: string }
  | { kind: "cover"; title: string; body: string; total: number }
  | { kind: "slide"; title: string; body: string; n: number; total: number }
  | { kind: "end"; title: string; body: string; total: number }

export type Look = { kit: BrandKit; template: TemplateKey }

/** The card for slide n of a carousel (first = cover, last = closing slide). */
export function slideCard(slides: Slide[], n: number): Card {
  const total = slides.length
  const s = slides[Math.max(0, Math.min(total - 1, n))] || { title: "", body: "" }
  if (n <= 0) return { kind: "cover", title: s.title, body: s.body, total }
  if (n >= total - 1) return { kind: "end", title: s.title, body: s.body, total }
  return { kind: "slide", title: s.title, body: s.body, n, total }
}

const fit = (t: string, sizes: [number, number][]) => sizes.find(([max]) => t.length <= max)?.[1] ?? sizes[sizes.length - 1][1]
const body = (c: Card) => ("body" in c ? c.body : "")
const pos = (c: Card) => (c.kind === "slide" ? c.n : c.kind === "end" ? c.total - 1 : 0)
const total = (c: Card) => ("total" in c ? c.total : 1)

type Ctx = { kit: BrandKit; logo: Logo | null; head: string; text: string }

function LogoMark({ ctx, height, color }: { ctx: Ctx; height: number; color: string }) {
  if (ctx.logo) {
    const w = Math.min(320, Math.round((ctx.logo.w / ctx.logo.h) * height))
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={ctx.logo.src} width={w} height={height} style={{ width: w, height, objectFit: "contain" }} alt="" />
  }
  return <div style={{ display: "flex", fontFamily: ctx.head, fontSize: Math.round(height * 0.55), fontWeight: 700, color }}>{ctx.kit.name}</div>
}

function Dots({ c, on, off }: { c: Card; on: string; off: string }) {
  if (c.kind === "single") return null
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {Array.from({ length: total(c) }, (_, i) => (
        <div key={i} style={{ display: "flex", width: i === pos(c) ? 34 : 12, height: 12, borderRadius: 6, background: i === pos(c) ? on : off }} />
      ))}
    </div>
  )
}

function Footer({ ctx, c, color, faint, on, off, swipe }: { ctx: Ctx; c: Card; color: string; faint: string; on: string; off: string; swipe: { bg: string; fg: string } }) {
  const right: ReactNode =
    c.kind === "cover" ? (
      <div style={{ display: "flex", fontFamily: ctx.text, fontSize: 30, fontWeight: 700, padding: "14px 28px", borderRadius: 999, background: swipe.bg, color: swipe.fg }}>Swipe →</div>
    ) : (
      <Dots c={c} on={on} off={off} />
    )
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ display: "flex", fontFamily: ctx.head, fontSize: 30, fontWeight: 700, color }}>{ctx.kit.name}</div>
        {ctx.kit.handle ? <div style={{ display: "flex", fontFamily: ctx.text, fontSize: 24, color: faint }}>{ctx.kit.handle}</div> : null}
      </div>
      {right}
    </div>
  )
}

const titleSize = (c: Card) =>
  c.kind === "single" ? fit(c.title, [[35, 104], [60, 88], [999, 72]]) : c.kind === "cover" ? fit(c.title, [[30, 100], [55, 84], [999, 70]]) : c.kind === "slide" ? fit(c.title, [[30, 74], [55, 64], [999, 54]]) : fit(c.title, [[30, 86], [55, 72], [999, 60]])
const bodySize = (c: Card) => (c.kind === "slide" ? fit(body(c), [[120, 42], [190, 38], [999, 34]]) : 40)
const num = (c: Card) => String(c.kind === "slide" ? c.n : 0).padStart(2, "0")

// 1. Bold: brand colour gradient, big headline, accent underline.
function Bold(c: Card, ctx: Ctx) {
  const k = ctx.kit
  const fg = textOn(k.primary)
  const faint = fg === "#ffffff" ? "rgba(255,255,255,0.72)" : "rgba(21,23,28,0.65)"
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "92px 88px 84px", backgroundImage: `linear-gradient(160deg, ${mix(k.primary, "#ffffff", 0.12)} 0%, ${k.primary} 45%, ${mix(k.primary, "#000000", 0.35)} 100%)`, color: fg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {ctx.logo ? <LogoMark ctx={ctx} height={84} color={fg} /> : <div style={{ display: "flex", width: 120, height: 12, borderRadius: 6, background: k.accent }} />}
        {c.kind === "slide" ? <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 92, height: 92, borderRadius: 46, background: k.accent, color: textOn(k.accent), fontFamily: ctx.head, fontSize: 38, fontWeight: 700 }}>{num(c)}</div> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
        <div style={{ display: "flex", fontFamily: ctx.head, fontSize: titleSize(c), lineHeight: 1.12, fontWeight: 700, letterSpacing: -1.2 }}>{c.title}</div>
        <div style={{ display: "flex", width: 140, height: 10, borderRadius: 5, background: k.accent }} />
        {body(c) ? <div style={{ display: "flex", fontFamily: ctx.text, fontSize: bodySize(c), lineHeight: 1.42, color: faint }}>{body(c)}</div> : null}
      </div>
      <Footer ctx={ctx} c={c} color={fg} faint={faint} on={k.accent} off={faint} swipe={{ bg: k.accent, fg: textOn(k.accent) }} />
    </div>
  )
}

// 2. Minimal: light page, dark text, a small accent bar, lots of space.
function Minimal(c: Card, ctx: Ctx) {
  const k = ctx.kit
  const bg = lum(k.secondary) > 0.75 ? k.secondary : "#ffffff"
  const muted = mix(INK, bg, 0.42)
  const label = c.kind === "slide" ? `${num(c)} / ${String(total(c) - 2).padStart(2, "0")}` : c.kind === "end" ? "In short" : ""
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "92px 92px 84px", background: bg, color: INK }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <LogoMark ctx={ctx} height={80} color={k.primary} />
        {label ? <div style={{ display: "flex", fontFamily: ctx.text, fontSize: 28, fontWeight: 700, color: k.primary, letterSpacing: 2 }}>{label}</div> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 34 }}>
        <div style={{ display: "flex", width: 72, height: 8, borderRadius: 4, background: k.accent }} />
        <div style={{ display: "flex", fontFamily: ctx.head, fontSize: titleSize(c), lineHeight: 1.12, fontWeight: 700, letterSpacing: -1.2, color: c.kind === "single" ? k.primary : INK }}>{c.title}</div>
        {body(c) ? <div style={{ display: "flex", fontFamily: ctx.text, fontSize: bodySize(c), lineHeight: 1.45, color: muted }}>{body(c)}</div> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
        <div style={{ display: "flex", height: 2, background: mix(INK, bg, 0.88) }} />
        <Footer ctx={{ ...ctx, logo: null }} c={c} color={INK} faint={muted} on={k.primary} off={mix(INK, bg, 0.8)} swipe={{ bg: k.primary, fg: textOn(k.primary) }} />
      </div>
    </div>
  )
}

// 3. Editorial: warm paper, centred classic layout, thin rules, a large quote mark.
function Editorial(c: Card, ctx: Ctx) {
  const k = ctx.kit
  const bg = lum(k.secondary) > 0.6 ? k.secondary : "#f6f1e7"
  const muted = mix(INK, bg, 0.4)
  const rule = mix(INK, bg, 0.8)
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center", padding: "84px 100px", background: bg, color: INK, textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: "100%" }}>
        <LogoMark ctx={ctx} height={76} color={k.primary} />
        <div style={{ display: "flex", width: "100%", height: 2, background: rule }} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
        {c.kind === "slide" ? (
          <div style={{ display: "flex", fontFamily: ctx.head, fontSize: 40, fontWeight: 700, color: k.accent, letterSpacing: 4 }}>{`No. ${num(c)}`}</div>
        ) : (
          <div style={{ display: "flex", fontFamily: ctx.head, fontSize: 160, lineHeight: 0.6, height: 90, fontWeight: 700, color: k.accent }}>“</div>
        )}
        <div style={{ display: "flex", justifyContent: "center", fontFamily: ctx.head, fontSize: titleSize(c), lineHeight: 1.15, fontWeight: 700, color: k.primary }}>{c.title}</div>
        {body(c) ? <div style={{ display: "flex", justifyContent: "center", fontFamily: ctx.text, fontSize: bodySize(c), lineHeight: 1.5, color: muted }}>{body(c)}</div> : null}
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22, width: "100%" }}>
        <div style={{ display: "flex", width: "100%", height: 2, background: rule }} />
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ display: "flex", fontFamily: ctx.text, fontSize: 26, letterSpacing: 4, color: muted }}>{(ctx.kit.handle || ctx.kit.name).toUpperCase()}</div>
          {c.kind === "cover" ? <div style={{ display: "flex", fontFamily: ctx.text, fontSize: 26, fontWeight: 700, color: k.accent }}>SWIPE →</div> : <Dots c={c} on={k.accent} off={rule} />}
        </div>
      </div>
    </div>
  )
}

// 4. Split: a colour block with the headline on top, the details on a light panel below.
function Split(c: Card, ctx: Ctx) {
  const k = ctx.kit
  const fg = textOn(k.primary)
  const lower = lum(k.secondary) > 0.75 ? k.secondary : "#ffffff"
  const muted = mix(INK, lower, 0.38)
  const top = c.kind === "single" ? 62 : body(c) ? 52 : 62
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: lower, color: INK }}>
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: `${top}%`, padding: "84px 88px 64px", background: k.primary, color: fg }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LogoMark ctx={ctx} height={76} color={fg} />
          {c.kind === "slide" ? <div style={{ display: "flex", padding: "10px 24px", borderRadius: 999, background: k.accent, color: textOn(k.accent), fontFamily: ctx.head, fontSize: 32, fontWeight: 700 }}>{num(c)}</div> : null}
        </div>
        <div style={{ display: "flex", fontFamily: ctx.head, fontSize: titleSize(c), lineHeight: 1.1, fontWeight: 700, letterSpacing: -1.2 }}>{c.title}</div>
      </div>
      <div style={{ display: "flex", width: "100%", height: 14, background: k.accent }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flexGrow: 1, padding: "56px 88px 80px" }}>
        {body(c) ? <div style={{ display: "flex", fontFamily: ctx.text, fontSize: bodySize(c), lineHeight: 1.45, color: muted }}>{body(c)}</div> : <div style={{ display: "flex" }} />}
        <Footer ctx={ctx} c={c} color={k.primary} faint={muted} on={k.primary} off={mix(INK, lower, 0.8)} swipe={{ bg: k.primary, fg }} />
      </div>
    </div>
  )
}

// 5. Spark: deep background, glowing accent shapes, a label chip, bright headline.
function Spark(c: Card, ctx: Ctx) {
  const k = ctx.kit
  const bg = lum(k.primary) < 0.08 ? k.primary : mix(k.primary, "#05070c", 0.62)
  const soft = "rgba(255,255,255,0.72)"
  const chip = c.kind === "single" ? "TIP" : c.kind === "cover" ? "GUIDE" : c.kind === "end" ? "TAKEAWAY" : num(c)
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: bg, color: "#ffffff", overflow: "hidden" }}>
      <div style={{ display: "flex", position: "absolute", width: 640, height: 640, borderRadius: 320, right: -220, top: -200, background: k.accent, opacity: 0.22 }} />
      <div style={{ display: "flex", position: "absolute", width: 360, height: 360, borderRadius: 180, left: -150, bottom: -120, background: mix(k.primary, "#ffffff", 0.25), opacity: 0.25 }} />
      <div style={{ display: "flex", position: "absolute", width: 34, height: 34, borderRadius: 17, right: 120, top: 470, background: k.accent }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", padding: "92px 88px 84px" }}>
        <LogoMark ctx={ctx} height={80} color="#ffffff" />
        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ display: "flex" }}>
            <div style={{ display: "flex", padding: "10px 24px", borderRadius: 999, background: k.accent, color: textOn(k.accent), fontFamily: ctx.text, fontSize: 28, fontWeight: 700, letterSpacing: 2 }}>{chip}</div>
          </div>
          <div style={{ display: "flex", fontFamily: ctx.head, fontSize: titleSize(c), lineHeight: 1.1, fontWeight: 700, letterSpacing: -1.2 }}>{c.title}</div>
          {body(c) ? <div style={{ display: "flex", fontFamily: ctx.text, fontSize: bodySize(c), lineHeight: 1.45, color: soft }}>{body(c)}</div> : null}
        </div>
        <Footer ctx={{ ...ctx, logo: null }} c={c} color="#ffffff" faint={soft} on={k.accent} off="rgba(255,255,255,0.3)" swipe={{ bg: k.accent, fg: textOn(k.accent) }} />
      </div>
    </div>
  )
}

const TEMPLATE_FN: Record<TemplateKey, (c: Card, ctx: Ctx) => ReactNode> = { bold: Bold, minimal: Minimal, editorial: Editorial, split: Split, spark: Spark }

/** One design as PNG bytes. Falls back to the built-in font (and no logo) if something can't be drawn. */
export async function renderCard(card: Card, look: Look): Promise<ArrayBuffer> {
  const kit = look.kit
  const all = [card.title, body(card), kit.name, kit.handle].join(" ")
  const [fonts, logo] = await Promise.all([fontsFor(kit, all), loadLogo(kit.logo)])
  const deva = /[ऀ-ॿ]/.test(all) ? ", Noto Sans Devanagari" : ""
  const fam = (f: string) => (fonts.some((x) => x.name === f) ? `"${f}"${deva}` : deva ? "Noto Sans Devanagari" : "sans-serif")
  const draw = (f: Font[], c: Card, ctx: Ctx) => new ImageResponse(TEMPLATE_FN[look.template](c, ctx) as ReactElement, { width: W, height: H, ...(f.length ? { fonts: f } : {}) }).arrayBuffer()
  try {
    return await draw(fonts, card, { kit, logo, head: fam(kit.headFont), text: fam(kit.bodyFont) })
  } catch {
    const strip = (t: string) => t.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, "")
    const plain = { ...card, title: strip(card.title), ...("body" in card ? { body: strip(card.body) } : {}) } as Card
    return draw([], plain, { kit: { ...kit, name: strip(kit.name), handle: strip(kit.handle) }, logo: null, head: "sans-serif", text: "sans-serif" })
  }
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
