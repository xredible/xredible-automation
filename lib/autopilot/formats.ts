// lib/autopilot/formats.ts
//
import { isTemplate, type TemplateKey } from "./brand-presets"

// Safe for client code. Post formats: plain text, one designed image, a carousel of designed
// slides, or the customer's own photos. A post's design lives as JSON in its `design` column.

export type Format = "text" | "image" | "carousel" | "photo"
export type Slide = { title: string; body: string }
export type Design = { headline?: string; slides?: Slide[]; photos?: string[]; template?: TemplateKey; audience?: { tags?: string[]; segment?: "all" | "engaged" | "new" | "inactive" } }

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
  if (isTemplate(o.template)) out.template = o.template
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
