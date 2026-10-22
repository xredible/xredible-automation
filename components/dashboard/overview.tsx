"use client"

// Overview: the headline number from every platform for the chosen dates,
// what's going out next, what needs attention, and the best content.

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowRight, TriangleAlert } from "lucide-react"
import type { AnySection, Kpi, QueueData, SectionData, ToolSummary } from "@/lib/dashboard/types"
import { fillDays, fmt } from "./format"
import { Card, Delta, Notice, Skeleton } from "./ui"
import { Sparkline } from "./charts"
import { PLATFORM } from "./brand"
import { QueueRow } from "./schedule-view"
import { useItems } from "./actions"
import { limited, loadKey, sectionKey, type View } from "./state"
import { BUSINESSES, type BusinessKey } from "@/lib/dashboard/businesses"
import { GettingStarted } from "@/components/autopilot/account-views"

// The Blog page's own sections: "blogpost" needs a post id, and the overview shows neither.
const BLOG_SECTIONS = ["blog", "blogpost"]

export function Overview({ biz, start, end, cmp, compareLabel, go, refreshTick }: { biz: BusinessKey; start: string; end: string; cmp: string; compareLabel: string | null; go: (v: View) => void; refreshTick: number }) {
  const business = BUSINESSES[biz]
  const [data, setData] = useState<Record<string, AnySection | undefined>>({})
  const lastTick = useRef(refreshTick)
  useEffect(() => {
    let alive = true
    const fresh = refreshTick !== lastTick.current
    lastTick.current = refreshTick
    if (!fresh) setData({})
    limited(
      business.sections.filter((s) => !BLOG_SECTIONS.includes(s)).map((s) => async () => {
        const d = await loadKey(sectionKey(biz, s, start, end, cmp), fresh)
        if (alive) setData((cur) => ({ ...cur, [s]: d }))
        return d
      }),
      3,
    )
    return () => {
      alive = false
    }
  }, [biz, business.sections, start, end, cmp, refreshTick])

  // A post changed from the dashboard: reload just the queue, not every platform.
  useEffect(() => {
    const reload = () => loadKey(sectionKey(biz, "queue", start, end, cmp), true).then((d) => setData((cur) => ({ ...cur, queue: d })))
    window.addEventListener("ec-queue-changed", reload)
    return () => window.removeEventListener("ec-queue-changed", reload)
  }, [biz, start, end, cmp])

  const rawQueue = data.queue && data.queue.ok ? (data.queue as QueueData) : null
  const liveItems = useItems(rawQueue?.items ?? [])
  const queue = rawQueue ? { ...rawQueue, items: liveItems } : null
  const now = Date.now()
  const next = queue ? queue.items.filter((x) => x.when && Date.parse(x.when) >= now && !/posted|failed/i.test(x.status)).sort((a, b) => (a.when as string).localeCompare(b.when as string)).slice(0, 6) : []
  const recent = queue ? queue.items.filter((x) => /posted/i.test(x.status)).sort((a, b) => (b.postedAt || b.when || "").localeCompare(a.postedAt || a.when || "")).slice(0, 6) : []
  const attention = queue
    ? queue.items.filter(
        (x) =>
          /failed/i.test(x.status) ||
          (x.when && Date.parse(x.when) < now - 2 * 3600_000 && /ready|processing/i.test(x.status) && /auto/i.test(x.mode)) ||
          (x.when && /draft/i.test(x.status) && Date.parse(x.when) - now < 3 * 86400_000 && Date.parse(x.when) > now),
      )
    : []
  const week = queue ? queue.items.filter((x) => x.when && Date.parse(x.when) >= now && Date.parse(x.when) < now + 7 * 86400_000 && !/posted/i.test(x.status)) : []

  const best = useMemo(() => {
    const out: { platform: string; title: string; url: string; thumb: string | null; metric: string; value: number }[] = []
    const ig = data.instagram && data.instagram.ok ? (data.instagram as SectionData) : null
    const yt = data.youtube && data.youtube.ok ? (data.youtube as SectionData) : null
    const fb = data.facebook && data.facebook.ok ? (data.facebook as SectionData) : null
    const ga = data.ga4 && data.ga4.ok ? (data.ga4 as SectionData) : null
    const top = (s: SectionData | null, k: string) => (s?.items?.rows || []).filter((r) => typeof r[k] === "number").sort((a, b) => (b[k] as number) - (a[k] as number))[0]
    const y = top(yt, "views")
    if (y) out.push({ platform: "youtube", title: y.title, url: y.url, thumb: y.thumb, metric: "views", value: y.views as number })
    const i = top(ig, "reach")
    if (i) out.push({ platform: "instagram", title: i.title, url: i.url, thumb: i.thumb, metric: "accounts reached", value: i.reach as number })
    const f = top(fb, "views")
    if (f) out.push({ platform: "facebook", title: f.title, url: f.url, thumb: f.thumb, metric: "views", value: f.views as number })
    const nl = data.newsletter && data.newsletter.ok ? (data.newsletter as SectionData) : null
    const n = top(nl, "opens")
    if (n && (n.opens as number) > 0) out.push({ platform: "newsletter", title: n.title, url: n.url, thumb: null, metric: "people opened", value: n.opens as number })
    const pages = ga?.tables.find((t) => t.key === "pages")?.rows || []
    const pg = pages.filter((r) => r.path !== "/").sort((a, b) => (b.views as number) - (a.views as number))[0]
    if (pg) out.push({ platform: "ga4", title: String(pg.title || pg.path).replace(/ \| (Elevating CHRIST|Nestoodle)$/, ""), url: business.site + pg.path, thumb: null, metric: "page views", value: pg.views as number })
    return out
  }, [data, business.site])

  return (
    <div className="space-y-6">
      {biz === "autopilot" && rawQueue?.tools ? <GettingStarted tools={rawQueue.tools} go={go} /> : null}
      {biz === "autopilot" ? <Automations tools={rawQueue?.tools ?? null} go={go} /> : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {business.picks.map((p) => {
          const d = data[p.section]
          const meta = PLATFORM[p.section]
          if (!d) return <Skeleton key={p.label} className="h-[132px]" />
          const k = d.ok && "kpis" in d ? (d as SectionData).kpis.find((x) => x.key === p.key) : undefined
          return <OverviewTile key={p.label} label={p.label} k={k} d={d.ok && "kpis" in d ? (d as SectionData) : null} error={!d.ok ? (d as { error: string }).error : null} color={meta.color} icon={meta.icon} onClick={() => go(p.section)} compareLabel={compareLabel} />
        })}
      </div>

      {attention.length ? (
        <Card title={<span className="inline-flex items-center gap-2 text-[var(--bad)]"><TriangleAlert className="h-4 w-4" />Needs attention</span>} sub="Failed posts, posts that should have gone out, and drafts due within 3 days">
          <ul className="divide-y divide-[var(--line-soft)]">
            {attention.map((x) => (
              <QueueRow key={x.row} item={x} showDate />
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card
          title="Coming up next"
          sub={queue ? `${week.length} ${week.length === 1 ? "post" : "posts"} in the next 7 days` : undefined}
          action={
            <button type="button" onClick={() => go("schedule")} className="inline-flex items-center gap-1 text-xs font-medium text-[var(--brand)] hover:underline">
              Calendar <ArrowRight className="h-3 w-3" />
            </button>
          }
        >
          {!data.queue ? <Skeleton className="h-48" /> : next.length ? <ul className="divide-y divide-[var(--line-soft)]">{next.map((x) => <QueueRow key={x.row} item={x} showDate />)}</ul> : <div className="py-6 text-center text-sm text-[var(--faint)]">Nothing scheduled in the {business.sheetName}.</div>}
        </Card>
        <Card title="Recently posted">
          {!data.queue ? <Skeleton className="h-48" /> : recent.length ? <ul className="divide-y divide-[var(--line-soft)]">{recent.map((x) => <QueueRow key={x.row} item={x} showDate actions={false} />)}</ul> : <div className="py-6 text-center text-sm text-[var(--faint)]">Nothing posted from the queue yet.</div>}
        </Card>
      </div>

      {best.length ? (
        <Card title="Best content in these dates">
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {best.map((b) => {
              const meta = PLATFORM[b.platform]
              return (
                <li key={b.platform} className="min-w-0">
                  <a href={b.url} target="_blank" rel="noreferrer" className="flex h-full flex-col rounded-lg border border-[var(--line)] p-3 transition hover:border-[var(--line-strong)] hover:bg-[var(--hover)]">
                    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: meta.color }}>
                      {meta.icon}
                      {meta.short}
                    </span>
                    {b.thumb ? <img onError={(e) => { e.currentTarget.style.visibility = "hidden" }} src={b.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-2 aspect-video w-full rounded-md bg-[var(--chip)] object-cover" /> : null}
                    <span className="mt-2 line-clamp-2 text-sm leading-snug text-[var(--ink)]">{b.title}</span>
                    <span className="mt-auto pt-2 text-xs text-[var(--muted)]">
                      <span className="font-semibold tabular-nums text-[var(--ink)]">{fmt(b.value)}</span> {b.metric}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}

      {Object.values(data).some((d) => d && !d.ok) ? (
        <Notice tone="warn" title="Some platforms didn't load">
          {Object.entries(data)
            .filter(([, d]) => d && !d.ok)
            .map(([s, d]) => `${PLATFORM[s === "queue" ? "schedule" : s]?.short || s}: ${(d as { error: string }).error}`)
            .join(" · ")}
        </Notice>
      ) : null}
    </div>
  )
}

function OverviewTile({ label, k, d, error, color, icon, onClick, compareLabel }: { label: string; k?: Kpi; d: SectionData | null; error: string | null; color: string; icon: React.ReactNode; onClick: () => void; compareLabel: string | null }) {
  const series = k?.series && d ? fillDays(k.series, d.range.start, d.range.end, 0) : []
  return (
    <button type="button" onClick={onClick} className="flex min-w-0 flex-col rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3.5 text-left transition hover:border-[var(--line-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] sm:p-4">
      <span className="flex items-start gap-1.5 text-[12.5px] font-medium leading-snug text-[var(--muted)]">
        <span className="mt-[2px]" style={{ color }}>{icon}</span>
        <span className="line-clamp-2">{label}</span>
      </span>
      {k ? (
        <>
          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[1.55rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--ink)]">{fmt(k.value, k.format, true)}</span>
            <Delta cur={k.value} prev={k.prev} invert={k.invert} />
          </span>
          <span className="mt-1 truncate text-[11.5px] text-[var(--faint)]">{k.prev !== null && compareLabel ? `${fmt(k.prev, k.format, true)} ${compareLabel}` : " "}</span>
          <span className="mt-2">{series.length > 1 ? <Sparkline data={series} color={color} /> : <span className="block h-[30px]" />}</span>
        </>
      ) : (
        <span className="mt-2 line-clamp-3 text-xs leading-snug text-[var(--muted)]">{error ? `Not loading: ${error}` : "No data for these dates yet."}</span>
      )}
    </button>
  )
}

const TOOL_VIEWS: Record<ToolSummary["product"], View> = { linkedin: "ap-linkedin", meta: "ap-meta", blog: "ap-blog", newsletter: "ap-newsletter" }

/** Autopilot: each tool's plan, posts left, and what's waiting, with a way in. */
function Automations({ tools, go }: { tools: ToolSummary[] | null; go: (v: View) => void }) {
  if (!tools) return <Skeleton className="h-[104px]" />
  return (
    <Card title="Your automations" sub="Every automation starts with 3 free posts. Approve drafts and they go out on schedule.">
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tools.map((t) => {
          const v = TOOL_VIEWS[t.product]
          const meta = PLATFORM[v]
          const state = !t.connected ? "Not connected" : t.drafts ? `${t.drafts} to review` : t.scheduled ? `${t.scheduled} scheduled` : "Up to date"
          return (
            <li key={t.product}>
              <button type="button" onClick={() => go(v)} className="flex h-full w-full flex-col rounded-lg border border-[var(--line)] p-3 text-left transition hover:border-[var(--line-strong)] hover:bg-[var(--hover)]">
                <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: meta.color }}>
                  {meta.icon}
                  {t.name}
                </span>
                <span className="mt-2 text-xs text-[var(--muted)]">
                  {t.plan} · <span className="font-semibold tabular-nums text-[var(--ink)]">{t.left}</span> of {t.limit} left
                </span>
                <span className={`mt-1 text-xs font-medium ${!t.connected ? "text-[var(--faint)]" : t.drafts ? "text-[var(--brand)]" : "text-[var(--good)]"}`}>{t.live || !t.connected ? state : "Plan paused · subscribe to continue"}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
