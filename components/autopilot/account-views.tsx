"use client"

// Autopilot account pages inside the dashboard: Billing, Settings, Help, plus the brand
// switcher, the "confirm your email" banner and the getting-started checklist on Overview.

import { useActionState, useCallback, useEffect, useRef, useState } from "react"
import { Check, ChevronsUpDown, Copy, Download, ExternalLink, Gift, Mail, MessageCircle, Plus, Receipt, Trash2, X } from "lucide-react"
import type { ToolSummary } from "@/lib/dashboard/types"
import type { View } from "@/components/dashboard/state"
import { Card, Notice, Skeleton } from "@/components/dashboard/ui"
import { PLATFORM } from "@/components/dashboard/brand"
import { PasswordPanel, type Me } from "@/components/dashboard/accounts"
import { changeMyName, type FormState } from "@/app/dashboard/actions"

type Brand = { n: number; name: string; key: string }
export type AccountState = {
  ok: true
  name: string
  email: string
  verified: boolean
  prefs: { digest: boolean }
  brands: { list: Brand[]; current: Brand }
  referral: { code: string; link: string; joined: number; rewarded: number; creditDays: number }
  payments: { id: number; invoiceNo: string; at: string | null; what: string; brand: string; amount: string; method: string; url: string }[]
  mail: boolean
  viewingAs: string | null
  announcements: { id: number; title: string; message: string }[]
}

// ---------- shared account state ----------

let cached: AccountState | null = null
const listeners = new Set<(s: AccountState) => void>()

async function call(body?: Record<string, unknown>): Promise<AccountState | { ok: false; error: string; deleted?: boolean }> {
  try {
    const r = await fetch("/dashboard/me/account", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
    if (r.status === 401) window.location.reload()
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

export function useAccount() {
  const [s, setS] = useState<AccountState | null>(cached)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    listeners.add(setS)
    if (!cached)
      call().then((r) => {
        if (r.ok) {
          cached = r as AccountState
          listeners.forEach((l) => l(cached as AccountState))
        } else setError(r.error)
      })
    return () => {
      listeners.delete(setS)
    }
  }, [])
  const act = useCallback(async (body: Record<string, unknown>) => {
    const r = await call(body)
    if (r.ok) {
      cached = r as AccountState
      listeners.forEach((l) => l(cached as AccountState))
      setError(null)
    } else setError(r.error)
    return r
  }, [])
  return { s, error, act }
}

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] disabled:opacity-50"
const primaryBtn = "inline-flex items-center gap-1.5 rounded-lg bg-[var(--nav)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
const input = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"

// ---------- brand switcher (sidebar) ----------

export function BrandSwitcher() {
  const { s, act, error } = useAccount()
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState("")
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener("mousedown", close)
    return () => document.removeEventListener("mousedown", close)
  }, [open])
  const current = s?.brands.current
  const pick = async (n: number) => {
    if (n === current?.n) return setOpen(false)
    const r = await act({ op: "brand-select", n })
    if (r.ok) window.location.reload()
  }
  return (
    <div className="relative min-w-0 flex-1" ref={box}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full min-w-0 items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/5" title="Switch brand">
        <img src="/dashboard/xredible.svg" alt="" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{current?.name || "My automations"}</span>
          <span className="block truncate text-[11.5px] text-white/55">Xredible Autopilot</span>
        </span>
        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-white/50" />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-xl border border-white/10 bg-[#16264a] p-1 shadow-2xl">
          <div className="px-2 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/40">Brands</div>
          <ul>
            {(s?.brands.list || []).map((b) => (
              <li key={b.n}>
                <button type="button" onClick={() => pick(b.n)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] ${b.n === current?.n ? "bg-white/10 text-white" : "text-white/75 hover:bg-white/5 hover:text-white"}`}>
                  <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
                  {b.n === current?.n ? <Check className="h-3.5 w-3.5 text-[var(--gold)]" /> : null}
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <form
              className="flex items-center gap-1 p-1"
              onSubmit={async (e) => {
                e.preventDefault()
                const r = await act({ op: "brand-add", name })
                if (r.ok) window.location.reload()
              }}
            >
              <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Brand name" className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-[13px] text-white placeholder:text-white/40" />
              <button type="submit" className="rounded-md bg-[var(--gold)] px-2 py-1.5 text-[12px] font-semibold text-[#10203f]">
                Add
              </button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-[13px] text-white/70 hover:bg-white/5 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> Add a brand
            </button>
          )}
          {error ? <div className="px-2 pb-1 text-[11.5px] text-red-300">{error}</div> : null}
          <div className="px-2 pb-1.5 pt-1 text-[11px] leading-snug text-white/40">Each brand has its own accounts, drafts, plans and free trials.</div>
        </div>
      ) : null}
    </div>
  )
}

// ---------- confirm-your-email banner ----------

/** Admin looking at a customer's dashboard: say so, with a way back. */
export function ViewAsBanner() {
  const { s } = useAccount()
  const [busy, setBusy] = useState(false)
  if (!s?.viewingAs) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--brand)] bg-[var(--brand-soft)] px-4 py-2.5 text-sm text-[var(--ink)]">
      <span className="min-w-0 flex-1">
        Viewing as <b>{s.viewingAs.split("::")[0]}</b>
        {s.viewingAs.includes("::") ? ` (brand ${s.viewingAs.split("::")[1]})` : ""}. Changes you make here change their account.
      </span>
      <button
        type="button"
        disabled={busy}
        className={primaryBtn}
        onClick={async () => {
          setBusy(true)
          await fetch("/dashboard/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "view-as-stop" }) }).catch(() => null)
          window.location.assign("/dashboard?biz=autopilot&view=admin-customers")
        }}
      >
        Exit
      </button>
    </div>
  )
}

/** News from Xredible (Admin → Announcements), until the customer closes it. */
export function AnnouncementBanner() {
  const { s, act } = useAccount()
  const list = s?.announcements || []
  if (!list.length || s?.viewingAs) return null
  return (
    <div className="space-y-2">
      {list.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm">
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--gold)]" aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{a.title}</div>
            <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--muted)]">{a.message}</div>
          </div>
          <button type="button" onClick={() => act({ op: "announce-dismiss", id: a.id })} className="rounded p-1 text-[var(--faint)] hover:bg-[var(--chip)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function VerifyBanner() {
  const { s, act, error } = useAccount()
  const [flash, setFlash] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("verified")
    if (v === "1") setFlash("Thanks, your email is confirmed.")
    else if (v === "expired") setFlash("That confirmation link has expired. Send a new one below.")
  }, [])
  if (flash && s?.verified) return <Notice>{flash}</Notice>
  if (!s || s.verified) return null
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <Mail className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">{flash || <>Please confirm your email ({s.email}). We send drafts, receipts and important notices there, and it&rsquo;s needed before paying.</>}</span>
      <button
        type="button"
        disabled={sent}
        onClick={async () => {
          const r = await act({ op: "resend-verify" })
          if (r.ok) setSent(true)
        }}
        className="rounded-lg bg-amber-900 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {sent ? "Sent, check your inbox" : "Resend link"}
      </button>
      {error ? <span className="w-full text-xs text-red-700">{error}</span> : null}
    </div>
  )
}

// ---------- getting started (Overview) ----------

const TOOL_VIEW: Record<ToolSummary["product"], View> = { linkedin: "ap-linkedin", meta: "ap-meta", blog: "ap-blog", newsletter: "ap-newsletter" }

export function GettingStarted({ tools, go }: { tools: ToolSummary[]; go: (v: View) => void }) {
  const { s } = useAccount()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("xd-start-hidden") === "1")
    } catch {}
  }, [])
  const first = tools.find((t) => t.ready || t.connected) || tools[0]
  const steps: { done: boolean; label: string; action: () => void }[] = [
    { done: !!s?.verified, label: "Confirm your email", action: () => window.scrollTo({ top: 0, behavior: "smooth" }) },
    { done: tools.some((t) => t.ready), label: "Pick an automation and fill in your details", action: () => go(TOOL_VIEW[first.product]) },
    { done: tools.some((t) => t.connected), label: "Connect your account (LinkedIn, Facebook, WordPress or email)", action: () => go(TOOL_VIEW[first.product]) },
    { done: tools.some((t) => t.scheduled > 0 || t.left < t.limit), label: "Approve your first post", action: () => go("schedule") },
    { done: tools.some((t) => !["Free trial", "Not started"].includes(t.plan)), label: "Choose a plan when you're happy", action: () => go("billing") },
  ]
  const done = steps.filter((x) => x.done).length
  if (hidden || done === steps.length) return null
  return (
    <Card
      title="Getting started"
      sub={`${done} of ${steps.length} done`}
      action={
        <button
          type="button"
          onClick={() => {
            setHidden(true)
            try {
              localStorage.setItem("xd-start-hidden", "1")
            } catch {}
          }}
          className="rounded p-1 text-[var(--faint)] hover:text-[var(--ink)]"
          aria-label="Hide getting started"
        >
          <X className="h-4 w-4" />
        </button>
      }
    >
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-[var(--chip)]">
        <div className="h-full rounded-full bg-[var(--brand)] transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="space-y-1.5">
        {steps.map((st, i) => (
          <li key={st.label}>
            <button type="button" onClick={st.action} disabled={st.done} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--hover)] disabled:hover:bg-transparent">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${st.done ? "bg-[var(--good-bg)] text-[var(--good)]" : "bg-[var(--chip)] text-[var(--muted)]"}`}>{st.done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className={st.done ? "text-[var(--faint)] line-through" : "text-[var(--ink)]"}>{st.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </Card>
  )
}

// ---------- Billing ----------

export function BillingView({ tools, go }: { tools: ToolSummary[] | null; go: (v: View) => void }) {
  const { s, error } = useAccount()
  const [copied, setCopied] = useState(false)
  if (!s) return error ? <Notice tone="error">{error}</Notice> : <Skeleton className="h-64" />
  return (
    <div className="space-y-5">
      <Card title="Your plans" sub={`For ${s.brands.current.name}. Open a tool to subscribe, change plan, pay by UPI or use a coupon.`}>
        {!tools ? (
          <Skeleton className="h-24" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tools.map((t) => {
              const v = TOOL_VIEW[t.product]
              const m = PLATFORM[v]
              return (
                <li key={t.product}>
                  <button type="button" onClick={() => go(v)} className="flex h-full w-full flex-col rounded-lg border border-[var(--line)] p-3 text-left hover:border-[var(--line-strong)] hover:bg-[var(--hover)]">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: m.color }}>
                      {m.icon}
                      {t.name}
                    </span>
                    <span className="mt-2 text-sm font-semibold text-[var(--ink)]">{t.plan}</span>
                    <span className="text-xs text-[var(--muted)]">
                      {t.left} of {t.limit} left
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card title="Payment history" sub="Receipts for every brand on your account">
        {s.payments.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-xs text-[var(--muted)]">
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">What</th>
                  <th className="py-2 font-medium">Paid by</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                  <th className="py-2 text-right font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {s.payments.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--line-soft)]">
                    <td className="py-2.5 tabular-nums text-[var(--muted)]">{p.at ? new Date(p.at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</td>
                    <td className="py-2.5">
                      {p.what}
                      {s.brands.list.length > 1 && p.brand ? <span className="text-[var(--muted)]"> · {p.brand}</span> : null}
                    </td>
                    <td className="py-2.5 text-[var(--muted)]">{p.method}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.amount}</td>
                    <td className="py-2.5 text-right">
                      <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand)] hover:underline">
                        <Receipt className="h-3.5 w-3.5" /> {p.invoiceNo}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-4 text-sm text-[var(--faint)]">No payments yet. Every tool starts with 3 free posts.</div>
        )}
      </Card>

      <Card title={<span className="inline-flex items-center gap-2"><Gift className="h-4 w-4 text-[var(--gold)]" />Invite friends, get a free month</span>} sub="When someone joins with your link and subscribes, you both get one month free.">
        <div className="flex flex-wrap items-center gap-2">
          <input readOnly value={s.referral.link} className={input + " mt-0 max-w-md flex-1 font-mono text-[13px]"} onFocus={(e) => e.currentTarget.select()} />
          <button
            type="button"
            className={btn}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(s.referral.link)
                setCopied(true)
                setTimeout(() => setCopied(false), 1500)
              } catch {}
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}
          </button>
          <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`I use Xredible to write and post my content automatically. Try it free (3 posts) and we both get a free month when you subscribe: ${s.referral.link}`)}`} target="_blank" rel="noreferrer">
            <MessageCircle className="h-3.5 w-3.5" /> Share on WhatsApp
          </a>
        </div>
        <div className="mt-3 flex flex-wrap gap-6 text-sm">
          <div>
            <div className="text-xs text-[var(--muted)]">Joined with your link</div>
            <div className="text-lg font-semibold tabular-nums">{s.referral.joined}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">Free months earned</div>
            <div className="text-lg font-semibold tabular-nums">{s.referral.rewarded}</div>
          </div>
          {s.referral.creditDays ? (
            <div>
              <div className="text-xs text-[var(--muted)]">Waiting to be used</div>
              <div className="text-lg font-semibold tabular-nums">{s.referral.creditDays} days</div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

// ---------- Settings ----------

export function SettingsView({ me }: { me: Me }) {
  const { s, act, error } = useAccount()
  const [nameState, nameAction, namePending] = useActionState<FormState, FormData>(changeMyName, { error: null })
  const [pw, setPw] = useState(false)
  const [renaming, setRenaming] = useState<number | null>(null)
  const [brandName, setBrandName] = useState("")
  const [del, setDel] = useState(false)
  const [delPw, setDelPw] = useState("")
  const [delMsg, setDelMsg] = useState<string | null>(null)
  if (!s) return error ? <Notice tone="error">{error}</Notice> : <Skeleton className="h-64" />
  return (
    <div className="max-w-3xl space-y-5">
      {pw ? <PasswordPanel onClose={() => setPw(false)} /> : null}
      <Card title="Profile">
        <form action={nameAction} className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[220px] flex-1">
            <span className="text-xs font-medium text-[var(--muted)]">Your name</span>
            <input name="name" defaultValue={s.name} required maxLength={80} className={input} />
          </label>
          <button type="submit" disabled={namePending} className={primaryBtn}>
            Save
          </button>
        </form>
        {nameState.error ? <div className="mt-2 text-sm text-[var(--bad)]">{nameState.error}</div> : nameState.ok ? <div className="mt-2 text-sm text-[var(--good)]">Saved. It shows everywhere after you reload.</div> : null}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-[var(--muted)]">Email</span>
          <span className="font-medium">{s.email}</span>
          {s.verified ? <span className="rounded-full bg-[var(--good-bg)] px-2 py-0.5 text-xs font-semibold text-[var(--good)]">Confirmed</span> : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">Not confirmed</span>}
          <span className="text-xs text-[var(--faint)]">To change your email, message us on WhatsApp.</span>
        </div>
        <div className="mt-4">
          <button type="button" className={btn} onClick={() => setPw(true)}>
            Change password
          </button>
        </div>
      </Card>

      <Card title="Brands" sub="Run several businesses from one sign-in. Each brand has its own connected accounts, drafts, plan and free trial.">
        <ul className="divide-y divide-[var(--line-soft)]">
          {s.brands.list.map((b) => (
            <li key={b.n} className="flex flex-wrap items-center gap-2 py-2.5">
              {renaming === b.n ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const r = await act({ op: "brand-rename", n: b.n, name: brandName })
                    if (r.ok) setRenaming(null)
                  }}
                >
                  <input autoFocus value={brandName} onChange={(e) => setBrandName(e.target.value)} className={input + " mt-0 max-w-xs"} />
                  <button type="submit" className={primaryBtn}>
                    Save
                  </button>
                  <button type="button" className={btn} onClick={() => setRenaming(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="flex-1 text-sm font-medium">
                    {b.name}
                    {b.n === s.brands.current.n ? <span className="ml-2 rounded bg-[var(--brand-soft)] px-1.5 py-0.5 text-[11px] text-[var(--brand)]">Open now</span> : null}
                  </span>
                  <button type="button" className={btn} onClick={() => { setRenaming(b.n); setBrandName(b.name) }}>
                    Rename
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-[var(--faint)]">Add or switch brands from the name at the top of the sidebar.</p>
      </Card>

      <Card title="Emails from Xredible">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={s.prefs.digest} onChange={(e) => act({ op: "prefs", digest: e.target.checked })} />
          <span>
            <span className="font-medium">Daily &ldquo;drafts ready to review&rdquo; email</span>
            <span className="block text-[var(--muted)]">Receipts, plan reminders and failed-post alerts are always sent.</span>
          </span>
        </label>
        {!s.mail ? <p className="mt-2 text-xs text-[var(--faint)]">Email sending is being switched on.</p> : null}
      </Card>

      <Card title="Your data">
        <p className="text-sm text-[var(--muted)]">Download everything we store for you: settings, drafts, posts, subscribers and payments (passwords and access keys are left out).</p>
        <button type="button" onClick={() => (window.location.href = "/dashboard/me/account?export=1")} className={btn + " mt-3"}>
          <Download className="h-3.5 w-3.5" /> Download my data
        </button>
      </Card>

      {me.role !== "admin" ? (
        <Card title={<span className="text-[var(--bad)]">Delete account</span>}>
          <p className="text-sm text-[var(--muted)]">Deletes your account, every brand, drafts, connected accounts and subscribers, and cancels card subscriptions. Payment records are kept for tax purposes. This can&rsquo;t be undone.</p>
          {del ? (
            <form
              className="mt-3 flex flex-wrap items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                if (!window.confirm("Delete your Xredible account and all its data for good?")) return
                const r = await act({ op: "delete", password: delPw })
                if (r.ok) window.location.href = "/dashboard"
                else setDelMsg((r as { error: string }).error)
              }}
            >
              <input type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} placeholder="Your password" autoComplete="current-password" required className={input + " mt-0 max-w-xs"} />
              <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--bad)] px-3.5 py-2 text-[13px] font-semibold text-white">
                <Trash2 className="h-3.5 w-3.5" /> Delete everything
              </button>
              <button type="button" className={btn} onClick={() => setDel(false)}>
                Cancel
              </button>
              {delMsg ? <span className="w-full text-sm text-[var(--bad)]">{delMsg}</span> : null}
            </form>
          ) : (
            <button type="button" className={btn + " mt-3 text-[var(--bad)]"} onClick={() => setDel(true)}>
              Delete my account
            </button>
          )}
        </Card>
      ) : null}
    </div>
  )
}

// ---------- Help ----------

const FAQ: [string, string][] = [
  ["Will anything be posted without my approval?", "No. Every draft waits for you. Only posts you approve (or schedule from the Content calendar) go out, at the time shown."],
  ["How do the 3 free posts work?", "Each automation lets you publish 3 posts, articles or newsletter issues free. Your settings and drafts stay when you subscribe."],
  ["How do I pay?", "Open the automation, pick Starter or Pro, monthly or yearly (2 months free). Pay by card, or by UPI and type the 12-digit UTR; we switch it on within a few hours and email a receipt."],
  ["Do UPI plans renew automatically?", "No. We email you 3 days before the end so you can pay again. Card plans renew automatically and can be cancelled anytime."],
  ["Why isn't Instagram posting?", "Your Instagram must be a Business or Creator account linked to your Facebook Page. Reconnect from Instagram + Facebook if you changed your password or Page."],
  ["How often do I need to reconnect LinkedIn?", "LinkedIn asks every 60 days. We show a reminder before it expires."],
  ["Can I manage more than one business?", "Yes. Use 'Add a brand' from the name at the top of the sidebar. Each brand has its own accounts, drafts and plan."],
  ["Can I cancel?", "Anytime. Your plan keeps working until the end of the period you've paid for. See the Cancellation & Refund Policy for refunds."],
]

export function HelpView() {
  return (
    <div className="max-w-3xl space-y-5">
      <Card title="Talk to us" sub="We reply within one working day (Mon–Sat, 10 am–7 pm IST).">
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primaryBtn} onClick={() => (window as unknown as { Tawk_API?: { maximize?: () => void } }).Tawk_API?.maximize?.()}>
            <MessageCircle className="h-4 w-4" /> Chat now
          </button>
          <a className={btn} href="https://wa.me/918085949384" target="_blank" rel="noreferrer">
            WhatsApp +91 80859 49384
          </a>
          <a className={btn} href="mailto:accounts@xredible.in">
            <Mail className="h-3.5 w-3.5" /> accounts@xredible.in
          </a>
        </div>
      </Card>
      <Card title="Questions people ask">
        <div className="divide-y divide-[var(--line-soft)]">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group py-2.5">
              <summary className="cursor-pointer list-none text-sm font-medium text-[var(--ink)] marker:hidden">
                <span className="mr-2 inline-block text-[var(--faint)] transition group-open:rotate-90">›</span>
                {q}
              </summary>
              <p className="mt-1.5 pl-5 text-sm leading-relaxed text-[var(--muted)]">{a}</p>
            </details>
          ))}
        </div>
      </Card>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {[
          ["Pricing", "/pricing"],
          ["Terms", "/terms"],
          ["Privacy", "/privacy"],
          ["Cancellation & Refunds", "/refund-policy"],
        ].map(([l, h]) => (
          <a key={h} href={h} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[var(--brand)] hover:underline">
            {l} <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
    </div>
  )
}

/** The live-chat widget (Tawk.to, same as the website), for customers. */
export function ChatWidget() {
  useEffect(() => {
    if (document.getElementById("tawk-js")) return
    ;(window as unknown as { Tawk_API: unknown; Tawk_LoadStart: Date }).Tawk_API = (window as unknown as { Tawk_API?: unknown }).Tawk_API || {}
    ;(window as unknown as { Tawk_LoadStart: Date }).Tawk_LoadStart = new Date()
    const s = document.createElement("script")
    s.id = "tawk-js"
    s.async = true
    s.src = "https://embed.tawk.to/6a1324055568261c36f51b35/1jpdc9dsq"
    s.charset = "UTF-8"
    s.setAttribute("crossorigin", "*")
    document.body.appendChild(s)
  }, [])
  return null
}
