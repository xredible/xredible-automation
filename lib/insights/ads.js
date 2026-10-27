// lib/insights/ads.js
//
// The Ads page for every dashboard: Meta (Facebook + Instagram), Google Ads, Pinterest Ads and
// LinkedIn Ads in one place, with "What stands out" notes worked out from the numbers.
// Plain JavaScript with no imports. Something else sends the calls (n8n with the business's own
// logins, or the website with a customer's token; see lib/dashboard/ads.ts) and hands the
// answers back here.
//
//   metaAccounts()                         the call that lists the ad accounts
//   metaPlan(accounts, query, now)         the insight calls for the active accounts
//   metaPart(accounts, plans, answers, r)  → a platform part
//   pinAccounts() / pinPlan / pinPart      the same for Pinterest
//   googlePart(rows, r, note)              Google Ads campaigns (n8n's Google Ads node) → a part
//   adsSection(query, now, parts, status)  → the dashboard section (lib/dashboard/types.ts)

const META = "https://graph.facebook.com/v24.0"
const PIN = "https://api.pinterest.com/v5"

const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v))
const sum = (a) => a.reduce((s, x) => s + (Number(x) || 0), 0)
const nf = (v) => {
  const n = Math.round(Number(v) || 0)
  try {
    return n.toLocaleString("en-IN")
  } catch {
    return String(n)
  }
}
const pc = (v) => `${((Number(v) || 0) * 100).toFixed(Math.abs(Number(v) || 0) < 0.1 ? 1 : 0)}%`
const add = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10)

export function adsRanges(query, now) {
  const q = query || {}
  const today = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10)
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""))
  let end = isDate(q.end) && q.end <= today ? q.end : today
  let start = isDate(q.start) && q.start <= end ? q.start : add(end, -27)
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 864e5) + 1
  if (days > 730) start = add(end, -729)
  const cmp = ["prev", "yoy", "none"].includes(q.cmp) ? q.cmp : "prev"
  let cstart = null
  let cend = null
  if (cmp === "prev") {
    cend = add(start, -1)
    cstart = add(cend, -(Math.min(days, 730) - 1))
  } else if (cmp === "yoy") {
    cstart = `${+start.slice(0, 4) - 1}${start.slice(4)}`.replace("-02-29", "-02-28")
    cend = `${+end.slice(0, 4) - 1}${end.slice(4)}`.replace("-02-29", "-02-28")
  }
  return { start, end, cstart, cend, days: Math.min(days, 730), cmp }
}

function answer(a) {
  if (!a) return { ok: false, error: "No answer" }
  const status = "statusCode" in a ? Number(a.statusCode) : 200
  const body = "statusCode" in a ? a.body : a
  const e = body && body.error
  if (e || status < 200 || status >= 300 || !body) {
    const m = !e ? (body && body.message) || `HTTP ${status}` : typeof e === "string" ? e : e.error_user_msg || e.message || JSON.stringify(e)
    return { ok: false, status, error: String(m).slice(0, 300) }
  }
  return { ok: true, status, body }
}

// ---------- results: what counts as the ad's outcome ----------

// The first of these that the account actually got is used as "Results" (like Ads Manager does per objective).
const RESULT_TYPES = [
  ["offsite_conversion.fb_pixel_purchase", "Purchases"],
  ["purchase", "Purchases"],
  ["onsite_web_purchase", "Purchases"],
  ["lead", "Leads"],
  ["onsite_conversion.lead_grouped", "Leads"],
  ["offsite_conversion.fb_pixel_lead", "Leads"],
  ["complete_registration", "Sign-ups"],
  ["offsite_conversion.fb_pixel_complete_registration", "Sign-ups"],
  ["onsite_conversion.messaging_conversation_started_7d", "Messages started"],
  ["contact_total", "Contacts"],
  ["landing_page_view", "Landing page views"],
  ["link_click", "Link clicks"],
  ["video_view", "Video plays (3 s)"],
  ["post_engagement", "Post engagements"],
  ["page_engagement", "Page engagements"],
]

const actionsOf = (row) => Object.fromEntries((row && row.actions ? row.actions : []).map((a) => [a.action_type, num(a.value) || 0]))
const valuesOf = (row) => Object.fromEntries((row && row.action_values ? row.action_values : []).map((a) => [a.action_type, num(a.value) || 0]))

function pickResult(rows) {
  const all = {}
  for (const r of rows) for (const [k, v] of Object.entries(actionsOf(r))) all[k] = (all[k] || 0) + v
  for (const [k, l] of RESULT_TYPES) if (all[k] > 0) return { key: k, label: l }
  return { key: "link_click", label: "Link clicks" }
}

// ---------- Meta ----------

export function metaAccounts() {
  return { method: "GET", url: `${META}/me/adaccounts?fields=id,account_id,name,account_status,currency,timezone_name,amount_spent&limit=50` }
}

const tr = (s, e) => encodeURIComponent(JSON.stringify({ since: s, until: e }))
const FIELDS = "spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,inline_link_click_ctr,cpc,cpm,actions,action_values,purchase_roas"

/** The accounts worth reporting: active ones (or all, when none is active), at most 5. */
export function metaUse(accountsAnswer) {
  const a = answer(accountsAnswer)
  if (!a.ok) return { ok: false, error: a.error, list: [] }
  const all = (a.body.data || []).map((x) => ({ id: x.id, name: x.name || x.account_id, status: x.account_status, currency: x.currency || "", tz: x.timezone_name || "" }))
  const active = all.filter((x) => x.status === 1)
  return { ok: true, list: (active.length ? active : all).slice(0, 5), all }
}

export function metaPlan(list, query, now) {
  const r = adsRanges(query, now)
  const out = []
  for (const acc of list) {
    const base = `${META}/${acc.id}/insights?time_range=${tr(r.start, r.end)}`
    const ask = (tag, url) => out.push({ tag, acc: acc.id, method: "GET", url })
    ask("total", `${base}&level=account&fields=${FIELDS}`)
    ask("daily", `${base}&level=account&time_increment=1&fields=spend,impressions,reach,clicks,inline_link_clicks,actions&limit=800`)
    if (r.cstart) ask("prev", `${META}/${acc.id}/insights?time_range=${tr(r.cstart, r.cend)}&level=account&fields=${FIELDS}`)
    if (r.cstart) ask("cdaily", `${META}/${acc.id}/insights?time_range=${tr(r.cstart, r.cend)}&level=account&time_increment=1&fields=spend,impressions,reach,clicks,inline_link_clicks,actions&limit=800`)
    ask("campaigns", `${base}&level=campaign&fields=campaign_id,campaign_name,objective,${FIELDS}&limit=100&sort=spend_descending`)
    ask("ads", `${base}&level=ad&fields=ad_id,ad_name,campaign_name,spend,impressions,reach,frequency,clicks,inline_link_clicks,ctr,cpc,cpm,actions&limit=50&sort=spend_descending`)
    ask("agegender", `${base}&level=account&breakdowns=age,gender&fields=spend,impressions,clicks,inline_link_clicks,actions&limit=200`)
    ask("placement", `${base}&level=account&breakdowns=publisher_platform,platform_position&fields=spend,impressions,clicks,inline_link_clicks,actions&limit=200`)
    ask("device", `${base}&level=account&breakdowns=impression_device&fields=spend,impressions,clicks,inline_link_clicks,actions&limit=100`)
    ask("country", `${base}&level=account&breakdowns=country&fields=spend,impressions,clicks,inline_link_clicks,actions&limit=100`)
  }
  return out
}

const PLACE = { facebook: "Facebook", instagram: "Instagram", audience_network: "Audience Network", messenger: "Messenger", threads: "Threads" }
const POS = (p) => String(p || "").replace(/_/g, " ").replace(/\b(feed)\b/i, "Feed").replace(/^./, (c) => c.toUpperCase())

export function metaPart(use, plans, answers, r) {
  const by = {}
  plans.forEach((p, i) => {
    const a = answer(answers[i])
    ;(by[p.tag] = by[p.tag] || []).push({ acc: p.acc, ...a })
  })
  const errors = []
  const rowsOf = (tag) => {
    const out = []
    for (const a of by[tag] || []) {
      if (!a.ok) {
        errors.push(a.error)
        continue
      }
      for (const x of a.body.data || []) out.push({ ...x, _acc: a.acc })
    }
    return out
  }
  const totals = rowsOf("total")
  const prevs = rowsOf("prev")
  const daily = rowsOf("daily")
  const cdaily = rowsOf("cdaily")
  const result = pickResult([...totals, ...rowsOf("campaigns")])
  const res = (row) => actionsOf(row)[result.key] || 0
  const purchaseValue = (row) => {
    const v = valuesOf(row)
    return v["offsite_conversion.fb_pixel_purchase"] || v.purchase || v.onsite_web_purchase || 0
  }
  const agg = (rows) => {
    const spend = sum(rows.map((x) => x.spend))
    const impressions = sum(rows.map((x) => x.impressions))
    const clicks = sum(rows.map((x) => x.inline_link_clicks || x.clicks))
    const results = sum(rows.map(res))
    const value = sum(rows.map(purchaseValue))
    const reach = sum(rows.map((x) => x.reach))
    return { spend, impressions, clicks, results, value, reach, ctr: impressions ? clicks / impressions : null, cpc: clicks ? spend / clicks : null, cpm: impressions ? (spend / impressions) * 1000 : null, cpr: results ? spend / results : null, roas: spend && value ? value / spend : null, frequency: reach ? impressions / reach : null }
  }
  const cur = agg(totals)
  const prev = r.cstart ? agg(prevs) : null
  const dayMap = (rows, f) => {
    const m = {}
    for (const x of rows) m[x.date_start] = (m[x.date_start] || 0) + f(x)
    return Object.entries(m).sort().map(([d, v]) => ({ d, v }))
  }
  const series = {
    spend: dayMap(daily, (x) => num(x.spend) || 0),
    impressions: dayMap(daily, (x) => num(x.impressions) || 0),
    clicks: dayMap(daily, (x) => num(x.inline_link_clicks || x.clicks) || 0),
    results: dayMap(daily, res),
    reach: dayMap(daily, (x) => num(x.reach) || 0),
  }
  const cseries = r.cstart
    ? { spend: dayMap(cdaily, (x) => num(x.spend) || 0), impressions: dayMap(cdaily, (x) => num(x.impressions) || 0), clicks: dayMap(cdaily, (x) => num(x.inline_link_clicks || x.clicks) || 0), results: dayMap(cdaily, res), reach: dayMap(cdaily, (x) => num(x.reach) || 0) }
    : null
  const rowStats = (x) => {
    const spend = num(x.spend) || 0
    const impressions = num(x.impressions) || 0
    const clicks = num(x.inline_link_clicks || x.clicks) || 0
    const results = res(x)
    return { spend, impressions, clicks, results, ctr: impressions ? clicks / impressions : null, cpc: clicks ? spend / clicks : null, cpr: results ? spend / results : null, frequency: num(x.frequency) }
  }
  const campaigns = rowsOf("campaigns").map((x) => ({ k: x.campaign_name || x.campaign_id, objective: String(x.objective || "").replace(/^OUTCOME_/, "").toLowerCase().replace(/^./, (c) => c.toUpperCase()), ...rowStats(x), roas: (num(x.spend) || 0) && purchaseValue(x) ? purchaseValue(x) / num(x.spend) : null }))
  const ads = rowsOf("ads").map((x) => ({ k: x.ad_name || x.ad_id, campaign: x.campaign_name || "", ...rowStats(x) }))
  const group = (rows, keyOf) => {
    const m = new Map()
    for (const x of rows) {
      const k = keyOf(x)
      const o = m.get(k) || { k, spend: 0, impressions: 0, clicks: 0, results: 0 }
      o.spend += num(x.spend) || 0
      o.impressions += num(x.impressions) || 0
      o.clicks += num(x.inline_link_clicks || x.clicks) || 0
      o.results += res(x)
      m.set(k, o)
    }
    return [...m.values()].map((o) => ({ ...o, ctr: o.impressions ? o.clicks / o.impressions : null, cpr: o.results ? o.spend / o.results : null })).sort((a, b) => b.spend - a.spend)
  }
  const ageGender = group(rowsOf("agegender"), (x) => `${x.age || "?"} · ${x.gender === "female" ? "Women" : x.gender === "male" ? "Men" : "Unknown"}`)
  const placements = group(rowsOf("placement"), (x) => `${PLACE[x.publisher_platform] || x.publisher_platform} · ${POS(x.platform_position)}`)
  const devices = group(rowsOf("device"), (x) => POS(x.impression_device))
  const countries = group(rowsOf("country"), (x) => x.country || "?").map((x) => ({ ...x, code: x.k }))
  const currency = (use.list[0] && use.list[0].currency) || ""
  return {
    platform: "meta",
    name: "Meta (Facebook + Instagram)",
    currency,
    accounts: use.list.map((a) => a.name),
    result,
    cur,
    prev,
    series,
    cseries,
    tables: { campaigns, ads, ageGender, placements, devices, countries },
    errors: [...new Set(errors)].slice(0, 2),
  }
}

// ---------- Pinterest ----------

export function pinAccounts() {
  return { method: "GET", url: `${PIN}/ad_accounts?page_size=25` }
}

export function pinUse(accountsAnswer) {
  const a = answer(accountsAnswer)
  if (!a.ok) return { ok: false, error: a.error, list: [] }
  const list = (a.body.items || []).map((x) => ({ id: x.id, name: x.name || x.id, currency: x.currency || "" })).slice(0, 3)
  return { ok: true, list }
}

const PIN_COLS = "SPEND_IN_DOLLAR,IMPRESSION_1,CLICKTHROUGH_1,CTR,TOTAL_CONVERSIONS,TOTAL_ENGAGEMENT"

export function pinPlan(list, query, now) {
  const r = adsRanges(query, now)
  // Pinterest reports at most 90 days at a time.
  const start = r.days > 90 ? add(r.end, -89) : r.start
  const out = []
  for (const acc of list) {
    out.push({ tag: "daily", acc: acc.id, method: "GET", url: `${PIN}/ad_accounts/${acc.id}/analytics?start_date=${start}&end_date=${r.end}&columns=${PIN_COLS}&granularity=DAY` })
    if (r.cstart && r.days <= 90) out.push({ tag: "prev", acc: acc.id, method: "GET", url: `${PIN}/ad_accounts/${acc.id}/analytics?start_date=${r.cstart}&end_date=${r.cend}&columns=${PIN_COLS}&granularity=TOTAL` })
    out.push({ tag: "campaigns", acc: acc.id, method: "GET", url: `${PIN}/ad_accounts/${acc.id}/campaigns?page_size=100` })
  }
  return out
}

export function pinCampaignPlan(list, campaignsAnswers, query, now) {
  const r = adsRanges(query, now)
  const start = r.days > 90 ? add(r.end, -89) : r.start
  const out = []
  list.forEach((acc, i) => {
    const a = answer(campaignsAnswers[i])
    const ids = a.ok ? (a.body.items || []).map((c) => c.id).slice(0, 100) : []
    if (ids.length) out.push({ tag: "campaignStats", acc: acc.id, method: "GET", url: `${PIN}/ad_accounts/${acc.id}/campaigns/analytics?start_date=${start}&end_date=${r.end}&campaign_ids=${ids.join(",")}&columns=${PIN_COLS}&granularity=TOTAL` })
  })
  return out
}

export function pinPart(use, plans, answers, campaignLists, r) {
  const by = {}
  const errors = []
  plans.forEach((p, i) => {
    const a = answer(answers[i])
    if (!a.ok) errors.push(a.error)
    ;(by[p.tag] = by[p.tag] || []).push(a)
  })
  const rows = (tag) => (by[tag] || []).filter((a) => a.ok).flatMap((a) => (Array.isArray(a.body) ? a.body : a.body.items || a.body.data || []))
  const daily = rows("daily")
  const prevRows = rows("prev")
  const v = (x, k) => num(x[k]) || 0
  const agg = (list) => {
    const spend = sum(list.map((x) => v(x, "SPEND_IN_DOLLAR")))
    const impressions = sum(list.map((x) => v(x, "IMPRESSION_1")))
    const clicks = sum(list.map((x) => v(x, "CLICKTHROUGH_1")))
    const results = sum(list.map((x) => v(x, "TOTAL_CONVERSIONS")))
    return { spend, impressions, clicks, results, value: 0, reach: null, ctr: impressions ? clicks / impressions : null, cpc: clicks ? spend / clicks : null, cpm: impressions ? (spend / impressions) * 1000 : null, cpr: results ? spend / results : null, roas: null, frequency: null }
  }
  const dmap = (k) => {
    const m = {}
    for (const x of daily) m[String(x.DATE || "").slice(0, 10)] = (m[String(x.DATE || "").slice(0, 10)] || 0) + v(x, k)
    return Object.entries(m).filter(([d]) => d).sort().map(([d, val]) => ({ d, v: val }))
  }
  const names = {}
  for (const raw of campaignLists || []) {
    const a = answer(raw)
    if (a.ok) for (const c of a.body.items || []) names[c.id] = c.name
  }
  const campaigns = rows("campaignStats").map((x) => {
    const spend = v(x, "SPEND_IN_DOLLAR")
    const impressions = v(x, "IMPRESSION_1")
    const clicks = v(x, "CLICKTHROUGH_1")
    const results = v(x, "TOTAL_CONVERSIONS")
    return { k: names[x.CAMPAIGN_ID] || x.CAMPAIGN_ID || "Campaign", objective: "", spend, impressions, clicks, results, ctr: impressions ? clicks / impressions : null, cpc: clicks ? spend / clicks : null, cpr: results ? spend / results : null }
  }).sort((a, b) => b.spend - a.spend)
  return {
    platform: "pinterest",
    name: "Pinterest Ads",
    currency: "USD",
    accounts: use.list.map((a) => a.name),
    result: { key: "conversions", label: "Conversions" },
    cur: agg(daily),
    prev: prevRows.length ? agg(prevRows) : null,
    series: { spend: dmap("SPEND_IN_DOLLAR"), impressions: dmap("IMPRESSION_1"), clicks: dmap("CLICKTHROUGH_1"), results: dmap("TOTAL_CONVERSIONS") },
    cseries: null,
    tables: { campaigns },
    errors: [...new Set(errors)].slice(0, 2),
    note: r.days > 90 ? "Pinterest reports the last 90 days at most." : "",
  }
}

// ---------- Google Ads (rows from n8n's Google Ads node, campaign → get many) ----------

/** Google Ads presets the n8n node understands, nearest to the dates asked for. */
export function googlePreset(r) {
  return r.days <= 7 ? { preset: "LAST_7_DAYS", days: 7 } : r.days <= 14 ? { preset: "LAST_14_DAYS", days: 14 } : { preset: "LAST_30_DAYS", days: 30 }
}

export function googlePart(rows, r) {
  const g = (x, ...keys) => {
    for (const k of keys) {
      const parts = k.split(".")
      let v = x
      for (const p of parts) v = v && typeof v === "object" ? v[p] : undefined
      if (v !== undefined && v !== null && v !== "") return v
    }
    return null
  }
  const list = (rows || []).filter((x) => x && typeof x === "object" && !x.error)
  const campaigns = list
    .map((x) => {
      const spend = (num(g(x, "metrics.costMicros", "costMicros", "metrics.cost_micros", "cost_micros")) || 0) / 1e6
      const impressions = num(g(x, "metrics.impressions", "impressions")) || 0
      const clicks = num(g(x, "metrics.clicks", "clicks", "interactions")) || 0
      const results = num(g(x, "metrics.conversions", "conversions")) || 0
      return { k: String(g(x, "campaign.name", "name") || "Campaign"), objective: String(g(x, "campaign.advertisingChannelType", "advertisingChannelType", "campaign.status", "status") || "").toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()), spend, impressions, clicks, results, ctr: impressions ? clicks / impressions : null, cpc: clicks ? spend / clicks : null, cpr: results ? spend / results : null }
    })
    .filter((c) => c.spend || c.impressions)
    .sort((a, b) => b.spend - a.spend)
  const cur = {
    spend: sum(campaigns.map((c) => c.spend)),
    impressions: sum(campaigns.map((c) => c.impressions)),
    clicks: sum(campaigns.map((c) => c.clicks)),
    results: sum(campaigns.map((c) => c.results)),
    value: 0,
    reach: null,
    frequency: null,
    roas: null,
  }
  cur.ctr = cur.impressions ? cur.clicks / cur.impressions : null
  cur.cpc = cur.clicks ? cur.spend / cur.clicks : null
  cur.cpm = cur.impressions ? (cur.spend / cur.impressions) * 1000 : null
  cur.cpr = cur.results ? cur.spend / cur.results : null
  const p = googlePreset(r)
  const conv = campaigns.some((c) => c.results)
  return { platform: "google", name: "Google Ads", currency: "", accounts: [], result: { key: "conversions", label: "Conversions" }, cur, prev: null, series: {}, cseries: null, tables: { campaigns }, errors: [], note: `Google Ads shows the last ${p.days} days${conv ? "" : " (clicks are interactions; conversions aren't in this report)"}.` }
}

// ---------- the section ----------

const PLATFORM_LABEL = { meta: "Meta", google: "Google Ads", pinterest: "Pinterest Ads", linkedin: "LinkedIn Ads" }

/**
 * parts: platform parts that answered. status: one row per platform:
 * { platform, state: "live" | "none" | "setup" | "error", note }.
 */
export function adsSection(query, now, parts, status) {
  const r = adsRanges(query, now)
  const out = { ok: true, section: "ads", range: r, filters: {}, generatedAt: now.toISOString(), account: null, kpis: [], tables: [], items: null, notes: [], errors: [], insights: [] }
  const live = parts.filter((p) => p.cur && (p.cur.spend || p.cur.impressions))
  const currencies = [...new Set(live.map((p) => p.currency).filter(Boolean))]
  const money = currencies.length === 1 ? (currencies[0] === "INR" ? "inr" : currencies[0] === "USD" ? "usd" : "decimal") : "decimal"
  const one = live.length === 1 ? live[0] : null
  const S = (k) => {
    // Daily series added up across platforms.
    const m = {}
    for (const p of live) for (const x of (p.series && p.series[k]) || []) m[x.d] = (m[x.d] || 0) + (x.v || 0)
    return Object.entries(m).sort().map(([d, v]) => ({ d, v }))
  }
  const CS = (k) => {
    const m = {}
    for (const p of live) for (const x of (p.cseries && p.cseries[k]) || []) m[x.d] = (m[x.d] || 0) + (x.v || 0)
    const a = Object.entries(m).sort().map(([d, v]) => ({ d, v }))
    return a.length ? a : null
  }
  const T = (k) => sum(live.map((p) => p.cur[k]))
  const P = (k) => (live.every((p) => p.prev) && live.length ? sum(live.map((p) => p.prev[k])) : null)
  const spend = T("spend")
  const impressions = T("impressions")
  const clicks = T("clicks")
  const results = T("results")
  const kpi = (key, label, value, prev, o = {}) => out.kpis.push({ key, label, value, prev, format: "number", ...o })
  if (live.length) {
    const ps = P("spend")
    kpi("spend", currencies.length > 1 ? "Spend (mixed currencies)" : "Ad spend", spend, ps, { format: money, series: S("spend"), cseries: CS("spend"), help: "What the ads cost in these dates." })
    kpi("impressions", "Impressions", impressions, P("impressions"), { series: S("impressions"), cseries: CS("impressions") })
    if (live.some((p) => p.cur.reach)) kpi("reach", "People reached (Meta)", sum(live.map((p) => p.cur.reach || 0)), live.every((p) => p.prev) ? sum(live.map((p) => (p.prev && p.prev.reach) || 0)) : null, { series: S("reach"), cseries: CS("reach") })
    kpi("clicks", "Link clicks", clicks, P("clicks"), { series: S("clicks"), cseries: CS("clicks") })
    kpi("ctr", "Click rate", impressions ? clicks / impressions : null, P("impressions") ? P("clicks") / P("impressions") : null, { format: "percent", avg: true })
    kpi("cpc", "Cost per click", clicks ? spend / clicks : null, P("clicks") ? P("spend") / P("clicks") : null, { format: money, avg: true, invert: true })
    kpi("cpm", "Cost per 1,000 views", impressions ? (spend / impressions) * 1000 : null, P("impressions") ? (P("spend") / P("impressions")) * 1000 : null, { format: money, avg: true, invert: true })
    const rl = one ? one.result.label : "Results"
    kpi("results", rl, results, P("results"), { series: S("results"), cseries: CS("results"), help: one && one.platform === "meta" ? `Counted as ${rl.toLowerCase()}: the main outcome these ads got.` : "Conversions, leads or the main result each platform counts." })
    kpi("cpr", `Cost per ${rl.toLowerCase().replace(/s$/, "")}`, results ? spend / results : null, P("results") ? P("spend") / P("results") : null, { format: money, avg: true, invert: true })
    const value = T("value")
    if (value) kpi("roas", "Return on ad spend", spend ? value / spend : null, null, { format: "decimal", avg: true, help: "Purchase value ÷ spend (Meta pixel purchases)." })
  }
  out.chartDefault = "spend"

  const cols = (first, o = {}) => [first, ...(o.objective ? [{ key: "objective", label: o.objective }] : []), { key: "spend", label: "Spend", format: money, bar: true }, { key: "impressions", label: "Impressions", format: "number" }, { key: "clicks", label: "Clicks", format: "number" }, { key: "ctr", label: "Click rate", format: "percent" }, { key: "results", label: o.results || "Results", format: "number" }, { key: "cpr", label: "Cost / result", format: money }]
  const tb = (key, title, columns, rows, o = {}) => {
    if (rows && rows.length) out.tables.push({ key, title, columns, rows, ...o })
  }
  for (const p of live) {
    const g = PLATFORM_LABEL[p.platform] || p.name
    const T2 = p.tables || {}
    tb(`${p.platform}-campaigns`, "Campaigns", cols({ key: "k", label: "Campaign" }, { objective: p.platform === "meta" ? "Objective" : "Type", results: p.result.label }), T2.campaigns, { kind: "table", wide: true, group: g })
    tb(`${p.platform}-ads`, "Ads", [{ key: "k", label: "Ad", sub: "campaign" }, ...cols({ key: "k", label: "" }, { results: p.result.label }).slice(1), { key: "frequency", label: "Frequency", format: "decimal" }], T2.ads, { kind: "table", wide: true, group: g })
    tb(`${p.platform}-agegender`, "Age and gender", cols({ key: "k", label: "Who" }, { results: p.result.label }), T2.ageGender, { kind: "table", group: g })
    tb(`${p.platform}-placements`, "Placements", cols({ key: "k", label: "Where" }, { results: p.result.label }), T2.placements, { kind: "table", group: g })
    tb(`${p.platform}-devices`, "Devices", cols({ key: "k", label: "Device" }, { results: p.result.label }), T2.devices, { kind: "table", group: g })
    tb(`${p.platform}-countries`, "Countries", cols({ key: "k", label: "Country" }, { results: p.result.label }), T2.countries, { kind: "table", group: g, countryCodes: true })
    if (p.note) out.notes.push(p.note)
    for (const e of p.errors || []) out.errors.push({ what: g, error: e })
  }
  // Every platform and where it stands.
  const ST = { live: "Connected", none: "Connected, no ads in these dates", setup: "Not connected yet", error: "Couldn't load" }
  out.tables.push({ key: "connections", title: "Ad accounts", group: "Connections", wide: true, columns: [{ key: "k", label: "Platform", sub: "accounts" }, { key: "state", label: "Status" }, { key: "note", label: "What to do" }], rows: status.map((s) => ({ k: PLATFORM_LABEL[s.platform] || s.platform, accounts: s.accounts || "", state: ST[s.state] || s.state, note: s.note || "" })) })

  // ----- what stands out -----
  const I = out.insights
  const m = (v) => (money === "inr" ? `₹${nf(v)}` : money === "usd" ? `$${(Number(v) || 0).toFixed(2)}` : nf(v))
  if (!live.length) {
    I.push({ tone: "info", title: "No paid ads in these dates", text: status.some((s) => s.state === "setup") ? "Connect the ad accounts below to see spend, results and what to change, all in one place." : "Nothing was spent on ads in these dates." })
    return out
  }
  const ps = P("spend")
  I.push({ tone: "info", title: `${m(spend)} spent`, text: `${nf(results)} ${(one ? one.result.label : "results").toLowerCase()} at ${results ? m(spend / results) : "—"} each, from ${nf(impressions)} impressions and ${nf(clicks)} clicks.${ps ? ` Spend is ${spend >= ps ? "up" : "down"} ${Math.round(Math.abs((spend - ps) / ps) * 100)}% on the period before.` : ""}` })
  const all = live.flatMap((p) => (p.tables.campaigns || []).map((c) => ({ ...c, platform: p.platform, result: p.result.label })))
  const withRes = all.filter((c) => c.results > 0 && c.spend > 0)
  if (withRes.length >= 2) {
    const best = [...withRes].sort((a, b) => a.cpr - b.cpr)[0]
    const worst = [...withRes].sort((a, b) => b.cpr - a.cpr)[0]
    if (best.k !== worst.k && worst.cpr > best.cpr * 1.5) I.push({ tone: "idea", title: "Move budget to the cheaper campaign", text: `“${best.k}” gets ${best.result.toLowerCase()} at ${m(best.cpr)} each; “${worst.k}” pays ${m(worst.cpr)}. Shifting budget toward the first usually lowers the overall cost.` })
  }
  const minSpend = spend * 0.1
  const wasted = all.filter((c) => c.spend >= minSpend && c.spend > 0 && !c.results)
  if (wasted.length) I.push({ tone: "down", title: `${m(sum(wasted.map((c) => c.spend)))} spent with no results`, text: `On ${wasted.map((c) => `“${c.k}”`).slice(0, 3).join(", ")}. Check the targeting and the landing page, or pause and test a new ad.` })
  const tired = live.flatMap((p) => (p.tables.ads || []).filter((a) => (a.frequency || 0) >= 3 && a.spend > 0))
  if (tired.length) I.push({ tone: "idea", title: "People are seeing the same ad too often", text: `${tired.length} ad${tired.length === 1 ? "" : "s"} shown 3+ times per person (e.g. “${tired[0].k}”, ${tired[0].frequency.toFixed(1)}). Fresh images or copy keep the cost down.` })
  const meta = live.find((p) => p.platform === "meta")
  if (meta && meta.tables.placements && meta.tables.placements.length >= 2) {
    const pl = meta.tables.placements.filter((x) => x.results > 0)
    if (pl.length >= 2) {
      const b = [...pl].sort((a, c) => a.cpr - c.cpr)[0]
      I.push({ tone: "info", title: `Cheapest placement: ${b.k}`, text: `${m(b.cpr)} per ${meta.result.label.toLowerCase().replace(/s$/, "")} there.` })
    }
  }
  if (meta && meta.tables.ageGender && meta.tables.ageGender.length >= 2) {
    const top = meta.tables.ageGender.filter((x) => x.results > 0).sort((a, b) => b.results - a.results)[0]
    if (top) I.push({ tone: "info", title: `Most results from ${top.k}`, text: `${nf(top.results)} ${meta.result.label.toLowerCase()} at ${m(top.cpr)} each.` })
  }
  const ctr = impressions ? clicks / impressions : 0
  if (impressions > 2000 && ctr < 0.008) I.push({ tone: "idea", title: `Low click rate (${pc(ctr)})`, text: "Fewer than 1 in 100 people click. A clearer first line, a face or a bold before/after image in the first second usually helps." })
  return out
}
