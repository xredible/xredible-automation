// lib/sources/index.ts
//
// Server-only. Adds 3–4 high-quality external links to an article, and checks the ones it has.
// Used by the Autopilot Blog Writer (Markdown drafts) and the Nestoodle Blog page (WordPress HTML).
//
//   1. The article's existing external links are opened: dead pages are unlinked (their words stay).
//   2. Claude, with web search (gateway kind "research"), suggests specific pages from authoritative,
//      independent publishers for claims in the article, with the words to link.
//   3. Every suggestion is opened here. It's used only when: the page loads (no error page, no
//      redirect to a homepage; pages from Claude's own search results are tried first), the publisher is an
//      authority (government, university, research, official bodies; never blogs, social media,
//      shops or the site's own pages), the page's own words match the claim, and the link words
//      occur in that paragraph. One link per page, per paragraph and per publisher.
//   4. The links go into the sentences they support. Nothing else in the article changes.

import { gateway } from "@/lib/dashboard/gateway"
import { safeFetch } from "@/lib/autopilot/safe-fetch"

export type SourceFormat = "md" | "html"

export type Source = {
  /** The linked words, exactly as they appear in the article. */
  anchor: string
  url: string
  /** Publisher, e.g. "Centers for Disease Control and Prevention". */
  site: string
  /** The page's own title. */
  title: string
  /** The statement in the article the page backs up. */
  supports: string
  /** Which paragraph (1 = first). */
  para: number
}

export type SourceCheck = {
  added: Source[]
  /** External links that were already there and still work. */
  kept: { url: string; anchor: string }[]
  /** Dead links that were unlinked (the words stay). */
  removed: { url: string; anchor: string; why: string }[]
  /** Suggestions that failed a check, for the record. */
  rejected: { url: string; why: string }[]
  checkedAt: string
  note: string
}

const UA = "Mozilla/5.0 (compatible; XredibleSourceCheck/1.0; +https://www.xredible.in)"

// ---------- which publishers count ----------

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

/** Never linked: user-generated, social, shopping, encyclopedias and other secondary sources. */
const BLOCKED = /(^|\.)(medium\.com|blogspot\.com|wordpress\.com|substack\.com|tumblr\.com|wixsite\.com|weebly\.com|quora\.com|reddit\.com|pinterest\.[a-z.]+|facebook\.com|instagram\.com|x\.com|twitter\.com|threads\.net|linkedin\.com|tiktok\.com|youtube\.com|youtu\.be|wikipedia\.org|wikihow\.com|fandom\.com|scribd\.com|slideshare\.net|amazon\.[a-z.]+|flipkart\.com|etsy\.com|ebay\.[a-z.]+|google\.com\/search)$/

/** Official and academic domains. */
const OFFICIAL = [/\.(gov|edu|mil|int)$/, /\.(gov|nic|ac|edu|res|govt|gob|gouv|go)\.[a-z]{2}$/, /(^|\.)canada\.ca$/, /\.gc\.ca$/, /\.nhs\.uk$/, /(^|\.)europa\.eu$/, /(^|\.)gov\.uk$/, /\.org\.in$/]

/** Research publishers and official documentation that don't use those domains. */
const TRUSTED = new Set([
  "nature.com", "science.org", "sciencedirect.com", "link.springer.com", "springer.com", "onlinelibrary.wiley.com", "tandfonline.com", "jamanetwork.com",
  "thelancet.com", "bmj.com", "nejm.org", "cell.com", "pnas.org", "journals.plos.org", "frontiersin.org", "cochranelibrary.com", "academic.oup.com", "cambridge.org",
  "journals.sagepub.com", "apa.org", "who.int", "unicef.org", "worldbank.org", "imf.org", "oecd.org", "un.org", "unesco.org", "britannica.com",
  "developers.google.com", "support.google.com", "web.dev", "learn.microsoft.com", "developer.mozilla.org", "w3.org", "schema.org", "iso.org", "ieee.org",
  "mayoclinic.org", "clevelandclinic.org", "hopkinsmedicine.org", "healthychildren.org", "aap.org", "rbi.org.in",
])

function authority(host: string): boolean {
  if (!host || BLOCKED.test(host)) return false
  if (OFFICIAL.some((r) => r.test(host))) return true
  for (const t of TRUSTED) if (host === t || host.endsWith("." + t)) return true
  // Non-profit and professional bodies; the page itself is still checked.
  return /\.org$/.test(host)
}

const norm = (u: string) => u.replace(/#.*$/, "").replace(/[?&](utm_[a-z]+|fbclid|gclid)=[^&]*/gi, "").replace(/\/$/, "").toLowerCase()

// ---------- reading the article ----------

type Block = { n: number; start: number; end: number; text: string }

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8212;|&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")

/** Paragraphs and list items that can hold a link (not headings, tables, images or FAQ markup). */
function blocks(body: string, format: SourceFormat): Block[] {
  const out: Block[] = []
  if (format === "html") {
    const re = /<(p|li)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi
    for (let m; (m = re.exec(body)); ) {
      const inner = m[3]
      const start = m.index + m[0].indexOf(">") + 1
      const text = decode(inner.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()
      if (text.length >= 40) out.push({ n: out.length + 1, start, end: start + inner.length, text })
    }
    return out
  }
  let pos = 0
  for (const chunk of body.split(/(\n\s*\n)/)) {
    const start = pos
    pos += chunk.length
    const t = chunk.trim()
    if (!t || /^\n\s*\n$/.test(chunk) || /^#{1,6}\s/.test(t) || /^\|/.test(t) || /^!\[/.test(t)) continue
    const text = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim()
    if (text.length >= 40) out.push({ n: out.length + 1, start, end: pos, text })
  }
  return out
}

/** The external links already in the article. */
function linksIn(body: string, format: SourceFormat, own: string[]): { url: string; anchor: string; full: string; index: number }[] {
  const re = format === "html" ? /<a\b[^>]*?href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi : /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  const out: { url: string; anchor: string; full: string; index: number }[] = []
  for (let m; (m = re.exec(body)); ) {
    const url = (format === "html" ? m[1] : m[2]).replace(/&amp;/g, "&")
    const anchor = format === "html" ? decode(m[2].replace(/<[^>]+>/g, "")) : m[1]
    const h = hostOf(url)
    if (!h || own.some((o) => h === o || h.endsWith("." + o))) continue
    out.push({ url, anchor, full: m[0], index: m.index })
  }
  return out
}

/** Same length as `s`, with tags and existing links blanked out, so a match can't land inside them. */
function mask(s: string, format: SourceFormat): string {
  const blank = (m: string) => "\u0000".repeat(m.length)
  if (format === "html") return s.replace(/<a\b[\s\S]*?<\/a>/gi, blank).replace(/<[^>]+>/g, blank).replace(/&[a-z#0-9]+;/gi, blank)
  return s.replace(/\[[^\]]*\]\([^)]*\)/g, blank).replace(/`[^`]*`/g, blank)
}

/** Where `anchor` occurs in this block (as plain words, not inside a tag or link), or -1. */
function findAnchor(body: string, b: Block, anchor: string, format: SourceFormat): number {
  const seg = body.slice(b.start, b.end)
  const m = mask(seg, format)
  const variants = [anchor, anchor.replace(/’/g, "'"), anchor.replace(/'/g, "’")]
  for (const v of variants) {
    const i = m.indexOf(v)
    if (i >= 0 && seg.slice(i, i + v.length) === v) return b.start + i
    const lower = m.toLowerCase().indexOf(v.toLowerCase())
    if (lower >= 0 && seg.slice(lower, lower + v.length).toLowerCase() === v.toLowerCase()) return b.start + lower
  }
  return -1
}

// ---------- checking a page ----------

const STOP = new Set("about above after again against also among another because been before being between both called cannot could does doing during each every from further have having here into itself just more most much must only other over same should since some such than that their them then there these they this those through under until very were what when where which while will with within without would your yours page article help helps".split(" "))
const words = (s: string) => [...new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 4 && !STOP.has(w)))]

type Page = { ok: true; url: string; title: string; text: string } | { ok: false; why: string; blocked?: boolean }

async function openPage(url: string): Promise<Page> {
  try {
    const { res, bytes } = await safeFetch(url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.5" }, signal: AbortSignal.timeout(12_000) }, 4_000_000)
    if (res.status === 401 || res.status === 403 || res.status === 429) return { ok: false, why: `the site refused the check (HTTP ${res.status})`, blocked: true }
    if (res.status < 200 || res.status >= 300) return { ok: false, why: `HTTP ${res.status}` }
    const final = res.url || url
    const type = res.headers.get("content-type") || ""
    if (/pdf/i.test(type)) return { ok: true, url: final, title: decodeURIComponent(new URL(final).pathname.split("/").pop() || ""), text: "" }
    if (!/html|xml|text/i.test(type)) return { ok: false, why: "not a web page" }
    const html = new TextDecoder("utf-8").decode(bytes)
    const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").replace(/\s+/g, " ").trim()
    const h1 = decode((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || "").replace(/<[^>]+>/g, "").trim()
    const desc = decode((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i) || [])[1] || "")
    if (/\b(404|page not found|not found|page (doesn.t|does not|cannot be found) exist|no longer available|error)\b/i.test(`${title} ${h1}`) && !/error rates?|errors? in/i.test(title)) return { ok: false, why: "it shows a 'page not found' message" }
    const text = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").slice(0, 120_000)
    return { ok: true, url: final, title: title || h1, text: `${title} ${h1} ${desc} ${text}` }
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e)
    return { ok: false, why: /timeout|aborted/i.test(m) ? "the page took too long to open" : m.slice(0, 120), blocked: /timeout|aborted/i.test(m) }
  }
}

// ---------- the research request ----------

type Suggestion = { para: number; anchor: string; url: string; site: string; supports: string }

function prompt(o: { title: string; site: string; audience: string; paras: Block[]; avoid: string[]; need: number }) {
  const list = o.paras.map((b) => `[${b.n}] ${b.text.slice(0, 700)}`).join("\n")
  return `You are adding outbound links to an article on ${o.site || "a business website"}${o.audience ? ` (readers: ${o.audience})` : ""}. Use web search to find ${o.need + 4} candidate pages; ${o.need} will be kept.

Rules:
- Only authoritative, independent sources: official government agencies, universities, peer-reviewed journals and research institutions, recognised professional or standards bodies, and official documentation. Topical relevance matters more than the domain ending: the page must really be about the statement it backs.
- Never link to competitors: no blogs, niche websites, magazines, news-style content sites, agencies or businesses that publish content for the same readers as ${o.site || "this site"}. No social media, forums, Wikipedia, shops or ${o.site || "the site itself"}.
- Search the authorities directly, e.g. "site:.gov …", "site:.edu …", "site:who.int …", "site:ncbi.nlm.nih.gov …", or the official body for the topic. Ignore commercial results.
- Each must be a specific page (original research, official guidance or a primary source), not a homepage, preferably one that appeared in your search results. Never invent a URL or a finding; every URL is opened and checked before it is used.
- Each link backs one specific statement in one paragraph. Use a different page, publisher and paragraph for each. Spread them through the article.
- "anchor": 2–7 words copied EXACTLY, character for character, from that paragraph's text, that describe what the reader will find on the page (e.g. "screen time guidance for toddlers"). Never generic words like "click here" or "this study".
${o.avoid.length ? `- Already linked (don't use): ${o.avoid.join(", ")}\n` : ""}
Article title: ${o.title}

Paragraphs:
${list}

Return ONLY JSON, no prose and no code fence:
{"links": [{"para": 3, "anchor": "exact words from paragraph 3", "url": "https://…", "site": "publisher name", "supports": "the statement in the paragraph this page backs, in one sentence"}]}`
}

function parseLinks(text: string): Suggestion[] {
  const i = text.indexOf("{")
  const j = text.lastIndexOf("}")
  if (i < 0 || j < i) return []
  try {
    const o = JSON.parse(text.slice(i, j + 1)) as { links?: unknown[] }
    return (o.links || [])
      .map((x) => x as Record<string, unknown>)
      .map((x) => ({ para: Number(x.para) || 0, anchor: String(x.anchor || "").trim(), url: String(x.url || "").trim(), site: String(x.site || "").slice(0, 100), supports: String(x.supports || "").slice(0, 300) }))
      .filter((x) => x.para > 0 && x.anchor.length >= 3 && /^https:\/\//.test(x.url))
  } catch {
    return []
  }
}

// ---------- the whole check ----------

/**
 * Checks the article's external links and adds verified ones until it has 3–4.
 * `own`: the site's own hostnames (never linked as external). Returns the new body and a report.
 */
export async function checkSources(o: { title: string; body: string; format: SourceFormat; own: string[]; site: string; audience?: string; max?: number }): Promise<{ body: string; report: SourceCheck }> {
  const own = o.own.map((h) => h.toLowerCase().replace(/^www\./, "")).filter(Boolean)
  const max = Math.min(4, Math.max(3, o.max || 4))
  let body = o.body
  const report: SourceCheck = { added: [], kept: [], removed: [], rejected: [], checkedAt: new Date().toISOString(), note: "" }

  // 1. The links it already has.
  const existing = linksIn(body, o.format, own)
  const opened = await Promise.all(existing.map((l) => openPage(l.url)))
  for (let k = existing.length - 1; k >= 0; k--) {
    const l = existing[k]
    const p = opened[k]
    if (p.ok || (!p.ok && p.blocked)) {
      report.kept.unshift({ url: l.url, anchor: l.anchor })
      continue
    }
    // Dead: keep the words, drop the link.
    const inner = o.format === "html" ? l.full.replace(/^<a\b[^>]*>/i, "").replace(/<\/a>$/i, "") : l.anchor
    body = body.slice(0, l.index) + inner + body.slice(l.index + l.full.length)
    report.removed.unshift({ url: l.url, anchor: l.anchor, why: p.why })
  }
  const need = Math.max(0, max - report.kept.length)
  if (!need) {
    report.note = `The article already has ${report.kept.length} working external links.`
    return { body, report }
  }

  // 2. Suggestions from a web search.
  const paras = blocks(body, o.format)
  if (paras.length < 3) {
    report.note = "The article is too short to add sources to."
    return { body, report }
  }
  const r = await gateway({ kind: "research", model: "claude-sonnet-5-5", searches: 5, maxTokens: 4000, prompt: prompt({ title: o.title, site: o.site, audience: o.audience || "", paras, avoid: report.kept.map((k) => k.url), need }) }, 115_000)
  const rb = (r.body || {}) as { ok?: boolean; text?: string; found?: { url: string; title: string }[]; error?: string }
  if (r.status !== 200 || !rb.ok || !rb.text) {
    report.note = `Sources couldn't be researched just now (${rb.error || `HTTP ${r.status}`}). Try again in a few minutes.`
    return { body, report }
  }
  const searched = new Set((rb.found || []).map((f) => norm(f.url)))
  const titles = new Map((rb.found || []).map((f) => [norm(f.url), f.title]))
  const suggestions = parseLinks(rb.text)

  // 3. Check every suggestion.
  const usedUrl = new Set(report.kept.map((k) => norm(k.url)))
  const usedHost = new Set(report.kept.map((k) => hostOf(k.url)))
  const pre = suggestions.filter((s) => {
    const h = hostOf(s.url)
    const why = own.some((x) => h === x || h.endsWith("." + x)) ? "the site's own page" : !authority(h) ? "not an authoritative publisher" : usedUrl.has(norm(s.url)) ? "already linked" : !paras.find((b) => b.n === s.para) ? "unknown paragraph" : ""
    if (why) report.rejected.push({ url: s.url, why })
    return !why
  })
  // Pages Claude actually saw in its searches first.
  pre.sort((a, b) => Number(searched.has(norm(b.url))) - Number(searched.has(norm(a.url))))
  const pages = await Promise.all(pre.map((s) => openPage(s.url)))
  const usedPara = new Set<number>()
  const picks: { s: Suggestion; at: number; title: string; url: string }[] = []
  pre.forEach((s, k) => {
    if (picks.length >= need) return
    const p = pages[k]
    if (!p.ok) return void report.rejected.push({ url: s.url, why: p.why })
    const finalHost = hostOf(p.url)
    if (!authority(finalHost)) return void report.rejected.push({ url: s.url, why: "it redirects to another site" })
    if (new URL(p.url).pathname.replace(/\/$/, "") === "" && new URL(s.url).pathname.replace(/\/$/, "") !== "") return void report.rejected.push({ url: s.url, why: "it redirects to the homepage" })
    if (p.text) {
      const want = words(`${s.anchor} ${s.supports}`)
      const hay = p.text.toLowerCase()
      const hits = want.filter((w) => hay.includes(w)).length
      if (hits < Math.min(3, Math.max(2, Math.ceil(want.length / 3)))) return void report.rejected.push({ url: s.url, why: "the page doesn't match the statement" })
    }
    if (usedUrl.has(norm(p.url)) || usedUrl.has(norm(s.url))) return void report.rejected.push({ url: s.url, why: "duplicate" })
    if (usedPara.has(s.para)) return void report.rejected.push({ url: s.url, why: "that paragraph already has a link" })
    if (usedHost.has(finalHost) && pre.length - k > need - picks.length) return void report.rejected.push({ url: s.url, why: "same publisher as another link" })
    const b = paras.find((x) => x.n === s.para)!
    const at = findAnchor(body, b, s.anchor, o.format)
    if (at < 0) return void report.rejected.push({ url: s.url, why: "the link words aren't in that paragraph" })
    if (picks.some((q) => Math.abs(q.at - at) < s.anchor.length + 5)) return void report.rejected.push({ url: s.url, why: "overlaps another link" })
    picks.push({ s, at, title: p.title || titles.get(norm(s.url)) || "", url: s.url })
    usedUrl.add(norm(s.url))
    usedUrl.add(norm(p.url))
    usedHost.add(finalHost)
    usedPara.add(s.para)
  })

  // 4. Insert, from the end so earlier positions stay right.
  for (const q of [...picks].sort((a, b) => b.at - a.at)) {
    const words0 = body.slice(q.at, q.at + q.s.anchor.length)
    const link = o.format === "html" ? `<a href="${q.url.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" target="_blank" rel="noopener">${words0}</a>` : `[${words0}](${q.url})`
    body = body.slice(0, q.at) + link + body.slice(q.at + q.s.anchor.length)
  }
  report.added = picks
    .sort((a, b) => a.s.para - b.s.para)
    .map((q) => ({ anchor: body.includes(q.s.anchor) ? q.s.anchor : q.s.anchor, url: q.url, site: q.s.site || hostOf(q.url), title: q.title.slice(0, 160), supports: q.s.supports, para: q.s.para }))
  const total = report.kept.length + report.added.length
  report.note =
    total >= 3
      ? `${report.added.length} verified source${report.added.length === 1 ? "" : "s"} added${report.kept.length ? `, ${report.kept.length} existing link${report.kept.length === 1 ? "" : "s"} kept` : ""}.`
      : `Only ${total} source${total === 1 ? "" : "s"} could be verified for this article. The others failed a check (see below), so they weren't added.`
  return { body, report }
}
