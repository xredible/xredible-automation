"use client"

// Date range, comparison, filters and data loading for the dashboard.

import { useCallback, useEffect, useRef, useState } from "react"
import type { AnySection } from "@/lib/dashboard/types"
import { DEFAULT_BUSINESS, isBusiness, viewsOf, type BusinessKey, type ViewName } from "@/lib/dashboard/businesses"
import { addDays, todayIST } from "./format"

export type Preset = "7d" | "28d" | "90d" | "month" | "lastMonth" | "year" | "12m" | "custom"
export type Cmp = "prev" | "yoy" | "none"
export type View = ViewName
export type Filters = Record<string, string>

export const PRESETS: { id: Preset; label: string }[] = [
  { id: "7d", label: "Last 7 days" },
  { id: "28d", label: "Last 28 days" },
  { id: "90d", label: "Last 90 days" },
  { id: "month", label: "This month" },
  { id: "lastMonth", label: "Last month" },
  { id: "year", label: "This year" },
  { id: "12m", label: "Last 12 months" },
  { id: "custom", label: "Custom dates" },
]

export const COMPARE: { id: Cmp; label: string }[] = [
  { id: "prev", label: "Previous period" },
  { id: "yoy", label: "Same dates last year" },
  { id: "none", label: "No comparison" },
]

export function presetDates(p: Preset, custom?: { start: string; end: string }): { start: string; end: string } {
  const t = todayIST()
  switch (p) {
    case "7d":
      return { start: addDays(t, -6), end: t }
    case "90d":
      return { start: addDays(t, -89), end: t }
    case "month":
      return { start: t.slice(0, 8) + "01", end: t }
    case "lastMonth": {
      const first = t.slice(0, 8) + "01"
      const end = addDays(first, -1)
      return { start: end.slice(0, 8) + "01", end }
    }
    case "year":
      return { start: t.slice(0, 4) + "-01-01", end: t }
    case "12m":
      return { start: addDays(t, -364), end: t }
    case "custom":
      return custom && custom.start && custom.end ? custom : { start: addDays(t, -27), end: t }
    default:
      return { start: addDays(t, -27), end: t }
  }
}

export type DashState = { biz: BusinessKey; view: View; preset: Preset; start: string; end: string; cmp: Cmp; filters: Record<string, Filters> }

const FILTER_KEYS = ["device", "country", "channel", "searchType", "contentType", "appType", "pinFormat", "source"]

/** Reads ?biz=&view=&range=&from=&to=&cmp=&device=… so a link opens the same view. */
export function readUrl(allowed: BusinessKey[]): DashState {
  const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search)
  // "?p=meta" (back from connecting an account) opens that Autopilot tool's page.
  const tool = q.get("p")
  const asked = tool && allowed.includes("autopilot") ? "autopilot" : q.get("biz")
  const biz = isBusiness(asked) && allowed.includes(asked) ? asked : allowed.includes(DEFAULT_BUSINESS) ? DEFAULT_BUSINESS : allowed[0]
  const wanted = biz === "autopilot" && tool ? `ap-${tool}` : q.get("view")
  const view = (viewsOf(biz).includes(wanted as View) ? wanted : "overview") as View
  const preset = (PRESETS.some((p) => p.id === q.get("range")) ? q.get("range") : "28d") as Preset
  const custom = { start: q.get("from") || "", end: q.get("to") || "" }
  const { start, end } = presetDates(preset, custom)
  const cmp = (COMPARE.some((c) => c.id === q.get("cmp")) ? q.get("cmp") : "prev") as Cmp
  const f: Filters = {}
  for (const k of FILTER_KEYS) if (q.get(k)) f[k] = q.get(k) as string
  return { biz, view, preset, start, end, cmp, filters: Object.keys(f).length ? { [view]: f } : {} }
}

export function writeUrl(s: DashState) {
  const q = new URLSearchParams()
  if (s.biz !== DEFAULT_BUSINESS) q.set("biz", s.biz)
  if (s.view !== "overview") q.set("view", s.view)
  if (s.preset !== "28d") q.set("range", s.preset)
  if (s.preset === "custom") {
    q.set("from", s.start)
    q.set("to", s.end)
  }
  if (s.cmp !== "prev") q.set("cmp", s.cmp)
  for (const [k, v] of Object.entries(s.filters[s.view] || {})) if (v) q.set(k, v)
  const qs = q.toString()
  window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""))
}

// ---------- data loading ----------

type Entry = { data: AnySection; at: number }
const cache = new Map<string, Entry>()
const inflight = new Map<string, Promise<AnySection>>()

export function sectionKey(biz: BusinessKey, section: string, start: string, end: string, cmp: string, filters: Filters = {}) {
  const q = new URLSearchParams({ biz, section, start, end, cmp })
  for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v)
  return q.toString()
}

async function fetchSection(key: string, fresh: boolean): Promise<AnySection> {
  const url = `/dashboard/data?${key}${fresh ? "&fresh=1" : ""}`
  const res = await fetch(url, { cache: "no-store" })
  let body: AnySection
  try {
    body = (await res.json()) as AnySection
  } catch {
    body = { ok: false, error: `The dashboard server answered with HTTP ${res.status}.` }
  }
  if (res.status === 401) window.location.reload()
  return body
}

export function loadKey(key: string, fresh = false): Promise<AnySection> {
  if (!fresh) {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < 10 * 60_000) return Promise.resolve(hit.data)
    const running = inflight.get(key)
    if (running) return running
  }
  const p = fetchSection(key, fresh)
    .then((data) => {
      if (data.ok) cache.set(key, { data, at: Date.now() })
      return data
    })
    .catch(() => ({ ok: false, error: "No internet connection, or the dashboard server did not answer." }) as AnySection)
    .finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export function useSection(key: string | null) {
  // Data is stored together with the key it belongs to, so after switching views the
  // previous view's data is never handed to the new one (different sections have different shapes).
  const [got, setGot] = useState<{ key: string; data: AnySection } | null>(() => {
    const hit = key ? cache.get(key) : undefined
    return key && hit ? { key, data: hit.data } : null
  })
  const [loading, setLoading] = useState(false)
  const current = useRef(key)
  const run = useCallback(
    (fresh: boolean) => {
      if (!key) return
      current.current = key
      setLoading(true)
      loadKey(key, fresh).then((d) => {
        if (current.current !== key) return
        setGot({ key, data: d })
        setLoading(false)
      })
    },
    [key],
  )
  useEffect(() => {
    if (!key) return
    const hit = cache.get(key)
    if (hit) setGot({ key, data: hit.data })
    run(false)
  }, [key, run])
  // While a new view loads, show the same view's older data (other dates/filters) but never another
  // section's, and never another business's.
  const q = key ? new URLSearchParams(key) : null
  const sameView = got && q && new URLSearchParams(got.key).get("biz") === q.get("biz") && got.data.ok && "section" in got.data && got.data.section === q.get("section")
  const data = got && (got.key === key || sameView) ? got.data : null
  return { data, loading, refresh: () => run(true) }
}

/** Runs async jobs a few at a time (the Pi is small). */
export async function limited<T>(jobs: (() => Promise<T>)[], size = 3): Promise<T[]> {
  const out: T[] = new Array(jobs.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(size, jobs.length) }, async () => {
      while (i < jobs.length) {
        const n = i++
        out[n] = await jobs[n]()
      }
    }),
  )
  return out
}
