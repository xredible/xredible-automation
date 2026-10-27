// lib/printables/spec.ts
//
// What a printable is made of. Safe to import from client code.
//
// A printable is a list of blocks (cards, a checklist, a tick chart, a planner, steps,
// write-in prompts, a key verse, fill-in-the-blank notes, cut-out shapes…). The AI drafts one
// from an article or a sermon, someone edits it on the dashboard's Printables page, and
// lib/printables/pdf.ts lays it out in the workspace's own design (lib/printables/themes.ts;
// Letter size, safe for A4).

import { ICON_NAMES } from "./icons"
import { SHAPE_NAMES } from "./shapes"

export type Card = {
  title: string
  icon?: string
  /** Short facts shown as small labels, e.g. "Ages 3–6", "10 min", "Low mess". */
  meta?: string[]
  text?: string
  list?: string[]
  /** The list is numbered steps rather than bullet points. */
  numbered?: boolean
  tip?: string
}

export type Block =
  | { type: "section"; title: string; text?: string; icon?: string; newPage?: boolean }
  | { type: "cards"; columns?: 1 | 2 | 3; cut?: boolean; cards: Card[] }
  | { type: "checklist"; title?: string; columns?: 1 | 2; items: string[] }
  | { type: "chart"; title?: string; columns: string[]; rows: { label: string; icon?: string }[] }
  | { type: "planner"; title?: string; columns: string[]; rows: string[]; tall?: boolean }
  | { type: "steps"; title?: string; steps: string[] }
  | { type: "table"; title?: string; head: string[]; rows: string[][] }
  | { type: "lines"; title?: string; prompts: string[]; lines?: number }
  | { type: "list"; title?: string; items: string[]; columns?: 1 | 2 }
  | { type: "tip"; title?: string; text: string }
  | { type: "shapes"; title?: string; size?: "small" | "medium" | "large"; shapes: { shape: string; label?: string }[] }
  /** A Bible verse (or any quotation) in a highlighted box, word for word, with its reference. */
  | { type: "verse"; text: string; ref?: string }
  /** Fill-in-the-blank points: [[answer]] becomes a blank line; the answers are printed small at the end. */
  | { type: "blanks"; title?: string; items: string[]; answers?: boolean }
  | { type: "pagebreak" }

export type BlockType = Block["type"]

export type Spec = {
  title: string
  subtitle?: string
  intro?: string
  /** Small labels under the title, e.g. "Ages 3–8", "12 crafts", "Paper only". */
  chips?: string[]
  /** Written in Hindi: laid out with a Devanagari font and Hindi page words. */
  lang?: "en" | "hi"
  blocks: Block[]
}

/** An article, as the Printables page lists it. */
export type PrintablePost = {
  id: number
  title: string
  status: string
  link: string
  slug: string
  date: string
  modified: string
  /** The download the article has now (its File block), if any. */
  file: { mediaId: number | null; href: string; name: string; text: string } | null
  /** The blog writer left an "[Add download: …]" spot for it. */
  spot: boolean
}

/** One article's printable (n8n data table "XD NST Printables"). */
export type PrintableRow = {
  id: number
  postId: number
  status: "drafting" | "draft" | "published" | "failed"
  title: string
  postTitle: string
  postLink: string
  spec: Spec | null
  fileName: string
  linkText: string
  source: string
  mediaId: number | null
  mediaUrl: string
  oldMediaUrl: string
  pages: number
  error: string
  changedAt: string
  publishedAt: string
}

export const BLOCK_TYPES:{ type: BlockType; label: string; hint: string }[] = [
  { type: "section", label: "Section heading", hint: "A heading with a short intro. Tick “start on a new page” for a fresh page." },
  { type: "cards", label: "Activity cards", hint: "Cards with a title, labels, text, steps and a tip. Tick “cut-out” for dashed cut lines." },
  { type: "checklist", label: "Checklist", hint: "Tick boxes, one item per line." },
  { type: "chart", label: "Tick chart", hint: "Rows (tasks) × columns (days). A box to tick in every cell." },
  { type: "planner", label: "Planner grid", hint: "Rows × columns with space to write in." },
  { type: "steps", label: "Numbered steps", hint: "One step per line." },
  { type: "table", label: "Table", hint: "Heading row and rows of text, columns separated by |." },
  { type: "lines", label: "Write-in prompts", hint: "Each prompt gets lines to write on." },
  { type: "list", label: "Bullet list", hint: "One item per line." },
  { type: "tip", label: "Tip box", hint: "A short tip, prayer or note in a colored box." },
  { type: "verse", label: "Key verse", hint: "A Bible verse word for word, with its reference, in a highlighted box." },
  { type: "blanks", label: "Fill-in-the-blank notes", hint: "One point per line; put the missing word in [[double brackets]]. The answers print small at the end." },
  { type: "shapes", label: "Cut-out shapes", hint: "Outline templates to trace and cut." },
  { type: "pagebreak", label: "Page break", hint: "Starts a new page." },
]

// ---------- clean-up (AI answers and edits both pass through this) ----------

const LIMIT = { title: 90, sub: 160, intro: 700, chip: 28, chips: 6, blocks: 60, cards: 24, cardText: 420, item: 160, items: 40, cols: 8, rows: 24, cell: 120, shapes: 12 }

const str = (v: unknown, max: number) =>
  typeof v === "string"
    ? v
        .replace(/\p{Extended_Pictographic}/gu, "")
        .replace(/[‍️]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : ""
const strs = (v: unknown, max: number, count: number): string[] => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, count) : typeof v === "string" ? strs(v.split(/\n+/), max, count) : [])
const icon = (v: unknown) => {
  const s = str(v, 30).toLowerCase()
  return ICON_NAMES.includes(s) ? s : undefined
}
const opt = <T>(v: T | undefined | "" | false) => (v === "" || v === false || v === undefined || (Array.isArray(v) && !v.length) ? undefined : v)

function card(v: unknown): Card | null {
  const c = (v || {}) as Record<string, unknown>
  const title = str(c.title, LIMIT.title)
  if (!title) return null
  return {
    title,
    icon: icon(c.icon),
    meta: opt(strs(c.meta, LIMIT.chip, 4)),
    text: opt(str(c.text, LIMIT.cardText)),
    list: opt(strs(c.list, LIMIT.item, 10)),
    numbered: c.numbered === true ? true : undefined,
    tip: opt(str(c.tip, 220)),
  }
}

function block(v: unknown): Block | null {
  const b = (v || {}) as Record<string, unknown>
  const title = opt(str(b.title, LIMIT.title))
  switch (b.type) {
    case "section": {
      const t = str(b.title, LIMIT.title)
      return t ? { type: "section", title: t, text: opt(str(b.text, LIMIT.intro)), icon: icon(b.icon), newPage: b.newPage === true ? true : undefined } : null
    }
    case "cards": {
      const cards = (Array.isArray(b.cards) ? b.cards : []).map(card).filter((c): c is Card => !!c).slice(0, LIMIT.cards)
      const columns = [1, 2, 3].includes(Number(b.columns)) ? (Number(b.columns) as 1 | 2 | 3) : 2
      return cards.length ? { type: "cards", columns, cut: b.cut === true ? true : undefined, cards } : null
    }
    case "checklist": {
      const items = strs(b.items, LIMIT.item, LIMIT.items)
      return items.length ? { type: "checklist", title, columns: Number(b.columns) === 1 ? 1 : items.length > 6 ? 2 : 1, items } : null
    }
    case "chart": {
      const columns = strs(b.columns, 14, LIMIT.cols)
      const rows = (Array.isArray(b.rows) ? b.rows : [])
        .map((r) => (typeof r === "string" ? { label: str(r, 60) } : { label: str((r as Record<string, unknown>)?.label, 60), icon: icon((r as Record<string, unknown>)?.icon) }))
        .filter((r) => r.label)
        .slice(0, LIMIT.rows)
      return columns.length && rows.length ? { type: "chart", title, columns, rows } : null
    }
    case "planner": {
      const columns = strs(b.columns, 24, 7)
      const rows = strs(b.rows, 40, LIMIT.rows)
      return columns.length && rows.length ? { type: "planner", title, columns, rows, tall: b.tall === true ? true : undefined } : null
    }
    case "steps": {
      const steps = strs(b.steps, 260, 20)
      return steps.length ? { type: "steps", title, steps } : null
    }
    case "table": {
      const head = strs(b.head, 40, 5)
      const n = head.length
      const rows = (Array.isArray(b.rows) ? b.rows : [])
        .map((r) => (Array.isArray(r) ? r : String(r ?? "").split("|")).map((x) => str(x, LIMIT.cell)))
        .filter((r) => r.some(Boolean))
        .map((r) => Array.from({ length: n }, (_, i) => r[i] || ""))
        .slice(0, 30)
      return n && rows.length ? { type: "table", title, head, rows } : null
    }
    case "lines": {
      const prompts = strs(b.prompts, 200, 16)
      const lines = Math.min(8, Math.max(1, Math.round(Number(b.lines) || 2)))
      return prompts.length ? { type: "lines", title, prompts, lines } : null
    }
    case "list": {
      const items = strs(b.items, 260, LIMIT.items)
      return items.length ? { type: "list", title, items, columns: Number(b.columns) === 2 ? 2 : 1 } : null
    }
    case "tip": {
      const text = str(b.text, 500)
      return text ? { type: "tip", title, text } : null
    }
    case "shapes": {
      const shapes = (Array.isArray(b.shapes) ? b.shapes : [])
        .map((s) => (typeof s === "string" ? { shape: s } : (s as Record<string, unknown>)))
        .map((s) => ({ shape: str(s?.shape, 20).toLowerCase(), label: opt(str(s?.label, 40)) }))
        .filter((s) => SHAPE_NAMES.includes(s.shape))
        .slice(0, LIMIT.shapes)
      const size = ["small", "medium", "large"].includes(String(b.size)) ? (b.size as "small" | "medium" | "large") : "medium"
      return shapes.length ? { type: "shapes", title, size, shapes } : null
    }
    case "verse": {
      const text = str(b.text, 700)
      return text ? { type: "verse", text, ref: opt(str(b.ref, 80)) } : null
    }
    case "blanks": {
      const items = strs(b.items, 300, 20)
      return items.length ? { type: "blanks", title, items, answers: b.answers === false ? false : undefined } : null
    }
    case "pagebreak":
      return { type: "pagebreak" }
  }
  return null
}

/** Any input (AI answer, saved row, an edit) → a printable that is safe to lay out, or null. */
export function cleanSpec(v: unknown): Spec | null {
  const s = (v || {}) as Record<string, unknown>
  const title = str(s.title, LIMIT.title)
  if (!title) return null
  const blocks = (Array.isArray(s.blocks) ? s.blocks : []).map(block).filter((b): b is Block => !!b).slice(0, LIMIT.blocks)
  // No page breaks at the very start or twice in a row.
  const tidy = blocks.filter((b, i) => b.type !== "pagebreak" || (i > 0 && blocks[i - 1].type !== "pagebreak" && i < blocks.length - 1))
  if (!tidy.some((b) => b.type !== "section" && b.type !== "pagebreak")) return null
  return { title, subtitle: opt(str(s.subtitle, LIMIT.sub)), intro: opt(str(s.intro, LIMIT.intro)), chips: opt(strs(s.chips, LIMIT.chip, LIMIT.chips)), lang: s.lang === "hi" ? "hi" : undefined, blocks: tidy }
}

// ---------- names ----------

/** "Nestoodle - Diwali Craft Templates" style words, without the brand, "Free" or "Printable(s)". */
export function cleanLinkText(s: string, brand = "Nestoodle"): string {
  const b = brand.replace(/[-_]+/g, " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s-]*")
  return str(s, 90)
    .replace(new RegExp(`^${b}\\s*[-–—:|]\\s*`, "i"), "")
    .replace(/^free\s+/i, "")
    .replace(/[\[\]]/g, "")
    .trim()
}

/** The file name downloads are saved as: Nestoodle-Diwali-Craft-Templates.pdf (Latin letters only). */
export function fileNameFor(title: string, prefix = "Nestoodle"): string {
  const base = cleanLinkText(title, prefix)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&|\+/g, " and ")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .split("-")
    .filter((w) => w && !/^(printables?|free|nestoodle)$/i.test(w) && !prefix.toLowerCase().split("-").includes(w.toLowerCase()))
    .map((w) => (/^[a-z]/.test(w) && w.length > 2 && !/^(and|for|the|with|to|of|in|on|at)$/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join("-")
    .slice(0, 70)
    .replace(/-+$/, "")
  return `${prefix}-${base || "Printable"}.pdf`
}

/** A short summary for lists: "12 cards · checklist · tick chart". */
export function describe(spec: Spec): string {
  const parts: string[] = []
  for (const b of spec.blocks) {
    if (b.type === "cards") parts.push(`${b.cards.length} card${b.cards.length === 1 ? "" : "s"}`)
    else if (b.type !== "section" && b.type !== "pagebreak" && b.type !== "tip" && b.type !== "verse") parts.push(BLOCK_TYPES.find((t) => t.type === b.type)!.label.toLowerCase())
  }
  return [...new Set(parts)].slice(0, 5).join(" · ")
}
