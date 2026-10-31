// lib/insights/website.js
//
// Website reports for every dashboard: Google Analytics ("ga4": visitors and pages),
// Visits ("sessions": how visits go, by channel, landing page, device…) and Search Console
// ("gsc": searches, pages, quick wins).
//
// webPlan() turns the dashboard's query into Google API calls; n8n sends them with the
// business's own Google login (workflow XD-GF, through the gateway; see lib/dashboard/website.ts);
// webReport() turns the answers into a dashboard section (lib/dashboard/types.ts), including
// "What stands out": short notes worked out from the numbers themselves (nothing is guessed).
//
// cfg: { ga4Property: "559315079", gscSite: "https://nestoodle.com/", site: "https://nestoodle.com",
//        siteName: "nestoodle.com", brand: ["nestoodle"] }
//
// Plain JavaScript with no imports, so it can also run unchanged in an n8n Code node.

export const WEB_SECTIONS = ["ga4", "sessions", "gsc"]

// ---------- dates ----------

export function webRanges(query, now) {
  const q = query || {}
  const today = new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10)
  const add = (d, n) => new Date(Date.parse(d + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10)
  const diff = (a, b) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5)
  const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) && !isNaN(Date.parse(v))
  let end = isDate(q.end) ? q.end : today
  if (end > today) end = today
  let start = isDate(q.start) ? q.start : add(end, -27)
  if (start > end) start = end
  if (diff(start, end) > 729) start = add(end, -729)
  const days = diff(start, end) + 1
  const cmp = ["prev", "yoy", "none"].includes(q.cmp) ? q.cmp : "prev"
  let cstart = null
  let cend = null
  if (cmp === "prev") {
    cend = add(start, -1)
    cstart = add(cend, -(days - 1))
  }
  if (cmp === "yoy") {
    const y = (d) => `${+d.slice(0, 4) - 1}${d.slice(4)}`.replace("-02-29", "-02-28")
    cstart = y(start)
    cend = y(end)
  }
  return { start, end, cstart, cend, days, cmp }
}

const clean = (v, max = 60) => String(v || "").replace(/[^\p{L}\p{N}_ .()\-]/gu, "").slice(0, max)

export function webFilters(query) {
  const q = query || {}
  const f = {}
  for (const k of ["device", "country", "channel", "searchType"]) if (q[k]) f[k] = clean(q[k])
  return f
}

// ---------- plan: which Google calls a section needs ----------

// GA4 allows at most 10 metrics in one report request.
const GA_M = (...n) => n.map((name) => ({ name }))
const GA_ORDER = (metric, limit) => ({ orderBys: [{ metric: { metricName: metric }, desc: true }], limit })
const DAILY_GA4 = ["activeUsers", "newUsers", "sessions", "screenPageViews", "engagementRate", "averageSessionDuration", "eventCount", "keyEvents", "bounceRate", "userEngagementDuration"]
const DAILY_VISITS = ["sessions", "engagedSessions", "engagementRate", "averageSessionDuration", "sessionsPerUser", "screenPageViewsPerSession", "bounceRate", "keyEvents", "sessionKeyEventRate"]
const VISIT_COLS = ["sessions", "engagementRate", "averageSessionDuration", "screenPageViewsPerSession", "bounceRate", "keyEvents"]

function gaFilter(f, extra) {
  const ex = []
  const eq = (fieldName, value) => ex.push({ filter: { fieldName, stringFilter: { value, matchType: "EXACT", caseSensitive: false } } })
  if (f.device) eq("deviceCategory", f.device.toLowerCase())
  if (f.country) eq("country", f.country)
  if (f.channel) eq("sessionDefaultChannelGroup", f.channel)
  if (extra) ex.push(extra)
  return ex.length ? { andGroup: { expressions: ex } } : undefined
}

export function webPlan(query, now, cfg) {
  const q = query || {}
  const section = String(q.section || "")
  const r = webRanges(q, now)
  const f = webFilters(q)
  const out = []
  if (section === "ga4" || section === "sessions") {
    const prop = `properties/${String(cfg.ga4Property).replace(/^properties\//, "")}`
    const url = `https://analyticsdata.googleapis.com/v1beta/${prop}:runReport`
    const cur = [{ startDate: r.start, endDate: r.end, name: "cur" }]
    const both = r.cstart ? [...cur, { startDate: r.cstart, endDate: r.cend, name: "prev" }] : cur
    const dimensionFilter = gaFilter(f)
    const ask = (tag, body, extraFilter) => {
      const flt = extraFilter ? gaFilter(f, extraFilter) : dimensionFilter
      out.push({ tag, method: "POST", url, body: flt ? { ...body, dimensionFilter: flt } : body })
    }
    const d = GA_M
    if (section === "ga4") {
      ask("totals", { dateRanges: both, metrics: d("activeUsers", "newUsers", "sessions", "engagedSessions", "engagementRate", "averageSessionDuration", "screenPageViews", "eventCount", "keyEvents", "bounceRate") })
      ask("daily", { dateRanges: cur, dimensions: d("date"), metrics: d(...DAILY_GA4), orderBys: [{ dimension: { dimensionName: "date" } }], limit: 800 })
      if (r.cstart) ask("cdaily", { dateRanges: [{ startDate: r.cstart, endDate: r.cend }], dimensions: d("date"), metrics: d(...DAILY_GA4), orderBys: [{ dimension: { dimensionName: "date" } }], limit: 800 })
      ask("pages", { dateRanges: cur, dimensions: d("pagePath", "pageTitle"), metrics: d("screenPageViews", "activeUsers", "userEngagementDuration", "eventCount"), ...GA_ORDER("screenPageViews", 100) })
      if (r.cstart) ask("pagesCmp", { dateRanges: both, dimensions: d("pagePath"), metrics: d("screenPageViews"), ...GA_ORDER("screenPageViews", 500) })
      ask("channels", { dateRanges: cur, dimensions: d("sessionDefaultChannelGroup"), metrics: d("sessions", "activeUsers", "engagementRate", "keyEvents"), ...GA_ORDER("sessions", 15) })
      ask("sourceMedium", { dateRanges: cur, dimensions: d("sessionSourceMedium"), metrics: d("sessions", "activeUsers", "engagementRate"), ...GA_ORDER("sessions", 25) })
      ask("referrers", { dateRanges: cur, dimensions: d("pageReferrer"), metrics: d("screenPageViews"), ...GA_ORDER("screenPageViews", 15) })
      ask("countries", { dateRanges: cur, dimensions: d("country", "countryId"), metrics: d("activeUsers", "sessions"), ...GA_ORDER("activeUsers", 25) })
      ask("cities", { dateRanges: cur, dimensions: d("city"), metrics: d("activeUsers", "sessions"), ...GA_ORDER("activeUsers", 25) })
      ask("devices", { dateRanges: cur, dimensions: d("deviceCategory"), metrics: d("activeUsers", "sessions", "engagementRate"), ...GA_ORDER("activeUsers", 5) })
      ask("os", { dateRanges: cur, dimensions: d("operatingSystem"), metrics: d("activeUsers"), ...GA_ORDER("activeUsers", 10) })
      ask("browsers", { dateRanges: cur, dimensions: d("browser"), metrics: d("activeUsers"), ...GA_ORDER("activeUsers", 10) })
      ask("languages", { dateRanges: cur, dimensions: d("language"), metrics: d("activeUsers"), ...GA_ORDER("activeUsers", 10) })
      ask("nvr", { dateRanges: cur, dimensions: d("newVsReturning"), metrics: d("activeUsers", "sessions", "engagementRate") })
      ask("events", { dateRanges: cur, dimensions: d("eventName"), metrics: d("eventCount", "totalUsers"), ...GA_ORDER("eventCount", 25) })
      ask("heat", { dateRanges: cur, dimensions: d("dayOfWeek", "hour"), metrics: d("activeUsers"), limit: 200 })
      out.push({ tag: "realtime", method: "POST", url: `https://analyticsdata.googleapis.com/v1beta/${prop}:runRealtimeReport`, body: { dimensions: d("unifiedScreenName"), metrics: d("activeUsers"), limit: 10, metricAggregations: ["TOTAL"] } })
    } else {
      ask("totals", { dateRanges: both, metrics: d(...DAILY_VISITS) })
      ask("daily", { dateRanges: cur, dimensions: d("date"), metrics: d(...DAILY_VISITS), orderBys: [{ dimension: { dimensionName: "date" } }], limit: 800 })
      if (r.cstart) ask("cdaily", { dateRanges: [{ startDate: r.cstart, endDate: r.cend }], dimensions: d("date"), metrics: d(...DAILY_VISITS), orderBys: [{ dimension: { dimensionName: "date" } }], limit: 800 })
      ask("channels", { dateRanges: both, dimensions: d("sessionDefaultChannelGroup"), metrics: d(...VISIT_COLS), ...GA_ORDER("sessions", 40) })
      ask("sourceMedium", { dateRanges: cur, dimensions: d("sessionSourceMedium"), metrics: d(...VISIT_COLS), ...GA_ORDER("sessions", 30) })
      ask("social", { dateRanges: cur, dimensions: d("sessionSource"), metrics: d(...VISIT_COLS), ...GA_ORDER("sessions", 15) }, { filter: { fieldName: "sessionDefaultChannelGroup", inListFilter: { values: ["Organic Social", "Paid Social"], caseSensitive: false } } })
      ask("campaigns", { dateRanges: cur, dimensions: d("sessionCampaignName"), metrics: d("sessions", "engagementRate", "keyEvents"), ...GA_ORDER("sessions", 25) })
      ask("landing", { dateRanges: cur, dimensions: d("landingPage"), metrics: d(...VISIT_COLS), ...GA_ORDER("sessions", 50) })
      ask("firstChannel", { dateRanges: cur, dimensions: d("firstUserDefaultChannelGroup"), metrics: d("newUsers", "activeUsers"), ...GA_ORDER("newUsers", 15) })
      ask("devices", { dateRanges: cur, dimensions: d("deviceCategory"), metrics: d(...VISIT_COLS), ...GA_ORDER("sessions", 5) })
      ask("nvr", { dateRanges: cur, dimensions: d("newVsReturning"), metrics: d(...VISIT_COLS) })
      ask("countries", { dateRanges: cur, dimensions: d("country", "countryId"), metrics: d(...VISIT_COLS), ...GA_ORDER("sessions", 25) })
      ask("weekday", { dateRanges: cur, dimensions: d("dayOfWeek"), metrics: d("sessions", "engagementRate", "averageSessionDuration") })
      ask("heat", { dateRanges: cur, dimensions: d("dayOfWeek", "hour"), metrics: d("sessions"), limit: 200 })
    }
  } else if (section === "gsc") {
    const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.gscSite)}/searchAnalytics/query`
    const type = ["web", "image", "video", "news", "discover", "googleNews"].includes(f.searchType) ? f.searchType : "web"
    const flt = []
    if (f.device) flt.push({ dimension: "device", operator: "equals", expression: f.device.toUpperCase() })
    if (f.country) flt.push({ dimension: "country", operator: "equals", expression: f.country.toLowerCase() })
    const base = (s, e) => ({ startDate: s, endDate: e, type, dataState: "all", ...(flt.length ? { dimensionFilterGroups: [{ groupType: "and", filters: flt }] } : {}) })
    const ask = (tag, s, e, dimensions, rowLimit) => out.push({ tag, method: "POST", url, body: { ...base(s, e), ...(dimensions.length ? { dimensions } : {}), ...(rowLimit ? { rowLimit } : {}) } })
    ask("totals", r.start, r.end, [], 0)
    ask("daily", r.start, r.end, ["date"], 1000)
    ask("queries", r.start, r.end, ["query"], 1000)
    ask("pages", r.start, r.end, ["page"], 500)
    ask("queryPage", r.start, r.end, ["query", "page"], 1000)
    ask("countries", r.start, r.end, ["country"], 50)
    if (type !== "discover" && type !== "googleNews") ask("devices", r.start, r.end, ["device"], 5)
    if (type === "web") ask("appearance", r.start, r.end, ["searchAppearance"], 50)
    if (r.cstart) {
      ask("ctotals", r.cstart, r.cend, [], 0)
      ask("cdaily", r.cstart, r.cend, ["date"], 1000)
      ask("cqueries", r.cstart, r.cend, ["query"], 1000)
      ask("cpages", r.cstart, r.cend, ["page"], 500)
    }
  }
  return out
}

// ---------- small helpers ----------

const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v))
const nf = (v) => {
  const n = Math.round(Number(v) || 0)
  try {
    return n.toLocaleString("en-IN")
  } catch {
    return String(n)
  }
}
const pc = (v) => {
  const n = Number(v) || 0
  return `${(n * 100).toFixed(n !== 0 && Math.abs(n) < 0.1 ? 1 : 0)}%`
}
const secs = (s) => {
  const n = Math.round(Number(s) || 0)
  return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, "0")}s`
}
const ratio = (c, p) => (p ? (c - p) / p : null)
// "up 23% on the period before" / "about the same as the period before"
const upDown = (c, p) => {
  const x = ratio(c, p)
  if (x === null) return ""
  if (Math.abs(x) < 0.03) return "about the same as the period before"
  return `${x > 0 ? "up" : "down"} ${Math.round(Math.abs(x) * 100)}% on the period before`
}
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s)
const tone = (c, p) => {
  const x = ratio(c, p)
  return x === null ? "info" : x >= 0.03 ? "up" : x <= -0.03 ? "down" : "info"
}
const q = (s) => `“${String(s).slice(0, 70)}”`
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const hourText = (h) => {
  const a = (x) => `${((x + 11) % 12) + 1}${x < 12 ? " am" : " pm"}`
  return `${a(h)}–${a((h + 1) % 24)}`
}
const DEV = { mobile: "Phone", desktop: "Computer", tablet: "Tablet", "smart tv": "TV", MOBILE: "Phone", DESKTOP: "Computer", TABLET: "Tablet" }
const NVR = { new: "New", returning: "Returning" }

function answer(a) {
  // n8n "full response" ({statusCode, body}), a plain body, or {error}.
  if (!a) return { ok: false, error: "No answer" }
  let status = 200
  let body = a
  if (typeof a === "object" && "statusCode" in a) {
    status = Number(a.statusCode) || 0
    body = a.body
  }
  const e = (body && body.error) || (a && a.error && !("statusCode" in a) ? a.error : null)
  if (e || status < 200 || status >= 300 || !body || typeof body !== "object") {
    const m = !e ? `HTTP ${status}` : typeof e === "string" ? e : e.message || (e.error && e.error.message) || JSON.stringify(e).slice(0, 200)
    return { ok: false, error: String(m).slice(0, 300) }
  }
  return { ok: true, body }
}

function explain(msg, section) {
  if (/has not been used|is disabled|SERVICE_DISABLED/i.test(msg)) return section === "gsc" ? "Turn on the Google Search Console API in Google Cloud." : "Turn on the Google Analytics Data API in Google Cloud."
  if (/PERMISSION_DENIED|insufficient|not have|403|User does not have sufficient/i.test(msg)) return `${msg} — make sure the Google login used here can see this ${section === "gsc" ? "Search Console site" : "Analytics property"}.`
  return msg
}

function base(query, now, section, r, f) {
  return { ok: true, section, range: r, filters: f, generatedAt: now.toISOString(), account: null, kpis: [], tables: [], items: null, notes: [], errors: [], insights: [] }
}

// GA4 runReport → rows of { dims: [...], vals: [...], range: "cur" | "prev" }
function gaRows(x) {
  if (!x || !x.ok) return null
  const dh = (x.body.dimensionHeaders || []).map((h) => h.name)
  const di = dh.indexOf("dateRange")
  return (x.body.rows || []).map((z) => {
    let dims = (z.dimensionValues || []).map((v) => v.value)
    let range = "cur"
    if (di >= 0) {
      range = dims[di]
      dims = dims.filter((_, i) => i !== di)
    } else if (dims.length === 1 && (dims[0] === "cur" || dims[0] === "prev") && !dh.length) {
      range = dims[0]
      dims = []
    }
    return { dims, vals: (z.metricValues || []).map((v) => num(v.value)), range }
  })
}
const gaNames = (x) => (x && x.ok ? (x.body.metricHeaders || []).map((h) => h.name) : [])
function gaTotals(x) {
  // A totals report (no dimensions) with one or two date ranges.
  const names = gaNames(x)
  const T = {}
  for (const z of gaRows(x) || []) {
    const rng = z.range === "prev" || z.dims[0] === "prev" ? "prev" : "cur"
    T[rng] = Object.fromEntries(names.map((n, i) => [n, z.vals[i]]))
  }
  const zero = Object.fromEntries(names.map((n) => [n, 0]))
  return { cur: T.cur || zero, prev: T.prev || zero }
}
function gaDaily(x) {
  const h = gaNames(x)
  return (gaRows(x) || []).map((z) => ({ d: `${z.dims[0].slice(0, 4)}-${z.dims[0].slice(4, 6)}-${z.dims[0].slice(6, 8)}`, ...Object.fromEntries(h.map((n, i) => [n, z.vals[i]])) }))
}
// Rows as objects keyed by metric name, split by date range.
function gaObjects(x) {
  const h = gaNames(x)
  const cur = []
  const prev = []
  for (const z of gaRows(x) || []) (z.range === "prev" ? prev : cur).push({ dims: z.dims, ...Object.fromEntries(h.map((n, i) => [n, z.vals[i]])) })
  return { cur, prev }
}

// "India time" for Asia/Kolkata, else "Los Angeles time": the GA4 property's own time zone.
function tzLabel(x) {
  const tz = (x && x.ok && x.body.metadata && x.body.metadata.timeZone) || "Asia/Kolkata"
  if (/Asia\/(Kolkata|Calcutta)/.test(tz)) return "India time"
  if (/^(Etc\/)?(GMT|UTC|UCT|Zulu)/.test(tz)) return "GMT"
  return `${tz.split("/").pop().replace(/_/g, " ")} time`
}

function heat(x, title) {
  const hm = gaRows(x)
  if (!hm || !hm.length) return null
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const z of hm) grid[+z.dims[0]][+z.dims[1]] += z.vals[0] || 0
  return { title, grid, days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] }
}
function peak(grid) {
  let best = null
  grid.forEach((row, d) => row.forEach((v, h) => { if (!best || v > best.v) best = { d, h, v } }))
  return best && best.v > 0 ? best : null
}

// ---------- report ----------

export function webReport(query, now, plans, answers, cfg) {
  const qy = query || {}
  const section = String(qy.section || "")
  const r = webRanges(qy, now)
  const f = webFilters(qy)
  const by = {}
  plans.forEach((p, i) => (by[p.tag] = answer(answers[i])))
  const first = by.totals
  if (!first || !first.ok) return { ok: false, section, error: explain(first ? first.error : "No answer from Google", section) }
  const out = base(qy, now, section, r, f)
  try {
    if (section === "ga4") ga4Report(out, by, r, cfg)
    else if (section === "sessions") visitsReport(out, by, r, cfg)
    else if (section === "gsc") gscReport(out, by, r, cfg)
    else return { ok: false, section, error: `Unknown section "${section}".` }
  } catch (e) {
    out.errors.push({ what: "Report", error: String((e && e.message) || e).slice(0, 300) })
  }
  for (const p of plans) if (by[p.tag] && !by[p.tag].ok && p.tag !== "totals" && p.tag !== "realtime") out.errors.push({ what: label(p.tag), error: explain(by[p.tag].error, section) })
  out.errors = out.errors.filter((e, i, a) => a.findIndex((x) => x.error === e.error) === i).slice(0, 4)
  return out
}

const LABELS = { daily: "Daily numbers", cdaily: "Earlier period", pages: "Pages", pagesCmp: "Page changes", channels: "Channels", sourceMedium: "Source / medium", referrers: "Referring pages", countries: "Countries", cities: "Cities", devices: "Devices", os: "Systems", browsers: "Browsers", languages: "Languages", nvr: "New vs returning", events: "Events", heat: "Busy times", social: "Social sites", campaigns: "Campaigns", landing: "Landing pages", firstChannel: "First visit", weekday: "Days of the week", queries: "Search terms", queryPage: "Search terms by page", appearance: "Search appearance", ctotals: "Earlier period", cqueries: "Earlier search terms", cpages: "Earlier pages" }
const label = (tag) => LABELS[tag] || tag

function kpiMaker(out, cur, prev, D, C, r) {
  const S = (rows, k) => (rows ? rows.map((x) => ({ d: x.d, v: x[k] === undefined ? null : x[k] })) : null)
  return (k, labelText, o = {}) => {
    const v = cur[k]
    if (v === null || v === undefined) return
    out.kpis.push({ key: o.key || k, label: labelText, value: num(v), prev: r.cstart ? num(prev[k]) : null, format: "number", series: S(D, k), cseries: r.cstart ? S(C, k) : null, ...o, ...(o.key ? { key: o.key } : {}) })
  }
}

const tb = (out, key, title, columns, rows, o = {}) => {
  if (rows && rows.length) out.tables.push({ key, title, columns, rows, ...o })
}

function path(p) {
  return String(p || "").split("?")[0] || "/"
}

function ga4Report(out, by, r, cfg) {
  const { cur, prev } = gaTotals(by.totals)
  const D = gaDaily(by.daily)
  const C = r.cstart ? gaDaily(by.cdaily) : null
  const K = kpiMaker(out, cur, prev, D, C, r)
  K("activeUsers", "Visitors", { help: "People who visited the website." })
  K("newUsers", "New visitors")
  K("sessions", "Sessions", { help: "Visits to the site. A session starts when someone opens the site and ends after 30 minutes without activity." })
  K("screenPageViews", "Page views")
  K("engagementRate", "Engaged visits", { format: "percent", avg: true, help: "Visits that lasted 10+ seconds, saw 2+ pages, or did something." })
  K("averageSessionDuration", "Average visit", { format: "duration", avg: true })
  K("bounceRate", "Bounce rate", { format: "percent", invert: true, avg: true, help: "Visits that were not engaged. Lower is better." })
  K("eventCount", "Events")
  K("keyEvents", "Key events", { help: "Actions marked as key events in GA4 (for example a sign-up)." })
  if (cur.activeUsers) {
    out.kpis.push({
      key: "viewsPerVisitor",
      label: "Pages per visitor",
      value: cur.screenPageViews / cur.activeUsers,
      prev: r.cstart && prev.activeUsers ? prev.screenPageViews / prev.activeUsers : null,
      format: "decimal",
      avg: true,
      series: D.map((x) => ({ d: x.d, v: x.activeUsers ? x.screenPageViews / x.activeUsers : null })),
      cseries: C ? C.map((x) => ({ d: x.d, v: x.activeUsers ? x.screenPageViews / x.activeUsers : null })) : null,
    })
  }

  const rows = (x) => gaRows(x) || []
  const pct = { format: "percent" }
  const pages = rows(by.pages).map((z) => ({ path: z.dims[0], title: z.dims[1], views: z.vals[0], users: z.vals[1], time: z.vals[1] ? Math.round(z.vals[2] / z.vals[1]) : 0 }))
  tb(out, "pages", "Pages", [{ key: "path", label: "Page", sub: "title" }, { key: "views", label: "Views", format: "number", bar: true }, { key: "users", label: "Visitors", format: "number" }, { key: "time", label: "Time per visitor", format: "duration" }], pages, { kind: "table", wide: true, link: cfg.site, group: "Content" })

  // Pages gaining and losing views against the earlier period.
  let movers = []
  if (r.cstart && by.pagesCmp && by.pagesCmp.ok) {
    const { cur: pc0, prev: pp0 } = gaObjects(by.pagesCmp)
    const was = new Map(pp0.map((x) => [x.dims[0], x.screenPageViews || 0]))
    const now = new Map(pc0.map((x) => [x.dims[0], x.screenPageViews || 0]))
    const keys = new Set([...was.keys(), ...now.keys()])
    movers = [...keys].map((p) => ({ path: p, views: now.get(p) || 0, before: was.get(p) || 0 })).map((x) => ({ ...x, diff: x.views - x.before, change: x.before ? (x.views - x.before) / x.before : x.views ? "new" : null }))
    const min = Math.max(5, Math.round((cur.screenPageViews || 0) / 400))
    const gain = movers.filter((x) => x.diff > 0 && x.views >= min).sort((a, b) => b.diff - a.diff).slice(0, 25)
    const lose = movers.filter((x) => x.diff < 0 && x.before >= min).sort((a, b) => a.diff - b.diff).slice(0, 25)
    const cols = [{ key: "path", label: "Page" }, { key: "views", label: "Views now", format: "number", bar: true }, { key: "before", label: "Before", format: "number" }, { key: "change", label: "Change", format: "change" }]
    tb(out, "pagesUp", "Pages gaining views", cols, gain, { kind: "table", link: cfg.site, group: "Content" })
    tb(out, "pagesDown", "Pages losing views", cols, lose, { kind: "table", link: cfg.site, group: "Content" })
  }

  const channels = rows(by.channels).map((z) => ({ k: z.dims[0], sessions: z.vals[0], users: z.vals[1], eng: z.vals[2], key: z.vals[3] }))
  tb(out, "channels", "How people arrive", [{ key: "k", label: "Channel", filter: "channel" }, { key: "sessions", label: "Sessions", format: "number", bar: true }, { key: "users", label: "Visitors", format: "number" }, { key: "eng", label: "Engaged", ...pct }], channels, { kind: "bars", group: "Acquisition" })
  tb(out, "sourceMedium", "Source / medium", [{ key: "k", label: "Source / medium" }, { key: "sessions", label: "Sessions", format: "number", bar: true }, { key: "users", label: "Visitors", format: "number" }, { key: "eng", label: "Engaged", ...pct }], rows(by.sourceMedium).map((z) => ({ k: z.dims[0], sessions: z.vals[0], users: z.vals[1], eng: z.vals[2] })), { kind: "table", group: "Acquisition" })
  tb(out, "referrers", "Referring pages", [{ key: "k", label: "Came from" }, { key: "views", label: "Page views", format: "number", bar: true }], rows(by.referrers).map((z) => ({ k: z.dims[0] || "(direct)", views: z.vals[0] })), { kind: "table", group: "Acquisition" })
  const countries = rows(by.countries).map((z) => ({ k: z.dims[0], code: z.dims[1], users: z.vals[0], sessions: z.vals[1] }))
  tb(out, "countries", "Countries", [{ key: "k", label: "Country", filter: "country" }, { key: "users", label: "Visitors", format: "number", bar: true }, { key: "sessions", label: "Sessions", format: "number" }], countries, { kind: "bars", group: "Audience", countryCodes: true })
  tb(out, "cities", "Cities", [{ key: "k", label: "City" }, { key: "users", label: "Visitors", format: "number", bar: true }, { key: "sessions", label: "Sessions", format: "number" }], rows(by.cities).map((z) => ({ k: z.dims[0], users: z.vals[0], sessions: z.vals[1] })), { kind: "bars", group: "Audience" })
  const devices = rows(by.devices).map((z) => ({ k: DEV[z.dims[0]] || z.dims[0], raw: z.dims[0], users: z.vals[0], eng: z.vals[2] }))
  tb(out, "devices", "Devices", [{ key: "k", label: "Device", filter: "device", filterKey: "raw" }, { key: "users", label: "Visitors", format: "number", bar: true }, { key: "eng", label: "Engaged", ...pct }], devices, { kind: "share", group: "Audience" })
  const nvr = rows(by.nvr).map((z) => ({ k: NVR[z.dims[0]] || "(not set)", users: z.vals[0], sessions: z.vals[1], eng: z.vals[2] }))
  tb(out, "nvr", "New vs returning", [{ key: "k", label: "Visitor" }, { key: "users", label: "Visitors", format: "number", bar: true }, { key: "eng", label: "Engaged", ...pct }], nvr, { kind: "share", group: "Audience" })
  tb(out, "languages", "Languages", [{ key: "k", label: "Language" }, { key: "users", label: "Visitors", format: "number", bar: true }], rows(by.languages).map((z) => ({ k: z.dims[0], users: z.vals[0] })), { kind: "bars", group: "Audience" })
  tb(out, "os", "Operating systems", [{ key: "k", label: "System" }, { key: "users", label: "Visitors", format: "number", bar: true }], rows(by.os).map((z) => ({ k: z.dims[0], users: z.vals[0] })), { kind: "bars", group: "Technology" })
  tb(out, "browsers", "Browsers", [{ key: "k", label: "Browser" }, { key: "users", label: "Visitors", format: "number", bar: true }], rows(by.browsers).map((z) => ({ k: z.dims[0], users: z.vals[0] })), { kind: "bars", group: "Technology" })
  tb(out, "events", "Events", [{ key: "k", label: "Event" }, { key: "count", label: "Count", format: "number", bar: true }, { key: "users", label: "Users", format: "number" }], rows(by.events).map((z) => ({ k: z.dims[0], count: z.vals[0], users: z.vals[1] })), { kind: "table", group: "Engagement" })
  const tzl = tzLabel(by.heat.ok ? by.heat : by.totals)
  const hm = heat(by.heat, `When visitors come (${tzl})`)
  if (hm) out.heatmap = hm
  if (by.realtime && by.realtime.ok) {
    const b = by.realtime.body
    const tot = b.totals && b.totals[0] && b.totals[0].metricValues ? num(b.totals[0].metricValues[0].value) : (b.rows || []).reduce((s, z) => s + (num(z.metricValues[0].value) || 0), 0)
    out.realtime = { users: tot || 0, pages: (b.rows || []).map((z) => ({ k: z.dimensionValues[0].value, v: num(z.metricValues[0].value) })) }
  }
  out.account = { name: cfg.siteName, handle: "Google Analytics 4", url: `https://analytics.google.com/analytics/web/#/p${String(cfg.ga4Property).replace(/^properties\//, "")}/reports/intelligenthome`, avatar: null, stats: [] }
  out.chartDefault = "activeUsers"

  // ----- what stands out -----
  const I = out.insights
  if (r.cstart && prev.activeUsers) {
    I.push({ tone: tone(cur.activeUsers, prev.activeUsers), title: `${nf(cur.activeUsers)} visitors`, text: `${cap(upDown(cur.activeUsers, prev.activeUsers))} (${nf(prev.activeUsers)}). They viewed ${nf(cur.screenPageViews)} pages.` })
  } else if (cur.activeUsers) I.push({ tone: "info", title: `${nf(cur.activeUsers)} visitors`, text: `They viewed ${nf(cur.screenPageViews)} pages in ${nf(cur.sessions)} visits.` })
  if (pages[0] && cur.screenPageViews) {
    const top = pages[0]
    I.push({ tone: "info", title: "Most read page", text: `${q(cleanTitle(top.title) || top.path)} had ${nf(top.views)} views, ${pc(top.views / cur.screenPageViews)} of all page views.` })
  }
  if (movers.length) {
    const g = movers.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff)[0]
    if (g && g.diff >= 10) I.push({ tone: "up", title: "Biggest climber", text: `${g.path} gained ${nf(g.diff)} views (${nf(g.before)} → ${nf(g.views)}). Share it again or link to it from related pages while it's hot.` })
    const l = movers.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff)[0]
    if (l && -l.diff >= 10) I.push({ tone: "down", title: "Biggest drop", text: `${l.path} lost ${nf(-l.diff)} views (${nf(l.before)} → ${nf(l.views)}). Check whether it slipped in Google (Search page) or a link to it stopped sending people.` })
  }
  const allSessions = channels.reduce((s, c) => s + (c.sessions || 0), 0)
  if (channels[0] && allSessions) I.push({ tone: "info", title: `Top channel: ${channels[0].k}`, text: `${pc(channels[0].sessions / allSessions)} of visits came from ${channels[0].k}${channels[1] ? `, then ${channels[1].k} (${pc(channels[1].sessions / allSessions)})` : ""}.` })
  const totalUsers = countries.reduce((s, c) => s + (c.users || 0), 0)
  if (countries[0] && totalUsers) I.push({ tone: "info", title: `Most visitors from ${countries[0].k}`, text: `${pc(countries[0].users / totalUsers)} of visitors${countries[1] ? `; next ${countries[1].k} (${pc(countries[1].users / totalUsers)})` : ""}.` })
  const dUsers = devices.reduce((s, d) => s + (d.users || 0), 0)
  const phone = devices.find((d) => d.raw === "mobile")
  if (phone && dUsers && phone.users / dUsers >= 0.5) I.push({ tone: "idea", title: `${pc(phone.users / dUsers)} on phones`, text: "Most visitors read on a phone: keep paragraphs short, buttons big and images light." })
  if (hm) {
    const p = peak(hm.grid)
    if (p) I.push({ tone: "idea", title: "Busiest time", text: `${DAYS[p.d]}s, ${hourText(p.h)} (${tzl}). Publish or share new posts an hour or two before that.` })
  }
  const ret = nvr.find((x) => x.k === "Returning")
  const nvrUsers = nvr.reduce((s, x) => s + (x.users || 0), 0)
  if (ret && nvrUsers) I.push({ tone: "info", title: `${pc(ret.users / nvrUsers)} came back`, text: `${nf(ret.users)} returning visitors. ${ret.users / nvrUsers < 0.2 ? "Most people visit once: an email sign-up or a “read next” link helps them come back." : "A healthy share of people return."}` })
}

// "Diwali crafts | Nestoodle" → "Diwali crafts"
function cleanTitle(t) {
  return String(t || "").replace(/\s+[|–—-]\s+[^|–—]{2,40}$/, "")
}

function visitsReport(out, by, r, cfg) {
  const { cur, prev } = gaTotals(by.totals)
  const D = gaDaily(by.daily)
  const C = r.cstart ? gaDaily(by.cdaily) : null
  const K = kpiMaker(out, cur, prev, D, C, r)
  K("sessions", "Sessions", { help: "A visit (session) starts when someone opens the site and ends after 30 minutes without activity." })
  K("engagedSessions", "Engaged visits", { help: "Visits that lasted 10+ seconds, saw 2+ pages, or did something." })
  K("engagementRate", "Engagement rate", { format: "percent", avg: true })
  K("averageSessionDuration", "Average visit length", { format: "duration", avg: true })
  K("screenPageViewsPerSession", "Pages per visit", { format: "decimal", avg: true })
  K("sessionsPerUser", "Sessions per visitor", { format: "decimal", avg: true })
  K("bounceRate", "Bounce rate", { format: "percent", invert: true, avg: true, help: "Visits that were not engaged. Lower is better." })
  K("keyEvents", "Key events", { help: "Actions marked as key events in GA4 (for example a sign-up)." })
  K("sessionKeyEventRate", "Visits with a key event", { format: "percent", avg: true })

  const vcols = (first) => [first, { key: "sessions", label: "Sessions", format: "number", bar: true }, { key: "eng", label: "Engaged", format: "percent" }, { key: "dur", label: "Avg. length", format: "duration" }, { key: "ppv", label: "Pages / visit", format: "decimal" }, { key: "key", label: "Key events", format: "number" }]
  const vrow = (x, extra) => ({ sessions: x.sessions, eng: x.engagementRate, dur: x.averageSessionDuration, ppv: x.screenPageViewsPerSession, bounce: x.bounceRate, key: x.keyEvents, ...extra })

  // Channels, with the change in visits.
  const ch = gaObjects(by.channels)
  const before = new Map(ch.prev.map((x) => [x.dims[0], x.sessions || 0]))
  const channels = ch.cur.map((x) => vrow(x, { k: x.dims[0], before: before.get(x.dims[0]) || 0, change: r.cstart ? (before.get(x.dims[0]) ? (x.sessions - before.get(x.dims[0])) / before.get(x.dims[0]) : "new") : null }))
  const chCols = vcols({ key: "k", label: "Channel", filter: "channel" })
  if (r.cstart) chCols.splice(2, 0, { key: "change", label: "Change", format: "change" })
  tb(out, "channels", "Visits by channel", chCols, channels, { kind: "table", wide: true, group: "Where visits come from" })
  tb(out, "social", "Social sites", vcols({ key: "k", label: "Site" }), gaObjects(by.social).cur.map((x) => vrow(x, { k: socialName(x.dims[0]) })), { kind: "table", group: "Where visits come from", emptyNote: "No visits from social sites in these dates." })
  tb(out, "sourceMedium", "Source / medium", vcols({ key: "k", label: "Source / medium" }), gaObjects(by.sourceMedium).cur.map((x) => vrow(x, { k: x.dims[0] })), { kind: "table", group: "Where visits come from" })
  const campaigns = gaObjects(by.campaigns).cur.filter((x) => !/^\((not set|direct|organic|referral|none)\)$/i.test(x.dims[0]))
  tb(out, "campaigns", "Campaigns (links with utm_campaign)", [{ key: "k", label: "Campaign" }, { key: "sessions", label: "Sessions", format: "number", bar: true }, { key: "eng", label: "Engaged", format: "percent" }, { key: "key", label: "Key events", format: "number" }], campaigns.map((x) => ({ k: x.dims[0], sessions: x.sessions, eng: x.engagementRate, key: x.keyEvents })), { kind: "table", group: "Where visits come from" })
  tb(out, "firstChannel", "How new visitors first found you", [{ key: "k", label: "First channel" }, { key: "newUsers", label: "New visitors", format: "number", bar: true }, { key: "users", label: "Visitors", format: "number" }], gaObjects(by.firstChannel).cur.map((x) => ({ k: x.dims[0], newUsers: x.newUsers, users: x.activeUsers })), { kind: "bars", group: "Where visits come from" })

  const landing = gaObjects(by.landing).cur.map((x) => vrow(x, { k: path(x.dims[0]) || "(not set)" }))
  const lcols = vcols({ key: "k", label: "First page of the visit" })
  lcols.splice(3, 0, { key: "bounce", label: "Bounce", format: "percent" })
  tb(out, "landing", "Landing pages", lcols, landing, { kind: "table", wide: true, link: cfg.site, group: "Landing pages" })

  const devices = gaObjects(by.devices).cur.map((x) => vrow(x, { k: DEV[x.dims[0]] || x.dims[0], raw: x.dims[0] }))
  tb(out, "devices", "Devices", vcols({ key: "k", label: "Device", filter: "device", filterKey: "raw" }), devices, { kind: "table", group: "Who visits" })
  const nvr = gaObjects(by.nvr).cur.map((x) => vrow(x, { k: NVR[x.dims[0]] || "(not set)" }))
  tb(out, "nvr", "New vs returning visitors", vcols({ key: "k", label: "Visitor" }), nvr, { kind: "table", group: "Who visits" })
  tb(out, "countries", "Countries", vcols({ key: "k", label: "Country", filter: "country" }), gaObjects(by.countries).cur.map((x) => vrow(x, { k: x.dims[0], code: x.dims[1] })), { kind: "table", group: "Who visits", countryCodes: true })
  const wd = gaObjects(by.weekday).cur.map((x) => ({ d: +x.dims[0], k: DAYS[+x.dims[0]], sessions: x.sessions, eng: x.engagementRate, dur: x.averageSessionDuration })).sort((a, b) => a.d - b.d)
  tb(out, "weekday", "Days of the week", [{ key: "k", label: "Day" }, { key: "sessions", label: "Sessions", format: "number", bar: true }, { key: "eng", label: "Engaged", format: "percent" }, { key: "dur", label: "Avg. length", format: "duration" }], wd, { kind: "bars", group: "When" })
  const hm = heat(by.heat, `Visits by day and hour (${tzLabel(by.heat && by.heat.ok ? by.heat : by.totals)})`)
  if (hm) out.heatmap = hm
  out.account = { name: cfg.siteName, handle: "Google Analytics 4 · visits", url: `https://analytics.google.com/analytics/web/#/p${String(cfg.ga4Property).replace(/^properties\//, "")}/reports/intelligenthome`, avatar: null, stats: [] }
  out.chartDefault = "sessions"

  // ----- what stands out -----
  const I = out.insights
  const minV = Math.max(10, Math.round((cur.sessions || 0) / 50))
  if (cur.sessions) {
    const t = r.cstart && prev.sessions ? upDown(cur.sessions, prev.sessions) : ""
    I.push({ tone: t ? tone(cur.sessions, prev.sessions) : "info", title: `${nf(cur.sessions)} visits`, text: `${t ? cap(t) + ". " : ""}${pc(cur.engagementRate)} were engaged; the average visit lasted ${secs(cur.averageSessionDuration)} and saw ${(cur.screenPageViewsPerSession || 0).toFixed(1)} pages.` })
  }
  if (r.cstart && prev.engagementRate && cur.engagementRate) {
    const dpts = (cur.engagementRate - prev.engagementRate) * 100
    if (Math.abs(dpts) >= 3) I.push({ tone: dpts > 0 ? "up" : "down", title: `Engagement ${dpts > 0 ? "up" : "down"} ${Math.abs(dpts).toFixed(0)} points`, text: `${pc(cur.engagementRate)} of visits were engaged, against ${pc(prev.engagementRate)} before.` })
  }
  const big = channels.filter((x) => x.sessions >= minV)
  if (big.length >= 2) {
    const best = [...big].sort((a, b) => b.eng - a.eng)[0]
    const worst = [...big].sort((a, b) => a.eng - b.eng)[0]
    if (best.eng - cur.engagementRate >= 0.05) I.push({ tone: "up", title: `${best.k} visits engage best`, text: `${pc(best.eng)} engaged against ${pc(cur.engagementRate)} overall (${nf(best.sessions)} visits). More of this traffic is worth chasing.` })
    if (cur.engagementRate - worst.eng >= 0.1 && worst.k !== best.k) I.push({ tone: "down", title: `${worst.k} visits leave quickly`, text: `Only ${pc(worst.eng)} engaged (${nf(worst.sessions)} visits). Check the pages those links land on: does the first screen match what the link promised?` })
  }
  const grow = channels.filter((x) => typeof x.change === "number" && x.sessions >= minV).sort((a, b) => b.sessions - b.before - (a.sessions - a.before))[0]
  if (grow && grow.sessions - grow.before >= 10 && grow.change >= 0.15) I.push({ tone: "up", title: `${grow.k} is growing`, text: `${nf(grow.before)} → ${nf(grow.sessions)} visits (+${Math.round(grow.change * 100)}%).` })
  const leaky = landing.filter((x) => x.sessions >= minV && x.bounce - (cur.bounceRate || 0) >= 0.15).sort((a, b) => b.sessions - a.sessions)[0]
  if (leaky) I.push({ tone: "idea", title: "A landing page loses people", text: `${leaky.k} gets ${nf(leaky.sessions)} visits but ${pc(leaky.bounce)} bounce (site average ${pc(cur.bounceRate)}). A clearer start, a related link near the top or a faster page usually helps.` })
  const soc = gaObjects(by.social).cur
  const socTotal = soc.reduce((s, x) => s + (x.sessions || 0), 0)
  if (socTotal) {
    const topS = soc[0]
    I.push({ tone: "info", title: `${nf(socTotal)} visits from social media`, text: `${pc(socTotal / (cur.sessions || socTotal))} of all visits; most from ${socialName(topS.dims[0])} (${nf(topS.sessions)}, ${pc(topS.engagementRate)} engaged).` })
  } else if (cur.sessions >= 50) I.push({ tone: "idea", title: "No visits from social media", text: "Add the website link to profiles, stories and captions (with utm_campaign tags) so these visits show up here." })
  const ret = nvr.find((x) => x.k === "Returning")
  const nw = nvr.find((x) => x.k === "New")
  if (ret && nw && ret.sessions >= minV && nw.sessions >= minV) I.push({ tone: "info", title: `Returning visitors ${ret.dur >= nw.dur ? "stay longer" : "leave sooner"}`, text: `Returning visits last ${secs(ret.dur)} on average against ${secs(nw.dur)} for new visitors, with ${(ret.ppv || 0).toFixed(1)} vs ${(nw.ppv || 0).toFixed(1)} pages per visit.` })
  if (wd.length >= 5) {
    const top = [...wd].sort((a, b) => b.sessions - a.sessions)[0]
    const low = [...wd].sort((a, b) => a.sessions - b.sessions)[0]
    if (top.sessions && low.sessions && top.sessions / low.sessions >= 1.3) I.push({ tone: "idea", title: `${top.k} is the busiest day`, text: `${nf(top.sessions)} visits against ${nf(low.sessions)} on ${low.k}. Publish new posts the day before or that morning.` })
  }
}

function socialName(s) {
  const x = String(s || "").toLowerCase()
  if (/(^|\.)(l\.)?(m\.)?(lm\.)?facebook|^fb$/.test(x)) return "Facebook"
  if (/instagram|^ig$/.test(x)) return "Instagram"
  if (/pinterest/.test(x)) return "Pinterest"
  if (/youtube/.test(x)) return "YouTube"
  if (/linkedin|lnkd/.test(x)) return "LinkedIn"
  if (/t\.co|twitter|^x\.com/.test(x)) return "X (Twitter)"
  if (/whatsapp|wa\.me/.test(x)) return "WhatsApp"
  if (/reddit/.test(x)) return "Reddit"
  if (/quora/.test(x)) return "Quora"
  if (/threads/.test(x)) return "Threads"
  return s || "(not set)"
}

// Rough share of searchers who click each Google position (web results). Only used to spot
// terms with a far lower click rate than their position usually gets.
const EXPECTED_CTR = [0, 0.27, 0.15, 0.1, 0.07, 0.055, 0.045, 0.035, 0.03, 0.025, 0.022]
const expected = (pos) => (pos <= 10 ? EXPECTED_CTR[Math.max(1, Math.round(pos))] : pos <= 20 ? 0.01 : 0.004)

function gscReport(out, by, r, cfg) {
  const list = (x) => (x && x.ok ? (x.body.rows || []).map((z) => ({ k: z.keys[0], k2: z.keys[1], clicks: z.clicks, impressions: z.impressions, ctr: z.ctr, position: z.position })) : null)
  const one = (x) => (x && x.ok && x.body.rows && x.body.rows[0] ? x.body.rows[0] : { clicks: 0, impressions: 0, ctr: 0, position: null })
  const cur = one(by.totals)
  const prev = r.cstart ? one(by.ctotals) : null
  const D = list(by.daily) || []
  const C = r.cstart ? list(by.cdaily) || [] : null
  const S = (rows, k) => (rows ? rows.map((x) => ({ d: x.k, v: x[k] })) : null)
  const kpi = (key, labelText, value, pv, o) => out.kpis.push({ key, label: labelText, value: num(value), prev: pv === undefined || pv === null ? null : num(pv), format: "number", ...o })
  kpi("clicks", "Clicks", cur.clicks, prev ? prev.clicks : null, { series: S(D, "clicks"), cseries: S(C, "clicks"), help: "Clicks from Google results to your site." })
  kpi("impressions", "Impressions", cur.impressions, prev ? prev.impressions : null, { series: S(D, "impressions"), cseries: S(C, "impressions"), help: "Times your site appeared in Google results." })
  kpi("ctr", "Click rate", cur.ctr, prev ? prev.ctr : null, { format: "percent", avg: true, series: S(D, "ctr"), cseries: S(C, "ctr") })
  if (cur.position) kpi("position", "Average position", Math.round(cur.position * 10) / 10, prev && prev.position ? Math.round(prev.position * 10) / 10 : null, { format: "decimal", invert: true, avg: true, series: S(D, "position"), cseries: S(C, "position"), help: "Average rank in Google results. Lower is better: 1 is the top result." })

  const queries = list(by.queries) || []
  const cq = r.cstart ? list(by.cqueries) : null
  kpi("terms", "Search terms", queries.filter((x) => x.impressions > 0).length, cq ? cq.filter((x) => x.impressions > 0).length : null, { help: "Different searches your site appeared for (up to 1,000 counted)." })
  kpi("top10", "Terms on page 1", queries.filter((x) => x.position <= 10.5).length, cq ? cq.filter((x) => x.position <= 10.5).length : null, { help: "Searches where your site's average position is in the top 10." })

  const cols = (first) => [first, { key: "clicks", label: "Clicks", format: "number", bar: true }, { key: "impressions", label: "Impressions", format: "number" }, { key: "ctr", label: "Click rate", format: "percent" }, { key: "position", label: "Position", format: "decimal" }]
  const host = new RegExp(`^https?://(www\\.)?${String(cfg.site || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
  const short = (u) => String(u || "").replace(host, "") || "/"
  tb(out, "queries", "Search terms", cols({ key: "k", label: "Search term" }), queries.slice(0, 300), { kind: "table", wide: true, group: "Searches", emptyNote: "Google hides search terms until enough people search them, to protect privacy." })
  const pages = (list(by.pages) || []).map((z) => ({ ...z, url: z.k, k: short(z.k) }))
  tb(out, "pages", "Pages in Google", cols({ key: "k", label: "Page", link: "url" }), pages.slice(0, 300), { kind: "table", wide: true, group: "Searches" })

  // Quick wins.
  const minImp = Math.max(20, Math.round((cur.impressions || 0) / 500))
  const page2 = queries.filter((x) => x.position > 10.5 && x.position <= 20 && x.impressions >= minImp).sort((a, b) => b.impressions - a.impressions).slice(0, 40)
  const near = queries.filter((x) => x.position > 3.5 && x.position <= 10.5 && x.impressions >= minImp).sort((a, b) => b.impressions - a.impressions).slice(0, 40)
  const lowCtr = queries.filter((x) => x.impressions >= minImp * 2 && x.position <= 15 && x.ctr < expected(x.position) * 0.5).sort((a, b) => b.impressions - a.impressions).slice(0, 40).map((x) => ({ ...x, exp: expected(x.position) }))
  tb(out, "page2", "Almost on page 1 (positions 11–20)", cols({ key: "k", label: "Search term" }), page2, { kind: "table", group: "Quick wins", note: "Improve the page that ranks: answer the search fully, add a section for it, link to it from related posts." })
  tb(out, "near", "Close to the top 3 (positions 4–10)", cols({ key: "k", label: "Search term" }), near, { kind: "table", group: "Quick wins", note: "A small push moves these up, and the top 3 get most of the clicks." })
  tb(out, "lowCtr", "Shown a lot, clicked little", [...cols({ key: "k", label: "Search term" }), { key: "exp", label: "Usual click rate", format: "percent" }], lowCtr, { kind: "table", wide: true, group: "Quick wins", note: "Seen often but rarely clicked for their position: rewrite the page title and meta description so they promise exactly what was searched." })

  // Which page ranks for each search, and searches where several pages compete.
  const qp = list(by.queryPage) || []
  const byQ = new Map()
  for (const x of qp) {
    if (!byQ.has(x.k)) byQ.set(x.k, [])
    byQ.get(x.k).push(x)
  }
  const compete = [...byQ.entries()]
    .map(([k, xs]) => ({ k, pages: xs.filter((x) => x.impressions >= 5), impressions: xs.reduce((s, x) => s + x.impressions, 0), clicks: xs.reduce((s, x) => s + x.clicks, 0) }))
    .filter((x) => x.pages.length >= 2 && x.impressions >= minImp)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25)
    .map((x) => ({ k: x.k, n: x.pages.length, clicks: x.clicks, impressions: x.impressions, list: x.pages.sort((a, b) => b.impressions - a.impressions).map((p) => short(p.k2)).slice(0, 3).join(" · ") }))
  tb(out, "queryPage", "Search term → page", [{ key: "k", label: "Search term", sub: "page" }, { key: "clicks", label: "Clicks", format: "number", bar: true }, { key: "impressions", label: "Impressions", format: "number" }, { key: "ctr", label: "Click rate", format: "percent" }, { key: "position", label: "Position", format: "decimal" }], qp.slice(0, 300).map((x) => ({ ...x, page: short(x.k2) })), { kind: "table", wide: true, group: "Pages and searches" })
  tb(out, "compete", "Searches where several of your pages compete", [{ key: "k", label: "Search term", sub: "list" }, { key: "n", label: "Pages", format: "number" }, { key: "impressions", label: "Impressions", format: "number", bar: true }, { key: "clicks", label: "Clicks", format: "number" }], compete, { kind: "table", wide: true, group: "Pages and searches", note: "Google splits these between pages. Make one page the main answer and link the others to it." })

  // Rising and falling, against the earlier period.
  let rising = []
  let falling = []
  let fresh = []
  if (cq) {
    const was = new Map(cq.map((x) => [x.k, x]))
    const minC = 3
    const mv = queries.map((x) => {
      const b = was.get(x.k)
      return { k: x.k, clicks: x.clicks, before: b ? b.clicks : 0, impressions: x.impressions, position: x.position, posBefore: b ? b.position : null, diff: x.clicks - (b ? b.clicks : 0), change: b && b.clicks ? (x.clicks - b.clicks) / b.clicks : x.clicks ? "new" : null }
    })
    const seen = new Set(queries.map((x) => x.k))
    const gone = cq.filter((x) => !seen.has(x.k)).map((b) => ({ k: b.k, clicks: 0, before: b.clicks, impressions: 0, position: null, posBefore: b.position, diff: -b.clicks, change: b.clicks ? -1 : null }))
    rising = mv.filter((x) => x.diff >= minC).sort((a, b) => b.diff - a.diff).slice(0, 30)
    falling = [...mv, ...gone].filter((x) => x.diff <= -minC).sort((a, b) => a.diff - b.diff).slice(0, 30)
    fresh = queries.filter((x) => !was.has(x.k) && x.impressions >= minImp).sort((a, b) => b.impressions - a.impressions).slice(0, 30)
    const mcols = [{ key: "k", label: "Search term" }, { key: "clicks", label: "Clicks now", format: "number", bar: true }, { key: "before", label: "Before", format: "number" }, { key: "change", label: "Change", format: "change" }, { key: "position", label: "Position", format: "decimal" }, { key: "posBefore", label: "Before", format: "decimal" }]
    tb(out, "rising", "Rising searches", mcols, rising, { kind: "table", wide: true, group: "Changes" })
    tb(out, "falling", "Falling searches", mcols, falling, { kind: "table", wide: true, group: "Changes" })
    tb(out, "fresh", "New searches you now show up for", cols({ key: "k", label: "Search term" }), fresh, { kind: "table", group: "Changes" })
    const cp = list(by.cpages)
    if (cp) {
      const pw = new Map(cp.map((x) => [x.k, x.clicks]))
      const pm = pages.map((x) => ({ k: x.k, url: x.url, clicks: x.clicks, before: pw.get(x.url) || 0 })).map((x) => ({ ...x, diff: x.clicks - x.before, change: x.before ? (x.clicks - x.before) / x.before : x.clicks ? "new" : null }))
      const pcols = [{ key: "k", label: "Page", link: "url" }, { key: "clicks", label: "Clicks now", format: "number", bar: true }, { key: "before", label: "Before", format: "number" }, { key: "change", label: "Change", format: "change" }]
      tb(out, "pagesUp", "Pages gaining clicks", pcols, pm.filter((x) => x.diff >= 3).sort((a, b) => b.diff - a.diff).slice(0, 25), { kind: "table", group: "Changes" })
      tb(out, "pagesDown", "Pages losing clicks", pcols, pm.filter((x) => x.diff <= -3).sort((a, b) => a.diff - b.diff).slice(0, 25), { kind: "table", group: "Changes" })
    }
  }

  const countries = (list(by.countries) || []).map((z) => ({ ...z, code: z.k, k: z.k.toUpperCase() }))
  tb(out, "countries", "Countries", cols({ key: "k", label: "Country", filter: "country", filterKey: "code" }), countries, { kind: "table", group: "Audience", countryCodes3: true })
  const devices = (list(by.devices) || []).map((z) => ({ ...z, raw: z.k, k: DEV[z.k] || z.k }))
  tb(out, "devices", "Devices", cols({ key: "k", label: "Device", filter: "device", filterKey: "raw" }), devices, { kind: "share", group: "Audience" })
  const ap = list(by.appearance) || []
  tb(out, "appearance", "Search appearance", cols({ key: "k", label: "Appearance" }), ap.map((z) => ({ ...z, k: z.k.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) })), { kind: "table", group: "Audience" })

  // Searches for the brand's own name.
  const brand = (cfg.brand || []).map((b) => String(b).toLowerCase().replace(/\s+/g, ""))
  const isBrand = (k) => brand.some((b) => b && String(k).toLowerCase().replace(/\s+/g, "").includes(b))
  const brandClicks = queries.filter((x) => isBrand(x.k)).reduce((s, x) => s + x.clicks, 0)
  const listedClicks = queries.reduce((s, x) => s + x.clicks, 0)

  out.account = { name: cfg.siteName, handle: "Google Search Console", url: "https://search.google.com/search-console?resource_id=" + encodeURIComponent(cfg.gscSite), avatar: null, stats: [] }
  out.notes.push("Search Console numbers take 2–3 days to settle; the latest days may still grow.")
  out.chartDefault = "clicks"

  // ----- what stands out -----
  const I = out.insights
  if (cur.impressions) {
    const t = prev && prev.clicks ? upDown(cur.clicks, prev.clicks) : ""
    I.push({ tone: t ? tone(cur.clicks, prev.clicks) : "info", title: `${nf(cur.clicks)} clicks from Google`, text: `${t ? cap(t) + ". " : ""}Your pages were shown ${nf(cur.impressions)} times at an average position of ${(cur.position || 0).toFixed(1)}.` })
  }
  if (page2.length) I.push({ tone: "idea", title: `${page2.length} searches almost on page 1`, text: `Together shown ${nf(page2.reduce((s, x) => s + x.impressions, 0))} times from page 2, e.g. ${q(page2[0].k)} (position ${page2[0].position.toFixed(1)}). Strengthening those pages is the quickest way to more clicks. See “Quick wins”.` })
  if (lowCtr.length) I.push({ tone: "idea", title: "Titles to rewrite", text: `${q(lowCtr[0].k)} was shown ${nf(lowCtr[0].impressions)} times at position ${lowCtr[0].position.toFixed(1)} but only ${pc(lowCtr[0].ctr)} clicked (usually about ${pc(lowCtr[0].exp)}). ${lowCtr.length > 1 ? `${lowCtr.length - 1} more like it in “Shown a lot, clicked little”.` : ""}`.trim() })
  if (rising[0]) I.push({ tone: "up", title: "Rising search", text: `${q(rising[0].k)}: ${nf(rising[0].before)} → ${nf(rising[0].clicks)} clicks.` })
  if (falling[0]) I.push({ tone: "down", title: "Falling search", text: `${q(falling[0].k)}: ${nf(falling[0].before)} → ${nf(falling[0].clicks)} clicks${falling[0].position && falling[0].posBefore ? ` (position ${falling[0].posBefore.toFixed(1)} → ${falling[0].position.toFixed(1)})` : ""}.` })
  if (fresh.length) I.push({ tone: "up", title: `${fresh.length} new searches`, text: `Your site started showing for searches like ${q(fresh[0].k)}${fresh[1] ? ` and ${q(fresh[1].k)}` : ""}.` })
  if (compete[0]) I.push({ tone: "idea", title: "Pages competing with each other", text: `For ${q(compete[0].k)}, ${compete[0].n} of your pages show up. Pick one main page for it and link the others there.` })
  if (brand.length && listedClicks >= 20) I.push({ tone: "info", title: `${pc(brandClicks / listedClicks)} of clicks are for your name`, text: brandClicks / listedClicks > 0.5 ? "Most Google visitors already know you. Articles that answer common questions bring new people." : "Most Google visitors found you through topics, not your name: new people are discovering the site." })
  const dClicks = devices.reduce((s, x) => s + x.clicks, 0)
  const ph = devices.find((x) => x.raw === "MOBILE")
  if (ph && dClicks >= 20) I.push({ tone: "info", title: `${pc(ph.clicks / dClicks)} of search clicks on phones`, text: `Phones click at ${pc(ph.ctr)}${devices.find((x) => x.raw === "DESKTOP") ? `, computers at ${pc(devices.find((x) => x.raw === "DESKTOP").ctr)}` : ""}.` })
}
