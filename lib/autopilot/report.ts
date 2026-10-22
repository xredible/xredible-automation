// lib/autopilot/report.ts
//
// Server-only. The "autopilot" business of the dashboard: a customer's own automations,
// shown with the same Overview / Content calendar / report pages as the client businesses.
// n8n isn't involved here: the queue comes from the Autopilot data tables, and the numbers
// from the customer's connected Instagram / Facebook (Graph API) and our own newsletter events.

import type { Column, ItemRow, Kpi, Point, QueueData, QueueItem, Range, SectionData, ToolSummary } from "@/lib/dashboard/types"
import { rows } from "./db"
import { open } from "./crypto"
import { graph } from "./meta"
import { postUrl } from "./linkedin"
import { postsFor, subsFor } from "./service"
import { cardUrl, channelFor, contactsFor, TOOL_KEYS, type Channel, type Item } from "./tools"
import { canPublish, lapsed, PRODUCTS, remaining } from "./products"

type Result = { status: number; body: unknown }

// ---------- dates ----------

const DAY = 864e5
const ymd = (t: number) => new Date(t).toISOString().slice(0, 10)
const istDay = (iso: string | null | undefined) => (iso ? ymd(Date.parse(iso) + 330 * 60_000) : "")
const addD = (d: string, n: number) => ymd(Date.parse(d + "T00:00:00Z") + n * DAY)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY) + 1

function range(search: URLSearchParams): Range {
  const today = istDay(new Date().toISOString())
  const okDate = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const end = okDate(search.get("end")) || today
  const start = okDate(search.get("start")) || addD(end, -27)
  const cmp = ["prev", "yoy", "none"].includes(String(search.get("cmp"))) ? String(search.get("cmp")) : "prev"
  const n = days(start, end)
  let cstart: string | null = null
  let cend: string | null = null
  if (cmp === "prev") {
    cend = addD(start, -1)
    cstart = addD(cend, -(n - 1))
  } else if (cmp === "yoy") {
    cstart = `${Number(start.slice(0, 4)) - 1}${start.slice(4)}`
    cend = `${Number(end.slice(0, 4)) - 1}${end.slice(4)}`
  }
  return { start, end, cstart, cend, days: n, cmp }
}

const inRange = (d: string, a: string | null, b: string | null) => !!a && !!b && d >= a && d <= b

/** Daily counts → a series covering every day of the range. */
function series(map: Map<string, number>, a: string, b: string): Point[] {
  const out: Point[] = []
  for (let d = a; d <= b; d = addD(d, 1)) out.push({ d, v: map.get(d) ?? 0 })
  return out
}
const sum = (p: Point[]) => p.reduce((s, x) => s + (x.v || 0), 0)

function countBy<T>(list: T[], day: (x: T) => string, weight: (x: T) => number = () => 1) {
  const m = new Map<string, number>()
  for (const x of list) {
    const d = day(x)
    if (d) m.set(d, (m.get(d) || 0) + weight(x))
  }
  return m
}

/** A KPI with a daily series for the range and the compare range. */
function kpi(key: string, label: string, map: Map<string, number>, r: Range, extra: Partial<Kpi> = {}): Kpi {
  const s = series(map, r.start, r.end)
  const c = r.cstart && r.cend ? series(map, r.cstart, r.cend) : null
  return { key, label, value: sum(s), prev: c ? sum(c) : null, format: "number", series: s, cseries: c, ...extra }
}

const section = (name: string, r: Range, part: Partial<SectionData>): SectionData => ({
  ok: true,
  section: name,
  range: r,
  filters: {},
  generatedAt: new Date().toISOString(),
  account: null,
  kpis: [],
  tables: [],
  items: null,
  notes: [],
  errors: [],
  ...part,
})

// ---------- queue (the content calendar) ----------

const STATUS: Record<string, string> = { draft: "Draft", approved: "Scheduled", paused: "Paused", posted: "Posted", failed: "Failed", blocked: "Failed" }
/** Calendar rows are numbered so a LinkedIn post and another tool's item never clash. */
export const rowOf = (kind: "li" | "item", id: number) => id * 10 + (kind === "li" ? 1 : 2)
export const fromRow = (row: number) => ({ kind: row % 10 === 1 ? ("li" as const) : ("item" as const), id: Math.floor(row / 10) })

async function itemsOf(email: string): Promise<Item[]> {
  const all = await rows<Record<string, unknown>>("ap_items", { col: "email", val: email })
  return all.map((r) => ({
    id: Number(r.id),
    email: String(r.email || ""),
    product: String(r.product || "") as Item["product"],
    status: String(r.status || "draft") as Item["status"],
    title: String(r.title || ""),
    summary: String(r.summary || ""),
    text: String(r.text || ""),
    topic: String(r.topic || ""),
    image: String(r.image || ""),
    scheduledAt: (r.scheduledAt as string) || null,
    postedAt: (r.postedAt as string) || null,
    ref: String(r.ref || ""),
    progress: Number(r.progress) || 0,
    error: String(r.error || ""),
    createdAt: (r.createdAt as string) || undefined,
  }))
}

async function queue(email: string): Promise<QueueData & { tools: ToolSummary[] }> {
  const [posts, items, subs, profile, ...channels] = await Promise.all([
    postsFor(email),
    itemsOf(email),
    subsFor(email),
    rows<Record<string, unknown>>("li_profiles", { col: "email", val: email }).then((r) => r[0] || null),
    ...TOOL_KEYS.map((k) => channelFor(email, k)),
  ])
  const ch = Object.fromEntries(TOOL_KEYS.map((k, i) => [k, channels[i]])) as Record<string, Channel | null>
  const list: QueueItem[] = []
  for (const p of posts) {
    if (p.status === "rejected") continue
    list.push({
      row: rowOf("li", p.id),
      title: p.topic || p.text.split("\n")[0].slice(0, 90),
      platform: "LinkedIn",
      format: "text",
      postType: "",
      mode: "auto",
      status: STATUS[p.status] || "Draft",
      phase: "",
      when: p.scheduledAt,
      whenText: "",
      postedAt: p.postedAt,
      url: p.postUrn.startsWith("urn:li:") ? postUrl(p.postUrn) : null,
      error: p.status === "posted" ? null : p.error || null,
      caption: p.text,
      preview: null,
      slides: 1,
      isVideo: false,
      editUrl: "/dashboard?biz=autopilot&view=ap-linkedin",
      ref: "LinkedIn Autopilot",
    })
  }
  for (const it of items) {
    if (it.status === "rejected") continue
    const meta = it.product === "meta"
    const sending = it.status === "approved" && it.progress > 0
    const targets = String(ch.meta?.settings.targets || "both")
    list.push({
      row: rowOf("item", it.id),
      title: it.title,
      platform: meta ? (targets === "facebook" ? "Facebook" : "Instagram") : it.product === "blog" ? "WordPress" : "Email",
      format: meta ? "image" : it.product === "blog" ? "post" : "newsletter",
      postType: meta && targets === "both" ? "Instagram + Facebook" : "",
      mode: it.product === "blog" ? "wordpress" : it.product === "newsletter" ? "email" : "auto",
      status: sending ? "Processing" : STATUS[it.status] || "Draft",
      phase: "",
      when: it.scheduledAt,
      whenText: "",
      postedAt: it.postedAt,
      url: it.product === "newsletter" ? null : it.ref.split(" ").find((u) => /^https:\/\//.test(u)) || null,
      error: it.status === "posted" ? null : it.error || null,
      caption: meta ? it.text : it.title,
      preview: meta ? (/^https:\/\//.test(it.image) ? it.image : cardUrl(it.id)) : null,
      slides: 1,
      isVideo: false,
      editUrl: `/dashboard?biz=autopilot&view=ap-${it.product}`,
      ref: it.product === "newsletter" && it.ref.startsWith("sent:") ? `Sent to ${it.ref.slice(5)}` : PRODUCTS[it.product].name,
    })
  }
  const tools: ToolSummary[] = (["linkedin", "meta", "blog", "newsletter"] as const).map((k) => {
    const sub = subs.find((s) => s.product === k) || null
    const mine = k === "linkedin" ? posts : items.filter((x) => x.product === k)
    return {
      product: k,
      name: PRODUCTS[k].name,
      connected: k === "linkedin" ? profile?.connected === true : ch[k]?.connected === true,
      plan: !sub ? "Not started" : sub.status === "trial" ? "Free trial" : lapsed(sub) ? "Expired" : sub.status === "active" ? `${sub.plan === "pro" ? "Pro" : "Starter"}` : sub.status,
      left: sub ? remaining(sub) : PRODUCTS[k].trial,
      limit: sub ? sub.postLimit : PRODUCTS[k].trial,
      live: canPublish(sub),
      drafts: mine.filter((x) => x.status === "draft").length,
      scheduled: mine.filter((x) => x.status === "approved").length,
    }
  })
  return { ok: true, section: "queue", generatedAt: new Date().toISOString(), items: list, tools }
}

// ---------- Instagram + Facebook (Graph API) ----------

type Insight = { data?: { name: string; values?: { value: number | Record<string, number>; end_time?: string }[]; total_value?: { value: number } }[] }

const unix = (d: string, endOfDay = false) => Math.floor(Date.parse(`${d}T${endOfDay ? "23:59:59" : "00:00:00"}-07:00`) / 1000)

/** Daily values of one metric over [a, b], in windows Meta allows; tries each name until one works. */
async function daily(node: string, token: string, names: string[], a: string, b: string, maxDays: number, extra = ""): Promise<{ name: string; map: Map<string, number> } | { error: string }> {
  let last = "Not available"
  for (const name of names) {
    try {
      const map = new Map<string, number>()
      for (let s = a; s <= b; s = addD(s, maxDays)) {
        const e = addD(s, maxDays - 1) < b ? addD(s, maxDays - 1) : b
        const r = await graph<Insight>(`/${node}/insights?metric=${name}&period=day&since=${unix(s)}&until=${unix(e, true)}${extra}&access_token=${encodeURIComponent(token)}`)
        for (const v of r.data?.[0]?.values || []) {
          if (!v.end_time) continue
          const d = ymd(Date.parse(v.end_time) - DAY)
          const n = typeof v.value === "number" ? v.value : Object.values(v.value || {}).reduce((x, y) => x + (Number(y) || 0), 0)
          map.set(d, (map.get(d) || 0) + n)
        }
      }
      return { name, map }
    } catch (e) {
      last = e instanceof Error ? e.message : String(e)
    }
  }
  return { error: last }
}

/** A total over [a, b] for metrics Meta only gives as totals. */
async function total(node: string, token: string, name: string, a: string, b: string, maxDays: number): Promise<number | null> {
  try {
    let t = 0
    for (let s = a; s <= b; s = addD(s, maxDays)) {
      const e = addD(s, maxDays - 1) < b ? addD(s, maxDays - 1) : b
      const r = await graph<Insight>(`/${node}/insights?metric=${name}&period=day&metric_type=total_value&since=${unix(s)}&until=${unix(e, true)}&access_token=${encodeURIComponent(token)}`)
      t += Number(r.data?.[0]?.total_value?.value) || 0
    }
    return t
  } catch {
    return null
  }
}

/** Runs a few Graph calls at a time. */
async function some<T, R>(list: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  for (let i = 0; i < list.length; i += size) out.push(...(await Promise.all(list.slice(i, i + size).map(fn))))
  return out
}

function metaAccess(c: Channel | null) {
  if (!c?.connected || !c.secretEnc) return null
  try {
    const token = String((JSON.parse(open(c.secretEnc)) as { token?: string }).token || "")
    return token ? { token, pageId: String(c.meta.pageId || ""), igId: String(c.meta.igId || "") } : null
  } catch {
    return null
  }
}

const NOT_CONNECTED = (what: string) => `Connect ${what} in Automations → Instagram + Facebook to see these numbers.`

async function instagram(email: string, r: Range): Promise<SectionData> {
  const acc = metaAccess(await channelFor(email, "meta"))
  if (!acc || !acc.igId) return section("instagram", r, { notes: [NOT_CONNECTED("Instagram")] })
  const { token, igId } = acc
  const errors: { what: string; error: string }[] = []
  const lo = r.cstart && r.cstart < r.start ? r.cstart : r.start
  const [profile, reach, views, cviews, inter, cinter, media] = await Promise.all([
    graph<{ username?: string; name?: string; followers_count?: number; media_count?: number; profile_picture_url?: string }>(`/${igId}?fields=username,name,followers_count,media_count,profile_picture_url&access_token=${encodeURIComponent(token)}`).catch(() => null),
    daily(igId, token, ["reach"], lo, r.end, 30),
    total(igId, token, "views", r.start, r.end, 30),
    r.cstart && r.cend ? total(igId, token, "views", r.cstart, r.cend, 30) : Promise.resolve(null),
    total(igId, token, "total_interactions", r.start, r.end, 30),
    r.cstart && r.cend ? total(igId, token, "total_interactions", r.cstart, r.cend, 30) : Promise.resolve(null),
    graph<{ data?: Record<string, unknown>[] }>(`/${igId}/media?fields=id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp,like_count,comments_count&limit=100&access_token=${encodeURIComponent(token)}`).catch((e) => {
      errors.push({ what: "Posts", error: e instanceof Error ? e.message : "failed" })
      return { data: [] }
    }),
  ])
  const kpis: Kpi[] = []
  if ("map" in reach) kpis.push(kpi("reach", "Accounts reached", reach.map, r, { help: "Daily accounts reached, added up." }))
  else errors.push({ what: "Reach", error: /permission/i.test(reach.error) ? "Reconnect Instagram + Facebook once so Xredible may read your insights." : reach.error })
  if (views !== null) kpis.push({ key: "views", label: "Views", value: views, prev: cviews, format: "number" })
  if (inter !== null) kpis.push({ key: "interactions", label: "Interactions", value: inter, prev: cinter, format: "number", help: "Likes, comments, saves and shares." })
  const posts = (media.data || []).filter((m) => inRange(istDay(String(m.timestamp)), r.start, r.end)).slice(0, 40)
  const withInsights = await some(posts, 6, async (m) => {
    const isImage = m.media_type !== "VIDEO"
    let ins: Record<string, number> = {}
    try {
      const x = await graph<Insight>(`/${m.id}/insights?metric=reach,views,saved,shares&access_token=${encodeURIComponent(token)}`)
      ins = Object.fromEntries((x.data || []).map((d) => [d.name, Number((d.values?.[0]?.value as number) ?? d.total_value?.value ?? 0)]))
    } catch {}
    const row: ItemRow = {
      id: String(m.id),
      url: String(m.permalink || ""),
      thumb: String((isImage ? m.media_url : m.thumbnail_url) || m.thumbnail_url || "") || null,
      title: String(m.caption || "(no caption)").split("\n")[0].slice(0, 120),
      time: String(m.timestamp || ""),
      type: m.media_product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carousel" : m.media_type === "VIDEO" ? "Video" : "Image",
      reach: ins.reach ?? null,
      views: ins.views ?? null,
      likes: Number(m.like_count) || 0,
      comments: Number(m.comments_count) || 0,
      saved: ins.saved ?? null,
      shares: ins.shares ?? null,
    }
    return row
  })
  const cposts = r.cstart && r.cend ? (media.data || []).filter((m) => inRange(istDay(String(m.timestamp)), r.cstart, r.cend)).length : null
  kpis.push({ key: "posts", label: "Posts published", value: posts.length, prev: cposts, format: "number" })
  const cols: Column[] = [
    { key: "reach", label: "Reached", bar: true },
    { key: "views", label: "Views" },
    { key: "likes", label: "Likes" },
    { key: "comments", label: "Comments" },
    { key: "saved", label: "Saves" },
    { key: "shares", label: "Shares" },
  ]
  return section("instagram", r, {
    account: profile
      ? { name: profile.name || profile.username || "Instagram", handle: profile.username ? `@${profile.username}` : undefined, url: `https://www.instagram.com/${profile.username || ""}`, avatar: profile.profile_picture_url || null, stats: [{ label: "Followers", value: profile.followers_count ?? null }, { label: "Posts", value: profile.media_count ?? null }] }
      : null,
    kpis,
    items: withInsights.length ? { title: "Posts in these dates", columns: cols, rows: withInsights, typeFilter: true, sortBy: "reach" } : null,
    notes: withInsights.length ? [] : ["No Instagram posts in these dates."],
    errors,
  })
}

async function facebook(email: string, r: Range): Promise<SectionData> {
  const acc = metaAccess(await channelFor(email, "meta"))
  if (!acc || !acc.pageId) return section("facebook", r, { notes: [NOT_CONNECTED("your Facebook Page")] })
  const { token, pageId } = acc
  const errors: { what: string; error: string }[] = []
  const lo = r.cstart && r.cstart < r.start ? r.cstart : r.start
  const metrics: [string, string, string[]][] = [
    ["views", "Views", ["page_media_view", "page_impressions"]],
    ["viewers", "Viewers", ["page_total_media_view_unique", "page_impressions_unique"]],
    ["engagement", "Engagements", ["page_post_engagements"]],
    ["follows", "New followers", ["page_daily_follows_unique", "page_fan_adds_unique"]],
  ]
  const [profile, posts, ...series] = await Promise.all([
    graph<{ name?: string; link?: string; followers_count?: number; fan_count?: number; picture?: { data?: { url?: string } } }>(`/${pageId}?fields=name,link,followers_count,fan_count,picture{url}&access_token=${encodeURIComponent(token)}`).catch(() => null),
    graph<{ data?: Record<string, unknown>[] }>(
      `/${pageId}/published_posts?fields=id,message,created_time,permalink_url,full_picture,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0),shares&since=${unix(r.start)}&until=${unix(r.end, true)}&limit=50&access_token=${encodeURIComponent(token)}`,
    ).catch((e) => {
      errors.push({ what: "Posts", error: e instanceof Error ? e.message : "failed" })
      return { data: [] }
    }),
    ...metrics.map(([, , names]) => daily(pageId, token, names, lo, r.end, 90)),
  ])
  const kpis: Kpi[] = []
  metrics.forEach(([key, label], i) => {
    const s = series[i]
    if ("map" in s) kpis.push(kpi(key, label, s.map, r))
    else errors.push({ what: label, error: s.error })
  })
  const rowsOut = await some((posts.data || []).slice(0, 40), 6, async (p) => {
    let views: number | null = null
    for (const m of ["post_media_view", "post_impressions"]) {
      try {
        const x = await graph<Insight>(`/${p.id}/insights?metric=${m}&access_token=${encodeURIComponent(token)}`)
        views = Number(x.data?.[0]?.values?.[0]?.value) || 0
        break
      } catch {}
    }
    const sumOf = (o: unknown) => Number((o as { summary?: { total_count?: number } })?.summary?.total_count) || 0
    const row: ItemRow = {
      id: String(p.id),
      url: String(p.permalink_url || ""),
      thumb: (p.full_picture as string) || null,
      title: String(p.message || "(photo)").split("\n")[0].slice(0, 120),
      time: String(p.created_time || ""),
      views,
      reactions: sumOf(p.reactions),
      comments: sumOf(p.comments),
      shares: Number((p.shares as { count?: number } | undefined)?.count) || 0,
    }
    return row
  })
  return section("facebook", r, {
    account: profile
      ? { name: profile.name || "Facebook Page", url: profile.link || `https://www.facebook.com/${pageId}`, avatar: profile.picture?.data?.url || null, stats: [{ label: "Followers", value: profile.followers_count ?? profile.fan_count ?? null }] }
      : null,
    kpis,
    items: rowsOut.length
      ? { title: "Posts in these dates", columns: [{ key: "views", label: "Views", bar: true }, { key: "reactions", label: "Reactions" }, { key: "comments", label: "Comments" }, { key: "shares", label: "Shares" }], rows: rowsOut, sortBy: "views" }
      : null,
    notes: rowsOut.length ? [] : ["No Facebook posts in these dates."],
    errors,
  })
}

// ---------- LinkedIn, blog articles, newsletter (our own data) ----------

async function linkedin(email: string, r: Range): Promise<SectionData> {
  const posts = await postsFor(email)
  const posted = posts.filter((p) => p.status === "posted" && p.postedAt)
  const map = countBy(posted, (p) => istDay(p.postedAt))
  const now = Date.now()
  const inR = posted.filter((p) => inRange(istDay(p.postedAt), r.start, r.end))
  return section("linkedin", r, {
    kpis: [
      kpi("posted", "Posts published", map, r),
      { key: "scheduled", label: "Scheduled to post", value: posts.filter((p) => p.status === "approved" && p.scheduledAt && Date.parse(p.scheduledAt) > now).length, prev: null, format: "number" },
      { key: "drafts", label: "Drafts to review", value: posts.filter((p) => p.status === "draft").length, prev: null, format: "number" },
    ],
    items: inR.length
      ? {
          title: "Published in these dates",
          columns: [{ key: "words", label: "Words" }],
          rows: inR.map((p) => ({ id: String(p.id), url: p.postUrn.startsWith("urn:li:") ? postUrl(p.postUrn) : "https://www.linkedin.com/", thumb: null, title: p.text.split("\n")[0].slice(0, 120), time: p.postedAt, words: p.text.split(/\s+/).filter(Boolean).length })),
          sortBy: "time",
        }
      : null,
    notes: ["LinkedIn doesn't share views and reactions of personal-profile posts with outside apps, so check those on each post in LinkedIn."],
  })
}

async function articles(email: string, r: Range): Promise<SectionData> {
  const items = (await itemsOf(email)).filter((i) => i.product === "blog")
  const posted = items.filter((i) => i.status === "posted" && i.postedAt)
  const words = (i: Item) => i.text.split(/\s+/).filter(Boolean).length
  const inR = posted.filter((i) => inRange(istDay(i.postedAt), r.start, r.end))
  const ch = await channelFor(email, "blog")
  return section("articles", r, {
    account: ch?.connected ? { name: ch.connName, url: String(ch.meta.site || ""), avatar: null, stats: [{ label: "Articles by Xredible", value: posted.length }] } : null,
    kpis: [kpi("published", "Articles published", countBy(posted, (i) => istDay(i.postedAt)), r), kpi("words", "Words published", countBy(posted, (i) => istDay(i.postedAt), words), r)],
    items: inR.length
      ? { title: "Published in these dates", columns: [{ key: "words", label: "Words", bar: true }], rows: inR.map((i) => ({ id: String(i.id), url: i.ref || String(ch?.meta.site || ""), thumb: null, title: i.title, time: i.postedAt, words: words(i) })), sortBy: "time" }
      : null,
    notes: [ch?.connected ? "Visits to these articles show in your website's own analytics (for example Google Analytics or Jetpack)." : "Connect your WordPress site in Automations → Blog Writer."],
  })
}

async function newsletter(email: string, r: Range): Promise<SectionData> {
  const [items, events, contacts] = await Promise.all([itemsOf(email), rows<Record<string, unknown>>("ap_events", { col: "owner", val: email }), contactsFor(email)])
  const issues = items.filter((i) => i.product === "newsletter" && (i.status === "posted" || i.progress > 0) && i.postedAt !== undefined)
  const sentOf = (i: Item) => Number(i.ref.replace(/^sent:/, "")) || 0
  const sentDay = (i: Item) => istDay(i.postedAt || i.scheduledAt)
  // First open / click per subscriber per issue.
  const first = (type: string) => {
    const m = new Map<string, string>()
    for (const e of events) {
      if (e.type !== type) continue
      const k = `${e.item}:${e.contact}`
      const at = String(e.at || e.createdAt || "")
      if (!m.has(k) || at < (m.get(k) as string)) m.set(k, at)
    }
    return m
  }
  const opens = first("open")
  const clicks = first("click")
  const perIssue = (m: Map<string, string>, id: number) => [...m.keys()].filter((k) => k.startsWith(`${id}:`)).length
  const openMap = countBy([...opens.values()], (at) => istDay(at))
  const clickMap = countBy([...clicks.values()], (at) => istDay(at))
  const sentMap = countBy(issues, sentDay, sentOf)
  const inR = issues.filter((i) => inRange(sentDay(i), r.start, r.end))
  const inC = r.cstart ? issues.filter((i) => inRange(sentDay(i), r.cstart, r.cend)) : []
  const rate = (list: Item[], m: Map<string, string>) => {
    const sent = list.reduce((s, i) => s + sentOf(i), 0)
    return sent ? list.reduce((s, i) => s + perIssue(m, i.id), 0) / sent : null
  }
  const unsubMap = countBy(
    contacts.filter((c) => c.status === "unsubscribed" && c.unsubAt),
    (c) => istDay(c.unsubAt),
  )
  return section("newsletter", r, {
    account: { name: "Subscribers", url: "/dashboard?biz=autopilot&view=ap-newsletter", avatar: null, stats: [{ label: "Subscribed", value: contacts.filter((c) => c.status === "subscribed").length }, { label: "Unsubscribed", value: contacts.filter((c) => c.status === "unsubscribed").length }] },
    kpis: [
      kpi("sent", "Emails sent", sentMap, r),
      kpi("opens", "Opened (people)", openMap, r),
      { key: "openRate", label: "Open rate", value: rate(inR, opens), prev: r.cstart ? rate(inC, opens) : null, format: "percent", help: "People who opened ÷ emails sent, for issues sent in these dates. Some email apps load images automatically, so this can read a little high." },
      kpi("clicks", "Clicked (people)", clickMap, r),
      { key: "clickRate", label: "Click rate", value: rate(inR, clicks), prev: r.cstart ? rate(inC, clicks) : null, format: "percent" },
      kpi("unsubs", "Unsubscribed", unsubMap, r, { invert: true }),
    ],
    items: inR.length
      ? {
          title: "Issues sent in these dates",
          columns: [
            { key: "sent", label: "Sent" },
            { key: "opens", label: "Opened", bar: true },
            { key: "openRate", label: "Open rate", format: "percent" },
            { key: "clicks", label: "Clicked" },
            { key: "clickRate", label: "Click rate", format: "percent" },
          ],
          rows: inR.map((i) => {
            const s = sentOf(i)
            const o = perIssue(opens, i.id)
            const c = perIssue(clicks, i.id)
            return { id: String(i.id), url: "/dashboard?biz=autopilot&view=ap-newsletter", thumb: null, title: i.title, time: i.postedAt || i.scheduledAt, sent: s, opens: o, openRate: s ? o / s : null, clicks: c, clickRate: s ? c / s : null }
          }),
          sortBy: "opens",
        }
      : null,
    notes: inR.length ? [] : ["No newsletter issues were sent in these dates."],
  })
}

// ---------- entry point ----------

export async function loadAutopilotSection(email: string, name: string, search: URLSearchParams): Promise<Result> {
  try {
    const r = range(search)
    if (name === "queue") return { status: 200, body: await queue(email) }
    if (name === "instagram") return { status: 200, body: await instagram(email, r) }
    if (name === "facebook") return { status: 200, body: await facebook(email, r) }
    if (name === "linkedin") return { status: 200, body: await linkedin(email, r) }
    if (name === "articles") return { status: 200, body: await articles(email, r) }
    if (name === "newsletter") return { status: 200, body: await newsletter(email, r) }
    return { status: 400, body: { ok: false, error: "Unknown section." } }
  } catch (e) {
    return { status: 502, body: { ok: false, error: e instanceof Error ? e.message : "Something went wrong." } }
  }
}
