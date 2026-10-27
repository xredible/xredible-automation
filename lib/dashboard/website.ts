// lib/dashboard/website.ts
//
// Server-only. The website pages of each business dashboard (Website = ga4, Visits = sessions,
// Google Search = gsc, Ad earnings = adsense) are worked out here, on the website:
//
//   1. lib/insights plans the Google calls for the dates and filters asked for,
//   2. n8n sends them with that business's own Google login (workflow "XD-GF Xredible - Google
//      Fetch", reached through the gateway with path -gfetch; it only lets these report URLs through),
//   3. lib/insights turns the answers into the page, with "What stands out".
//
// So every business gets the same reports, and a new business only needs its line in WEB below
// (plus its webhook in XD-GF).

import type { BusinessKey } from "./businesses"
import { gateway, type GatewayResult } from "./gateway"
import { webPlan, webRanges, webReport, WEB_SECTIONS } from "@/lib/insights/website"
import { adsReport, adsRequests } from "@/lib/insights/adsense"

type WebCfg = { ga4Property: string; gscSite: string; site: string; siteName: string; brand: string[]; adsense?: boolean; setup?: string }

const WEB: Partial<Record<BusinessKey, WebCfg>> = {
  "elevating-christ": { ga4Property: "547336597", gscSite: "https://www.elevatingchrist.com/", site: "https://www.elevatingchrist.com", siteName: "elevatingchrist.com", brand: ["elevating christ", "elevatingchrist"] },
  nestoodle: {
    ga4Property: "559315079",
    gscSite: "https://nestoodle.com/",
    site: "https://nestoodle.com",
    siteName: "nestoodle.com",
    brand: ["nestoodle"],
    adsense: true,
    setup: 'AdSense isn\'t connected yet. Once Google approves nestoodle.com, give the n8n login "[NST] Google" access to AdSense and the earnings show up here.',
  },
}

type Call = { method: "GET" | "POST"; url: string; body?: unknown }
type Answer = { statusCode: number; body: unknown }

/** Whether this page is worked out here rather than by the business's n8n Dashboard API. */
export function isWebSection(business: BusinessKey, section: string): boolean {
  const cfg = WEB[business]
  return !!cfg && ((WEB_SECTIONS as string[]).includes(section) || (section === "adsense" && !!cfg.adsense))
}

async function send(business: BusinessKey, calls: Call[]): Promise<{ ok: true; answers: Answer[] } | { ok: false; result: GatewayResult }> {
  const r = await gateway({ kind: "proxy", biz: business, path: "-gfetch", method: "POST", body: { calls } }, 55_000)
  const b = (r.body || {}) as { ok?: boolean; answers?: Answer[]; error?: string; message?: string }
  if (r.status === 200 && Array.isArray(b.answers)) return { ok: true, answers: b.answers }
  const error = b.error || b.message || (r.status === 404 ? "The n8n Google fetch (XD-GF) is not published." : `n8n answered with HTTP ${r.status}.`)
  return { ok: false, result: { status: r.status === 200 ? 502 : r.status, body: { ok: false, error } } }
}

export async function loadWebSection(business: BusinessKey, query: Record<string, string>): Promise<GatewayResult> {
  const cfg = WEB[business]
  if (!cfg) return { status: 400, body: { ok: false, error: "Unknown section." } }
  const now = new Date()
  if (query.section === "adsense") {
    const r = webRanges(query, now)
    const P = { ...r, f: /^[A-Za-z]{2}$/.test(query.country || "") ? { country: query.country.toUpperCase() } : {} }
    const first = await send(business, [{ method: "GET", url: "https://adsense.googleapis.com/v2/accounts" }])
    if (!first.ok) return first.result
    const reqs = adsRequests(P, first.answers[0])
    if (!reqs.length || reqs[0].key === "none") return { status: 200, body: adsReport(P, reqs, [], cfg) }
    const got = await send(business, reqs.map((x) => ({ method: "GET" as const, url: x.url })))
    if (!got.ok) return got.result
    return { status: 200, body: adsReport(P, reqs, got.answers, cfg) }
  }
  const plans = webPlan(query, now, cfg)
  if (!plans.length) return { status: 400, body: { ok: false, error: "Unknown section." } }
  const got = await send(business, plans.map((p) => ({ method: p.method as "POST", url: p.url, body: p.body })))
  if (!got.ok) return got.result
  const out = webReport(query, now, plans, got.answers, cfg)
  return { status: out.ok ? 200 : 502, body: out }
}
