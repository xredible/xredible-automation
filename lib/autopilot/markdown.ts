// lib/autopilot/markdown.ts
//
// Drafts are written and edited as simple text with a few markdown marks
// (## headings, - lists, 1. lists, **bold**, *italic*, [links](https://…)).
// This turns them into safe HTML for WordPress and email. Raw HTML is escaped.

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

function inline(s: string, linkStyle = ""): string {
  let t = esc(s)
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label: string, url: string) => `<a href="${url}"${linkStyle ? ` style="${linkStyle}"` : ""}>${label}</a>`)
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  t = t.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
  return t
}

export type HtmlStyle = { p?: string; h2?: string; h3?: string; ul?: string; li?: string; a?: string }

export function mdToHtml(md: string, style: HtmlStyle = {}): string {
  const at = (k: keyof HtmlStyle) => (style[k] ? ` style="${style[k]}"` : "")
  const lines = String(md || "").replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let para: string[] = []
  let list: { tag: "ul" | "ol"; items: string[] } | null = null
  const flushPara = () => {
    if (para.length) out.push(`<p${at("p")}>${para.map((l) => inline(l, style.a)).join("<br>")}</p>`)
    para = []
  }
  const flushList = () => {
    if (list) out.push(`<${list.tag}${at("ul")}>${list.items.map((i) => `<li${at("li")}>${inline(i, style.a)}</li>`).join("")}</${list.tag}>`)
    list = null
  }
  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = /^(#{2,4})\s+(.+)$/.exec(line.trim())
    const ul = /^\s*[-*•]\s+(.+)$/.exec(line)
    const ol = /^\s*\d+[.)]\s+(.+)$/.exec(line)
    if (!line.trim()) {
      flushPara()
      flushList()
    } else if (h) {
      flushPara()
      flushList()
      const tag = h[1].length === 2 ? "h2" : "h3"
      out.push(`<${tag}${at(tag)}>${inline(h[2], style.a)}</${tag}>`)
    } else if (ul || ol) {
      flushPara()
      const tag = ul ? "ul" : "ol"
      if (list && list.tag !== tag) flushList()
      if (!list) list = { tag, items: [] }
      list.items.push((ul || ol)![1])
    } else {
      flushList()
      para.push(line.replace(/^#\s+/, ""))
    }
  }
  flushPara()
  flushList()
  return out.join("\n")
}

/** Plain text version (for the email text part). */
export function mdToText(md: string): string {
  return String(md || "")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^#{2,4}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .trim()
}
