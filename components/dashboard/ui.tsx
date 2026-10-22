"use client"

// Shared building blocks: cards, KPI tiles, change pills, notices, skeletons.

import { Component, useState, type ReactNode } from "react"
import { AlertTriangle, Info } from "lucide-react"
import type { Kpi } from "@/lib/dashboard/types"
import { change, fmt } from "./format"
import { Sparkline } from "./charts"

export function Card({ title, sub, action, children, className = "", pad = true }: { title?: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`min-w-0 rounded-xl border border-[var(--line)] bg-[var(--panel)] ${pad ? "p-4 sm:p-5" : ""} ${className}`}>
      {(title || action) && (
        <div className={`flex items-start justify-between gap-3 ${pad ? "mb-3" : "px-4 pt-4 sm:px-5 sm:pt-5"}`}>
          <div className="min-w-0">
            <div className="text-[0.92rem] font-semibold tracking-[-0.005em] text-[var(--ink)]">{title}</div>
            {sub ? <div className="mt-0.5 text-xs text-[var(--muted)]">{sub}</div> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  )
}

export function Delta({ cur, prev, invert, size = "sm" }: { cur: number | null | undefined; prev: number | null | undefined; invert?: boolean; size?: "sm" | "xs" }) {
  const c = change(cur, prev, invert)
  if (!c) return null
  const cls =
    c.tone === "up" || c.tone === "new"
      ? "bg-[var(--good-bg)] text-[var(--good)]"
      : c.tone === "down"
        ? "bg-[var(--bad-bg)] text-[var(--bad)]"
        : "bg-[var(--chip)] text-[var(--muted)]"
  const arrow = c.text.startsWith("+") ? "↑" : c.text.startsWith("−") ? "↓" : ""
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums ${size === "xs" ? "text-[10.5px]" : "text-[11.5px]"} ${cls}`}>
      {arrow && c.tone !== "new" ? <span aria-hidden>{arrow}</span> : null}
      {c.text}
    </span>
  )
}

export function Help({ text }: { text?: string }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="What this means"
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onBlur={() => setOpen(false)}
        className="rounded p-0.5 text-[var(--faint)] hover:text-[var(--muted)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--brand)]"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <span role="tooltip" className="absolute left-1/2 top-6 z-30 w-56 -translate-x-1/2 rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-normal leading-relaxed text-white shadow-lg">
          {text}
        </span>
      ) : null}
    </span>
  )
}

export function KpiTile({ k, color, active, onSelect, compareLabel, showSpark = true }: { k: Kpi; color: string; active?: boolean; onSelect?: () => void; compareLabel?: string | null; showSpark?: boolean }) {
  const selectable = Boolean(onSelect && k.series && k.series.length > 1)
  const body = (
    <>
      <div className="flex items-center gap-1 text-[12.5px] font-medium text-[var(--muted)]">
        <span className="truncate">{k.label}</span>
        <Help text={k.help} />
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[1.55rem] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--ink)]">{fmt(k.value, k.format, true)}</span>
        <Delta cur={k.value} prev={k.prev} invert={k.invert} />
      </div>
      {compareLabel && k.prev !== null ? (
        <div className="mt-1 truncate text-[11.5px] text-[var(--faint)]">
          {fmt(k.prev, k.format, true)} {compareLabel}
        </div>
      ) : (
        <div className="mt-1 h-[17px]" />
      )}
      {showSpark && k.series && k.series.length > 1 ? (
        <div className="mt-2">
          <Sparkline data={k.series} color={active ? color : "var(--spark)"} />
        </div>
      ) : null}
    </>
  )
  const base = "relative flex min-w-0 flex-col rounded-xl border bg-[var(--panel)] p-3.5 text-left transition sm:p-4"
  if (!selectable) return <div className={`${base} border-[var(--line)]`}>{body}</div>
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect?.()
        }
      }}
      aria-pressed={active}
      className={`${base} ${active ? "border-transparent ring-2" : "border-[var(--line)] hover:border-[var(--line-strong)]"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]`}
      style={active ? ({ ["--tw-ring-color" as string]: color } as React.CSSProperties) : undefined}
    >
      {body}
    </div>
  )
}

export function Notice({ tone = "info", title, children }: { tone?: "info" | "warn" | "error"; title?: string; children: ReactNode }) {
  const cls = tone === "error" ? "border-[var(--bad-line)] bg-[var(--bad-bg)] text-[var(--bad)]" : tone === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-[var(--line)] bg-[var(--chip)] text-[var(--muted)]"
  return (
    <div className={`flex gap-2.5 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {tone === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <div className="min-w-0 leading-relaxed">
        {title ? <div className="font-semibold">{title}</div> : null}
        <div className="break-words">{children}</div>
      </div>
    </div>
  )
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-[var(--chip)] ${className}`} />
}

export function SectionSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-16" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[118px]" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-lg bg-[var(--chip)] p-0.5 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition ${value === o.id ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Keeps one broken view from blanking the whole dashboard: shows the error and a retry button. */
export class ViewBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error) {
    console.error("Dashboard view crashed:", error)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <Notice tone="error" title="This part of the dashboard hit a problem">
        <span className="block break-words font-mono text-[12px]">{this.state.error.message || String(this.state.error)}</span>
        <button type="button" onClick={() => this.setState({ error: null })} className="mt-3 rounded-md border border-[var(--line-strong)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:bg-[var(--hover)]">
          Try again
        </button>
      </Notice>
    )
  }
}
