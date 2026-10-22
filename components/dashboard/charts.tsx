"use client"

// Dependency-free SVG charts: sparkline, interactive trend chart (with comparison line),
// share bar and a day × hour heatmap.

import { useMemo, useRef, useState } from "react"
import type { Format, Point } from "@/lib/dashboard/types"
import { fmt, longDate, shortDate } from "./format"

const valid = (p: Point) => p.v !== null && Number.isFinite(p.v as number)

export function Sparkline({ data, color, height = 30 }: { data: Point[]; color: string; height?: number }) {
  const pts = data.filter(valid) as { d: string; v: number }[]
  if (pts.length < 2) return <div style={{ height }} aria-hidden />
  const W = 120
  const min = Math.min(0, ...pts.map((p) => p.v))
  const max = Math.max(...pts.map((p) => p.v), min + 1)
  const x = (i: number) => (i / (pts.length - 1)) * W
  const y = (v: number) => height - 2 - ((v - min) / (max - min)) * (height - 4)
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden>
      <path d={`${line} L${W},${height} L0,${height} Z`} fill={color} opacity={0.1} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function niceMax(v: number) {
  if (v <= 0) return 1
  if (v >= 1 && v <= 2) return 2 // keeps the 0 / half / top ticks distinct for small counts
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}

export function TrendChart({
  series,
  cseries,
  color,
  format = "number",
  label,
  compareLabel,
  height = 240,
}: {
  series: Point[]
  cseries?: Point[] | null
  color: string
  format?: Format
  label: string
  compareLabel?: string | null
  height?: number
}) {
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const n = series.length
  const W = 1000
  const H = height
  const top = 12
  const bottom = 28
  const left = 0
  const { max, min } = useMemo(() => {
    const all = [...series, ...(cseries || [])].filter(valid).map((p) => p.v as number)
    const lo = Math.min(0, ...all)
    return { max: niceMax(Math.max(...all, 0) || 1), min: lo < 0 ? -niceMax(-lo) : 0 }
  }, [series, cseries])
  if (n < 2) {
    return <div className="flex h-48 items-center justify-center text-sm text-[var(--faint)]">Not enough days to draw a trend for these dates.</div>
  }
  const x = (i: number) => left + (i / (n - 1)) * (W - left)
  const y = (v: number) => top + (1 - (v - min) / (max - min)) * (H - top - bottom)
  const path = (pts: Point[]) => {
    let d = ""
    let pen = false
    pts.slice(0, n).forEach((p, i) => {
      if (!valid(p)) {
        pen = false
        return
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(p.v as number).toFixed(1)}`
      pen = true
    })
    return d
  }
  const main = path(series)
  const comp = cseries && cseries.length ? path(cseries) : ""
  const firstValid = series.findIndex(valid)
  const lastValid = series.length - 1 - [...series].reverse().findIndex(valid)
  const area = main && firstValid >= 0 ? `${main} L${x(lastValid).toFixed(1)},${y(min)} L${x(firstValid).toFixed(1)},${y(min)} Z` : ""
  const ticks = [0, 0.5, 1].map((f) => min + f * (max - min))
  const xticks = n <= 8 ? series.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1]

  const onMove = (clientX: number) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    setHover(Math.round(f * (n - 1)))
  }
  const hv = hover !== null ? series[hover] : null
  const hc = hover !== null && cseries ? cseries[hover] : null
  const hx = hover !== null ? (x(hover) / W) * 100 : 0

  return (
    <figure className="m-0">
      <figcaption className="sr-only">
        {label} from {shortDate(series[0].d)} to {shortDate(series[n - 1].d)}.
      </figcaption>
      <div className="flex gap-2">
        <div className="relative flex w-10 shrink-0 flex-col justify-between pb-[28px] pt-[4px] text-right text-[10.5px] tabular-nums text-[var(--faint)]" style={{ height: H }} aria-hidden>
          {[...ticks].reverse().map((t, i) => (
            <span key={i}>{fmt(t, format === "duration" ? "duration" : format === "percent" ? "percent" : "number", true)}</span>
          ))}
        </div>
        <div
          ref={box}
          className="relative min-w-0 flex-1 touch-pan-y"
          onPointerMove={(e) => onMove(e.clientX)}
          onPointerDown={(e) => onMove(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: H }} role="img" aria-label={label}>
            {ticks.map((t, i) => (
              <line key={i} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="var(--grid)" strokeWidth={1} vectorEffect="non-scaling-stroke" strokeDasharray={i === 0 ? undefined : "3 4"} />
            ))}
            {area ? <path d={area} fill={color} opacity={0.09} /> : null}
            {comp ? <path d={comp} fill="none" stroke="var(--compare)" strokeWidth={1.5} strokeDasharray="5 5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" /> : null}
            <path d={main} fill="none" stroke={color} strokeWidth={2.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
            {hover !== null ? <line x1={x(hover)} x2={x(hover)} y1={top} y2={H - bottom} stroke="var(--line-strong)" strokeWidth={1} vectorEffect="non-scaling-stroke" /> : null}
          </svg>
          {hover !== null && hv && valid(hv) ? (
            <span className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${hx}%`, top: `${(y(hv.v as number) / H) * 100}%`, background: color }} />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[22px] text-[10.5px] tabular-nums text-[var(--faint)]" aria-hidden>
            {xticks.map((i) => (
              <span key={i} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full" style={{ left: `${(x(i) / W) * 100}%` }}>
                {shortDate(series[i].d)}
              </span>
            ))}
          </div>
          {hover !== null && hv ? (
            <div
              className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-xs shadow-lg"
              style={hx > 60 ? { right: `${100 - hx + 2}%` } : { left: `${hx + 2}%` }}
            >
              <div className="font-medium text-[var(--ink)]">{longDate(hv.d)}</div>
              <div className="mt-1 flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5 text-[var(--muted)]">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />
                  {label}
                </span>
                <span className="font-semibold tabular-nums text-[var(--ink)]">{fmt(hv.v, format)}</span>
              </div>
              {hc ? (
                <div className="mt-0.5 flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5 text-[var(--muted)]">
                    <span className="h-0.5 w-2.5 bg-[var(--compare)]" />
                    {shortDate(hc.d)}
                  </span>
                  <span className="tabular-nums text-[var(--muted)]">{fmt(hc.v, format)}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-[11.5px] text-[var(--muted)]">
        <span className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded" style={{ background: color }} />
          This period
        </span>
        {comp ? (
          <span className="flex items-center gap-1.5">
            <span className="h-0 w-4 border-t-2 border-dashed border-[var(--compare)]" />
            {compareLabel || "Comparison"}
          </span>
        ) : null}
      </div>
    </figure>
  )
}

const SHARE_COLORS = ["var(--s1)", "var(--s2)", "var(--s3)", "var(--s4)", "var(--s5)", "var(--s6)"]

export function ShareBar({ parts }: { parts: { label: string; value: number; display: string }[] }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0)
  if (!total) return <div className="py-4 text-sm text-[var(--faint)]">No data for these dates.</div>
  const shown = parts.filter((p) => p.value > 0)
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-[var(--chip)]" role="img" aria-label={shown.map((p) => `${p.label} ${Math.round((p.value / total) * 100)}%`).join(", ")}>
        {shown.map((p, i) => (
          <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: SHARE_COLORS[i % SHARE_COLORS.length] }} className="h-full border-r-2 border-[var(--panel)] last:border-r-0" />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {shown.map((p, i) => (
          <li key={p.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 text-[var(--ink-2)]">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: SHARE_COLORS[i % SHARE_COLORS.length] }} />
              <span className="truncate">{p.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-[var(--muted)]">
              <span className="font-semibold text-[var(--ink)]">{Math.round((p.value / total) * 100)}%</span>
              <span className="ml-2">{p.display}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Heatmap({ grid, days, color }: { grid: number[][]; days: string[]; color: string }) {
  const max = Math.max(1, ...grid.flat())
  const order = [1, 2, 3, 4, 5, 6, 0]
  const hours = [0, 6, 12, 18]
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid gap-[3px]" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
          {order.map((d) => (
            <div key={d} className="contents">
              <div className="pr-1 text-right text-[11px] leading-[18px] text-[var(--faint)]">{days[d]}</div>
              {grid[d].map((v, h) => (
                <div
                  key={h}
                  title={`${days[d]} ${h}:00 – ${v} visitor${v === 1 ? "" : "s"}`}
                  className="h-[18px] rounded-[3px]"
                  style={{ background: v ? color : "var(--chip)", opacity: v ? 0.18 + 0.82 * (v / max) : 1 }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1 grid" style={{ gridTemplateColumns: "36px repeat(24, minmax(0, 1fr))" }}>
          <div />
          {Array.from({ length: 24 }).map((_, h) => (
            <div key={h} className="text-[10.5px] text-[var(--faint)]">
              {hours.includes(h) ? (h === 0 ? "12am" : h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h - 12}pm`) : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
