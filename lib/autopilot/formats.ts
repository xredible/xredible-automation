// lib/autopilot/formats.ts
//
import { isTemplate, type TemplateKey } from "./brand-presets"

// Safe for client code. Post formats: plain text, one designed image, a carousel of designed
// slides, or the customer's own photos. A post's design lives as JSON in its `design` column.

export type Format = "text" | "image" | "carousel" | "photo"
export type Slide = { title: string; body: string }
/** Blog articles: the outbound links that were checked and added (lib/sources). */
export type SourcesInfo = {
  at: string
  pending?: boolean
  note: string
  added: { anchor: string; url: string; site: string; title: string; supports: string }[]
  kept: string[]
  removed: { url: string; why: string }[]
}
/** profile: the extra profile (XD Channels row id) a post goes to; none = the main profile. */
export type Design = { profile?: number; headline?: string; slides?: Slide[]; photos?: string[]; template?: TemplateKey; goal?: Goal; trend?: string; audience?: { tags?: string[]; segment?: "all" | "engaged" | "new" | "inactive" }; sources?: SourcesInfo }

// ---------- post goals: what each post is for ----------
// Most posts earn attention and trust; a few ask for business. Only "offer" posts carry the sales call to action.

export type Goal = "teach" | "story" | "proof" | "talk" | "offer"
export const GOALS: { key: Goal; label: string; blurb: string }[] = [
  { key: "teach", label: "Teach", blurb: "How-tos, checklists, mistakes to avoid, trend explainers. Builds authority and saves." },
  { key: "story", label: "Story", blurb: "Lessons, opinions and behind the scenes from your own work. Builds trust and likeability." },
  { key: "proof", label: "Proof", blurb: "What you did and how it turned out: before/after, process, small wins. Shows you deliver." },
  { key: "talk", label: "Conversation", blurb: "A question, a hot take or a this-or-that. Starts comments, which spreads your reach." },
  { key: "offer", label: "Offer", blurb: "Your service, product or free audit, with one clear next step. Turns readers into leads." },
]
export const isGoal = (v: unknown): v is Goal => typeof v === "string" && GOALS.some((g) => g.key === v)
export const GOAL_LABEL = Object.fromEntries(GOALS.map((g) => [g.key, g.label])) as Record<Goal, string>
export type GoalMix = Record<Goal, number>
export const GOAL_PLANS: { key: string; label: string; mix: GoalMix }[] = [
  { key: "growth", label: "Steady growth (recommended): 40% teach · 20% story · 15% proof · 10% conversation · 15% offer", mix: { teach: 40, story: 20, proof: 15, talk: 10, offer: 15 } },
  { key: "leads", label: "More leads: 30% teach · 15% story · 20% proof · 10% conversation · 25% offer", mix: { teach: 30, story: 15, proof: 20, talk: 10, offer: 25 } },
  { key: "brand", label: "New account, build trust first: 45% teach · 30% story · 10% proof · 10% conversation · 5% offer", mix: { teach: 45, story: 30, proof: 10, talk: 10, offer: 5 } },
]
export const goalPlanKey = (v: unknown) => (GOAL_PLANS.some((m) => m.key === v) ? String(v) : "growth")

export const FORMAT_LABEL: Record<Format, string> = { text: "Text", image: "Image", carousel: "Carousel", photo: "Your photos" }
export const LI_FORMATS: Format[] = ["text", "image", "carousel", "photo"]
export const META_FORMATS: Format[] = ["image", "carousel", "photo"]

export const isFormat = (v: unknown): v is Format => typeof v === "string" && ["text", "image", "carousel", "photo"].includes(v)

export const MAX_SLIDES = 10
export const MAX_PHOTOS = 10

const s = (v: unknown, n: number) => String(v ?? "").replace(/\s+\n/g, "\n").trim().slice(0, n)

export function parseDesign(raw: unknown): Design {
  if (raw && typeof raw === "object") return cleanDesign(raw)
  try {
    return cleanDesign(JSON.parse(String(raw || "{}")))
  } catch {
    return {}
  }
}

export function cleanDesign(d: unknown): Design {
  const o = (d && typeof d === "object" ? d : {}) as Record<string, unknown>
  const out: Design = {}
  const headline = s(o.headline, 90)
  if (headline) out.headline = headline
  if (Array.isArray(o.slides)) {
    const slides = o.slides
      .map((x) => ({ title: s((x as Slide)?.title, 80), body: s((x as Slide)?.body, 260) }))
      .filter((x) => x.title || x.body)
      .slice(0, MAX_SLIDES)
    if (slides.length) out.slides = slides
  }
  if (Number.isInteger(Number(o.profile)) && Number(o.profile) > 0) out.profile = Number(o.profile)
  if (isTemplate(o.template)) out.template = o.template
  if (isGoal(o.goal)) out.goal = o.goal
  const trend = s(o.trend, 200)
  if (trend && trend !== "evergreen") out.trend = trend
  if (o.audience && typeof o.audience === "object") {
    const a = o.audience as Record<string, unknown>
    const tags = (Array.isArray(a.tags) ? a.tags : []).map((t) => String(t).trim().toLowerCase().slice(0, 30)).filter(Boolean).slice(0, 10)
    const segment = ["all", "engaged", "new", "inactive"].includes(String(a.segment)) ? (a.segment as "all") : "all"
    if (tags.length || segment !== "all") out.audience = { tags, segment }
  }
  if (Array.isArray(o.photos)) {
    const photos = o.photos.map((x) => String(x || "").trim()).filter((x) => /^https:\/\/\S+$/i.test(x)).slice(0, MAX_PHOTOS)
    if (photos.length) out.photos = photos
  }
  if (o.sources && typeof o.sources === "object") {
    const x = o.sources as Record<string, unknown>
    const url = (v: unknown) => (/^https:\/\/\S+$/i.test(String(v || "")) ? String(v).slice(0, 600) : "")
    const arr = (v: unknown) => (Array.isArray(v) ? v : []).slice(0, 12) as Record<string, unknown>[]
    out.sources = {
      at: s(x.at, 40),
      ...(x.pending === true ? { pending: true } : {}),
      note: s(x.note, 300),
      added: arr(x.added).map((a) => ({ anchor: s(a.anchor, 120), url: url(a.url), site: s(a.site, 100), title: s(a.title, 160), supports: s(a.supports, 300) })).filter((a) => a.url),
      kept: arr(x.kept).map((k) => url(k)).filter(Boolean),
      removed: arr(x.removed).map((r) => ({ url: url(r.url), why: s(r.why, 120) })).filter((r) => r.url),
    }
  }
  return out
}

/** How many images a post sends (0 for text). */
export function imageCount(format: Format, d: Design) {
  if (format === "carousel") return d.slides?.length || 0
  if (format === "photo") return d.photos?.length || 0
  if (format === "image") return 1
  return 0
}

// ---------- the mix of formats the writers aim for ----------

export type Mix = { text: number; image: number; carousel: number }

export const LI_MIXES: { key: string; label: string; mix: Mix }[] = [
  { key: "balanced", label: "Balanced: 40% text · 30% image · 30% carousel", mix: { text: 40, image: 30, carousel: 30 } },
  { key: "text", label: "Mostly text: 70% text · 20% image · 10% carousel", mix: { text: 70, image: 20, carousel: 10 } },
  { key: "visual", label: "Visual: 20% text · 40% image · 40% carousel", mix: { text: 20, image: 40, carousel: 40 } },
  { key: "textonly", label: "Text only", mix: { text: 100, image: 0, carousel: 0 } },
]
export const META_MIXES: { key: string; label: string; mix: Mix }[] = [
  { key: "balanced", label: "Balanced: 60% single image · 40% carousel", mix: { text: 0, image: 60, carousel: 40 } },
  { key: "single", label: "Single images only", mix: { text: 0, image: 100, carousel: 0 } },
  { key: "carousels", label: "Mostly carousels: 30% image · 70% carousel", mix: { text: 0, image: 30, carousel: 70 } },
]
export const mixKey = (list: { key: string }[], v: unknown) => (list.some((m) => m.key === v) ? String(v) : "balanced")
