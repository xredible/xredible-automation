// lib/autopilot/brandkit.ts
//
// Server-only. Each brand's kit is kept as a notice (kind "brandkit") on its owner key.
// It can be filled in by hand, read from the customer's website, or suggested from their niche.

import { addNotice, noticesFor, removeNotice } from "./account"
import { askJson } from "./ai"
import { cleanKit, defaultKit, FONTS, isFont, isHex, NICHES, type BrandKit } from "./brand-presets"
import { safeText } from "./safe-fetch"

export async function savedKit(owner: string): Promise<BrandKit | null> {
  const n = (await noticesFor(owner)).filter((x) => x.kind === "brandkit").sort((a, b) => b.id - a.id)[0]
  if (!n) return null
  try {
    return cleanKit(JSON.parse(n.value), defaultKit())
  } catch {
    return null
  }
}

/** The kit, or a starting one from what the tools already know (name, colour). */
export async function kitFor(owner: string, fallback: { name?: string; color?: string } = {}): Promise<BrandKit & { saved: boolean }> {
  const saved = await savedKit(owner)
  if (saved) return { ...saved, name: saved.name || fallback.name || "", saved: true }
  return { ...defaultKit(fallback), saved: false }
}

export async function saveKit(owner: string, input: unknown): Promise<BrandKit> {
  const kit = cleanKit(input, await kitFor(owner))
  const old = (await noticesFor(owner)).filter((x) => x.kind === "brandkit")
  await addNotice(owner, "brandkit", "kit", JSON.stringify(kit))
  for (const o of old) await removeNotice(o.id)
  return kit
}

// ---------- reading a website ----------

const abs = (u: string, base: string) => {
  try {
    return new URL(u.replace(/&amp;/g, "&"), base).toString()
  } catch {
    return ""
  }
}

function hexes(css: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const raw of css.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi) || []) {
    let h = raw.toLowerCase()
    if (h.length === 4) h = "#" + h.slice(1).split("").map((c) => c + c).join("")
    m.set(h, (m.get(h) || 0) + 1)
  }
  for (const r of css.matchAll(/rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/gi)) {
    const h = "#" + [r[1], r[2], r[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, "0")).join("")
    m.set(h, (m.get(h) || 0) + 1)
  }
  return m
}

const hsl = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  const r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
  return { s, l }
}

/** Logo, colours, fonts and name from a website's home page and its first stylesheets. */
export async function readWebsite(url: string): Promise<Partial<BrandKit> & { found: string[] }> {
  if (/^http:\/\//i.test(url)) url = "https://" + url.slice(7)
  if (!/^https:\/\/\S+$/i.test(url)) throw new Error("Enter your website address, starting with https://")
  if (/^https:\/\/([a-z0-9-]+\.)*(linkedin\.com|instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com|youtube\.com|threads\.net|tiktok\.com|pinterest\.com|linktr\.ee)(\/|$)/i.test(url))
    throw new Error("That's a social media page, so it would pick up that site's logo and colours, not yours. Enter your own website, or use Suggest a look.")
  const get = (x: string, n: number) => safeText(x, n, { headers: { "User-Agent": "Mozilla/5.0 (compatible; XredibleBot/1.0; +https://www.xredible.in)" } })
  let html = ""
  try {
    html = await get(url, 600_000)
  } catch (e) {
    const m = e instanceof Error ? e.message : ""
    throw new Error(/can't be (read|used)/.test(m) ? m : "Couldn't open that website. Check the address and try again.")
  }
  const found: string[] = []
  const out: Partial<BrandKit> & { found: string[] } = { found, website: url }
  const meta = (name: string) => html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)`, "i"))?.[1] || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${name}["']`, "i"))?.[1] || ""
  const site = meta("og:site_name") || (html.match(/<title[^>]*>([^<]{2,80})/i)?.[1] || "").split(/[|\-–—]/)[0].trim()
  if (site) {
    out.name = site.slice(0, 60)
    found.push("name")
  }
  // Logo: an <img> that says "logo", else the large app icon.
  const imgs = [...html.matchAll(/<img[^>]+>/gi)].map((m) => m[0])
  const logoTag = imgs.find((t) => /logo/i.test(t))
  const logoSrc = logoTag?.match(/\s(?:src|data-src)=["']([^"']+)/i)?.[1]
  const icon = html.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon)[^>]+href=["']([^"']+)/i)?.[1] || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon/i)?.[1]
  const logo = abs(logoSrc || icon || "", url)
  if (/^https:\/\//.test(logo)) {
    out.logo = logo
    found.push("logo")
  }
  // Colours: theme colour, then the most used saturated colours in the CSS.
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n") + [...html.matchAll(/style=["']([^"']+)/gi)].map((m) => m[1]).join(";")
  const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)].map((m) => m[0].match(/href=["']([^"']+)/i)?.[1] || "").filter(Boolean).slice(0, 3)
  for (const s of sheets) {
    try {
      css += "\n" + (await get(abs(s, url), 400_000))
    } catch {}
  }
  const counts = hexes(css)
  const theme = meta("theme-color").toLowerCase()
  const ranked = [...counts.entries()].filter(([h]) => {
    const { s, l } = hsl(h)
    return s > 0.25 && l > 0.12 && l < 0.82
  }).sort((a, b) => b[1] - a[1]).map(([h]) => h)
  const colours = [...new Set([isHex(theme) && hsl(theme).s > 0.15 ? theme : "", ...ranked].filter(Boolean))]
  if (colours[0]) {
    out.primary = colours[0]
    found.push("colours")
  }
  if (colours[1]) out.accent = colours[1]
  // Fonts: Google Fonts links or font-family rules that match ones we can draw.
  const families = [...html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>]+)/gi)].flatMap((m) => [...m[1].matchAll(/family=([^:&]+)/g)].map((f) => decodeURIComponent(f[1].replace(/\+/g, " "))))
  const declared = [...css.matchAll(/font-family\s*:\s*["']?([^;"',}]+)/gi)].map((m) => m[1].trim())
  const fonts = [...families, ...declared].filter(isFont)
  if (fonts[0]) {
    out.headFont = fonts[0]
    out.bodyFont = fonts.find((f) => f !== fonts[0]) || "Inter"
    found.push("fonts")
  }
  return out
}

// ---------- suggesting a look ----------

/** Picks the closest niche (and so template, colours and fonts) from what the customer told us. */
export async function suggestNiche(about: string): Promise<string> {
  const keys = Object.keys(NICHES)
  const o = await askJson<{ niche?: string }>(
    `Which one of these niches best fits this business or person? Answer with the key only.\n\nNICHES:\n${keys.map((k) => `${k}: ${NICHES[k].label}`).join("\n")}\n\nABOUT THEM:\n${about.slice(0, 1500)}\n\nReturn JSON only: {"niche": "<key>"}`,
    1024,
  )
  return keys.includes(String(o.niche)) ? String(o.niche) : "agency"
}

export const FONT_LIST = FONTS
