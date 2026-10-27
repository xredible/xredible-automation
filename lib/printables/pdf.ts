// lib/printables/pdf.ts
//
// Server-only. Lays a printable (lib/printables/spec.ts) out on the Nestoodle page design
// and returns the PDF.
//
// The page: US Letter with 42pt (0.58in) side margins, so it also prints on A4 without
// anything cut off. Page 1 opens with the logo, title, subtitle, intro and labels; every
// page has a slim Nestoodle header and a nestoodle.com footer with page numbers. Cards,
// chart rows and steps are never split across pages, headings always stay with what
// follows, and tables repeat their heading row on a new page.

import fs from "node:fs"
import path from "node:path"
import { PDFDocument, rgb, LineCapStyle, type PDFFont, type PDFPage, type PDFImage, type RGB } from "pdf-lib"
import fontkit from "@pdf-lib/fontkit"
import { ICONS } from "./icons"
import { SHAPES } from "./shapes"
import type { Block, Card, Spec } from "./spec"

// ---------- page and brand ----------

const W = 612
const H = 792
const MX = 42
const CW = W - 2 * MX
const TOP_FIRST = 40
const TOP = 66
const BOTTOM = H - 56

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)
const C = {
  ink: hex("#332B22"),
  soft: hex("#6B5F4F"),
  faint: hex("#9C8F79"),
  line: hex("#E4D6BE"),
  paper: hex("#FFFCF6"),
  cream: hex("#FAF3E7"),
  coral: hex("#E0653C"),
  coralSoft: hex("#FBE3D6"),
  sky: hex("#3E8FA6"),
  skySoft: hex("#DCEEEF"),
  moss: hex("#6F8E4E"),
  mossSoft: hex("#E7EEDA"),
  white: rgb(1, 1, 1),
}

type Fonts = { head: PDFFont; headX: PDFFont; body: PDFFont; bold: PDFFont }
type Ctx = { doc: PDFDocument; f: Fonts; logo: PDFImage; spec: Spec }

const asset = (name: string) => fs.readFileSync(path.join(process.cwd(), "lib/printables/assets", name))

// ---------- text ----------

const FALLBACK: Record<string, string> = { "‘": "'", "’": "'", "‚": ",", "“": '"', "”": '"', "„": '"', "→": "-", "←": "-", "×": "x", "≈": "~", "½": "1/2", "¼": "1/4", "¾": "3/4", "✓": "", "✔": "", "☐": "", "•": "·" }
const sets = new WeakMap<PDFFont, Set<number>>()
function safe(font: PDFFont, s: string): string {
  let set = sets.get(font)
  if (!set) sets.set(font, (set = new Set(font.getCharacterSet())))
  let out = ""
  for (const ch of s) {
    const cp = ch.codePointAt(0)!
    if (set.has(cp)) out += ch
    else if (FALLBACK[ch] !== undefined) out += [...FALLBACK[ch]].every((c) => set!.has(c.codePointAt(0)!)) ? FALLBACK[ch] : ""
    else if (/\s/.test(ch)) out += " "
  }
  return out
}

type Run = { t: string; b: boolean }
/** "Glue **one** side" → words, each knowing whether it is bold. */
function words(text: string): Run[] {
  const out: Run[] = []
  String(text || "")
    .split(/(\*\*[^*]+\*\*)/)
    .forEach((part) => {
      const b = /^\*\*[^*]+\*\*$/.test(part)
      for (const w of (b ? part.slice(2, -2) : part).split(/\s+/)) if (w) out.push({ t: w, b })
    })
  return out
}

type Line = Run[]
type Para = { lines: Line[]; size: number; lead: number; reg: PDFFont; bold: PDFFont }

function wrap(text: string, width: number, size: number, reg: PDFFont, bold: PDFFont, lead = size * 1.35): Para {
  const lines: Line[] = []
  let cur: Line = []
  let w = 0
  const space = (f: PDFFont) => f.widthOfTextAtSize(" ", size)
  for (const r of words(text)) {
    const f = r.b ? bold : reg
    const t = safe(f, r.t)
    if (!t) continue
    let ww = f.widthOfTextAtSize(t, size)
    // A single word wider than the line (a long URL): break it by characters.
    if (ww > width) {
      let part = ""
      for (const ch of t) {
        if (f.widthOfTextAtSize(part + ch, size) > width && part) {
          if (cur.length) lines.push(cur)
          lines.push([{ t: part, b: r.b }])
          cur = []
          w = 0
          part = ""
        }
        part += ch
      }
      if (part) {
        cur = [{ t: part, b: r.b }]
        w = f.widthOfTextAtSize(part, size)
      }
      continue
    }
    const add = cur.length ? space(f) + ww : ww
    if (cur.length && w + add > width) {
      lines.push(cur)
      cur = [{ t, b: r.b }]
      w = ww
    } else {
      cur.push({ t, b: r.b })
      w += add
    }
    ww = 0
  }
  if (cur.length) lines.push(cur)
  return { lines, size, lead, reg, bold }
}

const paraH = (p: Para) => (p.lines.length ? (p.lines.length - 1) * p.lead + p.size : 0)
const lineW = (p: Para, l: Line) => l.reduce((s, r, i) => s + (r.b ? p.bold : p.reg).widthOfTextAtSize(r.t, p.size) + (i ? (r.b ? p.bold : p.reg).widthOfTextAtSize(" ", p.size) : 0), 0)

/** Draws a paragraph whose first line's top is at `top` (page coordinates, top-down). */
function drawPara(pg: PDFPage, p: Para, x: number, top: number, color: RGB, align: "left" | "center" = "left", width = 0) {
  p.lines.forEach((l, i) => {
    let cx = align === "center" ? x + (width - lineW(p, l)) / 2 : x
    const base = H - (top + i * p.lead + p.size * 0.8)
    l.forEach((r, j) => {
      const f = r.b ? p.bold : p.reg
      if (j) cx += f.widthOfTextAtSize(" ", p.size)
      pg.drawText(r.t, { x: cx, y: base, size: p.size, font: f, color })
      cx += f.widthOfTextAtSize(r.t, p.size)
    })
  })
}

/** One line of text, shrunk to fit `max` width. */
function fitText(pg: PDFPage, s: string, font: PDFFont, size: number, x: number, top: number, color: RGB, max: number, align: "left" | "center" | "right" = "left") {
  const t = safe(font, s)
  let sz = size
  while (sz > 6 && font.widthOfTextAtSize(t, sz) > max) sz -= 0.25
  const w = font.widthOfTextAtSize(t, sz)
  const dx = align === "center" ? (max - w) / 2 : align === "right" ? max - w : 0
  pg.drawText(t, { x: x + dx, y: H - (top + sz * 0.8), size: sz, font, color })
}

// ---------- shapes ----------

function roundRect(pg: PDFPage, x: number, top: number, w: number, h: number, rad: number, o: { fill?: RGB; border?: RGB; bw?: number; dash?: number[] }) {
  const r = Math.min(rad, w / 2, h / 2)
  const d = `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
  pg.drawSvgPath(d, { x, y: H - top, color: o.fill, borderColor: o.border, borderWidth: o.border ? o.bw ?? 1 : 0, borderDashArray: o.dash })
}

function icon(pg: PDFPage, name: string, x: number, top: number, size: number, color: RGB, width = 1.8) {
  const paths = ICONS[name]
  if (!paths) return
  const s = size / 24
  for (const d of paths) pg.drawSvgPath(d, { x, y: H - top, scale: s, borderColor: color, borderWidth: width, borderLineCap: LineCapStyle.Round })
}

/** A round badge with an icon or a number in it. */
function badge(pg: PDFPage, f: Fonts, x: number, top: number, d: number, what: { icon?: string; n?: number }, fill: RGB, ink: RGB) {
  pg.drawCircle({ x: x + d / 2, y: H - (top + d / 2), size: d / 2, color: fill })
  if (what.icon && ICONS[what.icon]) icon(pg, what.icon, x + d * 0.2, top + d * 0.2, d * 0.6, ink, 1.7)
  else if (what.n !== undefined) fitText(pg, String(what.n), f.bold, d * 0.5, x, top + d * 0.27, ink, d, "center")
}

function checkbox(pg: PDFPage, x: number, top: number, s: number, color = C.sky) {
  roundRect(pg, x, top, s, s, s * 0.22, { fill: C.white, border: color, bw: 1.1 })
}

const hline = (pg: PDFPage, x1: number, x2: number, top: number, color = C.line, t = 0.8, dash?: number[]) => pg.drawLine({ start: { x: x1, y: H - top }, end: { x: x2, y: H - top }, thickness: t, color, dashArray: dash })
const vline = (pg: PDFPage, x: number, t1: number, t2: number, color = C.line, t = 0.8) => pg.drawLine({ start: { x, y: H - t1 }, end: { x, y: H - t2 }, thickness: t, color })

// ---------- units (what the page flow places) ----------

type Unit = {
  h: number
  draw: (pg: PDFPage, top: number) => void
  /** Keep on the same page as the next unit (headings). */
  keep?: boolean
  /** Start a new page: always for a page break, and for a section only when the page is already well used. */
  newPage?: boolean
  force?: boolean
  /** Space after this unit. */
  gap: number
  /** Extra space before it, unless it starts a page (section headings). */
  before?: number
  /** A heading row to repeat when this unit starts a page (tables). */
  head?: { h: number; draw: (pg: PDFPage, top: number) => void }
}

function titleUnit(f: Fonts, title: string | undefined, gap = 8): Unit[] {
  if (!title) return []
  const p = wrap(title, CW, 13.5, f.head, f.head, 17)
  return [{ h: paraH(p), gap, keep: true, draw: (pg, top) => drawPara(pg, p, MX, top, C.ink) }]
}

function cover(ctx: Ctx): Unit {
  const { f, spec, logo } = ctx
  const L = 54
  let tsz = 27
  let tp = wrap(spec.title, CW - 40, tsz, f.headX, f.headX, tsz * 1.1)
  while (tp.lines.length > 2 && tsz > 18) {
    tsz -= 1
    tp = wrap(spec.title, CW - 40, tsz, f.headX, f.headX, tsz * 1.1)
  }
  const sub = spec.subtitle ? wrap(spec.subtitle, CW - 80, 12, f.bold, f.bold, 15.5) : null
  const intro = spec.intro ? wrap(spec.intro, 440, 10.2, f.body, f.bold, 14.2) : null
  const chips = (spec.chips || []).map((c) => safe(f.bold, c)).filter(Boolean)
  const chipH = 19
  // Chips wrap onto more rows when they don't fit on one.
  const chipRows: string[][] = []
  let row: string[] = []
  let rw = 0
  for (const c of chips) {
    const w = f.bold.widthOfTextAtSize(c, 8.6) + 20
    if (row.length && rw + w + 6 > CW) {
      chipRows.push(row)
      row = []
      rw = 0
    }
    row.push(c)
    rw += w + 6
  }
  if (row.length) chipRows.push(row)
  let h = L + 10 + paraH(tp)
  if (sub) h += 7 + paraH(sub)
  if (intro) h += 11 + paraH(intro)
  if (chipRows.length) h += 14 + chipRows.length * (chipH + 6) - 6
  h += 18
  return {
    h,
    gap: 16,
    draw: (pg, top) => {
      pg.drawImage(logo, { x: (W - L) / 2, y: H - (top + L), width: L, height: L })
      let y = top + L + 10
      drawPara(pg, tp, MX + 20, y, C.ink, "center", CW - 40)
      y += paraH(tp)
      if (sub) {
        y += 7
        drawPara(pg, sub, MX + 40, y, C.coral, "center", CW - 80)
        y += paraH(sub)
      }
      if (intro) {
        y += 11
        drawPara(pg, intro, (W - 440) / 2, y, C.soft, "center", 440)
        y += paraH(intro)
      }
      if (chipRows.length) {
        y += 14
        for (const r of chipRows) {
          const ws = r.map((c) => f.bold.widthOfTextAtSize(c, 8.6) + 20)
          let x = (W - (ws.reduce((a, b) => a + b, 0) + 6 * (r.length - 1))) / 2
          r.forEach((c, i) => {
            roundRect(pg, x, y, ws[i], chipH, chipH / 2, { fill: C.skySoft })
            pg.drawText(c, { x: x + 10, y: H - (y + 13), size: 8.6, font: f.bold, color: C.sky })
            x += ws[i] + 6
          })
          y += chipH + 6
        }
        y -= 6
      }
      hline(pg, MX + 60, W - MX - 60, y + 16, C.line, 1.2, [4, 4])
    },
  }
}

function section(f: Fonts, b: Extract<Block, { type: "section" }>): Unit[] {
  const ic = b.icon && ICONS[b.icon] ? 24 : 0
  const tp = wrap(b.title, CW - (ic ? ic + 9 : 0), 17, f.headX, f.headX, 20)
  const text = b.text ? wrap(b.text, CW, 10.2, f.body, f.bold, 14) : null
  const th = Math.max(ic, paraH(tp))
  const h = th + (text ? 6 + paraH(text) : 0)
  return [
    {
      h,
      gap: 11,
      before: 10,
      keep: true,
      newPage: b.newPage,
      draw: (pg, top) => {
        if (ic) badge(pg, f, MX, top + (th - ic) / 2, ic, { icon: b.icon }, C.coralSoft, C.coral)
        drawPara(pg, tp, MX + (ic ? ic + 9 : 0), top + (th - paraH(tp)) / 2, C.ink)
        if (text) drawPara(pg, text, MX, top + th + 6, C.soft)
      },
    },
  ]
}

// ----- cards -----

type CardLayout = { h: number; draw: (pg: PDFPage, x: number, top: number, h: number) => void }

function cardLayout(f: Fonts, c: Card, n: number, w: number, cut: boolean): CardLayout {
  const P = 11
  const inner = w - 2 * P
  const B = 20
  const title = wrap(c.title, inner - B - 7, 12, f.head, f.head, 14.5)
  const th = Math.max(B, paraH(title))
  const meta = c.meta?.length ? wrap(c.meta.join("  ·  "), inner, 8.4, f.bold, f.bold, 11) : null
  const text = c.text ? wrap(c.text, inner, 9.4, f.body, f.bold, 12.6) : null
  const items = (c.list || []).map((it) => wrap(it, inner - 13, 9.2, f.body, f.bold, 12.2))
  const tip = c.tip ? wrap(`**Tip:** ${c.tip}`, inner - 10, 8.8, f.body, f.bold, 11.8) : null
  let h = P + th
  if (meta) h += 5 + paraH(meta)
  if (text) h += 7 + paraH(text)
  if (items.length) h += 7 + items.reduce((s, p) => s + paraH(p), 0) + 4 * (items.length - 1)
  if (tip) h += 8 + paraH(tip) + 10
  h += P
  return {
    h,
    draw: (pg, x, top, hh) => {
      roundRect(pg, x, top, w, hh, 10, cut ? { fill: C.white, border: C.coral, bw: 1, dash: [5, 3.5] } : { fill: C.paper, border: C.line, bw: 1 })
      if (cut) {
        pg.drawRectangle({ x: x + 10, y: H - (top + 6), width: 14, height: 12, color: C.white })
        icon(pg, "scissors", x + 11, top - 6, 12, C.coral, 1.5)
      }
      let y = top + P
      badge(pg, f, x + P, y + (th - B) / 2, B, c.icon ? { icon: c.icon } : { n }, c.icon ? C.coralSoft : C.coral, c.icon ? C.coral : C.white)
      drawPara(pg, title, x + P + B + 7, y + (th - paraH(title)) / 2, C.ink)
      y += th
      if (meta) {
        y += 5
        drawPara(pg, meta, x + P, y, C.sky)
        y += paraH(meta)
      }
      if (text) {
        y += 7
        drawPara(pg, text, x + P, y, C.ink)
        y += paraH(text)
      }
      if (items.length) {
        y += 7
        items.forEach((p, i) => {
          if (c.numbered) fitText(pg, `${i + 1}.`, f.bold, 9.2, x + P, y, C.coral, 12)
          else pg.drawCircle({ x: x + P + 3, y: H - (y + 4.6), size: 1.8, color: C.coral })
          drawPara(pg, p, x + P + 13, y, C.ink)
          y += paraH(p) + 4
        })
        y -= 4
      }
      if (tip) {
        y += 8
        const th2 = paraH(tip) + 10
        roundRect(pg, x + P - 2, y, inner + 4, th2, 6, { fill: C.mossSoft })
        drawPara(pg, tip, x + P + 3, y + 5, C.soft)
      }
    },
  }
}

function cards(f: Fonts, b: Extract<Block, { type: "cards" }>): Unit[] {
  const cols = b.columns || 2
  const gap = 12
  const w = (CW - gap * (cols - 1)) / cols
  const max = BOTTOM - TOP - 4
  const lay = b.cards.map((c, i) => cardLayout(f, c, i + 1, w, !!b.cut))
  const units: Unit[] = []
  for (let i = 0; i < lay.length; i += cols) {
    const row = lay.slice(i, i + cols)
    const h = Math.min(max, Math.max(...row.map((r) => r.h)))
    units.push({ h, gap: b.cut ? 14 : 12, draw: (pg, top) => row.forEach((r, j) => r.draw(pg, MX + j * (w + gap), top, h)) })
  }
  return units
}

// ----- lists -----

function checklist(f: Fonts, b: Extract<Block, { type: "checklist" }>): Unit[] {
  const cols = b.columns || 1
  const gap = 22
  const w = (CW - gap * (cols - 1)) / cols
  const S = 12
  const paras = b.items.map((it) => wrap(it, w - S - 9, 10, f.body, f.bold, 13.4))
  const units: Unit[] = [...titleUnit(f, b.title)]
  for (let i = 0; i < paras.length; i += cols) {
    const row = paras.slice(i, i + cols)
    const h = Math.max(S, ...row.map(paraH))
    units.push({
      h,
      gap: 8,
      draw: (pg, top) =>
        row.forEach((p, j) => {
          const x = MX + j * (w + gap)
          checkbox(pg, x, top, S)
          drawPara(pg, p, x + S + 9, top + Math.max(0, (S - p.size) / 2 - 0.5), C.ink)
        }),
    })
  }
  return units
}

function list(f: Fonts, b: Extract<Block, { type: "list" }>): Unit[] {
  const cols = b.columns || 1
  const gap = 22
  const w = (CW - gap * (cols - 1)) / cols
  const paras = b.items.map((it) => wrap(it, w - 13, 10, f.body, f.bold, 13.6))
  const units: Unit[] = [...titleUnit(f, b.title)]
  for (let i = 0; i < paras.length; i += cols) {
    const row = paras.slice(i, i + cols)
    units.push({
      h: Math.max(...row.map(paraH)),
      gap: 6,
      draw: (pg, top) =>
        row.forEach((p, j) => {
          const x = MX + j * (w + gap)
          pg.drawCircle({ x: x + 3, y: H - (top + 5), size: 2.1, color: C.coral })
          drawPara(pg, p, x + 13, top, C.ink)
        }),
    })
  }
  return units
}

function steps(f: Fonts, b: Extract<Block, { type: "steps" }>): Unit[] {
  const B = 18
  return [
    ...titleUnit(f, b.title),
    ...b.steps.map((s, i) => {
      const p = wrap(s, CW - B - 10, 10, f.body, f.bold, 13.6)
      const h = Math.max(B, paraH(p))
      return {
        h,
        gap: 8,
        draw: (pg: PDFPage, top: number) => {
          badge(pg, f, MX, top, B, { n: i + 1 }, C.coral, C.white)
          drawPara(pg, p, MX + B + 10, top + Math.max(0, (B - paraH(p)) / 2), C.ink)
        },
      }
    }),
  ]
}

function lines(f: Fonts, b: Extract<Block, { type: "lines" }>): Unit[] {
  const n = b.lines || 2
  return [
    ...titleUnit(f, b.title),
    ...b.prompts.map((s) => {
      const p = wrap(s, CW, 10.4, f.bold, f.bold, 13.8)
      const h = paraH(p) + n * 24
      return {
        h,
        gap: 12,
        draw: (pg: PDFPage, top: number) => {
          drawPara(pg, p, MX, top, C.ink)
          for (let k = 1; k <= n; k++) hline(pg, MX, W - MX, top + paraH(p) + k * 24, C.line, 0.9)
        },
      }
    }),
  ]
}

function tip(f: Fonts, b: Extract<Block, { type: "tip" }>): Unit[] {
  const label = b.title ? (/[:.!?]$/.test(b.title) ? b.title : `${b.title}:`) : "Tip:"
  const t = wrap(`**${label}** ${b.text}`, CW - 34, 9.8, f.body, f.bold, 13.4)
  const h = paraH(t) + 20
  return [
    {
      h,
      gap: 12,
      draw: (pg, top) => {
        roundRect(pg, MX, top, CW, h, 8, { fill: C.mossSoft })
        pg.drawRectangle({ x: MX, y: H - (top + h - 6), width: 3, height: h - 12, color: C.moss })
        icon(pg, "lightbulb", MX + 10, top + 9, 13, C.moss, 1.6)
        drawPara(pg, t, MX + 28, top + 10, C.ink)
      },
    },
  ]
}

// ----- grids -----

function grid(
  f: Fonts,
  title: string | undefined,
  head: string[],
  firstW: number | number[],
  rows: { cells: ((pg: PDFPage, x: number, top: number, w: number, h: number) => void)[]; h: number }[],
  headFirst = "",
  align: "left" | "center" = "center",
): Unit[] {
  // Either the first column's width (the rest share what is left) or every column's width.
  const widths = Array.isArray(firstW) ? firstW : [firstW, ...head.map(() => (CW - firstW) / head.length)]
  const xs = widths.map((_, i) => MX + widths.slice(0, i).reduce((a, b) => a + b, 0))
  const HH = 22
  const headRow = {
    h: HH,
    draw: (pg: PDFPage, top: number) => {
      roundRect(pg, MX, top, CW, HH, 5, { fill: C.sky })
      pg.drawRectangle({ x: MX, y: H - (top + HH), width: CW, height: HH / 2, color: C.sky })
      if (headFirst) fitText(pg, headFirst, f.bold, 9, MX + 7, top + 6.5, C.white, widths[0] - 12)
      head.forEach((c, i) => (align === "left" ? fitText(pg, c, f.bold, 9, xs[i + 1] + 7, top + 6.5, C.white, widths[i + 1] - 12) : fitText(pg, c, f.bold, 9, xs[i + 1] + 2, top + 6.5, C.white, widths[i + 1] - 4, "center")))
    },
  }
  const units: Unit[] = [...titleUnit(f, title)]
  rows.forEach((r, i) => {
    units.push({
      h: r.h + (i === 0 ? HH : 0),
      gap: 0,
      head: headRow,
      draw: (pg, top0) => {
        let top = top0
        if (i === 0) {
          headRow.draw(pg, top)
          top += HH
        }
        if (i % 2 === 1) pg.drawRectangle({ x: MX, y: H - (top + r.h), width: CW, height: r.h, color: C.paper })
        r.cells.forEach((cell, j) => cell(pg, xs[j], top, widths[j], r.h))
        hline(pg, MX, W - MX, top + r.h)
        for (let j = 1; j < xs.length; j++) vline(pg, xs[j], top, top + r.h)
        vline(pg, MX, top, top + r.h)
        vline(pg, W - MX, top, top + r.h)
      },
    })
  })
  if (units.length) units[units.length - 1].gap = 14
  return units
}

function chart(f: Fonts, b: Extract<Block, { type: "chart" }>): Unit[] {
  const firstW = b.columns.length >= 6 ? 168 : b.columns.length >= 4 ? 200 : 240
  const rows = b.rows.map((r) => {
    const ic = r.icon && ICONS[r.icon] ? 14 : 0
    const p = wrap(r.label, firstW - 16 - (ic ? ic + 6 : 0), 9.8, f.bold, f.bold, 12.4)
    const h = Math.max(30, paraH(p) + 14)
    return {
      h,
      cells: [
        (pg: PDFPage, x: number, top: number, _w: number, hh: number) => {
          if (ic) icon(pg, r.icon!, x + 8, top + (hh - ic) / 2, ic, C.sky, 1.6)
          drawPara(pg, p, x + 8 + (ic ? ic + 6 : 0), top + (hh - paraH(p)) / 2, C.ink)
        },
        ...b.columns.map(() => (pg: PDFPage, x: number, top: number, w: number, hh: number) => checkbox(pg, x + (w - 13) / 2, top + (hh - 13) / 2, 13, C.line)),
      ],
    }
  })
  return grid(f, b.title, b.columns, firstW, rows)
}

function planner(f: Fonts, b: Extract<Block, { type: "planner" }>): Unit[] {
  const firstW = b.columns.length >= 6 ? 96 : 120
  const rows = b.rows.map((label) => {
    const p = wrap(label, firstW - 14, 9.6, f.bold, f.bold, 12)
    return {
      h: Math.max(b.tall ? 62 : 40, paraH(p) + 14),
      cells: [(pg: PDFPage, x: number, top: number) => drawPara(pg, p, x + 7, top + 7, C.ink), ...b.columns.map(() => () => {})],
    }
  })
  return grid(f, b.title, b.columns, firstW, rows, "", "left")
}

function table(f: Fonts, b: Extract<Block, { type: "table" }>): Unit[] {
  const n = b.head.length
  // Columns share the width by how much text they hold (short columns like "Age" stay narrow).
  const weight = b.head.map((h, j) => {
    const cells = [h, ...b.rows.map((r) => r[j] || "")]
    const avg = cells.reduce((a, c) => a + c.length, 0) / cells.length
    const longest = Math.max(...cells.map((c) => Math.max(...c.split(/\s+/).map((w) => w.length))))
    return Math.max(longest * 0.9, Math.min(60, avg), 5)
  })
  const sum = weight.reduce((a, b) => a + b, 0)
  let widths = weight.map((w) => Math.max(56, (w / sum) * CW))
  const over = widths.reduce((a, b) => a + b, 0) - CW
  if (over > 0) {
    const big = widths.map((w) => (w > 56 ? w - 56 : 0))
    const room = big.reduce((a, b) => a + b, 0) || 1
    widths = widths.map((w, i) => w - (big[i] / room) * over)
  }
  const rows = b.rows.map((r) => {
    const ps = r.map((c, j) => wrap(c, widths[j] - 14, 9.4, j === 0 ? f.bold : f.body, f.bold, 12.4))
    return { h: Math.max(26, ...ps.map((p) => paraH(p) + 13)), cells: ps.map((p) => (pg: PDFPage, x: number, top: number) => drawPara(pg, p, x + 7, top + 7, C.ink)) }
  })
  // The first heading sits over the first column; the grid helper takes the rest.
  return grid(f, b.title, b.head.slice(1), widths, rows, b.head[0], "left")
}

function shapes(f: Fonts, b: Extract<Block, { type: "shapes" }>): Unit[] {
  const S = b.size === "small" ? 104 : b.size === "large" ? 230 : 156
  const gap = 18
  const cols = Math.max(1, Math.floor((CW + gap) / (S + gap)))
  const units: Unit[] = [
    ...titleUnit(f, b.title, 4),
    {
      h: 12,
      gap: 10,
      keep: true,
      draw: (pg, top) => {
        icon(pg, "scissors", MX, top - 1, 11, C.coral, 1.4)
        fitText(pg, "Trace or print on card stock, then cut along the dashed line.", f.body, 8.8, MX + 16, top, C.faint, CW - 16)
      },
    },
  ]
  for (let i = 0; i < b.shapes.length; i += cols) {
    const row = b.shapes.slice(i, i + cols)
    const total = row.length * S + (row.length - 1) * gap
    units.push({
      h: S + 18,
      gap: 14,
      draw: (pg, top) =>
        row.forEach((s, j) => {
          const x = MX + (CW - total) / 2 + j * (S + gap)
          const sh = SHAPES[s.shape]
          for (const d of sh.paths) pg.drawSvgPath(d, { x, y: H - top, scale: S / 100, borderColor: C.coral, borderWidth: 1.3, borderDashArray: [5, 3.5], borderLineCap: LineCapStyle.Round })
          fitText(pg, s.label || sh.label, f.bold, 9, x, top + S + 6, C.soft, S, "center")
        }),
    })
  }
  return units
}

function unitsFor(f: Fonts, b: Block): Unit[] {
  switch (b.type) {
    case "section":
      return section(f, b)
    case "cards":
      return cards(f, b)
    case "checklist":
      return checklist(f, b)
    case "chart":
      return chart(f, b)
    case "planner":
      return planner(f, b)
    case "steps":
      return steps(f, b)
    case "table":
      return table(f, b)
    case "lines":
      return lines(f, b)
    case "list":
      return list(f, b)
    case "tip":
      return tip(f, b)
    case "shapes":
      return shapes(f, b)
    case "pagebreak":
      return [{ h: 0, gap: 0, newPage: true, force: true, draw: () => {} }]
  }
}

// ---------- page frame ----------

function frame(ctx: Ctx, pg: PDFPage, n: number, total: number) {
  const { f, logo, spec } = ctx
  if (n > 1) {
    pg.drawImage(logo, { x: MX, y: H - 46, width: 20, height: 20 })
    pg.drawText("nestoodle", { x: MX + 25, y: H - 40, size: 12.5, font: f.headX, color: C.coral })
    fitText(pg, spec.title, f.body, 8.6, MX + 120, 31.5, C.faint, CW - 120, "right")
    hline(pg, MX, W - MX, 52, C.line, 1, [3, 3])
  }
  hline(pg, MX, W - MX, H - 44, C.line, 1, [3, 3])
  pg.drawText(safe(f.body, "nestoodle.com · Free printable for personal and classroom use"), { x: MX, y: 30, size: 8.2, font: f.body, color: C.faint })
  const pn = `Page ${n} of ${total}`
  pg.drawText(pn, { x: W - MX - f.bold.widthOfTextAtSize(pn, 8.2), y: 30, size: 8.2, font: f.bold, color: C.faint })
}

// ---------- the document ----------

export type RenderResult = { pdf: Uint8Array; pages: number }

export async function renderPrintable(spec: Spec, o: { postTitle?: string; postUrl?: string } = {}): Promise<RenderResult> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const f: Fonts = {
    head: await doc.embedFont(asset("Baloo2-Bold.ttf"), { subset: true }),
    headX: await doc.embedFont(asset("Baloo2-ExtraBold.ttf"), { subset: true }),
    body: await doc.embedFont(asset("Karla-Regular.ttf"), { subset: true }),
    bold: await doc.embedFont(asset("Karla-Bold.ttf"), { subset: true }),
  }
  const logo = await doc.embedPng(asset("logo.png"))
  const ctx: Ctx = { doc, f, logo, spec }

  const units: Unit[] = [cover(ctx), ...spec.blocks.flatMap((b) => unitsFor(f, b))]
  // Something to close on: where the printable came from.
  if (o.postTitle) {
    const p = wrap(`From “${o.postTitle}” on ${o.postUrl ? o.postUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") : "nestoodle.com"}. More free printables at nestoodle.com.`, CW, 8.8, f.body, f.bold, 12)
    units.push({ h: paraH(p) + 10, gap: 0, draw: (pg, top) => drawPara(pg, p, MX, top + 10, C.faint, "center", CW) })
  }

  const pages: PDFPage[] = []
  let pg = doc.addPage([W, H])
  pages.push(pg)
  let top = TOP_FIRST
  let pageTop = TOP_FIRST
  let fresh = true
  const newPage = () => {
    pg = doc.addPage([W, H])
    pages.push(pg)
    top = pageTop = TOP
    fresh = true
  }
  for (let i = 0; i < units.length; i++) {
    const u = units[i]
    // A section that asks for a new page gets one only when this page is already well used (over 62%), so pages aren't left mostly empty.
    if (u.newPage && !fresh && (u.force || top - pageTop > (BOTTOM - pageTop) * 0.62)) newPage()
    if (u.h === 0) continue
    // Headings come along with the unit that follows them.
    let need = u.h
    for (let k = i; units[k]?.keep && units[k + 1]; k++) need += units[k].gap + units[k + 1].h
    const before = fresh ? 0 : u.before || 0
    if (top + before + need > BOTTOM && !fresh) newPage()
    else top += before
    // A table row that starts a page brings the heading row back (the first row already has it).
    if (fresh && u.head && top === TOP && i > 0 && units[i - 1].head === u.head) {
      u.head.draw(pg, top)
      top += u.head.h
    }
    u.draw(pg, top)
    top += u.h + u.gap
    fresh = false
    if (pages.length > 24) break
  }
  pages.forEach((p, i) => frame(ctx, p, i + 1, pages.length))

  doc.setTitle(`Nestoodle - ${spec.title}`)
  doc.setAuthor("Nestoodle")
  doc.setSubject(spec.subtitle || "Free printable from nestoodle.com")
  doc.setKeywords(["Nestoodle", "printable", ...(spec.chips || [])])
  doc.setCreator("Nestoodle")
  doc.setProducer("Nestoodle")
  doc.setLanguage("en-US")
  const now = new Date()
  doc.setCreationDate(now)
  doc.setModificationDate(now)
  return { pdf: await doc.save(), pages: pages.length }
}
