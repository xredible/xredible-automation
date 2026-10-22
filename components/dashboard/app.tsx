"use client"

// The dashboard app shell: business switcher, sidebar navigation, date range +
// comparison, per-platform filters, and the active report.

import { useEffect, useMemo, useRef, useState } from "react"
import { BadgeIndianRupee, CalendarRange, Check, ChevronDown, ChevronsUpDown, KeyRound, LogOut, Menu, RefreshCw, Users, X } from "lucide-react"
import type { BlogData, QueueData, SectionData, ToolSummary } from "@/lib/dashboard/types"
import { ACCOUNT_VIEWS, BUSINESSES, TOOL_VIEW, type BusinessKey } from "@/lib/dashboard/businesses"
import { BillingView, BrandSwitcher, ChatWidget, HelpView, SettingsView, VerifyBanner } from "@/components/autopilot/account-views"
import { LinkedInAutopilot } from "@/components/autopilot/customer-app"
import { ToolApp } from "@/components/autopilot/tool-app"
import { CSS as TOOL_CSS } from "@/components/autopilot/ui"
import { signOut } from "@/app/dashboard/actions"
import { addDays, dateTime, daysBetween, rangeLabel, todayIST } from "./format"
import { COMPARE, loadKey, PRESETS, presetDates, readUrl, sectionKey, useSection, writeUrl, type Cmp, type DashState, type Filters, type Preset, type View } from "./state"
import { PLATFORM } from "./brand"
import { FilterBar, SectionView } from "./section-view"
import { ScheduleView } from "./schedule-view"
import { BlogView } from "./blog-view"
import { Overview } from "./overview"
import { Notice, SectionSkeleton, ViewBoundary } from "./ui"
import { QueueActionsProvider } from "./actions"
import { AccountsPanel, CustomersPanel, PasswordPanel, type Me } from "./accounts"

const INTRO: Partial<Record<View, string>> = {
  youtube: "YouTube Analytics is 2–3 days behind, so the last few days fill in later.",
  instagram: "Instagram reports reach per day in its own time zone (US Pacific), so days can be a few hours off India time.",
}

const CSS = `
.dash-root{--bg:#f4f5f7;--panel:#fff;--ink:#0e1627;--ink-2:#334155;--muted:#5d6676;--faint:#8b93a1;--line:#e3e6eb;--line-soft:#eef0f3;--line-strong:#c8cdd5;--chip:#eff1f4;--hover:#f8f9fb;--brand:#24438a;--brand-soft:#eef2fb;--nav:#10203f;--gold:#d4ad4b;--good:#0e7a48;--good-bg:#e7f5ec;--bad:#c2372d;--bad-bg:#fdeceb;--bad-line:#f4c3be;--grid:#e8ebef;--compare:#a4acb8;--spark:#b6bdc8;--bar:rgba(36,67,138,.075);--s1:#24438a;--s2:#d4ad4b;--s3:#3a9d7a;--s4:#d9734a;--s5:#7c6bc4;--s6:#9aa3b0;background:var(--bg);color:var(--ink)}
@media (prefers-color-scheme:dark){.dash-root{--bg:#0b111c;--panel:#121a28;--ink:#eef2f8;--ink-2:#c7cfdb;--muted:#98a2b3;--faint:#6f7a8c;--line:#222c3c;--line-soft:#1a2332;--line-strong:#344158;--chip:#1a2333;--hover:#162031;--brand:#8aa6ee;--brand-soft:#1a2747;--nav:#0a1222;--good:#4fcf8f;--good-bg:#11291e;--bad:#ff8a80;--bad-bg:#2c1716;--bad-line:#5a2b27;--grid:#1f2938;--compare:#5d6879;--spark:#4a5568;--bar:rgba(138,166,238,.12);--s1:#8aa6ee;--s2:#e2c06a;--s3:#5cc39c;--s4:#ec9670;--s5:#a597e6;--s6:#6f7a8c;color-scheme:dark}}
.dash-root select{background-image:none}
`

export function DashboardApp({ allowed, me }: { allowed: BusinessKey[]; me: Me }) {
  const [state, setState] = useState<DashState | null>(null)
  const [panel, setPanel] = useState<"accounts" | "customers" | "password" | null>(null)
  const [menu, setMenu] = useState(false)
  const [tick, setTick] = useState(0)
  const [flash, setFlash] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null)
  // Back from connecting LinkedIn / Facebook: say how it went (read before the URL is rewritten).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const c = q.get("li") || q.get("c")
    const who = q.get("p") === "meta" ? "Facebook" : q.get("p") === "linkedin" ? "LinkedIn" : "Your account"
    if (c === "connected") setFlash({ tone: "good", text: `${who} connected. Your first drafts will appear here in a minute or two.` })
    else if (c === "choose") setFlash({ tone: "info", text: "You manage more than one Facebook Page. Pick the one to post to." })
    else if (c === "cancelled") setFlash({ tone: "info", text: "The connection was cancelled." })
    else if (c === "expired") setFlash({ tone: "bad", text: "That sign-in took too long. Please try again." })
    else if (c === "notready") setFlash({ tone: "info", text: "Connecting is being switched on. Please try again soon." })
    else if (c === "error") setFlash({ tone: "bad", text: q.get("msg") || "Sign-in failed." })
  }, [])
  useEffect(() => setState(readUrl(allowed)), [allowed])
  useEffect(() => {
    if (state) writeUrl(state)
  }, [state])

  const biz = state?.biz ?? allowed[0]
  const business = BUSINESSES[biz]
  const view = state?.view ?? "overview"
  const filters = state?.filters[view] || {}
  const tool = TOOL_VIEW[view]
  const account = ACCOUNT_VIEWS.includes(view)
  const page = !!tool || account
  const key = state && view !== "overview" && !page ? (view === "schedule" ? sectionKey(biz, "queue", state.start, state.end, state.cmp) : sectionKey(biz, view, state.start, state.end, state.cmp, filters)) : null
  const { data, loading, refresh } = useSection(key)
  const compareLabel = state?.cmp === "prev" ? "previous period" : state?.cmp === "yoy" ? "last year" : null

  const set = (patch: Partial<DashState>) => setState((s) => (s ? { ...s, ...patch } : s))
  const go = (v: View) => {
    set({ view: v })
    setMenu(false)
    window.scrollTo({ top: 0 })
  }
  const switchTo = (b: BusinessKey) => {
    set({ biz: b, view: "overview", filters: {} })
    setMenu(false)
    window.scrollTo({ top: 0 })
  }
  const setFilters = (f: Filters) => setState((s) => (s ? { ...s, filters: { ...s.filters, [s.view]: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) } } : s))
  const doRefresh = () => (view === "overview" || page ? setTick((t) => t + 1) : refresh())
  const meta = PLATFORM[view]
  const sectionData = data && data.ok && "kpis" in data ? (data as SectionData) : null
  const updated = data && data.ok ? (data as SectionData | QueueData).generatedAt : null

  return (
    <div className="dash-root min-h-[100dvh] font-[family-name:var(--font-dash),system-ui,sans-serif] antialiased">
      <style>{CSS}</style>
      {biz === "autopilot" && me.role === "customer" ? <ChatWidget /> : null}
      {panel === "accounts" ? <AccountsPanel me={me} onClose={() => setPanel(null)} /> : null}
      {panel === "password" ? <PasswordPanel onClose={() => setPanel(null)} /> : null}
      {panel === "customers" ? <CustomersPanel onClose={() => setPanel(null)} /> : null}
      <div className="lg:grid lg:grid-cols-[244px_minmax(0,1fr)]">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-[264px] transform bg-[var(--nav)] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white transition-transform lg:sticky lg:top-0 lg:z-auto lg:h-[100dvh] lg:w-auto lg:translate-x-0 ${menu ? "translate-x-0" : "-translate-x-full"}`}
          aria-label="Dashboard sections"
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-1 px-3 pb-5 pt-6">
              {biz === "autopilot" && allowed.length === 1 ? <BrandSwitcher /> : <BusinessSwitcher current={biz} allowed={allowed} onPick={switchTo} />}
              <button type="button" onClick={() => setMenu(false)} className="ml-auto shrink-0 rounded-md p-1.5 text-white/70 hover:bg-white/10 lg:hidden" aria-label="Close menu">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-3">
              {business.nav.map((g) => (
                <div key={g.group || "main"}>
                  {g.group ? <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/40">{g.group}</div> : null}
                  <ul className="space-y-0.5">
                    {g.items.map((v) => {
                      const m = PLATFORM[v]
                      const on = view === v
                      return (
                        <li key={v}>
                          <button
                            type="button"
                            onClick={() => go(v)}
                            aria-current={on ? "page" : undefined}
                            className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition ${on ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white"}`}
                          >
                            {on ? <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-[var(--gold)]" aria-hidden /> : null}
                            <span className={on ? "text-[var(--gold)]" : "text-white/55"}>{m.big}</span>
                            {m.label}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            <div className="border-t border-white/10 p-3">
              <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[12px] font-semibold text-[var(--gold)]" aria-hidden>
                  {(me.name || me.email).slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-white">{me.name || me.email}</span>
                  <span className="block truncate text-[11px] text-white/45">{me.role === "admin" ? "Admin" : me.email}</span>
                </span>
              </div>
              {me.role === "admin" ? (
                <button type="button" onClick={() => { setPanel("accounts"); setMenu(false) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/70 hover:bg-white/5 hover:text-white">
                  <Users className="h-4 w-4" />
                  Accounts
                </button>
              ) : null}
              {me.role === "admin" ? (
                <button type="button" onClick={() => { setPanel("customers"); setMenu(false) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/70 hover:bg-white/5 hover:text-white">
                  <BadgeIndianRupee className="h-4 w-4" />
                  Customers
                </button>
              ) : null}
              <button type="button" onClick={() => { setPanel("password"); setMenu(false) }} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/70 hover:bg-white/5 hover:text-white">
                <KeyRound className="h-4 w-4" />
                My password
              </button>
              <form action={signOut}>
                <button type="submit" className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium text-white/60 hover:bg-white/5 hover:text-white">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </aside>
        {menu ? <button type="button" aria-label="Close menu" onClick={() => setMenu(false)} className="fixed inset-0 z-30 bg-black/40 lg:hidden" /> : null}

        {/* Main */}
        <div className="min-w-0">
          <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] pt-[env(safe-area-inset-top)] backdrop-blur-md">
            <div className="mx-auto max-w-[1280px] px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button type="button" onClick={() => setMenu(true)} className="-ml-1 rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--chip)] lg:hidden" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </button>
                <h1 className="!m-0 flex min-w-0 items-center gap-2 !font-sans !text-[1.15rem] font-semibold tracking-[-0.015em] text-[var(--ink)]">
                  <span style={{ color: meta.color === "#10203f" ? "var(--brand)" : meta.color }}>{meta.big}</span>
                  <span className="truncate">{meta.label}</span>
                </h1>
                <div className="ml-auto flex items-center gap-2">
                  {state && view !== "blog" && !page ? <RangePicker state={state} onChange={(p) => set(p)} /> : null}
                  {state && view !== "schedule" && view !== "blog" && !page ? (
                    <label className="relative hidden sm:block">
                      <span className="sr-only">Compare with</span>
                      <select
                        id="cmp"
                        value={state.cmp}
                        onChange={(e) => set({ cmp: e.target.value as Cmp })}
                        className="h-9 appearance-none rounded-lg border border-[var(--line)] bg-[var(--panel)] pl-3 pr-7 text-xs font-medium text-[var(--ink-2)]"
                      >
                        {COMPARE.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.id === "none" ? c.label : `vs ${c.label.toLowerCase()}`}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]" />
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={doRefresh}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)]"
                    title="Get the latest numbers now"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span className="hidden md:inline">Refresh</span>
                  </button>
                </div>
              </div>
              {state && (sectionData || PLATFORM[view]) && view !== "overview" && view !== "schedule" && view !== "blog" && !page ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <label className="relative sm:hidden">
                    <span className="sr-only">Compare with</span>
                    <select id="cmp-m" value={state.cmp} onChange={(e) => set({ cmp: e.target.value as Cmp })} className="h-8 appearance-none rounded-lg border border-[var(--line)] bg-[var(--panel)] pl-2.5 pr-7 text-xs font-medium text-[var(--ink-2)]">
                      {COMPARE.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id === "none" ? c.label : `vs ${c.label.toLowerCase()}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]" />
                  </label>
                  <FilterBar section={view} data={sectionData} filters={filters} onChange={setFilters} />
                  {updated ? <span className="ml-auto hidden text-[11.5px] text-[var(--faint)] md:inline">Updated {dateTime(updated)}</span> : null}
                </div>
              ) : null}
            </div>
            {loading && data ? <div className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-[var(--brand)]" aria-hidden /> : null}
          </header>

          <QueueActionsProvider biz={biz} onChanged={() => (view === "schedule" ? refresh() : window.dispatchEvent(new Event("ec-queue-changed")))} dataStamp={biz + view + (view === "schedule" ? updated || "" : "")}>
          <main className="mx-auto max-w-[1280px] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8">
            <ViewBoundary key={view + (state ? sectionKey(biz, view, state.start, state.end, state.cmp, filters) : "")}>
            {biz === "autopilot" && state ? (
              <div className="mb-4">
                <VerifyBanner />
              </div>
            ) : null}
            {!state ? (
              <SectionSkeleton />
            ) : view === "settings" ? (
              <SettingsView me={me} />
            ) : view === "help" ? (
              <HelpView />
            ) : view === "billing" ? (
              <BillingPage key={tick} start={state.start} end={state.end} go={go} />
            ) : tool ? (
              <div key={tick} className="xd space-y-5 !bg-transparent">
                <style>{TOOL_CSS}</style>
                {flash ? (
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <Notice tone={flash.tone === "bad" ? "error" : "info"}>{flash.text}</Notice>
                    </div>
                    <button type="button" onClick={() => setFlash(null)} className="rounded p-1.5 text-[var(--faint)]" aria-label="Dismiss">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
                {tool === "linkedin" ? <LinkedInAutopilot bare /> : <ToolApp product={tool} bare />}
              </div>
            ) : view === "overview" ? (
              <Overview key={biz} biz={biz} start={state.start} end={state.end} cmp={state.cmp} compareLabel={compareLabel} go={go} refreshTick={tick} />
            ) : !data ? (
              <SectionSkeleton />
            ) : !data.ok ? (
              <Notice tone="error" title={`${meta.label} didn't load`}>
                {data.error} Try Refresh in a minute.
              </Notice>
            ) : view === "schedule" ? (
              <ScheduleView biz={biz} data={data as QueueData} start={state.start} end={state.end} />
            ) : view === "blog" ? (
              <BlogView biz={biz} data={data as BlogData} onChanged={refresh} />
            ) : (
              <div className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
                <SectionView
                  data={data as SectionData}
                  color={meta.color}
                  compareLabel={compareLabel}
                  onFilter={(k, v) => setFilters({ ...filters, [k]: v })}
                  intro={INTRO[view] ? <p className="!m-0 !text-xs text-[var(--faint)]">{INTRO[view]}</p> : null}
                />
              </div>
            )}
            </ViewBoundary>
          </main>
          </QueueActionsProvider>
        </div>
      </div>
    </div>
  )
}

/** Business name in the sidebar; a menu to switch when the password opens more than one. */
function BusinessSwitcher({ current, allowed, onPick }: { current: BusinessKey; allowed: BusinessKey[]; onPick: (b: BusinessKey) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open])
  const b = BUSINESSES[current]
  const name = (
    <>
      <img src={b.icon} alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg" />
      <span className="min-w-0 text-left">
        <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{b.name}</span>
        <span className="block truncate text-[11.5px] text-white/55">{b.subtitle}</span>
      </span>
    </>
  )
  if (allowed.length < 2) return <div className="flex min-w-0 items-center gap-3 px-2">{name}</div>
  return (
    <div className="relative min-w-0 flex-1" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="listbox" className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-white/5" title="Switch business">
        {name}
        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-white/50" />
      </button>
      {open ? (
        <ul role="listbox" aria-label="Businesses" className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-white/10 bg-[#16264a] p-1 shadow-2xl">
          {allowed.map((k) => {
            const x = BUSINESSES[k]
            return (
              <li key={k} role="option" aria-selected={k === current}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    if (k !== current) onPick(k)
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] ${k === current ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}
                >
                  <img src={x.icon} alt="" width={24} height={24} className="h-6 w-6 rounded-md" />
                  <span className="min-w-0 flex-1 truncate font-medium">{x.name}</span>
                  {k === current ? <Check className="h-3.5 w-3.5 text-[var(--gold)]" /> : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

function RangePicker({ state, onChange }: { state: DashState; onChange: (p: Partial<DashState>) => void }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(state.start)
  const [to, setTo] = useState(state.end)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setFrom(state.start)
    setTo(state.end)
  }, [state.start, state.end])
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", esc)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", esc)
    }
  }, [open])
  const today = todayIST()
  const pick = (p: Preset) => {
    if (p === "custom") return
    onChange({ preset: p, ...presetDates(p) })
    setOpen(false)
  }
  const valid = from && to && from <= to && to <= today && daysBetween(from, to) <= 729
  const label = useMemo(() => PRESETS.find((p) => p.id === state.preset)?.label, [state.preset])
  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-xs font-medium text-[var(--ink)] hover:border-[var(--line-strong)]"
      >
        <CalendarRange className="h-3.5 w-3.5 text-[var(--muted)]" />
        <span className="hidden sm:inline">{state.preset === "custom" ? "Custom" : label}</span>
        <span className="text-[var(--muted)] sm:border-l sm:border-[var(--line)] sm:pl-2">{rangeLabel(state.start, state.end)}</span>
        <ChevronDown className="h-3.5 w-3.5 text-[var(--faint)]" />
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-[min(92vw,320px)] rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-xl">
          <ul className="grid grid-cols-2 gap-1">
            {PRESETS.filter((p) => p.id !== "custom").map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pick(p.id)}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs font-medium ${state.preset === p.id ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--ink-2)] hover:bg-[var(--chip)]"}`}
                >
                  {p.label}
                  {state.preset === p.id ? <Check className="h-3.5 w-3.5" /> : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-[var(--line)] px-1 pt-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--faint)]">Custom dates</div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-[11px] text-[var(--muted)]">
                From
                <input id="range-from" type="date" value={from} max={to || today} min={addDays(today, -729)} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-xs text-[var(--ink)]" />
              </label>
              <label className="text-[11px] text-[var(--muted)]">
                To
                <input id="range-to" type="date" value={to} max={today} min={from} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2 py-1.5 text-xs text-[var(--ink)]" />
              </label>
            </div>
            <button
              type="button"
              disabled={!valid}
              onClick={() => {
                onChange({ preset: "custom", start: from, end: to })
                setOpen(false)
              }}
              className="mt-2 w-full rounded-lg bg-[var(--brand)] py-2 text-xs font-semibold text-white disabled:opacity-40 dark:text-[var(--nav)]"
            >
              Apply {valid ? `· ${daysBetween(from, to) + 1} days` : ""}
            </button>
            <p className="!m-0 mt-2 !text-[11px] leading-snug text-[var(--faint)]">Up to 2 years. Pinterest only keeps the last 90 days.</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** Billing needs each tool's plan summary, which comes with the calendar data. */
function BillingPage({ start, end, go }: { start: string; end: string; go: (v: View) => void }) {
  const [tools, setTools] = useState<ToolSummary[] | null>(null)
  useEffect(() => {
    loadKey(sectionKey("autopilot", "queue", start, end, "none"), true).then((d) => setTools(d.ok && "tools" in d ? ((d as QueueData).tools ?? []) : []))
  }, [start, end])
  return <BillingView tools={tools} go={go} />
}
