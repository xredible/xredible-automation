// lib/dashboard/ads.ts
//
// Server-only. The Ads page of each business dashboard: Meta (Facebook + Instagram), Pinterest
// Ads, Google Ads and LinkedIn Ads in one place. Worked out here, like the website pages:
//
//   1. lib/insights/ads.js plans the report calls for the dates asked for,
//   2. n8n sends them with that business's own ad logins (workflow "XD-AF Xredible - Ads Fetch",
//      reached through the gateway with paths -meta, -pin and -gads; it only lets ad report URLs through),
//   3. lib/insights/ads.js turns the answers into the page, with "What stands out".
//
// A platform that isn't connected yet is listed under "Ad accounts" with what to do.
//
// Google Ads needs the 10-digit customer ID of each account (not a secret), in Vercel:
//   GOOGLE_ADS_ID_EC, GOOGLE_ADS_ID_NST, GOOGLE_ADS_ID_LI   e.g. 123-456-7890
//   GOOGLE_ADS_MANAGER_ID                                     optional: the manager (MCC) account above them

import type { BusinessKey } from "./businesses"
import { gateway, type GatewayResult } from "./gateway"
import { adsRanges, adsSection, googlePart, googlePreset, metaAccounts, metaPart, metaPlan, metaUse, pinAccounts, pinCampaignPlan, pinPart, pinPlan, pinUse } from "@/lib/insights/ads"

type Platform = "meta" | "pinterest" | "google" | "linkedin"
/** metaHow: what to do so the Meta login can read ad reports. */
type AdsCfg = { platforms: Platform[]; metaHow?: string; pinterest?: string; googleEnv?: string }

const ADS: Partial<Record<BusinessKey, AdsCfg>> = {
  "elevating-christ": {
    platforms: ["meta", "google", "pinterest"],
    metaHow:
      'In Meta Business settings → Users → System users → n8n Publisher, generate a new token for the app with ads_read ticked, and paste it into the n8n login "[EC] Meta Ads" (Authorization: Bearer …). Leave "Meta Graph Token" as it is: the posting workflows use it.',
    pinterest: "Pinterest - Elevating CHRIST",
    googleEnv: "GOOGLE_ADS_ID_EC",
  },
  nestoodle: {
    platforms: ["meta", "google", "pinterest"],
    metaHow:
      'The n8n login "[NST] Meta" holds a Page token, which can post but can\'t read ads (keep it as it is). Make a system-user token with ads_read (Meta Business settings → Users → System users → Generate token), save it in n8n as a new Header Auth login "[NST] Meta Ads" (Authorization: Bearer …), and pick it in the "NST Meta" step of the workflow "XD-AF Xredible - Ads Fetch".',
    pinterest: "[NST] Pinterest",
    googleEnv: "GOOGLE_ADS_ID_NST",
  },
  "linkedin-agency": { platforms: ["linkedin", "google"], googleEnv: "GOOGLE_ADS_ID_LI" },
}

export const hasAds = (business: BusinessKey) => !!ADS[business]

type Call = { method: "GET"; url: string }
type Answer = { statusCode: number; body: unknown }
type Status = { platform: Platform; state: "live" | "none" | "setup" | "error"; note: string; accounts?: string }
// The platform parts lib/insights/ads.js builds and reads back.
type Part = { cur?: { spend?: number; impressions?: number } | null; accounts?: string[]; errors?: string[] }

async function send(business: BusinessKey, path: "-meta" | "-pin", calls: Call[]): Promise<{ ok: true; answers: Answer[] } | { ok: false; error: string }> {
  const r = await gateway({ kind: "proxy", biz: business, path, method: "POST", body: { calls } }, 50_000)
  const b = (r.body || {}) as { answers?: Answer[]; error?: string; message?: string }
  if (r.status === 200 && Array.isArray(b.answers)) return { ok: true, answers: b.answers }
  return { ok: false, error: b.error || b.message || (r.status === 404 ? "The n8n ads fetch (XD-AF) is not published." : `n8n answered with HTTP ${r.status}.`) }
}

const err = (e: unknown) => (e instanceof Error ? e.message : String(e || "failed"))
const spent = (p: Part) => !!(p.cur && (p.cur.spend || p.cur.impressions))
const names = (p: Part) => (p.accounts || []).join(", ")

// ---------- Meta ----------

async function meta(business: BusinessKey, cfg: AdsCfg, query: Record<string, string>, now: Date): Promise<{ part: Part | null; status: Status }> {
  const setup = (why: string) => ({ part: null, status: { platform: "meta" as const, state: "setup" as const, note: `${why} ${cfg.metaHow || "Give the Meta login the ads_read permission."}` } })
  const first = await send(business, "-meta", [{ method: "GET", url: metaAccounts().url }])
  if (!first.ok) return { part: null, status: { platform: "meta", state: "error", note: first.error } }
  const use = metaUse(first.answers[0])
  if (!use.ok) {
    const e = String(use.error || "")
    if (/permission|ads_read|ads_management|#200|#10\b|nonexisting field|\(#100\)/i.test(e)) return setup("The token can't read ad accounts yet.")
    if (/access token|session|expired|OAuth/i.test(e)) return setup("The Meta token has expired or isn't valid.")
    return { part: null, status: { platform: "meta", state: "error", note: e } }
  }
  if (!use.list.length) return setup("This login has no ad accounts.")
  const plans = metaPlan(use.list, query, now)
  const got = await send(business, "-meta", plans.map((p) => ({ method: "GET" as const, url: p.url })))
  if (!got.ok) return { part: null, status: { platform: "meta", state: "error", note: got.error, accounts: use.list.map((a: { name: string }) => a.name).join(", ") } }
  const part = metaPart(use, plans, got.answers, adsRanges(query, now)) as Part
  return { part, status: { platform: "meta", state: spent(part) ? "live" : part.errors?.length ? "error" : "none", note: part.errors?.[0] || "", accounts: names(part) } }
}

// ---------- Pinterest ----------

async function pinterest(business: BusinessKey, cfg: AdsCfg, query: Record<string, string>, now: Date): Promise<{ part: Part | null; status: Status }> {
  const login = cfg.pinterest || "the Pinterest login"
  const setup = (why: string) => ({
    part: null,
    status: { platform: "pinterest" as const, state: "setup" as const, note: `${why} In n8n, open the login "${login}", add ads:read to its scope and sign in again.` },
  })
  const first = await send(business, "-pin", [{ method: "GET", url: pinAccounts().url }])
  if (!first.ok) return { part: null, status: { platform: "pinterest", state: "error", note: first.error } }
  const use = pinUse(first.answers[0])
  if (!use.ok) {
    const e = String(use.error || "")
    if (/scope|permission|authoriz|401|403|forbidden/i.test(e)) return setup("This login can't read ad accounts yet.")
    return { part: null, status: { platform: "pinterest", state: "error", note: e } }
  }
  if (!use.list.length) return { part: null, status: { platform: "pinterest", state: "none", note: "No Pinterest ad account on this login. Create one at ads.pinterest.com if you want to run ads." } }
  const plans = pinPlan(use.list, query, now)
  const got = await send(business, "-pin", plans.map((p) => ({ method: "GET" as const, url: p.url })))
  if (!got.ok) return { part: null, status: { platform: "pinterest", state: "error", note: got.error } }
  const lists = plans.map((p, i) => (p.tag === "campaigns" ? got.answers[i] : null)).filter(Boolean) as Answer[]
  const cplans = pinCampaignPlan(use.list, lists, query, now)
  let cans: Answer[] = []
  if (cplans.length) {
    const c = await send(business, "-pin", cplans.map((p) => ({ method: "GET" as const, url: p.url })))
    if (c.ok) cans = c.answers
  }
  const part = pinPart(use, [...plans, ...cplans.slice(0, cans.length)], [...got.answers, ...cans], lists, adsRanges(query, now)) as Part
  return { part, status: { platform: "pinterest", state: spent(part) ? "live" : part.errors?.length ? "error" : "none", note: part.errors?.[0] || "", accounts: names(part) } }
}

// ---------- Google Ads ----------

async function google(business: BusinessKey, cfg: AdsCfg, query: Record<string, string>, now: Date): Promise<{ part: Part | null; status: Status }> {
  const id = String(process.env[cfg.googleEnv || ""] || "").replace(/\D/g, "")
  const signIn = 'Sign in the n8n login "Google Ads account" with the Google account that has the ads (it also needs a developer token: Google Ads → Tools → API Center).'
  if (!/^\d{10}$/.test(id)) {
    return { part: null, status: { platform: "google", state: "setup", note: `Add the 10-digit Google Ads customer ID (top right in Google Ads) in Vercel as ${cfg.googleEnv}. ${signIn}` } }
  }
  const r = adsRanges(query, now)
  const mgr = String(process.env.GOOGLE_ADS_MANAGER_ID || "").replace(/\D/g, "")
  const res = await gateway({ kind: "proxy", biz: business, path: "-gads", method: "POST", body: { customerId: id, managerId: mgr || id, preset: googlePreset(r).preset } }, 50_000)
  const b = (res.body || {}) as { ok?: boolean; rows?: unknown[]; error?: string; message?: string }
  if (res.status !== 200 || !b.ok || !Array.isArray(b.rows)) {
    const e = b.error || b.message || (res.status === 404 ? "The n8n ads fetch (XD-AF) is not published." : `n8n answered with HTTP ${res.status}.`)
    if (/access token|sign|unauthenticated|developer.token|credential/i.test(e)) return { part: null, status: { platform: "google", state: "setup", note: signIn } }
    return { part: null, status: { platform: "google", state: "error", note: e } }
  }
  const part = googlePart(b.rows, r) as Part
  return { part, status: { platform: "google", state: spent(part) ? "live" : "none", note: "", accounts: id.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3") } }
}

// ---------- LinkedIn Ads ----------

const LINKEDIN: Status = {
  platform: "linkedin",
  state: "setup",
  note: "LinkedIn only shares ad reports with apps approved for its Advertising API. Apply in the LinkedIn developer portal (your app → Products → Advertising API); once approved, the ad account can be connected here.",
}

// ---------- the page ----------

export async function loadAdsSection(business: BusinessKey, query: Record<string, string>): Promise<GatewayResult> {
  const cfg = ADS[business]
  if (!cfg) return { status: 400, body: { ok: false, error: "Unknown section." } }
  const now = new Date()
  const jobs = cfg.platforms.map(async (p): Promise<{ part: Part | null; status: Status }> => {
    try {
      if (p === "meta") return await meta(business, cfg, query, now)
      if (p === "pinterest") return await pinterest(business, cfg, query, now)
      if (p === "google") return await google(business, cfg, query, now)
      return { part: null, status: LINKEDIN }
    } catch (e) {
      return { part: null, status: { platform: p, state: "error", note: err(e) } }
    }
  })
  const done = await Promise.all(jobs)
  const body = adsSection(query, now, done.map((d) => d.part).filter(Boolean), done.map((d) => d.status))
  return { status: 200, body }
}

/** The Ads page for an Xredible Autopilot customer: what it will show and what it needs. */
export function autopilotAds(query: Record<string, string>): unknown {
  const now = new Date()
  return adsSection(query, now, [], [
    { platform: "meta", state: "setup", note: "Not available for your own ad account yet: Meta has to approve Xredible's access to ad reports (ads_read) first. Your connected Page keeps posting as before." },
    { platform: "google", state: "setup", note: "Not available for your own account yet. Ask us if you'd like your Google Ads numbers here." },
    { platform: "pinterest", state: "setup", note: "Not available for your own account yet. Ask us if you'd like your Pinterest Ads numbers here." },
    { platform: "linkedin", state: "setup", note: "Not available yet: LinkedIn has to approve Xredible for its Advertising API first." },
  ])
}
