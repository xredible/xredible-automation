// lib/insights/adsense.js
//
// The "Ad earnings" (adsense) section for any dashboard: AdSense Management API v2 reports
// → a dashboard section, with "What stands out" notes worked out from the numbers.
// Plain JavaScript with no imports. The calls go out through n8n (XD-GF) with the business's Google login.
//
// adsRequests(P, accounts, cfg): P = { start, end, cstart, cend, f: { country } } (the Ads Plan
//   node), accounts = the answer of GET https://adsense.googleapis.com/v2/accounts.
//   Returns [{ key, url, account }] (one GET per report).
// adsReport(P, reqs, answers, cfg): the section.
//
// cfg: { site: "https://nestoodle.com", siteName: "nestoodle.com", setup: "how to connect AdSense" }

function adsAnswer(a) {
  if (!a) return { ok: false, error: "No answer" }
  const status = "statusCode" in a ? Number(a.statusCode) : 200
  const body = "statusCode" in a ? a.body : a
  const e = body && body.error
  if (e || status < 200 || status >= 300 || !body) return { ok: false, status, error: String(!e ? `HTTP ${status}` : e.message || e.status || JSON.stringify(e)).slice(0, 300) }
  return { ok: true, status, body }
}

export function adsRequests(P, accounts) {
  const r = adsAnswer(accounts)
  const list = (r.ok && r.body.accounts) || []
  const account = list.find((a) => a.state === "READY") || list[0] || null
  if (!account) return [{ key: "none", url: "https://adsense.googleapis.com/v2/accounts", account: null, status: r.status || null, err: r.ok ? "" : r.error }]
  const dt = (p, d) => `${p}.year=${+d.slice(0, 4)}&${p}.month=${+d.slice(5, 7)}&${p}.day=${+d.slice(8, 10)}`
  const range = (s, e) => `dateRange=CUSTOM&${dt("startDate", s)}&${dt("endDate", e)}`
  const ms = (l) => l.map((m) => "metrics=" + m).join("&")
  const ds = (l) => l.map((d) => "dimensions=" + d).join("&")
  const base = `https://adsense.googleapis.com/v2/${account.name}/reports:generate?`
  const flt = P.f && P.f.country ? "&filters=" + encodeURIComponent("COUNTRY_CODE==" + P.f.country) : ""
  const M = ["ESTIMATED_EARNINGS", "PAGE_VIEWS", "PAGE_VIEWS_RPM", "IMPRESSIONS", "IMPRESSIONS_RPM", "CLICKS", "PAGE_VIEWS_CTR", "COST_PER_CLICK", "ACTIVE_VIEW_VIEWABILITY", "AD_REQUESTS_COVERAGE"]
  const ask = (dims, metrics, extra = "", s = P.start, e = P.end, f = flt) => base + range(s, e) + (dims.length ? "&" + ds(dims) : "") + "&" + ms(metrics) + extra + f
  const reqs = [
    ["daily", ask(["DATE"], M)],
    ["totals", ask([], M)],
    ["pages", ask(["PAGE_URL"], ["ESTIMATED_EARNINGS", "PAGE_VIEWS", "PAGE_VIEWS_RPM", "IMPRESSIONS", "CLICKS"], "&orderBy=-ESTIMATED_EARNINGS&limit=100")],
    ["countries", ask(["COUNTRY_CODE", "COUNTRY_NAME"], ["ESTIMATED_EARNINGS", "PAGE_VIEWS", "PAGE_VIEWS_RPM"], "&orderBy=-ESTIMATED_EARNINGS&limit=50", P.start, P.end, "")],
    ["devices", ask(["PLATFORM_TYPE_NAME"], ["ESTIMATED_EARNINGS", "PAGE_VIEWS", "PAGE_VIEWS_RPM", "PAGE_VIEWS_CTR"], "&orderBy=-ESTIMATED_EARNINGS")],
    ["units", ask(["AD_UNIT_NAME"], ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSIONS_RPM", "CLICKS", "ACTIVE_VIEW_VIEWABILITY"], "&orderBy=-ESTIMATED_EARNINGS&limit=50")],
    ["formats", ask(["AD_FORMAT_NAME"], ["ESTIMATED_EARNINGS", "IMPRESSIONS", "IMPRESSIONS_RPM", "CLICKS"], "&orderBy=-ESTIMATED_EARNINGS&limit=20")],
    ["weekday", ask(["DATE"], ["ESTIMATED_EARNINGS", "PAGE_VIEWS"])],
  ]
  if (P.cstart) {
    reqs.push(["cdaily", ask(["DATE"], M, "", P.cstart, P.cend)])
    reqs.push(["ctotals", ask([], M, "", P.cstart, P.cend)])
    reqs.push(["cpages", ask(["PAGE_URL"], ["ESTIMATED_EARNINGS", "PAGE_VIEWS"], "&orderBy=-ESTIMATED_EARNINGS&limit=200", P.cstart, P.cend)])
  }
  // "weekday" reuses the daily numbers; no need to ask twice.
  return reqs.filter(([key]) => key !== "weekday").map(([key, url]) => ({ key, url, account: { name: account.name, displayName: account.displayName || "", timeZone: (account.timeZone && account.timeZone.id) || "" } }))
}

export function adsReport(P, reqs, answers, cfg) {
  const out = { ok: true, section: "adsense", range: { start: P.start, end: P.end, cstart: P.cstart, cend: P.cend, days: P.days, cmp: P.cmp }, filters: P.f || {}, generatedAt: new Date().toISOString(), account: null, kpis: [], tables: [], items: null, notes: [], errors: [], insights: [] }
  const SETUP = cfg.setup || "AdSense isn't connected yet. Once Google approves the site, connect AdSense and the earnings show up here."
  if (!reqs.length || reqs[0].key === "none") {
    const e = reqs[0] || {}
    if (e.err && !/insufficient|scope|permission|not been used|disabled|credentials/i.test(e.err) && e.status !== 401 && e.status !== 403) out.errors.push({ what: "AdSense", error: e.err })
    out.notes.push(e.status === 200 ? `This Google account has no AdSense account yet. Apply at adsense.google.com with ${cfg.siteName}; earnings show up here once it's approved.` : SETUP)
    return out
  }
  const by = {}
  reqs.forEach((q, i) => (by[q.key] = adsAnswer(answers[i])))
  const num = (v) => (v === undefined || v === null || v === "" || isNaN(Number(v)) ? null : Number(v))
  const parse = (r) => {
    if (!r || !r.ok) return null
    const h = (r.body.headers || []).map((x) => x.name)
    const cur = ((r.body.headers || []).find((x) => x.type === "METRIC_CURRENCY") || {}).currencyCode || ""
    const obj = (cells) => Object.fromEntries(h.map((n, i) => [n, ((cells || [])[i] || {}).value]))
    return { rows: (r.body.rows || []).map((x) => obj(x.cells)), totals: r.body.totals ? obj(r.body.totals.cells) : r.body.rows && r.body.rows[0] && !h.some((n) => n === "DATE") ? obj(r.body.rows[0].cells) : {}, currency: cur }
  }
  const acc = reqs[0].account
  out.account = { name: "Google AdSense", handle: acc.name.replace("accounts/", ""), url: "https://adsense.google.com/", avatar: null, stats: [] }
  const cur = parse(by.daily)
  const prev = parse(by.cdaily)
  if (!cur) {
    out.errors.push({ what: "AdSense report", error: String(by.daily ? by.daily.error : "No answer").slice(0, 300) })
    return out
  }
  const tot = parse(by.totals)
  const ctot = parse(by.ctotals)
  const money = cur.currency === "INR" ? "inr" : cur.currency === "USD" ? "usd" : "decimal"
  const sym = money === "inr" ? "₹" : money === "usd" ? "$" : ""
  const m = (v) => `${sym}${(Number(v) || 0).toFixed(2)}${money === "decimal" && cur.currency ? " " + cur.currency : ""}`
  if (money === "decimal" && cur.currency) out.notes.push("Amounts are in " + cur.currency + ".")
  const S = (rep, k) => (rep ? rep.rows.map((x) => ({ d: x.DATE, v: num(x[k]) })) : null)
  // The totals row works ratio metrics (RPM, CTR, CPC) out over the whole period.
  const T = (rep, alt, k) => {
    const a = rep && num(rep.totals[k])
    return a !== null && a !== undefined ? a : alt ? num(alt.totals[k]) : null
  }
  const kpi = (key, labelText, k, format, o = {}) => {
    const v = T(tot, cur, k)
    if (v === null) return
    out.kpis.push({ key, label: labelText, value: v, prev: P.cstart ? T(ctot, prev, k) : null, format, series: S(cur, k), cseries: S(prev, k), ...o })
  }
  kpi("earnings", "Estimated earnings", "ESTIMATED_EARNINGS", money, { help: "What AdSense estimates you earned. The final amount is confirmed at the end of each month." })
  kpi("rpm", "Page RPM", "PAGE_VIEWS_RPM", money, { avg: true, help: "Earnings per 1,000 page views. The best single number for comparing months." })
  kpi("pageViews", "Page views with ads", "PAGE_VIEWS", "number", { help: "Page views AdSense counted (pages where its code loaded)." })
  kpi("impressions", "Ad impressions", "IMPRESSIONS", "number")
  kpi("irpm", "Impression RPM", "IMPRESSIONS_RPM", money, { avg: true, help: "Earnings per 1,000 ads shown." })
  kpi("clicks", "Ad clicks", "CLICKS", "number", { help: "Never click your own ads, or ask anyone to: Google can close the account for it." })
  kpi("ctr", "Page CTR", "PAGE_VIEWS_CTR", "percent", { avg: true })
  kpi("cpc", "Cost per click", "COST_PER_CLICK", money, { avg: true })
  kpi("viewability", "Viewable ads", "ACTIVE_VIEW_VIEWABILITY", "percent", { avg: true, help: "Ads that were actually on screen long enough to count as seen. Advertisers pay more for viewable ads." })
  kpi("coverage", "Ad coverage", "AD_REQUESTS_COVERAGE", "percent", { avg: true, help: "Ad requests that got an ad. Low coverage means empty ad spaces." })

  const table = (key, title, columns, rows, o = {}) => {
    if (rows.length) out.tables.push({ key, title, columns, rows, ...o })
  }
  const cols = (first) => [first, { key: "earnings", label: "Earnings", format: money, bar: true }, { key: "views", label: "Page views", format: "number" }, { key: "rpm", label: "Page RPM", format: money }]
  const row = (x, k, extra = {}) => ({ k, earnings: num(x.ESTIMATED_EARNINGS), views: num(x.PAGE_VIEWS), rpm: num(x.PAGE_VIEWS_RPM), ...extra })
  const has = (x) => x.earnings || x.views || x.impressions
  const host = new RegExp(`^https?://(www\\.)?${String(cfg.site || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i")
  const short = (u) => String(u || "").replace(host, "") || "/"
  const pages = parse(by.pages)
  const pageRows = pages ? pages.rows.map((x) => row(x, short(x.PAGE_URL), { url: x.PAGE_URL, clicks: num(x.CLICKS) })).filter(has) : []
  table("pages", "Top earning pages", cols({ key: "k", label: "Page", link: "url" }), pageRows, { kind: "table", wide: true, group: "Pages" })
  const minViews = Math.max(50, Math.round((T(tot, cur, "PAGE_VIEWS") || 0) / 200))
  const rpmPages = pageRows.filter((x) => x.views >= minViews).sort((a, b) => b.rpm - a.rpm)
  table("rpmPages", "Best paying pages (per 1,000 views)", cols({ key: "k", label: "Page", link: "url" }), rpmPages.slice(0, 25), { kind: "table", group: "Pages", note: `Pages with at least ${minViews} views, by Page RPM. Topics like these pay best: write more of them.` })
  const cp = parse(by.cpages)
  let movers = []
  if (cp) {
    const was = new Map(cp.rows.map((x) => [x.PAGE_URL, num(x.ESTIMATED_EARNINGS) || 0]))
    movers = pageRows.map((x) => ({ k: x.k, url: x.url, earnings: x.earnings, before: was.get(x.url) || 0 })).map((x) => ({ ...x, diff: x.earnings - x.before, change: x.before ? (x.earnings - x.before) / x.before : x.earnings ? "new" : null }))
    const mcols = [{ key: "k", label: "Page", link: "url" }, { key: "earnings", label: "Earnings now", format: money, bar: true }, { key: "before", label: "Before", format: money }, { key: "change", label: "Change", format: "change" }]
    table("pagesUp", "Pages earning more", mcols, movers.filter((x) => x.diff > 0).sort((a, b) => b.diff - a.diff).slice(0, 20), { kind: "table", group: "Pages" })
    table("pagesDown", "Pages earning less", mcols, movers.filter((x) => x.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 20), { kind: "table", group: "Pages" })
  }
  const countries = parse(by.countries)
  const cRows = countries ? countries.rows.map((x) => row(x, x.COUNTRY_NAME || x.COUNTRY_CODE, { code: x.COUNTRY_CODE })).filter(has) : []
  table("countries", "Countries", cols({ key: "k", label: "Country", filter: "country", filterKey: "code" }), cRows, { kind: "table", group: "Audience", countryCodes: true })
  const DEV = { "High-end mobile devices": "Phone", Desktop: "Computer", Tablets: "Tablet", "Other devices": "Other" }
  const devices = parse(by.devices)
  const dRows = devices ? devices.rows.map((x) => row(x, DEV[x.PLATFORM_TYPE_NAME] || x.PLATFORM_TYPE_NAME, { ctr: num(x.PAGE_VIEWS_CTR) })).filter(has) : []
  table("devices", "Devices", [...cols({ key: "k", label: "Device" }), { key: "ctr", label: "Page CTR", format: "percent" }], dRows, { kind: "table", group: "Audience" })
  const ucols = (first) => [first, { key: "earnings", label: "Earnings", format: money, bar: true }, { key: "impressions", label: "Ads shown", format: "number" }, { key: "irpm", label: "Impression RPM", format: money }, { key: "clicks", label: "Clicks", format: "number" }]
  const units = parse(by.units)
  table("units", "Ad units", [...ucols({ key: "k", label: "Ad unit" }), { key: "view", label: "Viewable", format: "percent" }], units ? units.rows.map((x) => ({ k: x.AD_UNIT_NAME || "(auto ads)", earnings: num(x.ESTIMATED_EARNINGS), impressions: num(x.IMPRESSIONS), irpm: num(x.IMPRESSIONS_RPM), clicks: num(x.CLICKS), view: num(x.ACTIVE_VIEW_VIEWABILITY) })).filter(has) : [], { kind: "table", group: "Ads" })
  const formats = parse(by.formats)
  const fRows = formats ? formats.rows.map((x) => ({ k: x.AD_FORMAT_NAME || "(not set)", earnings: num(x.ESTIMATED_EARNINGS), impressions: num(x.IMPRESSIONS), irpm: num(x.IMPRESSIONS_RPM), clicks: num(x.CLICKS) })).filter(has) : []
  table("formats", "Ad formats", ucols({ key: "k", label: "Format" }), fRows, { kind: "table", group: "Ads", note: "Auto ads formats (anchor, vignette, in-page…) and their earnings." })
  // Days of the week, from the daily rows.
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const wd = DAYS.map((k) => ({ k, earnings: 0, views: 0 }))
  for (const x of cur.rows) {
    const d = new Date(x.DATE + "T12:00:00Z").getUTCDay()
    wd[d].earnings += num(x.ESTIMATED_EARNINGS) || 0
    wd[d].views += num(x.PAGE_VIEWS) || 0
  }
  for (const x of wd) x.rpm = x.views ? (x.earnings / x.views) * 1000 : null
  if (cur.rows.length >= 14) table("weekday", "Days of the week", cols({ key: "k", label: "Day" }), wd, { kind: "bars", group: "Audience" })
  for (const [k, what] of [["pages", "Top pages"], ["countries", "Countries"], ["devices", "Devices"], ["units", "Ad units"], ["formats", "Ad formats"]]) if (by[k] && !by[k].ok) out.errors.push({ what, error: by[k].error })
  if (P.cstart && !prev) out.notes.push("No comparison: AdSense didn't answer for the earlier period.")
  if (!cur.rows.length) out.notes.push("No ad earnings in these dates yet. Ads start earning once AdSense has approved the site and the ad code is live.")
  out.notes.push("The last two days are estimates and can still change. AdSense confirms each month's total in the first days of the next month.")
  out.chartDefault = "earnings"

  // ----- what stands out -----
  const I = out.insights
  const e = T(tot, cur, "ESTIMATED_EARNINGS") || 0
  const pe = P.cstart ? T(ctot, prev, "ESTIMATED_EARNINGS") : null
  if (cur.rows.length) {
    const x = pe ? (e - pe) / pe : null
    I.push({ tone: x === null ? "info" : x >= 0.03 ? "up" : x <= -0.03 ? "down" : "info", title: `${m(e)} earned`, text: `${x === null ? "" : Math.abs(x) < 0.03 ? "About the same as the period before. " : `${x > 0 ? "Up" : "Down"} ${Math.round(Math.abs(x) * 100)}% on the period before (${m(pe)}). `}Page RPM ${m(T(tot, cur, "PAGE_VIEWS_RPM"))}: what every 1,000 page views earn.` })
  }
  if (rpmPages[0] && rpmPages.length >= 3) I.push({ tone: "idea", title: "Best paying topic", text: `${rpmPages[0].k} earns ${m(rpmPages[0].rpm)} per 1,000 views, against ${m(T(tot, cur, "PAGE_VIEWS_RPM"))} for the site. More articles on that topic (and links to it) pay off.` })
  if (pageRows[0] && e) I.push({ tone: "info", title: "Top earning page", text: `${pageRows[0].k} brought ${m(pageRows[0].earnings)} (${Math.round((pageRows[0].earnings / e) * 100)}% of earnings).` })
  if (cRows.length >= 2 && e) {
    const best = cRows.filter((x) => x.views >= minViews).sort((a, b) => b.rpm - a.rpm)[0]
    if (best) I.push({ tone: "info", title: `${best.k} pays the most per view`, text: `Page RPM ${m(best.rpm)} from ${best.k}; ${cRows[0].k} brings the most in total (${m(cRows[0].earnings)}).` })
  }
  const v = T(tot, cur, "ACTIVE_VIEW_VIEWABILITY")
  if (v !== null && v > 0 && v < 0.5) I.push({ tone: "idea", title: `Only ${Math.round(v * 100)}% of ads are seen`, text: "Advertisers pay more for ads people actually see. Fewer ads at the very bottom of long pages, and ads near the content people read, raise this." })
  const cov = T(tot, cur, "AD_REQUESTS_COVERAGE")
  if (cov !== null && cov > 0 && cov < 0.6) I.push({ tone: "idea", title: `${Math.round(cov * 100)}% ad coverage`, text: "Many ad spaces stay empty. That's common for new sites; it improves as traffic and history grow." })
  const ph = dRows.find((x) => x.k === "Phone")
  const pc = dRows.find((x) => x.k === "Computer")
  if (ph && pc && ph.views >= minViews && pc.views >= minViews && ph.rpm && pc.rpm) I.push({ tone: "info", title: ph.rpm >= pc.rpm ? "Phones pay more per view" : "Computers pay more per view", text: `Page RPM ${m(ph.rpm)} on phones, ${m(pc.rpm)} on computers.` })
  return out
}
