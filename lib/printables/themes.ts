// lib/printables/themes.ts
//
// Server-only. How a printable looks for each workspace: fonts, colors, logo, the words in
// the page header and footer, and the PDF's file name. lib/printables/pdf.ts draws every
// printable the same way and takes its look from here.
//
// Hindi needs a font with Devanagari: Poppins has both scripts, so Hindi printables use it
// for headings and text.

import { rgb, type RGB } from "pdf-lib"

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255)

export type Lang = "en" | "hi"

/** acc: the main accent (badges, bullets, subtitles); sec: tables, chips, checkboxes; ter: tip boxes. */
export type Palette = {
  ink: RGB
  soft: RGB
  faint: RGB
  line: RGB
  paper: RGB
  cream: RGB
  acc: RGB
  accSoft: RGB
  sec: RGB
  secSoft: RGB
  ter: RGB
  terSoft: RGB
  white: RGB
}

/** Font files in lib/printables/assets: head (headings), headX (big titles), body, bold. */
export type FontFiles = { head: string; headX: string; body: string; bold: string }

export type Words = {
  tip: string
  page: (n: number, total: number) => string
  cut: string
  answers: string
  read: string
  from: (title: string, site: string) => string
}

export type Theme = {
  key: string
  /** The brand as people write it: "Nestoodle", "Elevating CHRIST". */
  name: string
  /** Shown next to the small logo at the top of pages 2 onwards. */
  wordmark: string
  site: string
  footer: Record<Lang, string>
  fonts: Record<Lang, FontFiles>
  logo: string
  colors: Palette
  /** Start of every file name: Nestoodle-Diwali-Crafts.pdf */
  prefix: string
  words: Record<Lang, Words>
  /** Added at the end: where the printable came from. */
  closing?: boolean
}

const EN: Words = {
  tip: "Tip:",
  page: (n, t) => `Page ${n} of ${t}`,
  cut: "Trace or print on card stock, then cut along the dashed line.",
  answers: "Answers",
  read: "Read",
  from: (title, site) => `From “${title}” on ${site}.`,
}
const HI: Words = {
  tip: "सुझाव:",
  page: (n, t) => `पृष्ठ ${n} / ${t}`,
  cut: "मोटे कागज़ पर छापें, फिर बिंदु वाली रेखा पर काटें।",
  answers: "उत्तर",
  read: "पढ़ें",
  from: (title, site) => `“${title}” से, ${site} पर।`,
}

const NESTOODLE: Theme = {
  key: "nestoodle",
  name: "Nestoodle",
  wordmark: "nestoodle",
  site: "nestoodle.com",
  footer: { en: "nestoodle.com · Free printable for personal and classroom use", hi: "nestoodle.com · निजी और कक्षा में उपयोग के लिए मुफ़्त" },
  fonts: {
    en: { head: "Baloo2-Bold.ttf", headX: "Baloo2-ExtraBold.ttf", body: "Karla-Regular.ttf", bold: "Karla-Bold.ttf" },
    hi: { head: "Poppins-SemiBold.ttf", headX: "Poppins-Bold.ttf", body: "Poppins-Regular.ttf", bold: "Poppins-SemiBold.ttf" },
  },
  logo: "logo.png",
  colors: {
    ink: hex("#332B22"),
    soft: hex("#6B5F4F"),
    faint: hex("#9C8F79"),
    line: hex("#E4D6BE"),
    paper: hex("#FFFCF6"),
    cream: hex("#FAF3E7"),
    acc: hex("#E0653C"),
    accSoft: hex("#FBE3D6"),
    sec: hex("#3E8FA6"),
    secSoft: hex("#DCEEEF"),
    ter: hex("#6F8E4E"),
    terSoft: hex("#E7EEDA"),
    white: rgb(1, 1, 1),
  },
  prefix: "Nestoodle",
  words: { en: { ...EN, from: (t, s) => `From “${t}” on ${s}. More free printables at nestoodle.com.` }, hi: HI },
  closing: true,
}

const ELEVATING_CHRIST: Theme = {
  key: "elevating-christ",
  name: "Elevating CHRIST",
  wordmark: "Elevating CHRIST",
  site: "elevatingchrist.com",
  footer: { en: "elevatingchrist.com · Free to print and share", hi: "elevatingchrist.com · छापें और बाँटें, मुफ़्त" },
  fonts: {
    en: { head: "PlayfairDisplay-Bold.ttf", headX: "PlayfairDisplay-ExtraBold.ttf", body: "Poppins-Regular.ttf", bold: "Poppins-SemiBold.ttf" },
    hi: { head: "Poppins-SemiBold.ttf", headX: "Poppins-Bold.ttf", body: "Poppins-Regular.ttf", bold: "Poppins-SemiBold.ttf" },
  },
  logo: "ec-logo.png",
  colors: {
    ink: hex("#1C1C1C"),
    soft: hex("#55504A"),
    faint: hex("#8C857A"),
    line: hex("#E6DCC4"),
    paper: hex("#FFFDF8"),
    cream: hex("#FAF6EE"),
    acc: hex("#A8861F"),
    accSoft: hex("#F5ECD2"),
    sec: hex("#2E2B26"),
    secSoft: hex("#EFEAE0"),
    ter: hex("#8A6D1F"),
    terSoft: hex("#FAF6EE"),
    white: rgb(1, 1, 1),
  },
  prefix: "Elevating-CHRIST",
  words: { en: EN, hi: HI },
  closing: true,
}

export const THEMES: Record<string, Theme> = { nestoodle: NESTOODLE, "elevating-christ": ELEVATING_CHRIST }

/** A customer's own look (Xredible Autopilot): their name, site and two brand colors on the clean Poppins design. */
export function brandTheme(o: { key: string; name: string; site: string; primary?: string; accent?: string }): Theme {
  const ok = (c?: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : null)
  const acc = ok(o.primary) || "#2F5DAA"
  const sec = ok(o.accent) || "#1F2937"
  const mix = (c: string, w: number) => {
    const n = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    return "#" + n.map((v) => Math.round(v + (255 - v) * w).toString(16).padStart(2, "0")).join("")
  }
  const site = o.site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")
  return {
    ...ELEVATING_CHRIST,
    key: o.key,
    name: o.name,
    wordmark: o.name,
    site,
    footer: { en: `${site} · Free to print and share`, hi: `${site} · छापें और बाँटें, मुफ़्त` },
    fonts: { en: ELEVATING_CHRIST.fonts.hi, hi: ELEVATING_CHRIST.fonts.hi },
    logo: "",
    colors: { ...ELEVATING_CHRIST.colors, ink: hex("#1F2328"), acc: hex(acc), accSoft: hex(mix(acc, 0.85)), sec: hex(sec), secSoft: hex(mix(sec, 0.88)), ter: hex(acc), terSoft: hex(mix(acc, 0.92)), line: hex("#E2E5EA"), paper: hex("#FCFCFD"), cream: hex("#F6F7F9") },
    prefix: o.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "Download",
  }
}
