// lib/printables/generic.ts
//
// Server-only. Printables for the workspaces other than Nestoodle (which has its own n8n
// flow, NST-PR). Today: Elevating CHRIST's Sermon Notes and Bible Study Guides, in English
// and Hindi, made from the sermons on elevatingchrist.com.
//
//   sources   every sermon × kind × language that can be made (from elevatingchrist.com/api/sermons)
//   rows      what was made: n8n data table "XD Printables" (gateway kind "db", table "printables")
//   draft     Gemini (gateway kind "ai") writes the printable from the sermon's own text
//   publish   the PDF goes to Vercel Blob; the sermon page shows it (it reads /api/printables)
//
// Bible verses are kept only when they appear word for word in the sermon text (the Hindi
// sermons quote the Hindi O.V. Bible), so the AI can't put a verse in other words.

import { del, put } from "@vercel/blob"
import { ask } from "@/lib/autopilot/ai"
import { insert, remove, rows as dbRows, update } from "@/lib/autopilot/db"
import { renderPrintable } from "./pdf"
import { cleanLinkText, cleanSpec, fileNameFor, type Block, type Spec } from "./spec"
import { THEMES } from "./themes"
import { LANG_LABEL, WORKSPACES, sourceKey, type GRow, type GSource, type PLang } from "./kinds"

export const GENERIC = Object.keys(WORKSPACES)

// ---------- Elevating CHRIST sermons ----------

export type Sermon = {
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

let sermonCache: { at: number; list: Sermon[] } | null = null

async function sermons(): Promise<Sermon[]> {
  if (sermonCache && Date.now() - sermonCache.at < 300_000) return sermonCache.list
  const r = await fetch("https://www.elevatingchrist.com/api/sermons", { cache: "no-store", signal: AbortSignal.timeout(15_000) })
  if (!r.ok) throw new Error(`elevatingchrist.com didn't send the sermons (HTTP ${r.status}).`)
  const j = (await r.json()) as { sermons?: Sermon[] }
  const list = Array.isArray(j.sermons) ? j.sermons : []
  sermonCache = { at: Date.now(), list }
  return list
}

// ---------- rows ----------

type Raw = Record<string, unknown> & { id: number }

function toRow(r: Raw): GRow {
  let spec: Spec | null = null
  try {
    spec = r.spec ? cleanSpec(JSON.parse(String(r.spec))) : null
  } catch {}
  const s = (k: string) => (r[k] == null ? "" : String(r[k]))
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
  }
}

export async function listRows(biz: string): Promise<GRow[]> {
  return (await dbRows<Raw>("printables", { col: "biz", val: biz })).map(toRow)
}

export async function listSources(biz: string): Promise<GSource[]> {
  const ws = WORKSPACES[biz]
  if (!ws) return []
  const out: GSource[] = []
  for (const s of await sermons()) {
    for (const k of ws.kinds) {
      for (const lang of ws.langs) {
        const has = lang === "en" || !!(s.hi && s.hi.text.length > 200)
        out.push({
          key: sourceKey(s.slug, k.key, lang),
          ref: s.slug,
          kind: k.key,
          lang,
          title: s.title,
          shownTitle: lang === "hi" && s.hi?.title ? s.hi.title : s.title,
          link: s.url,
          date: s.date,
          available: has,
          note: has ? undefined : "The sermon has no Hindi text yet.",
        })
      }
    }
  }
  return out
}

/** The published downloads for a sermon page (public). */
export async function published(biz: string, ref?: string) {
  return (await listRows(biz))
    .filter((r) => r.status === "published" && r.url && (!ref || r.ref === ref))
    .map((r) => ({ ref: r.ref, kind: r.kind, lang: r.lang, title: r.title, linkText: r.linkText, url: r.url, pages: r.pages, fileName: r.fileName }))
}

// ---------- names ----------

const kindOf = (biz: string, kind: string) => WORKSPACES[biz]?.kinds.find((k) => k.key === kind) || WORKSPACES[biz]?.kinds[0]

export function namesFor(biz: string, s: { title: string; shownTitle?: string }, kind: string, lang: PLang, given?: { fileName?: unknown; linkText?: unknown }) {
  const theme = THEMES[biz]
  const k = kindOf(biz, kind)
  const label = lang === "hi" ? k?.labelHi || k?.label || "" : k?.label || ""
  const auto = fileNameFor(`${k?.label || ""} ${s.title}${lang === "hi" ? " Hindi" : ""}`, theme.prefix)
  const f = String(given?.fileName || "").trim()
  const re = new RegExp(`^${theme.prefix.replace(/[-]/g, "\\-")}-[A-Za-z0-9-]+\\.pdf$`)
  return {
    fileName: re.test(f) ? f : f ? fileNameFor(f.replace(/\.pdf$/i, ""), theme.prefix) : auto,
    linkText: cleanLinkText(String(given?.linkText || ""), theme.name) || `${label}: ${s.shownTitle || s.title}`,
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

/** Keeps a verse only when its words are in the sermon text as they are. */
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

const BLOCK_HELP = `Block types (use only these, with exactly these fields):
- {"type":"section","title":"...","text":"optional one or two sentences","icon":"book-open|pencil|heart|hand-heart|users|target|lightbulb|sparkles|sunrise|flame|star|circle-check|list-checks|calendar","newPage":false}
- {"type":"verse","text":"the verse copied word for word from the sermon text","ref":"Book 1:2"}
- {"type":"blanks","title":"optional","items":["One sentence from the message with one [[key word]] to fill in"]}
- {"type":"lines","title":"optional","prompts":["A question to answer in writing"],"lines":3}
- {"type":"checklist","title":"...","items":["A concrete step"]}
- {"type":"list","title":"...","items":["..."]}
- {"type":"steps","title":"...","steps":["..."]}
- {"type":"tip","title":"Prayer","text":"..."}
- {"type":"cards","columns":2,"cards":[{"title":"...","text":"...","list":["..."]}]}
- {"type":"pagebreak"}`

export function prompt(biz: string, s: Sermon, kind: string, lang: PLang): string {
  const hi = lang === "hi"
  const text = (hi ? s.hi?.text : s.text) || s.text
  const title = hi ? s.hi?.title || s.title : s.title
  const scripture = hi ? s.hi?.scripture || s.scripture : s.scripture
  const speaker = hi ? s.hi?.speaker || s.speaker : s.speaker
  const takeaways = (hi ? s.hi?.keyTakeaways : s.keyTakeaways) || []
  const k = kindOf(biz, kind)!
  const label = hi ? k.labelHi || k.label : k.label
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
Key takeaways: ${takeaways.join(" | ")}

${text.slice(0, 14000)}

Return JSON only: {"title":"...","subtitle":"...","intro":"...","chips":["..."],"lang":"${lang}","blocks":[...]}`
}

const now = () => new Date().toISOString()

async function findRow(biz: string, ref: string, kind: string, lang: string): Promise<GRow | null> {
  return (await listRows(biz)).find((r) => r.ref === ref && r.kind === kind && r.lang === lang) || null
}

/** Writes the printable with the AI and keeps it as a draft (replacing an older draft, never the live PDF's record). */
export async function draft(biz: string, ref: string, kind: string, lang: PLang): Promise<GRow> {
  if (!WORKSPACES[biz]?.kinds.some((k) => k.key === kind)) throw new Error("That kind of printable isn't available here.")
  const s = (await sermons()).find((x) => x.slug === ref)
  if (!s) throw new Error("That sermon isn't on elevatingchrist.com.")
  if (lang === "hi" && !(s.hi && s.hi.text.length > 200)) throw new Error("This sermon has no Hindi text yet, so there's nothing to make the Hindi version from.")
  const raw = await ask(prompt(biz, s, kind, lang), { json: true, maxTokens: 9000, temperature: 0.4, thinking: "low", timeoutMs: 100_000 })
  let parsed: unknown
  try {
    parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim())
  } catch {
    throw new Error("The AI answer came back broken. Try again.")
  }
  const clean = cleanSpec({ ...(parsed as Record<string, unknown>), lang })
  if (!clean) throw new Error("The AI didn't write a usable printable. Try again.")
  const own = lang === "hi" ? [s.hi?.text || "", ...(s.hi?.keyTakeaways || [])] : [s.text, ...s.keyTakeaways]
  const spec = checkVerses(clean, own.join("\n"))
  const names = namesFor(biz, { title: s.title, shownTitle: lang === "hi" ? s.hi?.title : s.title }, kind, lang)
  const row = { biz, ref, kind, lang, title: spec.title, spec: JSON.stringify(spec), ...names, error: "", changedAt: now(), sourceTitle: s.title, sourceLink: s.url }
  const old = await findRow(biz, ref, kind, lang)
  if (old) {
    await update("printables", old.id, { ...row, status: old.status === "published" ? "published" : "draft" })
    return { ...old, ...row, spec, status: old.status === "published" ? "published" : "draft", lang } as GRow
  }
  const made = await insert<Raw>("printables", { ...row, status: "draft", url: "", pages: 0, publishedAt: "" })
  return toRow({ ...made, ...row, status: "draft" } as Raw)
}

export async function saveRow(biz: string, id: number, spec: Spec, names: { fileName: string; linkText: string }) {
  const row = (await listRows(biz)).find((r) => r.id === id)
  if (!row) throw new Error("That printable isn't there any more.")
  await update("printables", id, { title: spec.title, spec: JSON.stringify(spec), ...names, changedAt: now() })
}

export async function discardRow(biz: string, id: number) {
  const row = (await listRows(biz)).find((r) => r.id === id)
  if (!row) return
  if (row.url) await del(row.url).catch(() => null)
  await remove("printables", id)
}

/** Lays the PDF out, puts it online and marks the printable live (the sermon page shows it within minutes). */
export async function publishRow(biz: string, id: number, spec: Spec, names: { fileName: string; linkText: string }) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("File storage isn't switched on yet: in Vercel open the xredible-automation project → Storage → Create a Blob store and connect it, then try again.")
  const row = (await listRows(biz)).find((r) => r.id === id)
  if (!row) throw new Error("That printable isn't there any more.")
  const s = (await sermons()).find((x) => x.slug === row.ref)
  const out = await renderPrintable(spec, { theme: THEMES[biz], postTitle: s ? (spec.lang === "hi" ? s.hi?.title || s.title : s.title) : undefined, postUrl: s?.url })
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 12)
  const blob = await put(`printables/${biz}/${stamp}/${names.fileName}`, Buffer.from(out.pdf), { access: "public", contentType: "application/pdf", addRandomSuffix: false })
  await update("printables", id, { title: spec.title, spec: JSON.stringify(spec), ...names, url: blob.url, pages: out.pages, status: "published", error: "", changedAt: now(), publishedAt: now() })
  if (row.url && row.url !== blob.url) await del(row.url).catch(() => null)
  return { url: blob.url, pages: out.pages, link: s?.url || "" }
}

export const langLabel = (l: PLang) => LANG_LABEL[l]
