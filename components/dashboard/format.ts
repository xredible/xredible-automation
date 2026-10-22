// Number, date and label helpers for the dashboard (India time, Indian number grouping).

import type { Format, Point } from "@/lib/dashboard/types"

export const TZ = "Asia/Kolkata"
const nf = new Intl.NumberFormat("en-IN")
const nf1 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 })
const cf = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 })

export function fmt(v: unknown, format: Format = "number", compact = false): string {
  if (v === null || v === undefined || v === "" || (typeof v === "number" && !Number.isFinite(v))) return "—"
  const n = Number(v)
  if (format === "date") return typeof v === "string" ? shortDate(v) : "—"
  if (Number.isNaN(n)) return String(v)
  if (format === "percent") return `${(n * 100).toFixed(n !== 0 && Math.abs(n) < 0.1 ? 1 : 0)}%`
  if (format === "duration") return duration(n)
  if (format === "decimal") return nf1.format(n)
  if (compact && Math.abs(n) >= 100000) return cf.format(n)
  return nf.format(Math.round(n))
}

export function duration(sec: number): string {
  if (!Number.isFinite(sec)) return "—"
  const s = Math.round(sec)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m < 60) return `${m}m ${r.toString().padStart(2, "0")}s`
  return `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, "0")}m`
}

export type Change = { text: string; tone: "up" | "down" | "flat" | "new" } | null

export function change(cur: number | null | undefined, prev: number | null | undefined, invert = false): Change {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null
  if (prev === 0) return cur > 0 ? { text: "New", tone: invert ? "down" : "new" } : null
  const p = (cur - prev) / Math.abs(prev)
  if (Math.abs(p) < 0.005) return { text: "0%", tone: "flat" }
  const pct = Math.abs(p * 100)
  const text = `${p > 0 ? "+" : "−"}${pct >= 100 ? Math.round(pct).toLocaleString("en-IN") : pct.toFixed(pct < 10 ? 1 : 0)}%`
  const good = invert ? p < 0 : p > 0
  return { text, tone: good ? "up" : "down" }
}

// ---------- dates (YYYY-MM-DD strings are India dates) ----------

export const todayIST = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date())
export const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10)
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5)
const asDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00+05:30` : d)

export const shortDate = (d: string) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short" }).format(asDate(d))
export const longDate = (d: string) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(asDate(d))
export const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso))
export const timeOf = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso))
export const dateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso))
export const weekdayDate = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, weekday: "short", day: "numeric", month: "short" }).format(new Date(iso))

export function rangeLabel(start: string, end: string): string {
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const f = (d: string, y: boolean) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", ...(y ? { year: "numeric" } : {}) }).format(asDate(d))
  return start === end ? f(start, true) : `${f(start, !sameYear)} – ${f(end, true)}`
}

/** Puts a series on every day of the range (missing days become 0, or null for averages). */
export function fillDays(series: Point[] | null | undefined, start: string, end: string, gap: number | null = 0): Point[] {
  if (!series || !series.length) return []
  const by = new Map(series.map((p) => [p.d.slice(0, 10), p.v]))
  const out: Point[] = []
  const n = Math.min(daysBetween(start, end), 800)
  for (let i = 0; i <= n; i++) {
    const d = addDays(start, i)
    out.push({ d, v: by.has(d) ? (by.get(d) as number | null) : gap })
  }
  // Drop trailing days the platform hasn't reported yet (YouTube and Search Console lag a few days).
  const lastReported = series.map((p) => p.d.slice(0, 10)).sort().pop() as string
  return out.filter((p) => p.d <= lastReported)
}

// ---------- labels the APIs return in raw form ----------

const RAW: Record<string, string> = {
  shorts: "Shorts", videoOnDemand: "Videos", liveStream: "Live streams", creatorContentTypeUnspecified: "Other", story: "Stories",
  ANDROID: "Android", IOS: "iOS", WINDOWS: "Windows", MACINTOSH: "Mac", LINUX: "Linux", CHROME_OS: "ChromeOS", KAIOS: "KaiOS",
  SMART_TV: "Smart TV", WEBOS: "webOS", AMAZON_FIREOS: "Fire OS", TIZEN: "Tizen", PLAYSTATION: "PlayStation", XBOX: "Xbox", ROKU: "Roku", OTHER: "Other",
  mobile: "Phone", tablet: "Tablet", web: "Computer", product: "Product pins", standard: "Image pins", video: "Video pins",
}
export const prettyLabel = (v: unknown) => (typeof v === "string" && RAW[v]) || (v === null || v === undefined ? "" : String(v))

// ---------- countries ----------

const ISO3: Record<string, string> = {
  ind: "IN", usa: "US", gbr: "GB", can: "CA", aus: "AU", nzl: "NZ", sgp: "SG", are: "AE", sau: "SA", qat: "QA", kwt: "KW", omn: "OM", bhr: "BH",
  npl: "NP", pak: "PK", bgd: "BD", lka: "LK", mys: "MY", idn: "ID", phl: "PH", tha: "TH", vnm: "VN", chn: "CN", jpn: "JP", kor: "KR",
  deu: "DE", fra: "FR", ita: "IT", esp: "ES", nld: "NL", irl: "IE", swe: "SE", nor: "NO", dnk: "DK", fin: "FI", che: "CH", aut: "AT", bel: "BE", pol: "PL", prt: "PT",
  rus: "RU", ukr: "UA", tur: "TR", isr: "IL", egy: "EG", nga: "NG", ken: "KE", zaf: "ZA", gha: "GH", eth: "ET", uga: "UG", tza: "TZ",
  bra: "BR", mex: "MX", arg: "AR", col: "CO", chl: "CL", per: "PE",
}
let regionNames: Intl.DisplayNames | null = null
function regions() {
  if (!regionNames) {
    try {
      regionNames = new Intl.DisplayNames(["en"], { type: "region" })
    } catch {
      regionNames = null
    }
  }
  return regionNames
}
export function countryName(code: string, iso3 = false): string {
  const c = iso3 ? ISO3[code.toLowerCase()] : code.toUpperCase()
  if (!c || !/^[A-Z]{2}$/.test(c)) return code.toUpperCase()
  try {
    return regions()?.of(c) || c
  } catch {
    return c
  }
}
export function flag(code: string, iso3 = false): string {
  const c = iso3 ? ISO3[code.toLowerCase()] : code.toUpperCase()
  if (!c || !/^[A-Z]{2}$/.test(c)) return "🌐"
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

// ---------- CSV export ----------

export function toCsv(columns: { key: string; label: string }[], rows: Record<string, unknown>[]): string {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map((c) => esc(c.label || c.key)).join(","), ...rows.map((r) => columns.map((c) => esc(r[c.key])).join(","))].join("\n")
}

export function download(name: string, text: string) {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
