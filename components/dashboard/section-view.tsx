"use client"

// One platform's report: account strip, KPI tiles, trend chart, breakdown tables, posts.

import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ExternalLink, Info, Lightbulb, TrendingDown, TrendingUp, X } from "lucide-react"
import type { DataTable, Insight, Kpi, SectionData } from "@/lib/dashboard/types"
import { countryName, fillDays, fmt, rangeLabel } from "./format"
import { TrendChart, Heatmap } from "./charts"
import { Card, KpiTile, Notice, Segmented } from "./ui"
import { PostsTable, ReportTable } from "./tables"
import type { Filters } from "./state"

export type FilterDef = { key: string; label: string; all: string; options: (d: SectionData | null) => { value: string; label: string }[] }

const fromTable = (tableKey: string, valueKey: string, labelFn?: (r: Record<string, unknown>) => string) => (d: SectionData | null) =>
  ((d?.tables.find((t) => t.key === tableKey)?.rows || []) as Record<string, unknown>[])
    .filter((r) => r[valueKey] && r[valueKey] !== "(not set)")
    .map((r) => ({ value: String(r[valueKey]), label: labelFn ? labelFn(r) : String(r.k ?? r[valueKey]) }))

const fixed = (opts: [string, string][]) => () => opts.map(([value, label]) => ({ value, label }))

export const FILTERS: Record<string, FilterDef[]> = {
  ga4: [
    { key: "device", label: "Device", all: "All devices", options: fixed([["mobile", "Phone"], ["desktop", "Computer"], ["tablet", "Tablet"]]) },
    { key: "channel", label: "Channel", all: "All channels", options: fromTable("channels", "k") },
    { key: "country", label: "Country", all: "All countries", options: fromTable("countries", "k") },
  ],
  sessions: [
    { key: "device", label: "Device", all: "All devices", options: fixed([["mobile", "Phone"], ["desktop", "Computer"], ["tablet", "Tablet"]]) },
    { key: "channel", label: "Channel", all: "All channels", options: fromTable("channels", "k") },
    { key: "country", label: "Country", all: "All countries", options: fromTable("countries", "k") },
  ],
  gsc: [
    { key: "searchType", label: "Search type", all: "Web search", options: fixed([["image", "Image search"], ["video", "Video search"], ["news", "News"], ["discover", "Discover"]]) },
    { key: "device", label: "Device", all: "All devices", options: fixed([["MOBILE", "Phone"], ["DESKTOP", "Computer"], ["TABLET", "Tablet"]]) },
    { key: "country", label: "Country", all: "All countries", options: fromTable("countries", "code", (r) => countryName(String(r.code), true)) },
  ],
  youtube: [
    { key: "contentType", label: "Content", all: "All content", options: fixed([["shorts", "Shorts"], ["videoOnDemand", "Videos"], ["liveStream", "Live streams"]]) },
    { key: "country", label: "Country", all: "All countries", options: fromTable("country", "code", (r) => countryName(String(r.code))) },
  ],
  adsense: [
    { key: "country", label: "Country", all: "All countries", options: fromTable("countries", "code", (r) => String(r.k || countryName(String(r.code)))) },
  ],
  pinterest: [
    { key: "appType", label: "Device", all: "All devices", options: fixed([["MOBILE", "Phone"], ["TABLET", "Tablet"], ["WEB", "Computer"]]) },
    { key: "pinFormat", label: "Pin format", all: "All formats", options: fixed([["ORGANIC_IMAGE", "Image pins"], ["ORGANIC_VIDEO", "Video pins"], ["ORGANIC_PRODUCT", "Product pins"]]) },
    { key: "source", label: "Pins", all: "All pins", options: fixed([["YOUR_PINS", "Your pins"], ["OTHER_PINS", "Other people's pins"]]) },
  ],
}

export function FilterBar({ section, data, filters, onChange }: { section: string; data: SectionData | null; filters: Filters; onChange: (f: Filters) => void }) {
  const defs = FILTERS[section]
  if (!defs) return null
  const active = Object.entries(filters).filter(([, v]) => v)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {defs.map((def) => {
        const opts = def.options(data)
        const cur = filters[def.key] || ""
        const list = cur && !opts.some((o) => o.value === cur) ? [{ value: cur, label: cur }, ...opts] : opts
        return (
          <label key={def.key} className="relative">
            <span className="sr-only">{def.label}</span>
            <select
              id={`f-${section}-${def.key}`}
              value={cur}
              onChange={(e) => onChange({ ...filters, [def.key]: e.target.value })}
              className={`h-8 appearance-none rounded-lg border bg-[var(--panel)] py-0 pl-2.5 pr-7 text-xs font-medium ${cur ? "border-[var(--brand)] text-[var(--brand)]" : "border-[var(--line)] text-[var(--ink-2)]"}`}
            >
              <option value="">{def.all}</option>
              {list.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[var(--faint)]">▼</span>
          </label>
        )
      })}
      {active.length ? (
        <button type="button" onClick={() => onChange({})} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-[var(--muted)] hover:bg-[var(--chip)] hover:text-[var(--ink)]">
          <X className="h-3.5 w-3.5" />
          Clear filters
        </button>
      ) : null}
    </div>
  )
}

function mergePages(t: DataTable): DataTable {
  if (t.key !== "pages" || !t.rows.length || !("path" in t.rows[0])) return t
  const by = new Map<string, { path: string; title: string; views: number; users: number; tw: number; best: number }>()
  for (const r of t.rows as { path: string; title: string; views: number; users: number; time: number }[]) {
    const e = by.get(r.path) || { path: r.path, title: r.title, views: 0, users: 0, tw: 0, best: -1 }
    if (r.views > e.best && !/^404/.test(r.title)) {
      e.title = r.title
      e.best = r.views
    }
    e.views += r.views || 0
    e.users += r.users || 0
    e.tw += (r.time || 0) * (r.users || 0)
    by.set(r.path, e)
  }
  return { ...t, rows: [...by.values()].map((e) => ({ path: e.path, title: e.title.replace(/ \| Elevating CHRIST$/, ""), views: e.views, users: e.users, time: e.users ? Math.round(e.tw / e.users) : 0 })).sort((a, b) => b.views - a.views) }
}

function prepare(d: SectionData) {
  const avg = (k: Kpi) => k.avg === true || k.format === "percent" || k.format === "duration" || k.format === "decimal"
  const kpis = d.kpis.map((k) => {
    const clean = (s: typeof k.series) => (k.key === "position" ? (s || []).map((p) => ({ ...p, v: p.v === 0 ? null : p.v })) : s)
    return {
      ...k,
      series: k.series ? fillDays(clean(k.series), d.range.start, d.range.end, avg(k) ? null : 0) : null,
      cseries: k.cseries && d.range.cstart && d.range.cend ? fillDays(clean(k.cseries), d.range.cstart, d.range.cend, avg(k) ? null : 0) : null,
    }
  })
  const tables = d.tables.map(mergePages).map((t) => ({ ...t, rows: t.rows.filter((r) => !(r.k === "creatorContentTypeUnspecified")) }))
  return { kpis, tables }
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="!font-sans !text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-[var(--faint)]">{title}</h2>
      {children}
    </section>
  )
}

const TONE: Record<Insight["tone"], { icon: ReactNode; cls: string }> = {
  up: { icon: <TrendingUp className="h-4 w-4" aria-hidden />, cls: "bg-[var(--good-bg)] text-[var(--good)]" },
  down: { icon: <TrendingDown className="h-4 w-4" aria-hidden />, cls: "bg-[var(--bad-bg)] text-[var(--bad)]" },
  idea: { icon: <Lightbulb className="h-4 w-4" aria-hidden />, cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300" },
  info: { icon: <Info className="h-4 w-4" aria-hidden />, cls: "bg-[var(--chip)] text-[var(--muted)]" },
}

/** "What stands out": notes worked out from this page's own numbers. */
export function Insights({ items }: { items: Insight[] }) {
  const [all, setAll] = useState(false)
  if (!items.length) return null
  const LIMIT = 6
  const shown = all ? items : items.slice(0, LIMIT)
  return (
    <Card
      title="What stands out"
      sub="Worked out from the numbers on this page"
      action={items.length > LIMIT ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="text-xs font-medium text-[var(--brand)] hover:underline">
          {all ? "Show fewer" : `Show all ${items.length}`}
        </button>
      ) : null}
    >
      <ul className="grid gap-x-6 gap-y-3.5 md:grid-cols-2">
        {shown.map((x, i) => (
          <li key={i} className="flex gap-3">
            <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${TONE[x.tone]?.cls || TONE.info.cls}`}>{TONE[x.tone]?.icon || TONE.info.icon}</span>
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold leading-snug text-[var(--ink)]">{x.title}</span>
              <span className="mt-0.5 block text-[13px] leading-snug text-[var(--muted)]">{x.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export function SectionView({
  data,
  color,
  compareLabel,
  onFilter,
  intro,
}: {
  data: SectionData
  color: string
  compareLabel: string | null
  onFilter?: (key: string, value: string) => void
  intro?: ReactNode
}) {
  const { kpis, tables } = useMemo(() => prepare(data), [data])
  const charted = kpis.filter((k) => k.series && k.series.length > 1)
  const [metric, setMetric] = useState<string>(data.chartDefault || charted[0]?.key || "")
  useEffect(() => {
    if (!charted.some((k) => k.key === metric)) setMetric(data.chartDefault && charted.some((k) => k.key === data.chartDefault) ? data.chartDefault : charted[0]?.key || "")
  }, [data, charted, metric])
  const sel = charted.find((k) => k.key === metric)
  const groups = useMemo(() => {
    const m = new Map<string, DataTable[]>()
    for (const t of tables) {
      const g = t.group || "Breakdown"
      m.set(g, [...(m.get(g) || []), t])
    }
    return [...m.entries()]
  }, [tables])
  const a = data.account

  return (
    <div className="space-y-6">
      {a ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            {a.avatar ? <img onError={(e) => { e.currentTarget.style.visibility = "hidden" }} src={a.avatar} alt="" referrerPolicy="no-referrer" className="h-10 w-10 shrink-0 rounded-full border border-[var(--line)] object-cover" /> : <span className="h-10 w-10 shrink-0 rounded-full" style={{ background: color, opacity: 0.15 }} />}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-[var(--ink)]">{a.name}</div>
              <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--brand)] hover:underline">
                {a.handle || "Open"}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
          {a.stats.filter((s) => s.value !== null).length ? (
            <dl className="flex flex-wrap gap-x-6 gap-y-2">
              {a.stats
                .filter((s) => s.value !== null)
                .map((s) => (
                  <div key={s.label}>
                    <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--faint)]">{s.label}</dt>
                    <dd className="text-base font-semibold tabular-nums text-[var(--ink)]">{fmt(s.value, "number", true)}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {data.realtime ? (
            <div className="ml-auto flex items-center gap-2 rounded-lg bg-[var(--chip)] px-3 py-1.5 text-xs text-[var(--muted)]">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>
                <span className="font-semibold text-[var(--ink)]">{fmt(data.realtime.users)}</span> on the site in the last 30 minutes
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {intro}

      {kpis.length ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {kpis.map((k) => (
            <KpiTile key={k.key} k={k} color={color} active={k.key === metric} onSelect={() => setMetric(k.key)} compareLabel={compareLabel} />
          ))}
        </div>
      ) : null}

      {data.insights && data.insights.length ? <Insights items={data.insights} /> : null}

      {sel ? (
        <Card
          title={`${sel.label} per day`}
          sub={`${rangeLabel(data.range.start, data.range.end)}${data.range.cstart && compareLabel ? ` · dashed line: ${rangeLabel(data.range.cstart, data.range.cend as string)}` : ""}`}
          action={charted.length > 1 ? <span className="hidden text-xs text-[var(--faint)] md:inline">Tap a number above to chart it</span> : null}
        >
          {charted.length > 1 ? (
            <div className="mb-4 md:hidden">
              <Segmented label="Metric" value={metric} options={charted.map((k) => ({ id: k.key, label: k.label }))} onChange={setMetric} />
            </div>
          ) : null}
          <TrendChart series={sel.series || []} cseries={sel.cseries} color={color} format={sel.format} label={sel.label} compareLabel={data.range.cstart ? rangeLabel(data.range.cstart, data.range.cend as string) : null} />
        </Card>
      ) : null}

      {data.items ? <PostsTable items={data.items} color={color} /> : null}

      {data.heatmap ? (
        <Card title={data.heatmap.title} sub="Darker squares = more visitors">
          <Heatmap grid={data.heatmap.grid} days={data.heatmap.days} color={color} />
        </Card>
      ) : null}

      {groups.map(([g, ts]) => (
        <Group key={g} title={g}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {ts.map((t) => (
              // min-w-0: a long table scrolls inside its box instead of widening the page on phones.
              <div key={t.key} className={`min-w-0 ${t.wide ? "lg:col-span-2" : ""}`}>
                <ReportTable t={t} onFilter={onFilter} />
              </div>
            ))}
          </div>
        </Group>
      ))}

      {data.realtime && data.realtime.pages.length ? (
        <Card title="Pages being read right now">
          <ul className="space-y-1 text-sm">
            {data.realtime.pages.map((p) => (
              <li key={p.k} className="flex justify-between gap-3">
                <span className="truncate text-[var(--ink-2)]">{p.k}</span>
                <span className="tabular-nums text-[var(--muted)]">{fmt(p.v)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {data.notes.length ? (
        <div className="space-y-2">
          {data.notes.map((n) => (
            <Notice key={n}>{n}</Notice>
          ))}
        </div>
      ) : null}
      {data.errors.length ? (
        <Notice tone="warn" title="Some numbers could not load">
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {data.errors.map((e, i) => (
              <li key={i}>
                <span className="font-medium">{e.what}:</span> {e.error}
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
    </div>
  )
}
