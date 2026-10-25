// lib/autopilot/ideas.ts
//
// Server-only. "One idea → every channel": turn a note, a link or a YouTube video into ready drafts for
// each tool the customer uses, in their voice. Also festival posts, news ideas for their topics and the
// hours their Instagram followers are online.

import { insert } from "./db"
import { open } from "./crypto"
import { HONEST, LANG, askJson, voiceBlock, voiceOf } from "./ai"
import { profileFor } from "./service"
import { channelFor, type ToolKey } from "./tools"
import { graph } from "./meta"
import { momentById } from "./moments"

export type Channel = "linkedin" | ToolKey
export const CHANNELS: Channel[] = ["linkedin", "meta", "blog", "newsletter"]
export const CHANNEL_NAME: Record<Channel, string> = { linkedin: "LinkedIn", meta: "Instagram + Facebook", blog: "Blog article", newsletter: "Newsletter" }

type Ctx = { about: string; audience: string; tone: string; language: string; time: string; topics: string; brand: string; name: string; fromName: string; connected: boolean }

/** What each tool knows about the customer (only tools where "About" is filled in). */
export async function contexts(owner: string): Promise<Partial<Record<Channel, Ctx>>> {
  const [li, meta, blog, newsletter] = await Promise.all([profileFor(owner), channelFor(owner, "meta"), channelFor(owner, "blog"), channelFor(owner, "newsletter")])
  const out: Partial<Record<Channel, Ctx>> = {}
  if (li?.about) out.linkedin = { about: li.about, audience: li.audience, tone: li.tone, language: li.language || "English", time: li.postTime || "09:05", topics: li.topics, brand: "", name: "", fromName: "", connected: li.connected }
  for (const [k, c] of [["meta", meta], ["blog", blog], ["newsletter", newsletter]] as const) {
    const s = (c?.settings || {}) as Record<string, unknown>
    if (c && String(s.about || "").trim())
      out[k] = {
        about: String(s.about),
        audience: String(s.audience || ""),
        tone: String(s.tone || ""),
        language: String(s.language || "English"),
        time: /^\d{2}:\d{2}$/.test(String(s.time || "")) ? String(s.time) : "10:05",
        topics: String(s.topics || ""),
        brand: String(s.brand || ""),
        name: String(s.name || ""),
        fromName: String(s.fromName || ""),
        connected: c.connected,
      }
  }
  return out
}

// ---------- reading the source ----------

const strip = (html: string) =>
  html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()

/** The text behind a link (page text, or a YouTube video's title + description), or the note itself. */
export async function sourceText(input: string): Promise<{ text: string; from: string }> {
  const raw = input.trim()
  if (!/^https?:\/\/\S+$/i.test(raw)) {
    if (raw.length < 15) throw new Error("Write a few words about the idea, or paste a link.")
    return { text: raw.slice(0, 6000), from: "note" }
  }
  const url = new URL(raw)
  if (!/^https?:$/.test(url.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(url.hostname)) throw new Error("That link can't be read.")
  const yt = /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname)
  try {
    const r = await fetch(raw, { headers: { "User-Agent": "Mozilla/5.0 (compatible; XredibleBot/1.0; +https://www.xredible.in)", "Accept-Language": "en-IN,en;q=0.9" }, signal: AbortSignal.timeout(12_000), redirect: "follow" })
    const html = (await r.text()).slice(0, 800_000)
    const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim()
    const desc = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([^"']*)/i)?.[1] || ""
    if (yt) {
      const short = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1]
      const body = short ? (JSON.parse(`"${short}"`) as string) : desc
      return { text: `YouTube video: ${strip(title).replace(/ - YouTube$/, "")}\n\n${body}`.slice(0, 6000), from: "youtube" }
    }
    const article = html.match(/<article[\s\S]*?<\/article>/i)?.[0] || html.match(/<main[\s\S]*?<\/main>/i)?.[0] || html
    const text = `${strip(title)}\n\n${desc}\n\n${strip(article)}`.trim()
    if (text.length < 80) throw new Error("short")
    return { text: text.slice(0, 6000), from: "link" }
  } catch {
    throw new Error("Couldn't read that link. Paste the main points as text instead.")
  }
}

// ---------- writing ----------

const SPEC: Record<Channel, { kind: string; spec: string; json: string; tokens: number }> = {
  linkedin: {
    kind: "LinkedIn post",
    spec: "120 to 220 words, first line a specific hook under 12 words, short paragraphs with blank lines, one practical idea, end with a light question, at most 3 hashtags and 1 emoji. Plain text, no markdown or asterisks.",
    json: '{"topic": "<3-6 words>", "text": "..."}',
    tokens: 8000,
  },
  meta: {
    kind: "Instagram and Facebook post (one designed image + caption)",
    spec: "headline: 4 to 12 words printed on the image, max 70 characters, no hashtags or emojis. caption: hook first line, 50 to 140 words in short lines, a clear call to action, last line 5 to 10 hashtags, at most 3 emojis. Plain text, no markdown.",
    json: '{"topic": "<3-6 words>", "headline": "...", "caption": "..."}',
    tokens: 8000,
  },
  blog: {
    kind: "SEO blog article",
    spec: "About 800 words. title max 65 characters with the main search phrase; metaDescription 140 to 155 characters; body in markdown using only ## and ### headings, - bullets, 1. lists and **bold** (no H1, links, tables or images): a 2-3 sentence intro, 4 to 6 ## sections, a ## Frequently asked questions section with 3 ### questions, a short closing ## section with a natural heading of its own (not 'Conclusion' or 'Summary') that ends on a tip or a nudge to act.",
    json: '{"topic": "<main search phrase>", "title": "...", "metaDescription": "...", "body": "..."}',
    tokens: 12000,
  },
  newsletter: {
    kind: "email newsletter issue",
    spec: "subject max 55 characters, at most 1 emoji; preheader 60 to 100 characters; body in markdown with only ## headings, - bullets and **bold**, starting with the line 'Hi {{name}},', 250 to 400 words, 2 or 3 short sections, one clear call to reply or act, then a sign-off line.",
    json: '{"topic": "<3-6 words>", "subject": "...", "preheader": "...", "body": "..."}',
    tokens: 12000,
  },
}

type Out = { topic?: string; text?: string; headline?: string; caption?: string; title?: string; metaDescription?: string; body?: string; subject?: string; preheader?: string }

const tidy = (t: unknown) => String(t || "").replace(/\r\n/g, "\n").trim()

/** Next slot at the customer's usual time, at least 2 hours away, on or after `day` (India date). */
function slot(time: string, day?: string) {
  const [hh, mm] = (/^\d{2}:\d{2}$/.test(time) ? time : "10:05").split(":")
  let d = day || new Date(Date.now() + 330 * 60_000 + 864e5).toISOString().slice(0, 10)
  for (let i = 0; i < 5; i++) {
    const t = Date.parse(`${d}T${hh}:${mm}:00+05:30`)
    if (t > Date.now() + 2 * 3600e3) return new Date(t).toISOString()
    d = new Date(Date.parse(d) + 864e5).toISOString().slice(0, 10)
  }
  return new Date(Date.now() + 864e5).toISOString()
}

async function writeOne(owner: string, ch: Channel, c: Ctx, task: string, day?: string): Promise<{ channel: Channel; id: number; title: string } | { channel: Channel; error: string }> {
  const S = SPEC[ch]
  try {
    const o = await askJson<Out>(
      `You write a ${S.kind} for one person or business, in their voice. They approve it before it goes out.\n\nABOUT THEM: ${c.about}\nAUDIENCE: ${c.audience || "their customers and followers"}\nTONE: ${c.tone || "warm, clear, confident, plain words"}\nLANGUAGE: ${LANG[c.language] || LANG.English}\n${c.brand ? `BRAND: ${c.brand}\n` : ""}${c.name ? `NEWSLETTER NAME: ${c.name}\n` : ""}${c.fromName ? `SIGN OFF AS: ${c.fromName}\n` : ""}${voiceBlock(await voiceOf(owner, ch))}\n${task}\n\nFORMAT: ${S.spec}\n${HONEST}\n\nReturn JSON only: ${S.json}`,
      S.tokens,
    )
    const scheduledAt = slot(c.time, day)
    const topic = tidy(o.topic).slice(0, 60)
    if (ch === "linkedin") {
      const text = tidy(o.text).replace(/\*\*(.+?)\*\*/g, "$1")
      if (text.length < 80) throw new Error("empty")
      const r = await insert<{ id: number }>("li_posts", { email: owner, status: "draft", text: text.slice(0, 2900), topic, scheduledAt, postedAt: null, postUrn: "", error: "" })
      return { channel: ch, id: Number(r.id), title: topic || text.split("\n")[0].slice(0, 80) }
    }
    let row: { title: string; summary: string; text: string }
    if (ch === "meta") {
      const caption = tidy(o.caption).replace(/\*\*(.+?)\*\*/g, "$1")
      if (caption.length < 40 || !o.headline) throw new Error("empty")
      row = { title: tidy(o.headline).replace(/[#*]/g, "").slice(0, 90), summary: "", text: caption.slice(0, 2200) }
    } else if (ch === "blog") {
      const body = tidy(o.body).replace(/^#\s+.*\n+/, "")
      if (body.length < 800 || !o.title) throw new Error("empty")
      row = { title: tidy(o.title).slice(0, 120), summary: tidy(o.metaDescription).slice(0, 300), text: body.slice(0, 60000) }
    } else {
      const body = tidy(o.body)
      if (body.length < 300 || !o.subject) throw new Error("empty")
      row = { title: tidy(o.subject).slice(0, 120), summary: tidy(o.preheader).slice(0, 300), text: body.slice(0, 30000) }
    }
    const r = await insert<{ id: number }>("ap_items", { email: owner, product: ch, status: "draft", ...row, topic, image: "", scheduledAt, postedAt: null, ref: "", progress: 0, error: "" })
    return { channel: ch, id: Number(r.id), title: row.title }
  } catch (e) {
    const m = e instanceof Error ? e.message : ""
    return { channel: ch, error: m === "empty" ? "The AI answer came back too short. Try again." : m || "Couldn't write this one." }
  }
}

async function fanOut(owner: string, wanted: unknown, task: (c: Ctx) => string, day?: string) {
  const ctx = await contexts(owner)
  const list = (Array.isArray(wanted) ? wanted : []).filter((c): c is Channel => CHANNELS.includes(c as Channel))
  if (!list.length) throw new Error("Pick at least one channel.")
  const missing = list.filter((c) => !ctx[c])
  if (missing.length === list.length) throw new Error(`Fill in "About" on ${missing.map((m) => CHANNEL_NAME[m]).join(", ")} first so the drafts fit you.`)
  const results = await Promise.all(list.filter((c) => ctx[c]).map((c) => writeOne(owner, c, ctx[c]!, task(ctx[c]!), day)))
  return [...results, ...missing.map((c) => ({ channel: c, error: `Fill in "About" on ${CHANNEL_NAME[c]} first.` }))]
}

/** One note / link / video → a draft for each chosen channel. */
export async function repurpose(owner: string, input: string, channels: unknown, angle = "") {
  const src = await sourceText(input)
  const what = src.from === "note" ? "THEIR IDEA / NOTES" : src.from === "youtube" ? "THEIR YOUTUBE VIDEO (title and description)" : "A PAGE THEY SHARED"
  return fanOut(
    owner,
    channels,
    () =>
      `Turn this into content. Keep the core message and any real facts from it, but write it fresh for this channel (not a summary of a summary).${src.from === "youtube" ? " Mention that the full video is on their YouTube channel." : ""}${angle ? `\nANGLE THEY WANT: ${angle.slice(0, 200)}` : ""}\n\n${what}:\n"""\n${src.text}\n"""`,
  )
}

/** Posts for a festival or special day, planned for that day. */
export async function momentPosts(owner: string, momentId: string, channels: unknown) {
  const m = momentById(momentId)
  if (!m) throw new Error("Pick a day from the list.")
  return fanOut(
    owner,
    channels,
    () =>
      `Write it for ${m.name} (${new Date(m.date).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}). Themes people connect with: ${m.idea}. Tie the day naturally to what they do; a warm wish plus one genuinely useful or heartfelt idea, not a hard sell. Be respectful of the day's meaning. Don't invent offers or discounts.`,
    m.date,
  )
}

// ---------- news ideas for their topics ----------

export type NewsIdea = { topic: string; title: string; link: string; source: string; at: string }

export async function newsIdeas(topics: string[]): Promise<NewsIdea[]> {
  const list = [...new Set(topics.map((t) => t.trim()).filter((t) => t.length > 2))].slice(0, 3)
  const out: NewsIdea[] = []
  await Promise.all(
    list.map(async (topic) => {
      try {
        const r = await fetch(`https://news.google.com/rss/search?q=${encodeURIComponent(topic + " when:7d")}&hl=en-IN&gl=IN&ceid=IN:en`, { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } })
        const xml = await r.text()
        for (const m of xml.match(/<item>[\s\S]*?<\/item>/g)?.slice(0, 4) || []) {
          const get = (tag: string) => (m.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim()
          const source = get("source")
          const title = get("title").replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`), "")
          if (title) out.push({ topic, title, link: get("link"), source, at: get("pubDate") })
        }
      } catch {}
    }),
  )
  return out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 10)
}

// ---------- when their Instagram followers are online ----------

export async function bestHours(owner: string): Promise<{ hours: { hour: number; share: number }[]; error?: string } | null> {
  const c = await channelFor(owner, "meta")
  if (!c?.connected || !c.secretEnc || !c.meta.igId) return null
  try {
    const secret = JSON.parse(open(c.secretEnc)) as { token?: string }
    const r = await graph<{ data?: { values?: { value?: Record<string, number> }[] }[] }>(`/${c.meta.igId}/insights?metric=online_followers&period=lifetime&access_token=${encodeURIComponent(String(secret.token || ""))}`)
    const vals = (r.data?.[0]?.values || []).map((v) => v.value || {}).filter((v) => Object.keys(v).length)
    if (!vals.length) return { hours: [], error: "Instagram shares this once the account has 100+ followers." }
    // Meta reports these hours in Pacific time; turn them into India time.
    const sum = new Array(24).fill(0) as number[]
    for (const v of vals) for (const [h, n] of Object.entries(v)) sum[(Number(h) + 12.5 + 24) % 24 | 0] += Number(n) || 0
    const total = sum.reduce((a, b) => a + b, 0) || 1
    return { hours: sum.map((n, hour) => ({ hour, share: n / total })) }
  } catch (e) {
    const m = e instanceof Error ? e.message : ""
    return { hours: [], error: /permission|scope/i.test(m) ? "Reconnect Instagram + Facebook once so Xredible may read your audience insights." : "Instagram didn't share this yet." }
  }
}
