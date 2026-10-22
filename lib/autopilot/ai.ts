// lib/autopilot/ai.ts
//
// Server-only. One Gemini answer through the n8n gateway (kind "ai"), so the Gemini key stays in n8n.
// Used for: rewrite buttons, "one idea → every channel", festival posts, and learning a customer's voice.

import { gateway } from "@/lib/dashboard/gateway"
import { addNotice, noticesFor, removeNotice } from "./account"

export async function ask(prompt: string, o: { json?: boolean; maxTokens?: number; temperature?: number } = {}): Promise<string> {
  const r = await gateway({ kind: "ai", prompt, json: !!o.json, maxTokens: o.maxTokens ?? 2048, temperature: o.temperature ?? 0.8 }, 95_000)
  const b = r.body as { ok?: boolean; text?: string; error?: string }
  if (r.status !== 200 || !b?.ok || !b.text) throw new Error(b?.error || "The AI didn't answer. Try again in a minute.")
  return b.text
}

export async function askJson<T>(prompt: string, maxTokens = 2048): Promise<T> {
  const text = await ask(prompt, { json: true, maxTokens })
  try {
    return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim()) as T
  } catch {
    throw new Error("The AI answer came back broken. Try again.")
  }
}

export const LANG: Record<string, string> = {
  English: "English (Indian English is fine)",
  Hinglish: "Hinglish (conversational Hindi written in English letters, mixed naturally with English words)",
  Hindi: "Hindi in Devanagari script (common English words can stay in English)",
}

export const HONEST = 'Do not invent facts about them: no made-up prices, offers, numbers, awards, testimonials or client names. No hype words like "game-changer", "unlock", "delve", "elevate".'

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
    o.markdown ? 8000 : 3000,
  )
  const text = String(out.text || "").trim()
  if (text.length < 20) throw new Error("The rewrite came back empty. Try again.")
  return { text: text.slice(0, o.limit), ...(o.title !== undefined && out.title ? { title: String(out.title).trim().slice(0, 120) } : {}) }
}
