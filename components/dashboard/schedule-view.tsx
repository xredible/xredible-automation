"use client"

// A business's content queue: list or month calendar, with platform / status / search filters.

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react"
import type { QueueData, QueueItem } from "@/lib/dashboard/types"
import { addDays, dayKey, timeOf, todayIST, weekdayDate } from "./format"
import { Card, Segmented } from "./ui"
import { PLATFORM, platformKey } from "./brand"
import { BulkActions, RowActions, useItems } from "./actions"
import { BUSINESSES, type BusinessKey } from "@/lib/dashboard/businesses"

const FORMAT: Record<string, string> = { reel: "Reel", carousel: "Carousel", fb_post: "Post", pin: "Pin", youtube_short: "Short", text: "Text post", post: "Blog post", image: "Image post", newsletter: "Newsletter" }
const MODE: Record<string, string> = { auto: "Posts automatically", "pinterest csv": "Pinterest publishes it", manual: "Post by hand", wordpress: "Publishes on the website", email: "Sends to your subscribers" }
export const STATUS_STYLE: Record<string, string> = {
  posted: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  ready: "bg-sky-50 text-sky-800 ring-sky-600/20",
  scheduled: "bg-violet-50 text-violet-700 ring-violet-600/20",
  skipped: "bg-slate-100 text-slate-500 ring-slate-500/20",
  processing: "bg-amber-50 text-amber-800 ring-amber-600/25",
  paused: "bg-orange-50 text-orange-800 ring-orange-600/25",
  draft: "bg-slate-100 text-slate-600 ring-slate-500/20",
  "pending review": "bg-amber-50 text-amber-800 ring-amber-600/25",
  failed: "bg-red-50 text-red-700 ring-red-600/20",
}

export function StatusPill({ status }: { status: string }) {
  const s = (status || "blank").toLowerCase()
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${STATUS_STYLE[s] ?? STATUS_STYLE.draft}`}>{status || "Blank"}</span>
}

export function QueueRow({ item, showDate, actions = true }: { item: QueueItem; showDate?: boolean; actions?: boolean }) {
  const p = PLATFORM[platformKey(item.platform)] ?? PLATFORM.ga4
  const when = item.status.toLowerCase() === "posted" ? item.postedAt || item.when : item.when
  return (
    <li className="flex gap-3 py-3">
      <div className="w-[4.6rem] shrink-0 pt-0.5 text-xs tabular-nums text-[var(--muted)]">
        {when ? (
          <>
            <div className="font-semibold text-[var(--ink)]">{timeOf(when)}</div>
            {showDate ? <div>{weekdayDate(when)}</div> : null}
          </>
        ) : (
          <div>{item.whenText || "No date"}</div>
        )}
      </div>
      {item.preview ? (
        <img onError={(e) => { e.currentTarget.style.visibility = "hidden" }} src={item.preview} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-lg bg-[var(--chip)] object-cover" />
      ) : (
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${p.color} 10%, transparent)`, color: p.color }}>
          {p.icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: p.color }}>
            {p.icon}
            {item.platform || "—"}
          </span>
          <span className="text-[var(--muted)]">
            {FORMAT[item.format] ?? item.format}
            {item.slides > 1 && item.format !== "reel" ? ` · ${item.slides} slides` : ""}
            {item.postType && item.ref ? ` · ${item.postType}` : ""}
          </span>
          <StatusPill status={item.status} />
        </div>
        <div className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-[var(--ink)]">{item.caption || item.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-[var(--muted)]">
          <span>{MODE[item.mode.toLowerCase()] ?? item.mode}</span>
          <span className="text-[var(--faint)]">{item.ref ?? `${item.platform === "WordPress" ? "Post" : "Row"} ${Math.abs(item.row)}`}</span>
          {item.url ? (
            <a href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-[var(--brand)] hover:underline">
              Open <ExternalLink className="h-3 w-3" />
            </a>
          ) : null}
        </div>
        {item.error ? <div className="mt-1 text-xs leading-snug text-[var(--bad)]">{item.error}</div> : null}
        {actions ? <RowActions item={item} /> : null}
      </div>
    </li>
  )
}

function dayHeading(key: string, today: string) {
  const diff = Math.round((Date.parse(key) - Date.parse(today)) / 864e5)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  if (diff === -1) return "Yesterday"
  return weekdayDate(`${key}T12:00:00+05:30`)
}

export function ScheduleView({ biz, data: raw, start, end }: { biz: BusinessKey; data: QueueData; start: string; end: string }) {
  const business = BUSINESSES[biz]
  const liveItems = useItems(raw.items)
  const data = useMemo(() => ({ ...raw, items: liveItems }), [raw, liveItems])
  const [platform, setPlatform] = useState("all")
  const [status, setStatus] = useState("all")
  const [q, setQ] = useState("")
  const [mode, setMode] = useState<"list" | "calendar">("list")
  const today = todayIST()
  const platforms = useMemo(() => Array.from(new Set(data.items.map((x) => x.platform).filter(Boolean))), [data])
  const statuses = useMemo(() => Array.from(new Set(data.items.map((x) => x.status).filter(Boolean))), [data])
  const match = (x: QueueItem) =>
    (platform === "all" || x.platform === platform) &&
    (status === "all" || x.status === status) &&
    (!q || `${x.title} ${x.caption} ${x.postType}`.toLowerCase().includes(q.toLowerCase()))
  const items = data.items.filter(match)
  const upcoming = items.filter((x) => x.status.toLowerCase() !== "posted").sort((a, b) => (a.when || "9").localeCompare(b.when || "9"))
  const posted = items
    .filter((x) => x.status.toLowerCase() === "posted")
    .filter((x) => {
      const k = dayKey(x.postedAt || x.when || new Date().toISOString())
      return k >= start && k <= end
    })
    .sort((a, b) => (b.postedAt || b.when || "").localeCompare(a.postedAt || a.when || ""))
  const groups = useMemo(() => {
    const m = new Map<string, QueueItem[]>()
    for (const x of upcoming) {
      const k = x.when ? dayKey(x.when) : "undated"
      m.set(k, [...(m.get(k) || []), x])
    }
    return [...m.entries()]
  }, [upcoming])
  const counts = data.items.reduce<Record<string, number>>((c, x) => ((c[x.status] = (c[x.status] || 0) + 1), c), {})

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="View" value={mode} options={[{ id: "list", label: "List" }, { id: "calendar", label: "Calendar" }]} onChange={setMode} />
        <select id="q-platform" value={platform} onChange={(e) => setPlatform(e.target.value)} className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-xs font-medium text-[var(--ink-2)]">
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select id="q-status" value={status} onChange={(e) => setStatus(e.target.value)} className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-xs font-medium text-[var(--ink-2)]">
          <option value="all">All statuses</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="flex h-8 min-w-[160px] flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-sm sm:max-w-xs">
          <Search className="h-3.5 w-3.5 text-[var(--faint)]" />
          <input id="q-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search posts" className="w-full bg-transparent text-xs text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
        </label>
        <BulkActions readyCount={data.items.filter((x) => /^(ready|scheduled)$/i.test(x.status) && (!x.when || Date.parse(x.when) > Date.now() - 3600_000)).length} pausedCount={data.items.filter((x) => /^paused$/i.test(x.status)).length} />
        <div className="flex flex-wrap gap-1.5 text-[11px] lg:ml-auto">
          {Object.entries(counts).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <StatusPill status={k} />
              <span className="tabular-nums text-[var(--muted)]">{v}</span>
            </span>
          ))}
        </div>
      </div>

      {mode === "calendar" ? (
        <MonthCalendar items={items} today={today} platforms={business.platforms} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <Card title="Scheduled" sub={`${upcoming.length} not yet posted`}>
            {groups.length ? (
              <div className="space-y-4">
                {groups.map(([k, xs]) => (
                  <div key={k}>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--faint)]">{k === "undated" ? "No date set" : dayHeading(k, today)}</div>
                    <ul className="divide-y divide-[var(--line-soft)]">
                      {xs.map((x) => (
                        <QueueRow key={x.row} item={x} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--faint)]">Nothing matches these filters.</div>
            )}
          </Card>
          <Card title="Posted" sub="In the dates chosen above">
            {posted.length ? (
              <ul className="divide-y divide-[var(--line-soft)]">
                {posted.map((x) => (
                  <QueueRow key={x.row} item={x} showDate actions={false} />
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center text-sm text-[var(--faint)]">Nothing posted in these dates.</div>
            )}
          </Card>
        </div>
      )}
      {raw.notes?.map((n) => (
        <div key={n} className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20">{n}</div>
      ))}
      <div className="text-xs text-[var(--faint)]">{biz === "autopilot" ? "Drafts from all your automations. Schedule a draft to approve it; nothing goes out until you do." : `From the ${business.sheetName}${biz === "nestoodle" ? " and the website's blog posts" : ""}.`} Times are India time.</div>
    </div>
  )
}

function MonthCalendar({ items, today, platforms }: { items: QueueItem[]; today: string; platforms: string[] }) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const [picked, setPicked] = useState<string | null>(today)
  const first = `${month}-01`
  const startDow = new Date(`${first}T12:00:00Z`).getUTCDay()
  const gridStart = addDays(first, -((startDow + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  const byDay = useMemo(() => {
    const m = new Map<string, QueueItem[]>()
    for (const x of items) {
      const w = x.status.toLowerCase() === "posted" ? x.postedAt || x.when : x.when
      if (!w) continue
      const k = dayKey(w)
      m.set(k, [...(m.get(k) || []), x])
    }
    return m
  }, [items])
  const shift = (n: number) => {
    const [y, mo] = month.split("-").map(Number)
    const d = new Date(Date.UTC(y, mo - 1 + n, 1))
    setMonth(d.toISOString().slice(0, 7))
  }
  const title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(new Date(`${first}T12:00:00Z`))
  const dayItems = picked ? byDay.get(picked) || [] : []
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card
        title={title}
        action={
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => shift(-1)} className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--chip)]" aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--chip)]">
              Today
            </button>
            <button type="button" onClick={() => shift(1)} className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--chip)]" aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-[var(--faint)]">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="pb-1">
              {d}
            </div>
          ))}
          {cells.map((d) => {
            const xs = byDay.get(d) || []
            const inMonth = d.slice(0, 7) === month
            const sel = picked === d
            return (
              <button
                key={d}
                type="button"
                onClick={() => setPicked(d)}
                className={`flex min-h-[64px] flex-col items-start rounded-lg border p-1.5 text-left transition ${sel ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line-soft)] hover:border-[var(--line-strong)]"} ${inMonth ? "" : "opacity-40"}`}
              >
                <span className={`text-xs tabular-nums ${d === today ? "flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand)] font-semibold text-white" : "text-[var(--ink-2)]"}`}>{Number(d.slice(8))}</span>
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {xs.slice(0, 6).map((x) => {
                    const p = PLATFORM[platformKey(x.platform)] ?? PLATFORM.ga4
                    const failed = x.status.toLowerCase() === "failed"
                    return <span key={x.row} title={`${x.platform} · ${x.status}`} className={`h-1.5 w-1.5 rounded-full ${failed ? "ring-2 ring-red-400" : ""}`} style={{ background: p.color, opacity: x.status.toLowerCase() === "posted" ? 0.45 : 1 }} />
                  })}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
          {platforms.map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM[k].color }} />
              {PLATFORM[k].label}
            </span>
          ))}
          <span className="text-[var(--faint)]">Faded dots = already posted</span>
        </div>
      </Card>
      <Card title={picked ? dayHeading(picked, today) : "Pick a day"} sub={picked ? `${dayItems.length} ${dayItems.length === 1 ? "post" : "posts"}` : undefined}>
        {dayItems.length ? (
          <ul className="divide-y divide-[var(--line-soft)]">
            {dayItems.map((x) => (
              <QueueRow key={x.row} item={x} />
            ))}
          </ul>
        ) : (
          <div className="py-6 text-center text-sm text-[var(--faint)]">Nothing on this day.</div>
        )}
      </Card>
    </div>
  )
}
