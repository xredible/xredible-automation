// lib/printables/generic.ts
//
// Server-only. Printables for every workspace except Nestoodle (which has its own n8n flow,
// NST-PR). Each workspace has an adapter: where its printables come from, how the AI writes
// them, how they look and where Publish puts them.
//
//   elevating-christ  Sermon Notes and Bible Study Guides (English + Hindi) from the sermons on
//                     elevatingchrist.com; published to Vercel Blob, shown on the sermon page
//   linkedin-agency   Lead Magnets from the LinkedIn newsletters (or any topic); published to
//                     Vercel Blob as a link to share
//   autopilot         a customer's "Free download" for each article the Blog tool published,
//                     in their brand; published to their WordPress Media and added to the article
//
// Rows live in the n8n data table "XD Printables" (gateway kind "db", table "printables"),
// keyed by `biz`: the workspace, or "ap:<owner>" for an Autopilot customer.
// Quotations (Bible verses) are kept only when they appear word for word in the source text
// (the Hindi sermons quote the Hindi O.V. Bible), so the AI can't put a verse in other words.

import { del, put } from "@vercel/blob"
import { ask } from "@/lib/autopilot/ai"
import { insert, remove, rows as dbRows, update } from "@/lib/autopilot/db"
import { gateway } from "@/lib/dashboard/gateway"
import { renderPrintable } from "./pdf"
import { cleanLinkText, cleanSpec, fileNameFor, type Block, type Spec } from "./spec"
import { THEMES, brandTheme, type Theme } from "./themes"
import { LANG_LABEL, WORKSPACES, sourceKey, type GRow, type GSource, type PLang } from "./kinds"

export const GENERIC = Object.keys(WORKSPACES)

/** Who the printables belong to: the workspace, and for Autopilot the customer's data key. */
export type Scope = { ws: string; key: string; owner?: string }
export const scopeOf = (ws: string, owner?: string): Scope => ({ ws, key: ws === "autopilot" ? `ap:${owner}` : ws, owner })

/** Something a printable can be made from. */
type Src = { ref: string; title: string; shownTitle?: Partial<Record<PLang, string>>; link: string; date: string; text: Partial<Record<PLang, string>>; facts: Partial<Record<PLang, string[]>>; meta: Record<string, string>; langs: PLang[] }

type Look = { theme: Theme; logo?: Uint8Array | null }

type Adapter = {
  sources: (s: Scope, rows: Row[]) => Promise<Src[]>
  prompt: (src: Src, kind: string, lang: PLang) => string
  look: (s: Scope) => Promise<Look>
  publish: (s: Scope, row: Row, pdf: Uint8Array, names: { fileName: string; linkText: string }, src?: Src) => Promise<{ url: string; link: string; how: string; mediaId?: string }>
  unpublish?: (s: Scope, row: Row) => Promise<void>
}

const now = () => new Date().toISOString()
const devanagari = (t: string) => (t.match(/[ऀ-ॿ]/g) || []).length / Math.max(1, t.replace(/\s/g, "").length)

const RULES_COMMON = `- Plain words, short sentences. No emojis, no markdown, no hashtags.
- Do not invent facts: no made-up numbers, statistics, studies, prices, names, quotes, testimonials or case studies.`

const BLOCK_HELP = `Block types (use only these, with exactly these fields):
- {"type":"section","title":"...","text":"optional one or two sentences","icon":"book-open|pencil|heart|hand-heart|users|target|lightbulb|sparkles|sunrise|flame|star|circle-check|list-checks|calendar|clock|trophy|rocket","newPage":false}
- {"type":"verse","text":"a quotation copied word for word from the source","ref":"where it is from"}
- {"type":"blanks","title":"optional","items":["One sentence with one [[key word]] to fill in"]}
- {"type":"lines","title":"optional","prompts":["A question to answer in writing"],"lines":3}
- {"type":"checklist","title":"...","items":["A concrete step"]}
- {"type":"list","title":"...","items":["..."]}
- {"type":"steps","title":"...","steps":["..."]}
- {"type":"table","title":"...","head":["Column","Column"],"rows":[["...","..."]]}
- {"type":"planner","title":"...","columns":["Mon","Tue"],"rows":["Task"]}
- {"type":"tip","title":"...","text":"..."}
- {"type":"cards","columns":2,"cards":[{"title":"...","text":"...","list":["..."]}]}
- {"type":"pagebreak"}`

const isBlob = (u: string) => /\.blob\.vercel-storage\.com\//.test(u)

async function blobPublish(s: Scope, row: Row, pdf: Uint8Array, names: { fileName: string }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("File storage isn't switched on yet: in Vercel open the xredible-automation project → Storage → Create a Blob store and connect it, then try again.")
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 12)
  const blob = await put(`printables/${s.ws}/${stamp}/${names.fileName}`, Buffer.from(pdf), { access: "public", contentType: "application/pdf", addRandomSuffix: false })
  if (row.url && row.url !== blob.url && isBlob(row.url)) await del(row.url).catch(() => null)
  return blob.url
}

const blobRemove = async (_s: Scope, row: Row) => {
  if (row.url && isBlob(row.url)) await del(row.url).catch(() => null)
}

// ---------- Elevating CHRIST: sermons ----------

type Sermon = {
  slug: string
  url: string
  title: string
  date: string
  scripture: string
  speaker: string
  excerpt: string
  tags: string[]
  keyTakeaways: string[]
  text: string
  hi: { title: string; scripture: string; speaker: string; keyTakeaways: string[]; text: string } | null
}

let sermonCache: { at: number; list: Src[] } | null = null

async function sermons(): Promise<Src[]> {
  if (sermonCache && Date.now() - sermonCache.at < 300_000) return sermonCache.list
  const r = await fetch("https://www.elevatingchrist.com/api/sermons", { cache: "no-store", signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`elevatingchrist.com didn't send the sermons (HTTP ${r.status}).`)
  const j = (await r.json()) as { sermons?: Sermon[] }
  const list: Src[] = (Array.isArray(j.sermons) ? j.sermons : []).map((s) => ({
    ref: s.slug,
    title: s.title,
    shownTitle: { en: s.title, hi: s.hi?.title || s.title },
    link: s.url,
    date: s.date,
    text: { en: s.text, hi: s.hi?.text || "" },
    facts: { en: s.keyTakeaways, hi: s.hi?.keyTakeaways || [] },
    meta: { scripture: s.scripture, scriptureHi: s.hi?.scripture || s.scripture, speaker: s.speaker, speakerHi: s.hi?.speaker || s.speaker },
    langs: s.hi && s.hi.text.length > 200 ? ["en", "hi"] : ["en"],
  }))
  sermonCache = { at: Date.now(), list }
  return list
}

export function sermonPrompt(s: Src, kind: string, lang: PLang): string {
  const hi = lang === "hi"
  const k = WORKSPACES["elevating-christ"].kinds.find((x) => x.key === kind) || WORKSPACES["elevating-christ"].kinds[0]
  const label = hi ? k.labelHi || k.label : k.label
  const title = s.shownTitle?.[lang] || s.title
  const scripture = hi ? s.meta.scriptureHi : s.meta.scripture
  const speaker = hi ? s.meta.speakerHi : s.meta.speaker
  const shape =
    kind === "study"
      ? `A BIBLE STUDY GUIDE (2 to 3 pages) for one person or a small group, about 45 minutes. In this order:
1. verse: the sermon's main verse.
2. section "${hi ? "शुरू करने से पहले" : "Before you start"}" (icon "book-open") with one or two sentences on what this study is about, then a "list" titled "${hi ? "पढ़ें" : "Read"}" with the Bible passages the sermon itself names (references only).
3. For each main part of the message (2 to 4 parts, in the sermon's order): a section with the part's name (icon "pencil"), one sentence summing it up from the sermon, then "lines" with 3 questions: what the passage says, what it means, how to live it (lines: 3).
4. section "${hi ? "समूह में बात करें" : "Talk it over"}" (icon "users") and a "list" of 4 discussion questions.
5. checklist "${hi ? "इसे जीएँ" : "Live it out"}": 3 concrete steps the sermon asks for.
6. tip titled "${hi ? "प्रार्थना" : "Prayer"}": a short prayer (2 or 3 sentences) in the spirit of the message, ending with "${hi ? "आमीन।" : "Amen."}"`
      : `SERMON NOTES (1 or 2 pages) that people fill in while they watch the sermon or afterwards. In this order:
1. verse: the sermon's main verse.
2. section "${hi ? "संदेश की रूपरेखा" : "Message outline"}" (icon "book-open"), then "blanks" with 5 to 7 points that follow the sermon in order. Each point is one short sentence that says what the sermon says, with exactly one [[key word]] (one or two words from the sermon) to fill in.
3. section "${hi ? "मनन करें" : "Reflect"}" (icon "pencil"), then "lines" with 3 personal questions (lines: 3).
4. checklist "${hi ? "इस सप्ताह" : "This week"}": 3 concrete steps the sermon asks for.
5. tip titled "${hi ? "प्रार्थना" : "Prayer"}": a short prayer (2 or 3 sentences) in the spirit of the message, ending with "${hi ? "आमीन।" : "Amen."}"
6. "lines" titled "${hi ? "मेरे नोट्स" : "My notes"}" with one prompt "${hi ? "परमेश्वर मुझसे क्या कह रहा है?" : "What is God saying to me?"}" and lines: 5.`
  return `You make a printable ${label} handout (a PDF) for the church Elevating CHRIST from one of its sermons.

${shape}

RULES
- Use only what this sermon says. Do not add stories, numbers, names, claims or quotes that are not in it.
- Bible verses: copy them exactly, word for word, from the sermon text below, and give the reference. Never quote a verse the sermon doesn't quote, and never put a verse in your own words.
- ${hi ? "Write everything in Hindi (Devanagari), simple and warm, the way the sermon text is written. Bible verses must be the Hindi words exactly as they appear in the sermon text below." : "Write in clear, simple, warm English."}
- Reverent and encouraging. Short sentences. No emojis, no markdown, no hashtags.
- The title is "${label}: ${title}". The subtitle is "${scripture} · ${speaker}". The intro is one sentence on how to use the handout. chips: "${label}" and two themes of the sermon (one or two words each).
- Field "lang": "${lang}".

${BLOCK_HELP}

SERMON
Title: ${title}
Scripture: ${scripture}
Speaker: ${speaker}
Key takeaways: ${(s.facts[lang] || []).join(" | ")}

${(s.text[lang] || s.text.en || "").slice(0, 14000)}

Return JSON only: {"title":"...","subtitle":"...","intro":"...","chips":["..."],"lang":"${lang}","blocks":[...]}`
}

// ---------- LinkedIn Agency: newsletters and topics ----------

const XREDIBLE = brandTheme({ key: "linkedin-agency", name: "Xredible", site: "xredible.in", primary: "#24438A", accent: "#1F2937" })

async function newsletters(_s: Scope, rows: Row[]): Promise<Src[]> {
  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)
  const start = new Date(Date.parse(today) - 729 * 864e5).toISOString().slice(0, 10)
  const r = await gateway({ kind: "proxy", biz: "linkedin-agency", path: "", method: "GET", query: { section: "newsletters", start, end: today, cmp: "none" } }, 40_000)
  const b = (r.body || {}) as { ok?: boolean; tables?: { rows?: Record<string, unknown>[] }[] }
  const list: Src[] = []
  const seen = new Set<string>()
  for (const t of b.tables || []) {
    for (const x of t.rows || []) {
      const title = String(x.k || "").trim()
      if (!title) continue
      const ref = "nl:" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80)
      if (seen.has(ref)) continue
      seen.add(ref)
      const notes = [x.subtitle, x.notes].filter(Boolean).join("\n")
      list.push({ ref, title, link: "", date: String(x.created || "").slice(0, 10) || today, text: { en: notes }, facts: {}, meta: { newsletter: String(x.newsletter || "") }, langs: ["en"] })
    }
  }
  // Topics typed on the page are kept with their printable.
  for (const row of rows) {
    if (!row.ref.startsWith("topic:") || seen.has(row.ref)) continue
    seen.add(row.ref)
    list.push({ ref: row.ref, title: row.sourceTitle || row.title, link: "", date: (row.changedAt || today).slice(0, 10), text: { en: row.sourceNotes || "" }, facts: {}, meta: {}, langs: ["en"] })
  }
  return list
}

function magnetPrompt(s: Src): string {
  return `You make a LEAD MAGNET: a free one or two page PDF that a marketing professional shares on LinkedIn ("comment GUIDE and I'll send it"). It must be genuinely useful on its own and easy to act on.

TOPIC: ${s.title}
${s.meta.newsletter ? `From the LinkedIn newsletter: ${s.meta.newsletter}\n` : ""}${s.text.en ? `NOTES:\n${s.text.en.slice(0, 4000)}\n` : ""}
In this order:
1. section with a clear promise of what the reader will be able to do (icon "target"), one or two sentences.
2. "checklist" titled with the main job (6 to 10 concrete items).
3. "steps" titled "How to do it" (4 to 6 steps).
4. "cards" (columns 2) with 4 to 6 practical tips or mistakes to avoid, each with a short title and one or two sentences.
5. Optional: a "table" that compares options or shows what to use when, if it helps.
6. tip titled "Next step": one sentence inviting them to connect or reply on LinkedIn.

RULES
- Write in clear, practical English for business owners and marketers in India and abroad.
${RULES_COMMON}
- The title is short and specific (at most 9 words). The subtitle says who it's for. The intro is one sentence. chips: 3 short labels (for example "Checklist", "10 minutes", the topic).
- Field "lang": "en".

${BLOCK_HELP}

Return JSON only: {"title":"...","subtitle":"...","intro":"...","chips":["..."],"lang":"en","blocks":[...]}`
}

// ---------- Autopilot customers: their published articles ----------

async function customerArticles(s: Scope): Promise<Src[]> {
  const { itemsFor } = await import("@/lib/autopilot/tools")
  const { mdToText } = await import("@/lib/autopilot/markdown")
  const items = (await itemsFor(s.owner!, "blog")).filter((i) => i.status === "posted" && /^https?:\/\//.test(i.ref))
  return items.map((i) => {
    const text = mdToText(i.text || "")
    const lang: PLang = devanagari(text) > 0.3 ? "hi" : "en"
    return { ref: `post:${i.id}`, title: i.title, link: i.ref.split(" ")[0], date: String(i.postedAt || i.scheduledAt || "").slice(0, 10), text: { [lang]: text }, facts: {}, meta: { topic: i.topic || "" }, langs: [lang] }
  })
}

function guidePrompt(s: Src, lang: PLang): string {
  const hi = lang === "hi"
  return `You make a free printable download (a PDF, 1 or 2 pages) for readers of a blog article: a checklist, planner or short guide that helps them act on the article.

In this order:
1. section saying what the download helps with (one or two sentences, icon "target").
2. The most useful one or two of: a "checklist" (6 to 10 items), "steps" (4 to 6), a "planner", a "table".
3. "cards" (columns 2) with 3 to 6 key points from the article, each with a short title and one or two sentences.
4. "lines" with 2 or 3 prompts for the reader's own notes (lines: 2).
5. tip with one practical tip from the article.

RULES
- Use only what the article says; you may turn it into steps and checklists. ${hi ? "Write everything in Hindi (Devanagari), simple and warm, like the article." : "Write in clear, simple English."}
${RULES_COMMON}
- The title is short and specific (at most 9 words). The subtitle says who it's for. The intro is one sentence. chips: 3 short labels.
- Field "lang": "${lang}".

${BLOCK_HELP}

ARTICLE: ${s.title}
${(s.text[lang] || "").slice(0, 12000)}

Return JSON only: {"title":"...","subtitle":"...","intro":"...","chips":["..."],"lang":"${lang}","blocks":[...]}`
}

async function customerLook(s: Scope): Promise<Look> {
  const { kitFor } = await import("@/lib/autopilot/brandkit")
  const { channelFor } = await import("@/lib/autopilot/tools")
  const c = await channelFor(s.owner!, "blog").catch(() => null)
  const kit = await kitFor(s.owner!, { name: String(c?.settings.name || ""), color: String(c?.settings.color || "") })
  const site = String(kit.website || c?.meta.site || "")
  const theme = brandTheme({ key: s.key, name: kit.name || "Free download", site, primary: kit.primary, accent: kit.secondary })
  let logo: Uint8Array | null = null
  if (/^https:\/\/\S+\.(png|jpe?g)(\?.*)?$/i.test(kit.logo || "")) {
    try {
      const r = await fetch(kit.logo, { signal: AbortSignal.timeout(10_000) })
      const buf = new Uint8Array(await r.arrayBuffer())
      if (r.ok && buf.length < 2_500_000) logo = buf
    } catch {}
  }
  return { theme, logo }
}

/** The download added to the end of the article (replaced on the next publish). */
const MARK = /<!-- xd-printable -->[\s\S]*?<!-- \/xd-printable -->\s*/g

async function wpLogin(owner: string) {
  const { channelFor } = await import("@/lib/autopilot/tools")
  const { open } = await import("@/lib/autopilot/crypto")
  const c = await channelFor(owner, "blog")
  if (!c || !c.connected || !c.secretEnc) throw new Error("Your WordPress site isn't connected (Blog tool → Connect).")
  const secret = JSON.parse(open(c.secretEnc) || "{}") as { pass?: string }
  return { site: String(c.meta.site || ""), user: String(c.meta.user || ""), pass: String(secret.pass || "") }
}

async function customerPublish(s: Scope, row: Row, pdf: Uint8Array, names: { fileName: string; linkText: string }, src?: Src) {
  const { wpUploadMedia, wpPostByLink, wpUpdatePost, wpDeleteMedia } = await import("@/lib/autopilot/wordpress")
  const { site, user, pass } = await wpLogin(s.owner!)
  const post = src?.link ? await wpPostByLink(site, user, pass, src.link) : null
  if (!post) throw new Error("The article wasn't found on your site any more.")
  const media = await wpUploadMedia(site, user, pass, { name: names.fileName, type: "application/pdf", bytes: pdf, title: names.linkText })
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
  const block = `<!-- xd-printable -->\n<!-- wp:file {"id":${media.id},"href":"${esc(media.url)}"} -->\n<div class="wp-block-file"><a id="wp-block-file--media-${media.id}" href="${esc(media.url)}">${esc(names.linkText)}</a><a href="${esc(media.url)}" class="wp-block-file__button wp-element-button" download aria-describedby="wp-block-file--media-${media.id}">Download</a></div>\n<!-- /wp:file -->\n<!-- /xd-printable -->\n`
  const content = post.raw.replace(MARK, "").trimEnd() + "\n\n" + block
  const r = await wpUpdatePost(site, user, pass, post.id, content)
  if (row.mediaId && Number(row.mediaId) !== media.id) await wpDeleteMedia(site, user, pass, Number(row.mediaId)).catch(() => null)
  return { url: media.url, link: r.link || post.link, how: "at the end of the article", mediaId: String(media.id) }
}

async function customerUnpublish(s: Scope, row: Row) {
  const { wpPostByLink, wpUpdatePost, wpDeleteMedia } = await import("@/lib/autopilot/wordpress")
  const { site, user, pass } = await wpLogin(s.owner!)
  if (row.sourceLink) {
    const post = await wpPostByLink(site, user, pass, row.sourceLink).catch(() => null)
    if (post && post.raw.match(MARK)) await wpUpdatePost(site, user, pass, post.id, post.raw.replace(MARK, "")).catch(() => null)
  }
  if (row.mediaId) await wpDeleteMedia(site, user, pass, Number(row.mediaId)).catch(() => null)
}

// ---------- the adapters ----------

const ADAPTERS: Record<string, Adapter> = {
  "elevating-christ": {
    sources: () => sermons(),
    prompt: sermonPrompt,
    look: async () => ({ theme: THEMES["elevating-christ"] }),
    publish: async (s, row, pdf, names, src) => ({ url: await blobPublish(s, row, pdf, names), link: src?.link || "", how: "on the sermon page" }),
    unpublish: blobRemove,
  },
  "linkedin-agency": {
    sources: newsletters,
    prompt: (src) => magnetPrompt(src),
    look: async () => ({ theme: XREDIBLE }),
    publish: async (s, row, pdf, names) => {
      const url = await blobPublish(s, row, pdf, names)
      return { url, link: url, how: "as a link to share" }
    },
    unpublish: blobRemove,
  },
  autopilot: {
    sources: (s) => customerArticles(s),
    prompt: (src, _k, lang) => guidePrompt(src, lang),
    look: customerLook,
    publish: customerPublish,
    unpublish: customerUnpublish,
  },
}

// ---------- rows ----------

type Raw = Record<string, unknown> & { id: number }

export type Row = GRow & { sourceTitle: string; sourceNotes: string; sourceLink: string; mediaId: string }

function toRow(r: Raw): Row {
  let spec: Spec | null = null
  try {
    spec = r.spec ? cleanSpec(JSON.parse(String(r.spec))) : null
  } catch {}
  const s = (k: string) => (r[k] == null ? "" : String(r[k]))
  const link = s("sourceLink")
  return {
    id: Number(r.id),
    ref: s("ref"),
    kind: s("kind"),
    lang: s("lang") === "hi" ? "hi" : "en",
    status: (["draft", "published", "failed"].includes(s("status")) ? s("status") : "draft") as GRow["status"],
    title: s("title"),
    spec,
    fileName: s("fileName"),
    linkText: s("linkText"),
    url: s("url"),
    pages: Number(r.pages) || 0,
    error: s("error"),
    changedAt: s("changedAt"),
    publishedAt: s("publishedAt"),
    sourceTitle: s("sourceTitle"),
    // Topic rows keep the notes typed with them where other rows keep the source's link.
    sourceNotes: link.startsWith("notes:") ? link.slice(6) : "",
    sourceLink: link.startsWith("notes:") ? "" : link,
    mediaId: s("mediaId"),
  }
}

export async function listRows(s: Scope): Promise<Row[]> {
  return (await dbRows<Raw>("printables", { col: "biz", val: s.key })).map(toRow)
}

export async function listSources(s: Scope, rows?: Row[]): Promise<GSource[]> {
  const ws = WORKSPACES[s.ws]
  const ad = ADAPTERS[s.ws]
  if (!ws || !ad) return []
  const out: GSource[] = []
  for (const src of await ad.sources(s, rows || (await listRows(s)))) {
    for (const k of ws.kinds) {
      for (const lang of ws.langs) {
        const has = src.langs.includes(lang)
        // Only Elevating CHRIST shows a language the sermon doesn't have yet (both are expected).
        if (!has && s.ws !== "elevating-christ") continue
        out.push({
          key: sourceKey(src.ref, k.key, lang),
          ref: src.ref,
          kind: k.key,
          lang,
          title: src.title,
          shownTitle: src.shownTitle?.[lang] || src.title,
          link: src.link,
          date: src.date,
          available: has,
          note: has ? undefined : `The ${ws.source} has no ${LANG_LABEL[lang]} text yet.`,
        })
      }
    }
  }
  return out
}

/** The published downloads for a page (public; Elevating CHRIST sermon pages). */
export async function published(ws: string, ref?: string) {
  return (await listRows(scopeOf(ws)))
    .filter((r) => r.status === "published" && r.url && (!ref || r.ref === ref))
    .map((r) => ({ ref: r.ref, kind: r.kind, lang: r.lang, title: r.title, linkText: r.linkText, url: r.url, pages: r.pages, fileName: r.fileName }))
}

// ---------- names ----------

export async function lookOf(s: Scope): Promise<Look> {
  return ADAPTERS[s.ws].look(s)
}

export function namesFor(s: Scope, theme: Theme, src: { title: string; shownTitle?: string }, kind: string, lang: PLang, given?: { fileName?: unknown; linkText?: unknown }) {
  const k = WORKSPACES[s.ws]?.kinds.find((x) => x.key === kind) || WORKSPACES[s.ws]?.kinds[0]
  const label = lang === "hi" ? k?.labelHi || k?.label || "" : k?.label || ""
  const sermon = s.ws === "elevating-christ"
  const auto = fileNameFor(sermon ? `${k?.label || ""} ${src.title}${lang === "hi" ? " Hindi" : ""}` : src.title, theme.prefix)
  const f = String(given?.fileName || "").trim()
  const re = new RegExp(`^${theme.prefix.replace(/[-]/g, "\\-")}-[A-Za-z0-9-]+\\.pdf$`)
  return {
    fileName: re.test(f) ? f : f ? fileNameFor(f.replace(/\.pdf$/i, ""), theme.prefix) : auto,
    linkText: cleanLinkText(String(given?.linkText || ""), theme.name) || (sermon ? `${label}: ${src.shownTitle || src.title}` : src.shownTitle || src.title),
  }
}

// ---------- the AI draft ----------

const norm = (t: string) =>
  t
    .normalize("NFC")
    .replace(/[“”"'‘’«»]/g, "")
    .replace(/[.,;:!?।॥—–\-()[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()

/** Keeps a quotation only when its words are in the source text as they are. */
export function checkVerses(spec: Spec, text: string): Spec {
  const src = norm(text)
  const blocks: Block[] = []
  for (const b of spec.blocks) {
    if (b.type !== "verse") {
      blocks.push(b)
      continue
    }
    const v = norm(b.text)
    if (v.length >= 12 && src.includes(v)) blocks.push(b)
    else if (b.ref) blocks.push({ type: "tip", title: spec.lang === "hi" ? "पढ़ें" : "Read", text: b.ref })
  }
  return { ...spec, blocks }
}

async function findSrc(s: Scope, ref: string, rows: Row[]): Promise<Src | null> {
  return (await ADAPTERS[s.ws].sources(s, rows)).find((x) => x.ref === ref) || null
}

/** Writes the printable with the AI and keeps it as a draft (a live PDF stays until the next publish). */
export async function draft(s: Scope, ref: string, kind: string, lang: PLang, topic?: { title: string; notes: string }): Promise<Row> {
  const ws = WORKSPACES[s.ws]
  if (!ws?.kinds.some((k) => k.key === kind)) throw new Error("That kind of printable isn't available here.")
  const rows = await listRows(s)
  let src: Src | null
  if (topic) {
    if (!ws.topics) throw new Error("Topics aren't available here.")
    const title = topic.title.trim().slice(0, 120)
    if (title.length < 4) throw new Error("Write the topic first.")
    const id = "topic:" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + Date.now().toString(36)
    src = { ref: id, title, link: "", date: now().slice(0, 10), text: { en: topic.notes.slice(0, 2000) }, facts: {}, meta: {}, langs: ["en"] }
  } else src = await findSrc(s, ref, rows)
  if (!src) throw new Error(`That ${ws.source} isn't there any more.`)
  if (!src.langs.includes(lang)) throw new Error(`This ${ws.source} has no ${LANG_LABEL[lang]} text yet, so there's nothing to make that version from.`)
  const ad = ADAPTERS[s.ws]
  const raw = await ask(ad.prompt(src, kind, lang), { json: true, maxTokens: 9000, temperature: 0.4, thinking: "low", timeoutMs: 100_000 })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim())
  } catch {
    throw new Error("The AI answer came back broken. Try again.")
  }
  const clean = cleanSpec({ ...(parsed as Record<string, unknown>), lang })
  if (!clean) throw new Error("The AI didn't write a usable printable. Try again.")
  const spec = checkVerses(clean, [src.text[lang] || "", ...(src.facts[lang] || [])].join("\n"))
  const { theme } = await lookOf(s)
  const names = namesFor(s, theme, { title: src.title, shownTitle: src.shownTitle?.[lang] }, kind, lang)
  const row = { biz: s.key, ref: src.ref, kind, lang, title: spec.title, spec: JSON.stringify(spec), ...names, error: "", changedAt: now(), sourceTitle: src.title, sourceLink: topic ? `notes:${topic.notes.slice(0, 2000)}` : src.link }
  const old = rows.find((r) => r.ref === src!.ref && r.kind === kind && r.lang === lang)
  if (old) {
    const status = old.status === "published" ? "published" : "draft"
    await update("printables", old.id, { ...row, status })
    return { ...old, ...row, spec, status, lang, sourceLink: src.link, sourceNotes: old.sourceNotes } as Row
  }
  const made = await insert<Raw>("printables", { ...row, status: "draft", url: "", pages: 0, publishedAt: "", mediaId: "" })
  return toRow({ ...made, ...row, status: "draft" } as Raw)
}

export async function saveRow(s: Scope, id: number, spec: Spec, names: { fileName: string; linkText: string }) {
  const row = (await listRows(s)).find((r) => r.id === id)
  if (!row) throw new Error("That printable isn't there any more.")
  await update("printables", id, { title: spec.title, spec: JSON.stringify(spec), ...names, changedAt: now() })
}

export async function discardRow(s: Scope, id: number) {
  const row = (await listRows(s)).find((r) => r.id === id)
  if (!row) return
  if (row.url) await ADAPTERS[s.ws].unpublish?.(s, row).catch(() => null)
  await remove("printables", id)
}

/** The PDF exactly as it will be published. */
export async function previewPdf(s: Scope, spec: Spec, o: { title?: string; link?: string }) {
  const look = await lookOf(s)
  return renderPrintable(spec, { theme: look.theme, logo: look.logo, postTitle: o.title, postUrl: o.link })
}

/** Lays the PDF out, puts it online and marks the printable live. */
export async function publishRow(s: Scope, id: number, spec: Spec, names: { fileName: string; linkText: string }) {
  const rows = await listRows(s)
  const row = rows.find((r) => r.id === id)
  if (!row) throw new Error("That printable isn't there any more.")
  const src = row.ref.startsWith("topic:") ? null : await findSrc(s, row.ref, rows)
  const look = await lookOf(s)
  const lang = spec.lang === "hi" ? "hi" : "en"
  const out = await renderPrintable(spec, { theme: look.theme, logo: look.logo, postTitle: src ? src.shownTitle?.[lang] || src.title : undefined, postUrl: src?.link || undefined })
  const r = await ADAPTERS[s.ws].publish(s, row, out.pdf, names, src || undefined)
  await update("printables", id, { title: spec.title, spec: JSON.stringify(spec), ...names, url: r.url, pages: out.pages, status: "published", error: "", changedAt: now(), publishedAt: now(), ...(r.mediaId ? { mediaId: r.mediaId } : {}) })
  return { ...r, pages: out.pages }
}
