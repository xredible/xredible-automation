// lib/autopilot/style.ts
//
// Human-writing rules shared by every Autopilot writer (posts, carousels, blogs, emails, rewrites).
// Learned from the hand-written articles of our editor, which pass AI detectors; the same rules
// drive the Nestoodle blog writer (elevating-christ repo, ops/n8n/automations/nestoodle-blog/style.js).
// They cover HOW it reads. Each customer's own voice, person ("I" or "we"), tone and language
// still come from their settings and the posts they edited.

/** Stock phrases that make text read as AI-written. */
export const BANNED = [
  "dive into", "deep dive", "delve", "in today's fast-paced world", "in today's world", "look no further", "game-changer", "game changer",
  "unlock", "embark", "navigate the", "navigating", "it's important to note", "it is important to note", "it's worth noting",
  "in conclusion", "to sum up", "in summary", "the best part?", "not only", "a testament to", "tapestry", "plethora", "myriad",
  "seamless", "seamlessly", "holistic", "realm", "ever-evolving", "ever-changing", "crucial", "pivotal", "vital role",
  "moreover", "furthermore", "additionally", "comprehensive", "robust", "leverage", "utilize", "boasts", "transformative",
  "meticulous", "intricate", "when it comes to", "let's explore", "we've got you covered", "at the end of the day", "key takeaways",
  "whether you're", "this guide", "this article", "in this post", "without further ado", "buckle up", "harness", "empower",
  "resonate", "elevate your", "take it to the next level", "a must-have", "rest assured", "fret not",
]

export const HUMAN = `WRITE LIKE A PERSON, NOT A TEMPLATE:
- Rhythm: most sentences 8-20 words, mixed with some very short ones and only a few long ones. Paragraphs of 1-3 sentences.
- Contractions and plain everyday words (use, help, start), never "utilize", "leverage", "facilitate".
- Open with something real: a question, a surprising fact or a familiar moment. Never "In today's…", "If you're looking for…", "Whether you're…", "In this post…".
- Be specific: real numbers, times, amounts and names of things from what they told you. Specific beats general.
- Every paragraph and list item starts differently. No summary or moral at the end of a section; end on a tip, an aside or a nudge.
- Never use: ${BANNED.map((b) => `"${b}"`).join(", ")}.
- Never invent a personal story, a test, a result, a statistic, a percentage or a quote. Don't claim something happened to them ("It happened to me", "a client once…", "every weekend I see…") unless ABOUT THEM says so; give the tip as plain advice instead.`

/** Banned phrases in `text`, ignoring any the customer used themselves (`own`, e.g. their About text or brief). */
export function aiPhrases(text: string, own = ""): string[] {
  const t = String(text || "").toLowerCase().replace(/[’‘]/g, "'")
  const mine = String(own || "").toLowerCase().replace(/[’‘]/g, "'")
  return BANNED.filter((b) => t.includes(b) && !mine.includes(b))
}

/** Quick check of a finished text: banned phrases, sentence rhythm and repeated paragraph openings. */
export function styleReport(text: string, own = "") {
  const plain = String(text || "").replace(/<[^>]+>/g, " ").replace(/[#*_>`]/g, " ")
  const words = plain.match(/[\p{L}’'-]+/gu) || []
  const sents = plain.split(/(?<=[.!?।])\s+|\n+/).map((s) => (s.match(/[\p{L}’'-]+/gu) || []).length).filter((l) => l >= 2)
  const avg = sents.reduce((a, b) => a + b, 0) / Math.max(1, sents.length)
  const sd = Math.sqrt(sents.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, sents.length))
  const paras = plain.split(/\n+/).map((p) => p.trim()).filter((p) => !/^[-•\d]/.test(p) && (p.match(/\S+/g) || []).length >= 12)
  const counts = paras.map((p) => p.split(/\s+/).slice(0, 2).join(" ").toLowerCase()).reduce<Record<string, number>>((m, w) => ((m[w] = (m[w] || 0) + 1), m), {})
  const repeats = Object.entries(counts).filter(([, c]) => c >= 3).map(([w, c]) => `"${w}…" ×${c}`)
  const found = aiPhrases(plain, own)
  const issues: string[] = []
  if (found.length) issues.push(`AI-sounding phrases: ${found.join(", ")}`)
  if (sents.length >= 8 && avg > 20) issues.push(`sentences too long (avg ${avg.toFixed(1)} words)`)
  if (sents.length >= 8 && sd < 4) issues.push(`sentence lengths too even (spread ${sd.toFixed(1)})`)
  if (repeats.length) issues.push(`paragraphs start the same way: ${repeats.slice(0, 3).join(", ")}`)
  return { words: words.length, avgSentence: Math.round(avg * 10) / 10, spread: Math.round(sd * 10) / 10, aiPhrases: found, issues, ok: !issues.length }
}

// Safe word swaps for the commonest AI tells. "" removes a lead-in; the next word then gets a capital
// if the removed phrase started the sentence.
const SWAPS: [RegExp, string][] = [
  [/\b(?:moreover|furthermore|additionally),\s*/gi, "also, "],
  [/\bit(?:'|’)s (?:important|worth) (?:to note|noting) that\s+/gi, ""],
  [/\bit is important to note that\s+/gi, ""],
  [/\bin today(?:'|’)s fast-paced world,?\s*/gi, "these days, "],
  [/\butiliz(e|es|ed|ing)\b/gi, "us$1"],
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bseamless\b/gi, "smooth"],
  [/\b(?:a )?(?:plethora|myriad) of\b/gi, "lots of"],
  [/\bwithout further ado,?\s*/gi, ""],
  [/\b(?:in conclusion|to sum up|in summary),\s*/gi, ""],
]

/** Rewords the commonest AI tells in place, unless the customer uses that phrase themselves (`own`). */
export function polish(text: string, own = ""): string {
  const mine = String(own || "").toLowerCase()
  let t = String(text || "")
  for (const [re, to] of SWAPS) {
    t = t.replace(re, (m: string, ...rest: unknown[]) => {
      const g = typeof rest[0] === "string" ? rest[0] : ""
      const offset = rest.find((x) => typeof x === "number") as number
      if (mine.includes(m.toLowerCase().replace(/[,\s]+$/, ""))) return m
      const out = to.replace("$1", g)
      if (/^[A-Z]/.test(m)) return out ? out.charAt(0).toUpperCase() + out.slice(1) : "\u0001"
      return out || (/(^|[.!?]\s*|\n\s*)$/.test(t.slice(0, offset)) ? "\u0001" : "")
    })
    t = t.replace(/\u0001(\s*)(\p{Ll})/gu, (_m, sp: string, c: string) => sp + c.toUpperCase()).replace(/\u0001/g, "")
  }
  return t
}
