// lib/dashboard/blocks.ts
//
// Reads WordPress block markup into simple editable blocks and writes it back, for
// the dashboard's blog editor. Paragraphs, headings, lists and Yoast FAQ blocks are
// editable; anything else (images, embeds, custom HTML) is kept exactly as it was.
// A block that wasn't edited is written back byte for byte. The markup matches what
// the blog writer produces (ops/n8n/automations/nestoodle-blog/writer.js).

export type Block =
  | { kind: "paragraph"; text: string; raw?: string }
  | { kind: "heading"; level: number; text: string; raw?: string }
  | { kind: "list"; ordered: boolean; items: string[]; raw?: string }
  | { kind: "faq"; items: { q: string; a: string }[]; raw?: string }
  | { kind: "other"; name: string; raw: string }

const OPEN = /<!--\s+wp:([a-z0-9][a-z0-9/_-]*)(\s+(\{[\s\S]*?\}))?\s+(\/)?-->/g

const decode = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
const inner = (html: string, tag: string) => {
  const m = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*)</${tag}>`, "i").exec(html)
  return m ? m[1].trim() : html.trim()
}

function parseOne(name: string, attrs: Record<string, unknown>, body: string, raw: string): Block {
  if (name === "paragraph") return { kind: "paragraph", text: inner(body, "p"), raw }
  if (name === "heading") {
    const level = Number(attrs.level) || 2
    return { kind: "heading", level, text: inner(body, `h${level}`), raw }
  }
  if (name === "list") {
    const items: string[] = []
    const re = /<li\b[^>]*>([\s\S]*?)<\/li>/gi
    let m
    while ((m = re.exec(body))) items.push(m[1].trim())
    return { kind: "list", ordered: !!attrs.ordered, items, raw }
  }
  if (name === "yoast/faq-block" && Array.isArray(attrs.questions)) {
    const items = (attrs.questions as { jsonQuestion?: string; jsonAnswer?: string; question?: unknown; answer?: unknown }[]).map((q) => ({
      q: decode(String(q.jsonQuestion ?? (Array.isArray(q.question) ? q.question.join("") : ""))),
      a: decode(String(q.jsonAnswer ?? (Array.isArray(q.answer) ? q.answer.join("") : ""))),
    }))
    return { kind: "faq", items, raw }
  }
  return { kind: "other", name, raw }
}

export function parseBlocks(markup: string): Block[] {
  const out: Block[] = []
  let pos = 0
  const pushFree = (s: string) => {
    if (s.trim()) out.push({ kind: "other", name: "html", raw: s.trim() })
  }
  OPEN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = OPEN.exec(markup))) {
    if (m.index < pos) continue
    pushFree(markup.slice(pos, m.index))
    const name = m[1]
    let attrs: Record<string, unknown> = {}
    try {
      attrs = m[3] ? JSON.parse(m[3]) : {}
    } catch {}
    const openEnd = m.index + m[0].length
    if (m[4]) {
      out.push({ kind: "other", name, raw: m[0] })
      pos = openEnd
      continue
    }
    // Find the matching closer, allowing the same block nested inside.
    const esc = name.replace(/[/]/g, "\\/")
    const tag = new RegExp(`<!--\\s+(\\/)?wp:${esc}(\\s+\\{[\\s\\S]*?\\})?\\s+(\\/)?-->`, "g")
    tag.lastIndex = openEnd
    let depth = 1
    let close: RegExpExecArray | null = null
    let t: RegExpExecArray | null
    while ((t = tag.exec(markup))) {
      if (t[3]) continue // self-closing, same name
      depth += t[1] ? -1 : 1
      if (depth === 0) {
        close = t
        break
      }
    }
    if (!close) {
      pushFree(markup.slice(m.index))
      pos = markup.length
      break
    }
    const end = close.index + close[0].length
    out.push(parseOne(name, attrs, markup.slice(openEnd, close.index), markup.slice(m.index, end)))
    pos = end
    OPEN.lastIndex = end
  }
  pushFree(markup.slice(pos))
  return out
}

// Block attributes are JSON inside an HTML comment; escape like WordPress does.
const attrJson = (o: unknown) => JSON.stringify(o).replace(/--/g, "\\u002d\\u002d").replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")

export function serializeBlock(b: Block): string {
  if (b.raw !== undefined && !("dirty" in b)) return b.raw
  switch (b.kind) {
    case "paragraph":
      return `<!-- wp:paragraph -->\n<p>${b.text}</p>\n<!-- /wp:paragraph -->`
    case "heading":
      return `<!-- wp:heading${b.level === 2 ? "" : ` {"level":${b.level}}`} -->\n<h${b.level} class="wp-block-heading">${b.text}</h${b.level}>\n<!-- /wp:heading -->`
    case "list": {
      const tag = b.ordered ? "ol" : "ul"
      const items = b.items.filter((i) => i.trim()).map((i) => `<!-- wp:list-item -->\n<li>${i}</li>\n<!-- /wp:list-item -->`).join("")
      return `<!-- wp:list${b.ordered ? ' {"ordered":true}' : ""} -->\n<${tag} class="wp-block-list">${items}</${tag}>\n<!-- /wp:list -->`
    }
    case "faq": {
      const qs = b.items
        .filter((i) => i.q.trim() && i.a.trim())
        .map((i, n) => ({ id: `faq-question-${n + 1}`, question: [escape(i.q)], answer: [escape(i.a)], jsonQuestion: escape(i.q), jsonAnswer: escape(i.a) }))
      const html = qs.map((q) => `<div class="schema-faq-section" id="${q.id}"><strong class="schema-faq-question">${q.jsonQuestion}</strong> <p class="schema-faq-answer">${q.jsonAnswer}</p> </div>`).join("")
      return `<!-- wp:yoast/faq-block ${attrJson({ questions: qs })} -->\n<div class="schema-faq wp-block-yoast-faq-block">${html}</div>\n<!-- /wp:yoast/faq-block -->`
    }
    default:
      return b.raw
  }
}

export const serializeBlocks = (blocks: Block[]) => blocks.map(serializeBlock).join("\n\n")

/** Marks a block as edited so it is rebuilt instead of copied. */
export function edited<T extends Block>(b: T, patch: Partial<T>): T {
  return { ...b, ...patch, dirty: true } as T
}

/** Visible text of a block, for word counts and keyword checks. */
export function blockText(b: Block): string {
  const strip = (s: string) => decode(s.replace(/<[^>]*>/g, " "))
  if (b.kind === "paragraph" || b.kind === "heading") return strip(b.text)
  if (b.kind === "list") return b.items.map(strip).join(" ")
  if (b.kind === "faq") return b.items.map((i) => `${i.q} ${i.a}`).join(" ")
  return strip(b.raw)
}
