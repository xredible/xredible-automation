// lib/autopilot/ai.ts
//
// Server-only. One Gemini answer through the n8n gateway (kind "ai"), so the Gemini key stays in n8n.
// Used for: rewrite buttons, "one idea → every channel", festival posts, and learning a customer's voice.

import { gateway } from "@/lib/dashboard/gateway"
import { addNotice, noticesFor, removeNotice } from "./account"
import { HUMAN, aiPhrases, polish } from "./style"

export async function ask(prompt: string, o: { json?: boolean; maxTokens?: number; temperature?: number; timeoutMs?: number; thinking?: "minimal" | "low" | "medium" | "high" } = {}): Promise<string> {
  const r = await gateway({ kind: "ai", prompt, json: !!o.json, maxTokens: o.maxTokens ?? 2048, temperature: o.temperature ?? 0.8, ...(o.thinking ? { thinking: o.thinking } : {}) }, o.timeoutMs ?? 95_000)
  const b = r.body as { ok?: boolean; text?: string; error?: string }
  if (r.status !== 200 || !b?.ok || !b.text) throw new Error(b?.error || "The AI didn't answer. Try again in a minute.")
  return b.text
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()) as T
  } catch {
    throw new Error("The AI answer came back broken. Try again.")
  }
}

/** All the text in an answer, for the style check. */
const strings = (v: unknown): string => (typeof v === "string" ? v : Array.isArray(v) ? v.map(strings).join("\n") : v && typeof v === "object" ? Object.values(v).map(strings).join("\n") : "")

/** Every string in an answer, passed through `f`. */
const mapStrings = (v: unknown, f: (s: string) => string): unknown =>
  typeof v === "string" ? f(v) : Array.isArray(v) ? v.map((x) => mapStrings(x, f)) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x, f)])) : v

/**
 * A JSON answer from the AI. Every answer is checked for stock AI phrases (see style.ts); if it has
 * any the customer didn't use themselves, the AI rewords just those once (only when the first answer
 * came back quickly, so the request still fits the route's time limit; otherwise the first answer stands). Then the commonest
 * tells are reworded in place (polish).
 */
export async function askJson<T>(prompt: string, maxTokens = 8000, o: { check?: boolean } = {}): Promise<T> {
  const t0 = Date.now()
  const first = parseJson<T>(await ask(prompt, { json: true, maxTokens }))
  if (o.check === false) return first
  // Phrases from their own About, tone or brief are fine; the text being edited doesn't count as theirs.
  const own = prompt.replace(HUMAN, "").split(/\n(?:CURRENT TEXT|POST):\n/)[0]
  const done = (v: T) => mapStrings(v, (x) => polish(x, own)) as T
  const found = aiPhrases(strings(first), own)
  if (!found.length || Date.now() - t0 > 35_000) return done(first)
  try {
    const fixed = parseJson<T>(
      await ask(
        `${prompt}\n\nYOUR LAST ANSWER:\n${JSON.stringify(first)}\n\nIt uses phrases that read as AI-written: ${found.map((f) => `"${f}"`).join(", ")}. Return the same JSON with only those phrases reworded in plain, everyday words. Change nothing else.`,
        { json: true, maxTokens, timeoutMs: 50_000 },
      ),
    )
    return done(strings(fixed).length > strings(first).length * 0.6 ? fixed : first)
  } catch {
    return done(first)
  }
}

export const LANG: Record<string, string> = {
  English: "English (Indian English is fine)",
  Hinglish: "Hinglish (conversational Hindi written in English letters, mixed naturally with English words)",
  Hindi: "Hindi in Devanagari script (common English words can stay in English)",
}

export const HONEST = `Do not invent facts about them: no made-up prices, offers, numbers, awards, testimonials or client names.\n${HUMAN}`

// ---------- learning the customer's voice ----------
// When someone edits a draft, the finished text is kept (the last 4 per tool) as an example of how
// they write. Rewrites and the n8n draft writers show these examples to Gemini.

const VOICE_MAX = 4

export async function rememberVoice(owner: string, product: string, text: string) {
  const clean = text.trim()
  if (clean.length < 60) return
  const mine = (await noticesFor(owner)).filter((n) => n.kind === "voice" && n.key === product).sort((a, b) => String(a.at).localeCompare(String(b.at)))
  for (const old of mine.slice(0, Math.max(0, mine.length - (VOICE_MAX - 1)))) await removeNotice(old.id)
  await addNotice(owner, "voice", product, clean.slice(0, 1800))
}

export async function voiceOf(owner: string, product: string): Promise<string[]> {
  return (await noticesFor(owner)).filter((n) => n.kind === "voice" && n.key === product).map((n) => n.value)
}

export const voiceBlock = (samples: string[]) =>
  samples.length ? `\nHOW THEY WRITE (posts they edited themselves; match this voice, rhythm and formatting, but don't copy sentences):\n${samples.map((s, i) => `--- example ${i + 1} ---\n${s.slice(0, 900)}`).join("\n")}\n` : ""

// ---------- rewrite buttons ----------

export const REWRITES: Record<string, string> = {
  shorter: "Make it about 40% shorter. Keep the main idea and the hook.",
  longer: "Make it a bit longer and more useful: add one concrete example or step.",
  hook: "Rewrite only the opening so the first line is a much stronger, specific hook. Keep the rest.",
  hinglish: "Rewrite it in natural Hinglish (Hindi in English letters mixed with English), the way Indians write online.",
  hindi: "Rewrite it in simple Hindi (Devanagari). Common English words can stay in English.",
  english: "Rewrite it in clear, simple English.",
  formal: "Make the tone more professional and polished.",
  friendly: "Make the tone warmer, more friendly and conversational.",
  cta: "Add one clear, natural call to action at the end (comment, save, share, reply, visit, DM).",
  emoji: "Add a few fitting emojis (at most 4), without overdoing it.",
}

export async function rewrite(o: { kind: string; text: string; title?: string; how: string; custom?: string; samples: string[]; limit: number; markdown?: boolean }): Promise<{ text: string; title?: string }> {
  const instruction = o.how === "custom" ? String(o.custom || "").slice(0, 300) : REWRITES[o.how]
  if (!instruction) throw new Error("Pick how to rewrite it.")
  const out = await askJson<{ text?: string; title?: string }>(
    `You edit a ${o.kind} for its author. Apply this change: ${instruction}\n${voiceBlock(o.samples)}\n${HONEST}\n${o.markdown ? "Keep the same simple markdown marks (## headings, - lists, **bold**)." : "Plain text only, no markdown or asterisks."} Keep it under ${o.limit} characters.\n\n${o.title !== undefined ? `CURRENT TITLE: ${o.title}\n` : ""}CURRENT TEXT:\n${o.text}\n\nReturn JSON only: {${o.title !== undefined ? '"title": "...", ' : ""}"text": "..."}`,
    12000,
  )
  const text = String(out.text || "").trim()
  if (text.length < 20) throw new Error("The rewrite came back empty. Try again.")
  return { text: text.slice(0, o.limit), ...(o.title !== undefined && out.title ? { title: String(out.title).trim().slice(0, 120) } : {}) }
}

// ---------- designs for image and carousel posts ----------

export const SLIDES_RULES =
  "Slide 1 is the cover: a scroll-stopping title of at most 8 words and a subtitle of at most 14 words. Then 4 to 6 slides with one idea each: a title of at most 7 words and a body of at most 32 words. The last slide is the takeaway or call to action (title at most 7 words, body at most 25 words). Same language as the post. Plain text, no hashtags, no emojis, no numbering in titles."

/** A short headline for a designed image, from a post's text. */
export async function makeHeadline(text: string): Promise<string> {
  const o = await askJson<{ headline?: string }>(
    `Write the words printed big on an image that goes with this social media post: 4 to 10 words, max 70 characters, a strong hook or the key tip. Same language as the post. No hashtags, emojis or quotes.\n\nPOST:\n${text.slice(0, 3000)}\n\nReturn JSON only: {"headline": "..."}`,
  )
  const h = String(o.headline || "").replace(/[#*"]/g, "").trim()
  if (h.length < 3) throw new Error("Couldn't write a headline. Try again.")
  return h.slice(0, 90)
}

/** Carousel slides from a post's text. */
export async function makeSlides(text: string): Promise<{ title: string; body: string }[]> {
  const o = await askJson<{ slides?: { title?: string; body?: string }[] }>(
    `Turn this social media post into a swipeable carousel. ${SLIDES_RULES} ${HONEST}\n\nPOST:\n${text.slice(0, 4000)}\n\nReturn JSON only: {"slides": [{"title": "...", "body": "..."}]}`,
  )
  const slides = (o.slides || []).map((s) => ({ title: String(s.title || "").trim().slice(0, 80), body: String(s.body || "").trim().slice(0, 260) })).filter((s) => s.title || s.body)
  if (slides.length < 3) throw new Error("Couldn't make the slides. Try again.")
  return slides.slice(0, 10)
}
