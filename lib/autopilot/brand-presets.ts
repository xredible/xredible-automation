// lib/autopilot/brand-presets.ts
//
// Safe for client code. A brand kit (logo, colours, fonts, design template) and ready-made looks
// for common niches, so every customer's images and carousels look like their own brand.

export type TemplateKey = "bold" | "minimal" | "editorial" | "split" | "spark"
export const TEMPLATES: { key: TemplateKey; name: string; blurb: string }[] = [
  { key: "bold", name: "Bold", blurb: "Big headline on your brand colour" },
  { key: "minimal", name: "Minimal", blurb: "Clean, light and calm" },
  { key: "editorial", name: "Editorial", blurb: "Magazine style with a classic font" },
  { key: "split", name: "Split", blurb: "Colour block on top, text below" },
  { key: "spark", name: "Spark", blurb: "Dark and modern with bright accents" },
]
export const isTemplate = (v: unknown): v is TemplateKey => typeof v === "string" && TEMPLATES.some((t) => t.key === v)

/** Fonts that draw well on images (Google Fonts, bold heading + regular body). */
export const FONTS = [
  "Poppins",
  "Montserrat",
  "Inter",
  "Plus Jakarta Sans",
  "Manrope",
  "Outfit",
  "Space Grotesk",
  "Raleway",
  "Playfair Display",
  "Lora",
  "Merriweather",
  "Libre Baskerville",
] as const
export type FontName = (typeof FONTS)[number]
export const isFont = (v: unknown): v is FontName => typeof v === "string" && (FONTS as readonly string[]).includes(v)

export type BrandKit = {
  name: string
  handle: string
  logo: string
  primary: string
  secondary: string
  accent: string
  headFont: FontName
  bodyFont: FontName
  template: TemplateKey | "rotate"
  niche: string
  website: string
}

type Preset = Pick<BrandKit, "primary" | "secondary" | "accent" | "headFont" | "bodyFont"> & { template: TemplateKey; label: string }

export const NICHES: Record<string, Preset> = {
  coach: { label: "Coach / consultant", template: "minimal", primary: "#1f3a5f", secondary: "#f2efe9", accent: "#e07a5f", headFont: "Playfair Display", bodyFont: "Inter" },
  agency: { label: "Marketing / agency / freelancer", template: "spark", primary: "#10203f", secondary: "#f6f4ee", accent: "#d4ad4b", headFont: "Manrope", bodyFont: "Inter" },
  tech: { label: "Tech / SaaS / IT", template: "minimal", primary: "#3d5afe", secondary: "#f5f7ff", accent: "#00b894", headFont: "Space Grotesk", bodyFont: "Inter" },
  ecommerce: { label: "E-commerce / D2C / Amazon seller", template: "spark", primary: "#1d1d1f", secondary: "#fafafa", accent: "#ff6b35", headFont: "Outfit", bodyFont: "Inter" },
  fashion: { label: "Fashion / jewellery / lifestyle", template: "editorial", primary: "#1a1a1a", secondary: "#f3ede6", accent: "#b08968", headFont: "Playfair Display", bodyFont: "Raleway" },
  beauty: { label: "Salon / beauty / skincare", template: "editorial", primary: "#4a2c3d", secondary: "#f8eeee", accent: "#d79c8c", headFont: "Playfair Display", bodyFont: "Raleway" },
  food: { label: "Restaurant / café / bakery", template: "editorial", primary: "#7a1f1f", secondary: "#fdf6ec", accent: "#e9a23b", headFont: "Lora", bodyFont: "Inter" },
  health: { label: "Doctor / clinic / wellness", template: "minimal", primary: "#0b6e99", secondary: "#eef7fb", accent: "#23b5a3", headFont: "Plus Jakarta Sans", bodyFont: "Inter" },
  fitness: { label: "Gym / fitness / sports", template: "bold", primary: "#141414", secondary: "#f5f5f5", accent: "#e63946", headFont: "Montserrat", bodyFont: "Inter" },
  education: { label: "Education / coaching institute", template: "split", primary: "#283593", secondary: "#fff8e1", accent: "#ffb300", headFont: "Poppins", bodyFont: "Inter" },
  realestate: { label: "Real estate / interiors", template: "split", primary: "#0f3d3e", secondary: "#f4f1ea", accent: "#c8a96a", headFont: "Montserrat", bodyFont: "Inter" },
  finance: { label: "CA / finance / legal", template: "minimal", primary: "#12355b", secondary: "#f2f5f9", accent: "#2a9d8f", headFont: "Libre Baskerville", bodyFont: "Inter" },
  travel: { label: "Travel / hospitality", template: "split", primary: "#006d77", secondary: "#fefae0", accent: "#f4a261", headFont: "Outfit", bodyFont: "Inter" },
  faith: { label: "Church / ministry / NGO", template: "editorial", primary: "#1b2a49", secondary: "#f7f3e8", accent: "#c9a227", headFont: "Lora", bodyFont: "Inter" },
  creator: { label: "Creator / personal brand", template: "bold", primary: "#5b21b6", secondary: "#f5f3ff", accent: "#f59e0b", headFont: "Poppins", bodyFont: "Inter" },
}

export const isHex = (v: unknown) => /^#[0-9a-f]{6}$/i.test(String(v || ""))

export function defaultKit(o: { name?: string; color?: string; niche?: string } = {}): BrandKit {
  const p = NICHES[o.niche || ""] || NICHES.agency
  return {
    name: o.name || "",
    handle: "",
    logo: "",
    primary: isHex(o.color) ? String(o.color) : p.primary,
    secondary: p.secondary,
    accent: p.accent,
    headFont: p.headFont,
    bodyFont: p.bodyFont,
    template: "rotate",
    niche: o.niche && NICHES[o.niche] ? o.niche : "",
    website: "",
  }
}

export function cleanKit(input: unknown, base: BrandKit): BrandKit {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>
  const str = (v: unknown, n: number, d: string) => (v === undefined ? d : String(v ?? "").trim().slice(0, n))
  const logo = str(o.logo, 600, base.logo)
  const website = str(o.website, 200, base.website)
  return {
    name: str(o.name, 60, base.name),
    handle: str(o.handle, 60, base.handle),
    logo: logo && !/^https:\/\/\S+$/i.test(logo) ? base.logo : logo,
    primary: isHex(o.primary) ? String(o.primary) : base.primary,
    secondary: isHex(o.secondary) ? String(o.secondary) : base.secondary,
    accent: isHex(o.accent) ? String(o.accent) : base.accent,
    headFont: isFont(o.headFont) ? o.headFont : base.headFont,
    bodyFont: isFont(o.bodyFont) ? o.bodyFont : base.bodyFont,
    template: o.template === "rotate" || isTemplate(o.template) ? (o.template as BrandKit["template"]) : base.template,
    niche: typeof o.niche === "string" && (o.niche === "" || NICHES[o.niche]) ? o.niche : base.niche,
    website: website && !/^https?:\/\/\S+$/i.test(website) ? base.website : website,
  }
}

/** The template a post uses: its own choice, else the kit's, else one of five by post number. */
export function templateFor(kit: BrandKit, own: unknown, id: number): TemplateKey {
  if (isTemplate(own)) return own
  if (isTemplate(kit.template)) return kit.template
  return TEMPLATES[Math.abs(id) % TEMPLATES.length].key
}
