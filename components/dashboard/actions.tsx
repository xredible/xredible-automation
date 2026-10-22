"use client"

// Changing queue rows from the dashboard: pause, resume, move to draft, retry a failed post,
// reschedule, and pause / resume everything. Changes go through /dashboard/action → the
// business's n8n Dashboard Actions workflow (church: workflow 17), which checks each row
// still looks the way this screen showed it.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { CalendarClock, Check, Copy, FileSpreadsheet, Pause, Play, RotateCcw, Undo2, X } from "lucide-react"
import type { QueueItem } from "@/lib/dashboard/types"
import { BUSINESSES, type BusinessKey } from "@/lib/dashboard/businesses"
import { TZ } from "./format"

export const sheetRowUrl = (biz: BusinessKey, row: number) => BUSINESSES[biz].rowUrl.replace("{row}", String(row))

type Body =
  | { action: "status"; to: "ready" | "paused" | "draft"; rows: { row: number; expect: string }[] }
  | { action: "reschedule"; when: string; rows: { row: number; expect: string }[] }
  | { action: "pause_all" }
  | { action: "resume_all" }

type Result = {
  ok: boolean
  error?: string | null
  changed?: number
  done?: { row: number; to: string; late?: boolean; status?: string }[]
  skipped?: { row: number; why: string }[]
}

type Override = { status?: string; when?: string }

type Ctx = {
  biz: BusinessKey
  run: (body: Body, success: string) => Promise<Result>
  busy: number | "all" | null
  overrides: Record<number, Override>
}

const ActionsContext = createContext<Ctx | null>(null)

export function useQueueActions() {
  return useContext(ActionsContext)
}

function apply(item: QueueItem, o: Override | undefined): QueueItem {
  if (!o) return item
  return { ...item, status: o.status ?? item.status, when: o.when ?? item.when, error: o.status ? null : item.error }
}

/** Applies changes made on this screen until fresh data arrives from the sheet. */
export function useItems(items: QueueItem[]): QueueItem[] {
  const ctx = useContext(ActionsContext)
  const o = ctx?.overrides
  return o && Object.keys(o).length ? items.map((x) => apply(x, o[x.row])) : items
}

const istToIso = (v: string) => `${v}:00+05:30`

export function QueueActionsProvider({ biz, onChanged, children, dataStamp }: { biz: BusinessKey; onChanged: () => void; children: ReactNode; dataStamp: string | null }) {
  const [busy, setBusy] = useState<number | "all" | null>(null)
  const [overrides, setOverrides] = useState<Record<number, Override>>({})
  const [toast, setToast] = useState<{ tone: "ok" | "bad"; text: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // New data from the sheet replaces what this screen guessed.
  useEffect(() => setOverrides({}), [dataStamp])

  const show = (tone: "ok" | "bad", text: string) => {
    setToast({ tone, text })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), tone === "ok" ? 6000 : 12000)
  }

  const run = useCallback(
    async (body: Body, success: string): Promise<Result> => {
      setBusy("rows" in body && body.rows.length === 1 ? body.rows[0].row : "all")
      let res: Result
      try {
        const r = await fetch("/dashboard/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, biz }) })
        if (r.status === 401) window.location.reload()
        res = (await r.json().catch(() => ({ ok: false, error: `The dashboard server answered with HTTP ${r.status}.` }))) as Result
      } catch {
        res = { ok: false, error: "No internet connection. Nothing was changed." }
      }
      setBusy(null)
      if (!res.ok) {
        show("bad", res.error || "That didn't work. Nothing was changed.")
        return res
      }
      const next: Record<number, Override> = {}
      for (const d of res.done || []) {
        if (body.action === "reschedule") next[d.row] = { when: istToIso(body.when), ...(d.status ? { status: d.status } : {}) }
        else next[d.row] = { status: d.to }
      }
      setOverrides((cur) => ({ ...cur, ...next }))
      const skipped = res.skipped || []
      const late = (res.done || []).some((d) => d.late)
      if (!res.changed && skipped.length) show("bad", skipped[0].why)
      else
        show(
          skipped.length ? "bad" : "ok",
          `${success}${res.changed && res.changed > 1 ? ` (${res.changed} posts)` : ""}.${late ? " Its time has passed, so it goes out at the next hourly check." : ""}${skipped.length ? ` ${skipped.length} not changed: ${skipped[0].why}` : ""}`,
        )
      onChanged()
      return res
    },
    [onChanged, biz],
  )

  return (
    <ActionsContext.Provider value={{ biz, run, busy, overrides }}>
      {children}
      {toast ? (
        <div role="status" className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
          <div className={`flex max-w-lg items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-xl ${toast.tone === "ok" ? "bg-[var(--nav)] text-white" : "bg-[var(--bad)] text-white"}`}>
            {toast.tone === "ok" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="leading-snug">{toast.text}</span>
            <button type="button" onClick={() => setToast(null)} className="-mr-1 ml-1 rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}
    </ActionsContext.Provider>
  )
}

const btn = "inline-flex h-7 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-[11.5px] font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] hover:text-[var(--ink)] disabled:opacity-50"

function istInput(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000)
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d).map((p) => [p.type, p.value]))
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

/** Buttons under a queue row. Posted and in-progress rows only get Copy / Sheet. */
export function RowActions({ item }: { item: QueueItem }) {
  const ctx = useQueueActions()
  const [resched, setResched] = useState(false)
  const [when, setWhen] = useState(() => istInput(item.when))
  const [copied, setCopied] = useState(false)
  if (!ctx) return null
  const business = BUSINESSES[ctx.biz]
  const s = (item.status || "").toLowerCase()
  // Calendars without a Dashboard Actions workflow only get Copy / open.
  const locked = s === "posted" || s === "processing" || !business.actions || !!item.readOnly
  const busy = ctx.busy === item.row || ctx.busy === "all"
  const one = [{ row: item.row, expect: item.status }]
  const past = item.when ? Date.parse(item.when) < Date.now() : false
  const pin = /pinterest/i.test(item.platform)

  const setStatus = (to: "ready" | "paused" | "draft", msg: string) => {
    if (to === "ready" && past && s !== "failed" && !window.confirm("This post's time has already passed, so it will go out at the next hourly check. Post it then?")) return
    ctx.run({ action: "status", to, rows: one }, msg)
  }
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.caption || item.title)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {!locked && (s === "ready" || s === "scheduled") ? (
        <button type="button" disabled={busy} onClick={() => setStatus("paused", "Paused. It won't post until you resume it")} className={btn}>
          <Pause className="h-3 w-3" /> Pause
        </button>
      ) : null}
      {!locked && s === "paused" ? (
        <button type="button" disabled={busy} onClick={() => setStatus("ready", "Resumed. It will post at its time")} className={btn}>
          <Play className="h-3 w-3" /> Resume
        </button>
      ) : null}
      {!locked && s === "failed" ? (
        <button type="button" disabled={busy} onClick={() => setStatus("ready", "Set to try again at the next hourly check")} className={btn}>
          <RotateCcw className="h-3 w-3" /> Retry
        </button>
      ) : null}
      {!locked && !["ready", "scheduled", "paused", "failed"].includes(s) ? (
        <button type="button" disabled={busy} onClick={() => setStatus("ready", pin ? "Approved. The pin will post at its time" : "Scheduled. It will post at its time")} className={btn}>
          <Play className="h-3 w-3" /> {pin ? "Approve" : "Schedule"}
        </button>
      ) : null}
      {!locked && s !== "draft" ? (
        <button type="button" disabled={busy} onClick={() => setStatus("draft", "Moved to Draft")} className={btn}>
          <Undo2 className="h-3 w-3" /> Draft
        </button>
      ) : null}
      {!locked ? (
        <button type="button" disabled={busy} onClick={() => setResched((v) => !v)} className={btn} aria-expanded={resched}>
          <CalendarClock className="h-3 w-3" /> Reschedule
        </button>
      ) : null}
      <button type="button" onClick={copy} className={btn} title="Copy the caption" aria-label="Copy the caption">
        {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} <span className="hidden sm:inline">{copied ? "Copied" : "Caption"}</span>
      </button>
      {item.editUrl || business.rowUrl ? (
        <a href={item.editUrl || sheetRowUrl(ctx.biz, item.row)} target="_blank" rel="noreferrer" className={btn} title={item.readOnly ? "Open it in WordPress" : `Open it in ${business.sheetName}`} aria-label={item.readOnly ? "Open it in WordPress" : `Open it in ${business.sheetName}`}>
          <FileSpreadsheet className="h-3 w-3" /> <span className="hidden sm:inline">{item.readOnly ? "Edit" : business.rowLabel}</span>
        </a>
      ) : null}
      {busy ? <span className="text-[11px] text-[var(--faint)]">Saving…</span> : null}
      {resched && !locked ? (
        <form
          className="flex w-full flex-wrap items-center gap-1.5 pt-1"
          onSubmit={async (e) => {
            e.preventDefault()
            const r = await ctx.run({ action: "reschedule", when, rows: one }, "Rescheduled")
            if (r.ok && r.changed) setResched(false)
          }}
        >
          <label className="sr-only" htmlFor={`when-${item.row}`}>New date and time (India time)</label>
          <input
            id={`when-${item.row}`}
            type="datetime-local"
            value={when}
            min={istInput(null).slice(0, 10) + "T00:00"}
            onChange={(e) => setWhen(e.target.value)}
            required
            className="h-7 rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 text-xs text-[var(--ink)]"
          />
          <button type="submit" disabled={busy || !when} className="inline-flex h-7 items-center rounded-md bg-[var(--brand)] px-2.5 text-[11.5px] font-semibold text-white disabled:opacity-50 dark:text-[var(--nav)]">
            Save
          </button>
          <button type="button" onClick={() => setResched(false)} className="h-7 px-1.5 text-[11.5px] text-[var(--muted)] hover:text-[var(--ink)]">
            Cancel
          </button>
          <span className="w-full text-[11px] text-[var(--faint)]">India time. {s === "failed" ? "A failed post is also set to try again." : "The status stays the same."}</span>
        </form>
      ) : null}
    </div>
  )
}

/** "Pause everything" for emergencies, and "Resume paused". */
export function BulkActions({ readyCount, pausedCount }: { readyCount: number; pausedCount: number }) {
  const ctx = useQueueActions()
  if (!ctx || !BUSINESSES[ctx.biz].actions) return null
  const busy = ctx.busy !== null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        disabled={busy || !readyCount}
        onClick={() => {
          if (window.confirm(`Pause all ${readyCount} scheduled posts? Nothing will post until you resume them.`)) ctx.run({ action: "pause_all" }, "Paused all scheduled posts")
        }}
        className={btn}
        title="Stop every scheduled post from going out"
      >
        <Pause className="h-3 w-3" /> Pause all{readyCount ? ` (${readyCount})` : ""}
      </button>
      <button
        type="button"
        disabled={busy || !pausedCount}
        onClick={() => {
          if (window.confirm(`Resume ${pausedCount} paused posts? Posts whose time has already passed stay paused.`)) ctx.run({ action: "resume_all" }, "Resumed paused posts")
        }}
        className={btn}
        title="Put paused posts back on schedule"
      >
        <Play className="h-3 w-3" /> Resume paused{pausedCount ? ` (${pausedCount})` : ""}
      </button>
    </div>
  )
}
