// lib/dashboard/server.ts
//
// Server-only data helpers for xredible.in/dashboard: report sections, content-queue
// actions and Blog page actions, all sent through the n8n gateway (lib/dashboard/gateway.ts).
// Who may see what is decided in lib/dashboard/auth.ts.

import { BUSINESSES, type BusinessKey } from "./businesses"
import { gateway, type GatewayResult } from "./gateway"
import { isWebSection, loadWebSection } from "./website"

export { access, canSee, currentUser, isConfigured } from "./auth"

const PARAMS = ["id", "start", "end", "cmp", "device", "country", "channel", "searchType", "contentType", "appType", "pinFormat", "source"]

export function sectionAllowed(business: BusinessKey, section: string): boolean {
  return BUSINESSES[business].sections.includes(section)
}

export type LoadResult = GatewayResult

// Each business + section + dates + filters combination is kept for 10 minutes and
// shared by every signed-in account of that business. "fresh" skips and replaces it.
const cache = new Map<string, { at: number; body: unknown }>()
const TTL = 600_000

export async function loadSection(business: BusinessKey, section: string, search: URLSearchParams, fresh: boolean): Promise<LoadResult> {
  // The Blog page edits live posts, and drafts arrive in the background: never serve it stale.
  if (section === "blog" || section === "blogpost") fresh = true
  const query: Record<string, string> = { section }
  for (const k of PARAMS) {
    const v = (search.get(k) || "").replace(/[^A-Za-z0-9_ .\-]/g, "").slice(0, 40)
    if (v) query[k] = v
  }
  const path = section === "email" ? "-email" : ""
  const cacheKey = business + "|" + JSON.stringify(query)
  const hit = cache.get(cacheKey)
  if (!fresh && hit && Date.now() - hit.at < TTL) return { status: 200, body: hit.body }
  const r = isWebSection(business, section) ? await loadWebSection(business, query) : await gateway({ kind: "proxy", biz: business, path, method: "GET", query })
  if (r.status === 200 && (r.body as { ok?: boolean } | null)?.ok) {
    cache.set(cacheKey, { at: Date.now(), body: r.body })
    if (cache.size > 400) cache.delete(cache.keys().next().value as string)
  }
  return r
}

/** After a change, drop everything cached for that business. */
function forget(business: BusinessKey) {
  for (const k of cache.keys()) if (k.startsWith(business + "|")) cache.delete(k)
}

// ---------- queue actions (pause / resume / draft / retry / reschedule) ----------

export type QueueAction =
  | { action: "status"; to: "ready" | "paused" | "draft"; rows: { row: number; expect: string }[] }
  | { action: "reschedule"; when: string; rows: { row: number; expect: string }[] }
  | { action: "pause_all" }
  | { action: "resume_all" }

/** Checks the browser's request strictly; returns null when it is not a valid action. */
export function parseAction(input: unknown): QueueAction | null {
  if (!input || typeof input !== "object") return null
  const b = input as Record<string, unknown>
  const rows = () => {
    if (!Array.isArray(b.rows) || b.rows.length < 1 || b.rows.length > 50) return null
    const out: { row: number; expect: string }[] = []
    for (const r of b.rows) {
      const row = Number((r as { row?: unknown })?.row)
      const expect = String((r as { expect?: unknown })?.expect ?? "").slice(0, 20)
      if (!Number.isInteger(row) || row < 2 || row > 1e9) return null
      out.push({ row, expect })
    }
    return out
  }
  if (b.action === "status" && ["ready", "paused", "draft"].includes(String(b.to))) {
    const r = rows()
    return r ? { action: "status", to: b.to as "ready" | "paused" | "draft", rows: r } : null
  }
  if (b.action === "reschedule" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(b.when))) {
    const r = rows()
    return r ? { action: "reschedule", when: String(b.when), rows: r } : null
  }
  if (b.action === "pause_all" || b.action === "resume_all") return { action: b.action }
  return null
}

export async function runAction(business: BusinessKey, body: QueueAction): Promise<LoadResult> {
  const r = await gateway({ kind: "proxy", biz: business, path: "-act", method: "POST", body })
  forget(business)
  return r
}

// ---------- Blog page (edit, schedule, publish, topics, share) ----------

export type BlogAction = {
  action: "save" | "schedule" | "publish" | "draft" | "skip_topic" | "restore_topic" | "write_now" | "new_photos" | "share"
  id?: number
  row?: number
  title?: string
  slug?: string
  excerpt?: string
  content?: string
  date?: string
}

const BLOG_ACTIONS = ["save", "schedule", "publish", "draft", "skip_topic", "restore_topic", "write_now", "new_photos", "share"]

/** Checks a Blog page request strictly; returns null when it is not valid. */
export function parseBlogAction(input: unknown): BlogAction | null {
  if (!input || typeof input !== "object") return null
  const b = input as Record<string, unknown>
  const action = String(b.action || "")
  if (!BLOG_ACTIONS.includes(action)) return null
  const out: BlogAction = { action: action as BlogAction["action"] }
  const int = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 1e9 ? Number(v) : null)
  if (["save", "schedule", "publish", "draft", "share"].includes(action)) {
    const id = int(b.id)
    if (!id) return null
    out.id = id
  } else {
    const row = int(b.row)
    if (!row || row < 2) return null
    out.row = row
  }
  if (typeof b.title === "string") out.title = b.title.slice(0, 300)
  if (typeof b.slug === "string") out.slug = b.slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 200)
  if (typeof b.excerpt === "string") out.excerpt = b.excerpt.slice(0, 600)
  if (typeof b.content === "string") {
    if (b.content.length > 400_000) return null
    out.content = b.content
  }
  if (typeof b.date === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.date)) out.date = b.date
  return out
}

export async function runBlogAction(business: BusinessKey, body: BlogAction): Promise<LoadResult> {
  const r = await gateway({ kind: "proxy", biz: business, path: "-blog", method: "POST", body })
  forget(business)
  return r
}
