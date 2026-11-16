"use client"

// The dashboard app shell: business switcher, sidebar navigation, date range +
// comparison, per-platform filters, and the active report.

import { useEffect, useRef, useState } from "react"
import { Check, ChevronDown, ChevronsUpDown, RefreshCw, X } from "lucide-react"
import type { BlogData, QueueData, SectionData, ToolSummary } from "@/lib/dashboard/types"
import { ACCOUNT_VIEWS, ADMIN_VIEWS, BUSINESSES, TOOL_VIEW, hubOf, type BusinessKey } from "@/lib/dashboard/businesses"
import { AnnouncementBanner, BillingView, BrandSwitcher, ChatWidget, HelpView, SettingsView, VerifyBanner, ViewAsBanner } from "@/components/autopilot/account-views"
import { BusinessWorkspace } from "./business-workspace"
import { isWorkspace } from "@/lib/dashboard/business-workspace"
import { IdeasView } from "@/components/autopilot/ideas-view"
import { BrandKitView } from "@/components/autopilot/brand-kit"
import { AdminAnnounce, AdminCoupons, AdminCustomers, AdminHealth, AdminLeads, AdminPayments, AdminRevenue } from "./admin-views"
import { LinkedInAutopilot } from "@/components/autopilot/customer-app"
import { ToolApp } from "@/components/autopilot/tool-app"
import { CSS as TOOL_CSS } from "@/components/autopilot/ui"
import { AvatarMenu, HubSidebar, HubSubnav, MobileHubBar } from "./hub-navigation"
import "./shell.css"
import { dateTime } from "./format"
import { COMPARE, loadKey, readUrl, sectionKey, useSection, writeUrl, type Cmp, type DashState, type Filters, type View } from "./state"
import { PLATFORM } from "./brand"
import { FilterBar, SectionView } from "./section-view"
import { ScheduleView } from "./schedule-view"
import { BlogView } from "./blog-view"
import { PrintablesView } from "./printables-view"
import { GenericPrintables } from "./printables-generic"
import { RangePicker, ResultsDateControls } from "./date-controls"
import { ResultsSummary } from "./results-hub"
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
  const [tick, setTick] = useState(0)
  const [flash, setFlash] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null)
  // Back from connecting LinkedIn / Facebook: say how it went (read before the URL is rewritten).
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const c = q.get("li") || q.get("c")
    const who = q.get("p") === "meta" ? "Facebook" : q.get("p") === "linkedin" ? "LinkedIn" : "Your account"
    if (c === "connected") setFlash({ tone: "good", text: `${who} connected. Your first drafts will appear here in a minute or two.` })
    else if (c === "choose") setFlash({ tone: "info", text: "You manage more than one Facebook Page. Pick the one to post to." })
    else if (c === "extra") setFlash({ tone: "good", text: `The extra ${q.get("p") === "meta" ? "Facebook Page" : "LinkedIn profile"} is connected. Pick it under “Post to” on any post.` })
    else if (c === "extra-choose") setFlash({ tone: "info", text: "One more step: pick the Page to add under “More Facebook Pages”." })
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
  const asked = state?.view ?? "overview"
  // Admin pages only for admins (the API refuses everyone else too).
  const view = ADMIN_VIEWS.includes(asked) && me.role !== "admin" ? "overview" : asked
  const activeHub = hubOf(biz, view)
  const isResults = activeHub.key === "results"
  const filters = state?.filters[view] || {}
  const tool = TOOL_VIEW[view]
  const workspacePage = isWorkspace(biz) && (view === "automations" || view.startsWith("automation-") || ["ap-ideas", "ap-brand", "settings", "help", "email"].includes(view))
  const account = ACCOUNT_VIEWS.includes(view) || ADMIN_VIEWS.includes(view)
  // Pages that load their own data (no date range).
  const page = !!tool || account || view === "printables" || (workspacePage && view !== "email")
  const key = state && view !== "overview" && view !== "all-results" && !page ? (view === "schedule" ? sectionKey(biz, "queue", state.start, state.end, state.cmp) : sectionKey(biz, view, state.start, state.end, state.cmp, filters)) : null
  const { data, loading, refresh } = useSection(key)
  const compareLabel = state?.cmp === "prev" ? "previous period" : state?.cmp === "yoy" ? "last year" : null

  const set = (patch: Partial<DashState>) => setState((s) => (s ? { ...s, ...patch } : s))
  const go = (v: View) => {
    set({ view: v })
    window.scrollTo({ top: 0 })
  }
  const switchTo = (b: BusinessKey) => {
    set({ biz: b, view: "overview", filters: {} })
    window.scrollTo({ top: 0 })
  }
  const setFilters = (f: Filters) => setState((s) => (s ? { ...s, filters: { ...s.filters, [s.view]: Object.fromEntries(Object.entries(f).filter(([, v]) => v)) } } : s))
  const doRefresh = () => (view === "overview" || view === "all-results" || page ? setTick((t) => t + 1) : refresh())
  const accountPage = (v: View) => set({ biz: "autopilot", view: v, filters: {} })
  const avatar = <AvatarMenu me={me} allowed={allowed} onAccounts={() => setPanel("accounts")} onCustomers={() => allowed.includes("autopilot") ? accountPage("admin-customers") : setPanel("customers")} onPassword={() => setPanel("password")} onPage={accountPage} />
  const brand = biz === "autopilot" && allowed.length === 1 ? <BrandSwitcher /> : <BusinessSwitcher current={biz} allowed={allowed} onPick={switchTo} />
  const meta = { ...PLATFORM[view], label: business.labels?.[view] || PLATFORM[view]?.label }
  const sectionData = data && data.ok && "kpis" in data ? (data as SectionData) : null
  const reportCompareLabel = sectionData?.range.cmp === "prev" ? "previous period" : sectionData?.range.cmp === "yoy" ? "last year" : null
  const updated = data && data.ok ? (data as SectionData | QueueData).generatedAt : null

  return (
    <div data-business={biz} className="dash-root min-h-[100dvh] antialiased">
      <style>{CSS}</style>
      {biz === "autopilot" && me.role === "customer" ? <ChatWidget /> : null}
      {panel === "accounts" ? <AccountsPanel me={me} onClose={() => setPanel(null)} /> : null}
      {panel === "password" ? <PasswordPanel onClose={() => setPanel(null)} /> : null}
      {panel === "customers" ? <CustomersPanel onClose={() => setPanel(null)} /> : null}
      <div className="dash-shell-grid">
        <HubSidebar biz={biz} view={view} admin={me.role === "admin"} go={go} />
        {/* Main */}
        <div className="min-w-0">
          <header className="dash-shell-header">
            <div className="dash-mobile-brand">{brand}{avatar}</div>
            <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
              <div className="dash-shell-heading">
                <div className="min-w-0">
                  <div className="dash-hub-eyebrow">{business.name} <span aria-hidden> / </span> {activeHub.label}</div>
                  <h1 className="dash-page-title">{view === "overview" ? "Home" : isResults ? "Results" : meta.label}</h1>
                </div>
                <div className="dash-shell-tools">
                  {state && view !== "blog" && !page ? isResults ? <ResultsDateControls state={state} onChange={set} /> : <RangePicker state={state} onChange={set} /> : null}
                  {state && !isResults && view !== "schedule" && view !== "blog" && !page ? (
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
                    aria-label="Refresh"
                    title="Get the latest numbers now"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                    <span className="hidden md:inline">Refresh</span>
                  </button>
                </div>
              </div>
              {state && (sectionData || PLATFORM[view]) && view !== "overview" && view !== "all-results" && view !== "schedule" && view !== "blog" && !page ? (
                <div className="dash-shell-filters mt-2.5 flex flex-wrap items-center gap-2">
                  {!isResults ? <label className="relative sm:hidden">
                    <span className="sr-only">Compare with</span>
                    <select id="cmp-m" value={state.cmp} onChange={(e) => set({ cmp: e.target.value as Cmp })} className="h-8 appearance-none rounded-lg border border-[var(--line)] bg-[var(--panel)] pl-2.5 pr-7 text-xs font-medium text-[var(--ink-2)]">
                      {COMPARE.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.id === "none" ? c.label : `vs ${c.label.toLowerCase()}`}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--faint)]" />
                  </label> : null}
                  <FilterBar section={view} data={sectionData} filters={filters} onChange={setFilters} />
                  {updated ? <span className="ml-auto hidden text-[11.5px] text-[var(--faint)] md:inline">Updated {dateTime(updated)}</span> : null}
                </div>
              ) : null}
            </div>
            {loading && data ? <div className="absolute inset-x-0 bottom-0 h-0.5 animate-pulse bg-[var(--brand)]" aria-hidden /> : null}
          </header>
          {/* Phones: the header scrolls away with the page; only this slim row of page chips stays on top. */}
          <HubSubnav biz={biz} view={view} go={go} />

          <QueueActionsProvider biz={biz} onChanged={() => (view === "schedule" ? refresh() : window.dispatchEvent(new Event("ec-queue-changed")))} dataStamp={biz + view + (view === "schedule" ? updated || "" : "")}>
          <main className="dash-main mx-auto max-w-[1280px] px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-8">
            {isResults ? <h2 className="sr-only">{meta.label}</h2> : null}
            <ViewBoundary key={view + (state ? sectionKey(biz, view, state.start, state.end, state.cmp, filters) : "")}>
            {biz === "autopilot" && state ? (
              <div className="mb-4 space-y-3 empty:hidden">
                <ViewAsBanner />
                <VerifyBanner />
                <AnnouncementBanner />
              </div>
            ) : null}
            {!state ? (
              <SectionSkeleton />
            ) : workspacePage && isWorkspace(biz) ? (
              <BusinessWorkspace key={`${biz}-${view}-${tick}`} biz={biz} view={view} owner={me.role === "admin"} go={go} emailData={sectionData} compareLabel={isResults ? reportCompareLabel : compareLabel} emailError={data && !data.ok ? data.error : undefined} />
            ) : view === "ap-brand" ? (
              <BrandKitView key={tick} />
            ) : view === "ap-ideas" ? (
              <IdeasView key={tick} go={go} />
            ) : view === "admin-revenue" ? (
              <AdminRevenue key={tick} />
            ) : view === "admin-customers" ? (
              <AdminCustomers key={tick} />
            ) : view === "admin-payments" ? (
              <AdminPayments key={tick} />
            ) : view === "admin-leads" ? (
              <AdminLeads key={tick} />
            ) : view === "admin-coupons" ? (
              <AdminCoupons key={tick} />
            ) : view === "admin-announce" ? (
              <AdminAnnounce key={tick} />
            ) : view === "admin-health" ? (
              <AdminHealth key={tick} />
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
            ) : view === "printables" ? (
              biz === "nestoodle" ? <PrintablesView key={`${biz}-${tick}`} /> : <GenericPrintables key={`${biz}-${tick}`} biz={biz} />
            ) : view === "overview" ? (
              <Overview key={`${me.email}-${biz}`} account={me.email} biz={biz} start={state.start} end={state.end} cmp={state.cmp} compareLabel={compareLabel} go={go} refreshTick={tick} />
            ) : view === "all-results" && isWorkspace(biz) ? (
              <ResultsSummary key={`${me.email}-${biz}`} account={me.email} biz={biz} start={state.start} end={state.end} cmp={state.cmp} refreshTick={tick} go={go} />
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
                  compareLabel={isResults ? reportCompareLabel : compareLabel}
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
      <MobileHubBar biz={biz} view={view} go={go} />
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
        <span className="dash-brand-name block truncate lg:whitespace-normal lg:overflow-visible lg:text-clip text-[15px] font-semibold leading-tight tracking-[-0.01em]">{b.name}</span>
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

/** Billing needs each tool's plan summary, which comes with the calendar data. */
function BillingPage({ start, end, go }: { start: string; end: string; go: (v: View) => void }) {
  const [tools, setTools] = useState<ToolSummary[] | null>(null)
  useEffect(() => {
    loadKey(sectionKey("autopilot", "queue", start, end, "none"), true).then((d) => setTools(d.ok && "tools" in d ? ((d as QueueData).tools ?? []) : []))
  }, [start, end])
  return <BillingView tools={tools} go={go} />
}
