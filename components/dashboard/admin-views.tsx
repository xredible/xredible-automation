"use client"

// Admin section of the Autopilot dashboard (admins only): Revenue, Customers (with a full detail page
// and "view as customer"), Payments, Coupons, Announcements and System health.

import { useCallback, useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, CheckCircle2, Download, Eye, XCircle } from "lucide-react"
import { PRODUCTS, type ProductKey } from "@/lib/autopilot/products"
import { Card, Notice, Skeleton } from "./ui"
import { download, toCsv } from "./format"

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] disabled:opacity-50"
const primaryBtn = "inline-flex items-center gap-1.5 rounded-lg bg-[var(--nav)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
const input = "rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`
const pct = (n: number) => `${Math.round(n * 100)}%`
const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "2-digit", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—")
const dayOnly = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—")

type Res<T> = { ok: true } & T
async function get<T>(url: string): Promise<Res<T> | { ok: false; error: string }> {
  try {
    const r = await fetch(url, { cache: "no-store" })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}
async function postTo(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

function useLoad<T>(url: string) {
  const [data, setData] = useState<Res<T> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const r = await get<T>(url)
    if (r.ok) {
      setData(r as Res<T>)
      setError(null)
    } else setError((r as { error: string }).error)
  }, [url])
  useEffect(() => {
    load()
  }, [load])
  return { data, error, load }
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--faint)]">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-[12px] text-[var(--muted)]">{sub}</div> : null}
    </div>
  )
}

const Pill = ({ tone, children }: { tone: "good" | "bad" | "info" | "plain"; children: ReactNode }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium ${
      tone === "good" ? "bg-[var(--good-bg)] text-[var(--good)]" : tone === "bad" ? "bg-[var(--bad-bg)] text-[var(--bad)]" : tone === "info" ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "bg-[var(--chip)] text-[var(--muted)]"
    }`}
  >
    {children}
  </span>
)

const Loading = ({ error }: { error: string | null }) => (error ? <Notice tone="error">{error}</Notice> : <Skeleton className="h-64" />)

// ---------- Revenue ----------

type Stats = {
  mrr: number
  arr: number
  activePaid: number
  yearly: number
  trials: number
  customers: number
  payers: number
  conversion: number
  revenue30: number
  revenuePrev30: number
  revenueAll: number
  arpu: number
  churn30: number
  pending: number
  series: { d: string; v: number }[]
  products: { product: string; trials: number; paid: number; mrr: number; revenue: number }[]
}

export function AdminRevenue() {
  const { data, error } = useLoad<{ stats: Stats }>("/dashboard/admin?section=revenue")
  if (!data) return <Loading error={error} />
  const s = data.stats
  const peak = Math.max(1, ...s.series.map((x) => x.v))
  const change = s.revenuePrev30 ? (s.revenue30 - s.revenuePrev30) / s.revenuePrev30 : null
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Monthly recurring" value={inr(s.mrr)} sub={`${inr(s.arr)} a year · ${s.activePaid} paid plans${s.yearly ? ` (${s.yearly} yearly)` : ""}`} />
        <Tile label="Revenue, 30 days" value={inr(s.revenue30)} sub={change === null ? `${inr(s.revenueAll)} all time` : `${change >= 0 ? "▲" : "▼"} ${pct(Math.abs(change))} vs previous 30 days`} />
        <Tile label="Trial → paid" value={pct(s.conversion)} sub={`${s.payers} of ${s.customers} customers paid · ${s.trials} on trial`} />
        <Tile label="Churn, 30 days" value={pct(s.churn30)} sub={`Avg. revenue per payer ${inr(s.arpu)}`} />
      </div>
      {s.pending ? <Notice title="UPI payments to check">{s.pending} customer{s.pending === 1 ? " is" : "s are"} waiting. Open Payments to activate.</Notice> : null}
      <Card title="Revenue by day" sub="Last 90 days, India time">
        <div className="flex h-36 items-end gap-[2px]" role="img" aria-label="Revenue by day for the last 90 days">
          {s.series.map((x) => (
            <div key={x.d} className="flex-1 rounded-t-sm bg-[var(--brand)]" style={{ height: `${x.v ? Math.max(4, (x.v / peak) * 100) : 1}%`, opacity: x.v ? 1 : 0.25 }} title={`${x.d}: ₹${x.v.toLocaleString("en-IN")}`} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-[var(--faint)]">
          <span>{dayOnly(s.series[0]?.d)}</span>
          <span>Today</span>
        </div>
      </Card>
      <Card title="By automation" pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[11.5px] uppercase tracking-[0.05em] text-[var(--faint)]">
                <th className="px-4 py-2 font-medium sm:px-5">Automation</th>
                <th className="px-3 py-2 text-right font-medium">On trial</th>
                <th className="px-3 py-2 text-right font-medium">Paid</th>
                <th className="px-3 py-2 text-right font-medium">MRR</th>
                <th className="px-4 py-2 text-right font-medium sm:px-5">Revenue, all time</th>
              </tr>
            </thead>
            <tbody>
              {s.products.map((p) => (
                <tr key={p.product} className="border-b border-[var(--line-soft)] last:border-0">
                  <td className="px-4 py-2.5 font-medium sm:px-5">{p.product}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.trials}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{p.paid}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{inr(p.mrr)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums sm:px-5">{inr(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ---------- Customers ----------

type Person = {
  email: string
  name: string
  role: string
  active: boolean
  verified: boolean
  lastLogin: string | null
  brands: number
  tools: { product: string; plan: string; status: string; brand: string }[]
  paid: number
  pendingUpi: boolean
  posted: number
  drafts: number
  failed: number
}

type Upi = { plan: string; utr: string; at: string; cycle: string; coupon: string; amount: number } | null
type Sub = { id: number; email: string; product: ProductKey; plan: string; cycle: string; status: string; postLimit: number; used: number; periodStart: string | null; periodEnd: string | null; note: string; upi: Upi }
type Detail = {
  email: string
  name: string
  role: string
  active: boolean
  lastLogin: string | null
  verified: boolean
  brands: { n: number; key: string; name: string; subs: Sub[]; linkedin: { name: string; connected: boolean; about: string } | null; channels: { product: string; name: string; connected: boolean }[] }[]
  items: { tool: string; id: number; status: string; title: string; when: string; error: string }[]
  payments: { id: number; invoiceNo: string; product: string; plan: string; cycle: string; amountText: string; method: string; ref: string; at: string | null }[]
  notes: { id: number; kind: string; key: string; value: string; at: string | null }[]
}

export function AdminCustomers() {
  const { data, error, load } = useLoad<{ people: Person[] }>("/dashboard/admin?section=people")
  const [open, setOpen] = useState<string | null>(null)
  const [q, setQ] = useState("")
  const [filter, setFilter] = useState<"all" | "paid" | "trial" | "upi" | "problems">("all")
  if (open) return <CustomerDetail email={open} back={() => { setOpen(null); load() }} />
  if (!data) return <Loading error={error} />
  const paid = (p: Person) => p.tools.some((t) => t.status === "active" && t.plan !== "Trial")
  const list = data.people.filter(
    (p) =>
      (!q || `${p.name} ${p.email}`.toLowerCase().includes(q.toLowerCase())) &&
      (filter === "all" || (filter === "paid" && paid(p)) || (filter === "trial" && !paid(p)) || (filter === "upi" && p.pendingUpi) || (filter === "problems" && (p.failed > 0 || !p.verified || !p.active))),
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "paid", "trial", "upi", "problems"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${filter === f ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--chip)]"}`}>
            {{ all: "All", paid: "Paying", trial: "Trial only", upi: "UPI to check", problems: "Needs attention" }[f]}
          </button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className={input + " ml-auto w-full py-1.5 sm:w-64"} />
        <button
          type="button"
          className={btn}
          onClick={() =>
            download(
              "xredible-customers.csv",
              toCsv(
                [
                  { key: "name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "tools", label: "Plans" },
                  { key: "paid", label: "Paid (₹)" },
                  { key: "posted", label: "Posted" },
                  { key: "lastLogin", label: "Last sign-in" },
                ],
                list.map((p) => ({ ...p, tools: p.tools.map((t) => `${t.product}: ${t.plan} (${t.status})`).join("; "), paid: Math.round(p.paid / 100) })),
              ),
            )
          }
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>
      <Card pad={false}>
        <ul className="divide-y divide-[var(--line-soft)]">
          {!list.length ? <li className="px-5 py-6 text-sm text-[var(--faint)]">{data.people.length ? "Nobody matches." : "No customers yet. Share xredible.in/dashboard?signup to get the first ones."}</li> : null}
          {list.map((p) => (
            <li key={p.email}>
              <button type="button" onClick={() => setOpen(p.email)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-[var(--hover)] sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {p.name || p.email}
                    {p.pendingUpi ? <Pill tone="info">UPI to check</Pill> : null}
                    {!p.verified ? <Pill tone="plain">email not confirmed</Pill> : null}
                    {!p.active ? <Pill tone="bad">disabled</Pill> : null}
                    {p.failed ? <Pill tone="bad">{p.failed} failed</Pill> : null}
                  </div>
                  <div className="truncate text-[12px] text-[var(--muted)]">
                    {p.email}
                    {p.brands > 1 ? ` · ${p.brands} brands` : ""} · {p.tools.map((t) => `${t.product.split(" ")[0]} ${t.plan}`).join(", ") || "no tools yet"}
                  </div>
                </div>
                <div className="text-right text-[12.5px]">
                  <div className="font-semibold tabular-nums">{p.paid ? inr(p.paid) : "₹0"}</div>
                  <div className="text-[var(--muted)]">
                    {p.posted} posted · {p.drafts} drafts · seen {dayOnly(p.lastLogin)}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function CustomerDetail({ email, back }: { email: string; back: () => void }) {
  const { data, error, load } = useLoad<{ person: Detail }>(`/dashboard/admin?section=person&email=${encodeURIComponent(email)}`)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null)
  const run = async (url: string, body: Record<string, unknown>, ok: string) => {
    setBusy(true)
    const r = await postTo(url, body)
    setBusy(false)
    setMsg(r.ok ? { tone: "good", text: ok } : { tone: "bad", text: String(r.error || "That didn't work.") })
    load()
    return r.ok
  }
  const admin = (body: Record<string, unknown>, ok: string) => run("/dashboard/admin", body, ok)
  const cust = (body: Record<string, unknown>, ok: string) => run("/dashboard/customers", body, ok)
  const viewAs = async (key: string) => {
    if (await admin({ op: "view-as", key }, "Opening their dashboard…")) window.location.assign("/dashboard?biz=autopilot&view=overview")
  }
  return (
    <div className="space-y-4">
      <button type="button" className={btn} onClick={back}>
        <ArrowLeft className="h-3.5 w-3.5" /> All customers
      </button>
      {!data ? (
        <Loading error={error} />
      ) : (
        (() => {
          const p = data.person
          return (
            <>
              <Card>
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="text-lg font-semibold">{p.name || p.email}</div>
                    <div className="text-sm text-[var(--muted)]">{p.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.verified ? <Pill tone="good">email confirmed</Pill> : <Pill tone="plain">email not confirmed</Pill>}
                      {p.active ? <Pill tone="good">can sign in</Pill> : <Pill tone="bad">disabled</Pill>}
                      <Pill tone="plain">last sign-in {when(p.lastLogin)}</Pill>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={primaryBtn} disabled={busy} onClick={() => viewAs(p.email)}>
                      <Eye className="h-4 w-4" /> View as customer
                    </button>
                    {!p.verified ? (
                      <button type="button" className={btn} disabled={busy} onClick={() => admin({ op: "verify", email: p.email }, "Marked as confirmed.")}>
                        Mark email confirmed
                      </button>
                    ) : null}
                    <button type="button" className={btn} disabled={busy} onClick={() => admin({ op: "reset-link", email: p.email }, "Password reset link emailed to them.")}>
                      Email a password reset link
                    </button>
                    {p.role !== "admin" ? (
                      <button type="button" className={btn + (p.active ? " text-[var(--bad)]" : "")} disabled={busy} onClick={() => (!p.active || window.confirm("Disable this account? They are signed out and can't sign in.")) && admin({ op: "active", email: p.email, active: !p.active }, p.active ? "Account disabled." : "Account enabled.")}>
                        {p.active ? "Disable account" : "Enable account"}
                      </button>
                    ) : null}
                  </div>
                </div>
                {msg ? <div className={`mt-3 text-sm ${msg.tone === "good" ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{msg.text}</div> : null}
              </Card>

              {p.brands.map((b) => (
                <Card key={b.key} title={`${b.name}${p.brands.length > 1 ? ` (brand ${b.n})` : ""}`} action={p.brands.length > 1 ? <button type="button" className={btn} disabled={busy} onClick={() => viewAs(b.key)}><Eye className="h-3.5 w-3.5" /> View this brand</button> : null}>
                  <div className="mb-3 flex flex-wrap gap-2 text-[12.5px]">
                    {b.linkedin ? <Pill tone={b.linkedin.connected ? "good" : "plain"}>LinkedIn {b.linkedin.connected ? `· ${b.linkedin.name}` : "not connected"}</Pill> : null}
                    {b.channels.map((c) => (
                      <Pill key={c.product} tone={c.connected ? "good" : "plain"}>
                        {PRODUCTS[c.product as ProductKey]?.name || c.product} {c.connected ? `· ${c.name}` : "not connected"}
                      </Pill>
                    ))}
                  </div>
                  {!b.subs.length ? <p className="text-sm text-[var(--faint)]">No plans yet.</p> : null}
                  <ul className="space-y-3">
                    {b.subs.map((s) => (
                      <SubRow key={s.id} s={s} busy={busy} admin={admin} cust={cust} />
                    ))}
                  </ul>
                </Card>
              ))}

              <div className="grid gap-4 lg:grid-cols-2">
                <Card title="Recent posts" pad={false}>
                  <ul className="max-h-[420px] divide-y divide-[var(--line-soft)] overflow-y-auto">
                    {!p.items.length ? <li className="px-5 py-4 text-sm text-[var(--faint)]">Nothing yet.</li> : null}
                    {p.items.map((i) => (
                      <li key={i.tool + i.id} className="px-4 py-2.5 text-sm sm:px-5">
                        <div className="flex items-center gap-2">
                          <Pill tone={i.status === "posted" ? "good" : i.status === "failed" || i.status === "blocked" ? "bad" : i.status === "approved" ? "info" : "plain"}>{i.status}</Pill>
                          <span className="text-[12px] text-[var(--faint)]">
                            {i.tool} · {when(i.when)}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate">{i.title}</div>
                        {i.error ? <div className="text-[12px] text-[var(--bad)]">{i.error}</div> : null}
                      </li>
                    ))}
                  </ul>
                </Card>
                <Card title="Payments" pad={false}>
                  <ul className="divide-y divide-[var(--line-soft)]">
                    {!p.payments.length ? <li className="px-5 py-4 text-sm text-[var(--faint)]">No payments yet.</li> : null}
                    {p.payments.map((x) => (
                      <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
                        <span className="font-mono text-[12px]">{x.invoiceNo}</span>
                        <span className="min-w-0 flex-1 truncate text-[var(--muted)]">
                          {PRODUCTS[x.product as ProductKey]?.name} {x.plan} ({x.cycle}) · {x.method} · {dayOnly(x.at)}
                        </span>
                        <span className="font-semibold tabular-nums">{x.amountText}</span>
                        <a className="text-[var(--brand)] hover:underline" href={`/dashboard/receipt/${x.id}`} target="_blank" rel="noreferrer">
                          Receipt
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              </div>
              <details className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-sm">
                <summary className="cursor-pointer font-medium">Account notes ({p.notes.length})</summary>
                <ul className="mt-2 space-y-1 text-[12.5px] text-[var(--muted)]">
                  {p.notes.map((n) => (
                    <li key={n.id}>
                      {when(n.at)} · <b>{n.kind}</b> {n.key} {n.value ? `· ${String(n.value).slice(0, 120)}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            </>
          )
        })()
      )}
    </div>
  )
}

function SubRow({ s, busy, admin, cust }: { s: Sub; busy: boolean; admin: (b: Record<string, unknown>, ok: string) => Promise<boolean>; cust: (b: Record<string, unknown>, ok: string) => Promise<boolean> }) {
  const [used, setUsed] = useState(String(s.used))
  const [days, setDays] = useState("7")
  const name = PRODUCTS[s.product]?.name || s.product
  return (
    <li className="rounded-lg border border-[var(--line)] p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <b>{name}</b>
        <Pill tone={s.status === "active" ? "good" : s.status === "trial" ? "info" : "plain"}>
          {s.plan}
          {s.cycle === "yearly" ? " yearly" : ""} · {s.status}
        </Pill>
        <span className="text-[12.5px] text-[var(--muted)]">
          {s.used}/{s.postLimit} used{s.periodEnd ? ` · until ${dayOnly(s.periodEnd)}` : ""}
        </span>
      </div>
      {s.upi ? (
        <div className="mt-2 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-[13px]">
          UPI payment{s.upi.amount ? ` of ${inr(s.upi.amount)}` : ""} for <b className="capitalize">{s.upi.plan}</b> ({s.upi.cycle}){s.upi.coupon ? ` · coupon ${s.upi.coupon}` : ""} · UTR <b className="font-mono">{s.upi.utr}</b> · {when(s.upi.at)}
        </div>
      ) : s.note ? (
        <div className="mt-1.5 text-[12.5px] text-[var(--muted)]">{s.note}</div>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {s.upi ? (
          <>
            <button type="button" className={primaryBtn} disabled={busy} onClick={() => cust({ op: "activate", id: s.id }, "Activated. Receipt emailed.")}>
              Payment received: activate
            </button>
            <button type="button" className={btn + " text-[var(--bad)]"} disabled={busy} onClick={() => cust({ op: "reject", id: s.id }, "Marked as not found. They see a message.")}>
              Payment not found
            </button>
          </>
        ) : null}
        <button type="button" className={btn} disabled={busy} onClick={() => window.confirm(`Record a manual payment and start ${name} Starter (monthly)?`) && cust({ op: "activate", id: s.id, plan: "starter", cycle: "monthly" }, "Starter activated.")}>
          {s.status === "active" ? "+1 month Starter" : "Activate Starter"}
        </button>
        <button type="button" className={btn} disabled={busy} onClick={() => window.confirm(`Record a manual payment and start ${name} Pro (monthly)?`) && cust({ op: "activate", id: s.id, plan: "pro", cycle: "monthly" }, "Pro activated.")}>
          {s.status === "active" ? "+1 month Pro" : "Activate Pro"}
        </button>
        {s.status === "active" ? (
          <button type="button" className={btn} disabled={busy} onClick={() => cust({ op: "stop", id: s.id }, "Plan stopped.")}>
            Stop plan
          </button>
        ) : null}
        <button type="button" className={btn} disabled={busy} onClick={() => cust({ op: "trial", id: s.id }, "Free trial reset.")}>
          Reset free trial
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="text-[var(--muted)]">Used</span>
        <input type="number" min={0} value={used} onChange={(e) => setUsed(e.target.value)} className={input + " w-20 py-1"} />
        <button type="button" className={btn} disabled={busy} onClick={() => admin({ op: "set-used", subId: s.id, used: Number(used) }, "Usage updated.")}>
          Save
        </button>
        <span className="ml-3 text-[var(--muted)]">Extend by</span>
        <input type="number" min={1} max={366} value={days} onChange={(e) => setDays(e.target.value)} className={input + " w-20 py-1"} />
        <span className="text-[var(--muted)]">days</span>
        <button type="button" className={btn} disabled={busy || s.plan === "trial"} onClick={() => admin({ op: "extend", subId: s.id, days: Number(days) }, "Plan extended.")} title={s.plan === "trial" ? "Activate a plan first" : "Free extra days, no payment recorded"}>
          Extend
        </button>
      </div>
    </li>
  )
}

// ---------- Payments ----------

type PaymentRow = { id: number; email: string; name: string; productName: string; plan: string; cycle: string; amount: number; amountText: string; method: string; ref: string; coupon: string; invoiceNo: string; at: string | null }

export function AdminPayments() {
  const { data, error, load } = useLoad<{ payments: PaymentRow[]; pending: { id: number; email: string; product: string; note: string; name: string }[] }>("/dashboard/admin?section=payments")
  const [busy, setBusy] = useState<number | null>(null)
  const [q, setQ] = useState("")
  if (!data) return <Loading error={error} />
  const list = data.payments.filter((p) => !q || `${p.name} ${p.email} ${p.invoiceNo} ${p.ref}`.toLowerCase().includes(q.toLowerCase()))
  const act = async (body: Record<string, unknown>) => {
    setBusy(Number(body.id))
    await postTo("/dashboard/customers", body)
    setBusy(null)
    load()
  }
  return (
    <div className="space-y-4">
      {data.pending.length ? (
        <Card title={`UPI payments to check · ${data.pending.length}`} sub="Match the UTR in your bank app, then activate.">
          <ul className="space-y-2">
            {data.pending.map((p) => {
              const [, plan, utr, at, cycle, coupon, amount] = (p.note.match(/^upi:([^:]*):([^:]*):([^|]*)\|?([^|]*)\|?([^|]*)\|?(\d*)/) || []) as string[]
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--line)] px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <b>{p.name || p.email}</b> · {p.product} <span className="capitalize">{plan}</span> ({cycle || "monthly"}){coupon ? ` · ${coupon}` : ""}
                    <div className="text-[12px] text-[var(--muted)]">
                      UTR <span className="font-mono">{utr}</span> · {amount ? inr(Number(amount)) : ""} · {when(at)}
                    </div>
                  </div>
                  <button type="button" className={primaryBtn} disabled={busy === p.id} onClick={() => act({ op: "activate", id: p.id })}>
                    <CheckCircle2 className="h-4 w-4" /> Activate
                  </button>
                  <button type="button" className={btn + " text-[var(--bad)]"} disabled={busy === p.id} onClick={() => act({ op: "reject", id: p.id })}>
                    <XCircle className="h-4 w-4" /> Not found
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, invoice or UTR" className={input + " w-full py-1.5 sm:w-72"} />
        <span className="text-[12.5px] text-[var(--muted)]">
          {list.length} payments · {inr(list.reduce((t, p) => t + p.amount, 0))}
        </span>
        <button
          type="button"
          className={btn + " ml-auto"}
          onClick={() =>
            download(
              "xredible-payments.csv",
              toCsv(
                [
                  { key: "invoiceNo", label: "Invoice" },
                  { key: "at", label: "Date" },
                  { key: "name", label: "Name" },
                  { key: "email", label: "Email" },
                  { key: "productName", label: "Automation" },
                  { key: "plan", label: "Plan" },
                  { key: "cycle", label: "Cycle" },
                  { key: "rupees", label: "Amount (₹)" },
                  { key: "method", label: "Method" },
                  { key: "ref", label: "Reference" },
                  { key: "coupon", label: "Coupon" },
                ],
                list.map((p) => ({ ...p, rupees: (p.amount / 100).toFixed(2), at: p.at ? new Date(p.at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "" })),
              ),
            )
          }
        >
          <Download className="h-3.5 w-3.5" /> CSV for accounts
        </button>
      </div>
      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[11.5px] uppercase tracking-[0.05em] text-[var(--faint)]">
                <th className="px-4 py-2 font-medium">Invoice</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Plan</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {!list.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-[var(--faint)]">
                    No payments yet.
                  </td>
                </tr>
              ) : null}
              {list.map((p) => (
                <tr key={p.id} className="border-b border-[var(--line-soft)] last:border-0">
                  <td className="px-4 py-2.5 font-mono text-[12px]">{p.invoiceNo}</td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">{dayOnly(p.at)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{p.name || p.email.split("::")[0]}</div>
                    <div className="text-[11.5px] text-[var(--faint)]">{p.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    {p.productName} <span className="capitalize">{p.plan}</span> ({p.cycle}){p.coupon ? <span className="text-[var(--faint)]"> · {p.coupon}</span> : null}
                  </td>
                  <td className="px-3 py-2.5 text-[var(--muted)]">
                    {p.method === "razorpay" ? "Card" : "UPI"} <span className="text-[11.5px]">{p.ref}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{p.amountText}</td>
                  <td className="px-4 py-2.5 text-right">
                    <a className="text-[var(--brand)] hover:underline" href={`/dashboard/receipt/${p.id}`} target="_blank" rel="noreferrer">
                      Receipt
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ---------- Demo requests (from xredible.in/demo) ----------

type Lead = { id: number; name: string; email: string; phone: string; business: string; website: string; interests: string[]; when: string; note: string; consent: boolean; at: string; status: string }
const LEAD_STATUSES = ["new", "contacted", "demo done", "customer", "not a fit"]

export function AdminLeads() {
  const { data, error, load } = useLoad<{ leads: Lead[] }>("/dashboard/admin?section=leads")
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [show, setShow] = useState<"open" | "all">("open")
  if (!data) return <Loading error={error} />
  const leads = data.leads.filter((l) => show === "all" || ["new", "contacted"].includes(l.status))
  const counts = Object.fromEntries(LEAD_STATUSES.map((s) => [s, data.leads.filter((l) => l.status === s).length]))
  const wa = (l: Lead) => `https://wa.me/${l.phone.replace(/\D/g, "").replace(/^(\d{10})$/, "91$1")}?text=${encodeURIComponent(`Hi ${l.name.split(" ")[0]}, this is Abhijit from Xredible. Thanks for booking a demo! When suits you for a 15-minute call?`)}`
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {LEAD_STATUSES.map((s) => (
          <Tile key={s} label={s} value={String(counts[s] || 0)} />
        ))}
      </div>
      <Card
        title="Demo requests"
        sub={
          <>
            From <a href="/demo" target="_blank" className="underline">xredible.in/demo</a>. You also get each one on Telegram and by email.
          </>
        }
        pad={false}
      >
        <div className="flex gap-2 px-4 pb-3 sm:px-5">
          {(["open", "all"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setShow(v)} className={btn + (show === v ? " !border-[var(--brand)] !text-[var(--brand)]" : "")}>
              {v === "open" ? "To follow up" : "All"}
            </button>
          ))}
        </div>
        {msg ? <div className="px-5 pb-2 text-sm text-[var(--bad)]">{msg}</div> : null}
        <ul className="divide-y divide-[var(--line-soft)]">
          {!leads.length ? <li className="px-5 py-5 text-sm text-[var(--faint)]">{data.leads.length ? "Nothing to follow up. Nice." : "No demo requests yet. Share xredible.in/demo in your posts and bio."}</li> : null}
          {leads.map((l) => (
            <li key={l.id} className="px-4 py-3 text-sm sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <b>{l.name}</b>
                {l.business ? <span className="text-[var(--muted)]">· {l.business}</span> : null}
                <span className="text-[12px] text-[var(--faint)]">{when(l.at)}</span>
                <select value={l.status} disabled={busy === l.id} onChange={async (e) => { setBusy(l.id); const r = await postTo("/dashboard/admin", { op: "lead-status", id: l.id, status: e.target.value }); setBusy(null); setMsg(r.ok ? null : String(r.error || "That didn't work.")); load() }} className={input + " ml-auto !py-1 text-[13px]"} aria-label="Status">
                  {LEAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[var(--muted)]">
                <span>{l.email}</span>
                <span>{l.phone}</span>
                {l.when ? <span>Best time: {l.when}</span> : null}
                {l.interests.length ? <span>Wants: {l.interests.join(", ")}</span> : null}
                {l.website ? <span>{l.website}</span> : null}
                {l.consent ? <Pill tone="good">tips by email: yes</Pill> : null}
              </div>
              {l.note ? <div className="mt-1 text-[13px]">“{l.note}”</div> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={wa(l)} target="_blank" rel="noreferrer" className={btn}>
                  WhatsApp
                </a>
                <a href={`mailto:${l.email}?subject=${encodeURIComponent("Your Xredible demo")}`} className={btn}>
                  Email
                </a>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ---------- Coupons ----------

type CouponRow = { id: number; code: string; percent: number; products: string; maxUses: number; used: number; expires: string | null; active: boolean }

export function AdminCoupons() {
  const { data, error, load } = useLoad<{ coupons: CouponRow[] }>("/dashboard/customers")
  const [c, setC] = useState({ code: "", percent: "20", products: "", maxUses: "", expires: "" })
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (body: Record<string, unknown>) => {
    setBusy(true)
    const r = await postTo("/dashboard/customers", body)
    setBusy(false)
    setMsg(r.ok ? null : String(r.error || "That didn't work."))
    load()
    return r.ok
  }
  if (!data) return <Loading error={error} />
  return (
    <div className="space-y-4">
      <Card title="New coupon code" sub="Customers type it when paying by UPI. The discounted price shows on their QR code and on your activate button.">
        <form
          className="grid gap-2 sm:grid-cols-6"
          onSubmit={async (e) => {
            e.preventDefault()
            if (await run({ op: "coupon", ...c })) setC({ code: "", percent: "20", products: "", maxUses: "", expires: "" })
          }}
        >
          <input required value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} placeholder="DIWALI20" className={input + " uppercase sm:col-span-2"} aria-label="Code" />
          <input required type="number" min={1} max={100} value={c.percent} onChange={(e) => setC({ ...c, percent: e.target.value })} placeholder="% off" className={input} aria-label="Percent off" />
          <input type="number" min={0} value={c.maxUses} onChange={(e) => setC({ ...c, maxUses: e.target.value })} placeholder="Max uses" className={input} aria-label="Max uses" />
          <input type="date" value={c.expires} onChange={(e) => setC({ ...c, expires: e.target.value })} className={input} title="Expires (optional)" aria-label="Expires" />
          <button type="submit" className={primaryBtn + " justify-center"} disabled={busy}>
            Create
          </button>
          <select value={c.products} onChange={(e) => setC({ ...c, products: e.target.value })} className={input + " sm:col-span-6"} aria-label="Automation">
            <option value="">All automations</option>
            {Object.values(PRODUCTS).map((p) => (
              <option key={p.key} value={p.key}>
                Only {p.name}
              </option>
            ))}
          </select>
        </form>
        {msg ? <div className="mt-2 text-sm text-[var(--bad)]">{msg}</div> : null}
      </Card>
      <Card pad={false}>
        <ul className="divide-y divide-[var(--line-soft)]">
          {!data.coupons.length ? <li className="px-5 py-5 text-sm text-[var(--faint)]">No coupon codes yet.</li> : null}
          {data.coupons.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5">
              <span className="font-mono font-semibold">{x.code}</span>
              <span>{x.percent}% off</span>
              <span className="text-[var(--muted)]">
                {x.products ? PRODUCTS[x.products as ProductKey]?.name || x.products : "all automations"} · used {x.used}
                {x.maxUses ? ` of ${x.maxUses}` : ""}
                {x.expires ? ` · until ${dayOnly(x.expires)}` : ""}
              </span>
              {x.active ? <Pill tone="good">on</Pill> : <Pill tone="plain">off</Pill>}
              <button type="button" className={btn + " ml-auto"} disabled={busy} onClick={() => run({ op: "coupon-active", couponId: x.id, active: !x.active })}>
                {x.active ? "Turn off" : "Turn on"}
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

// ---------- Announcements ----------

type Announcement = { id: number; title: string; message: string; until: string | null; audience: "all" | "trial" | "paid"; at: string | null }

export function AdminAnnounce() {
  const { data, error, load } = useLoad<{ announcements: Announcement[] }>("/dashboard/admin?section=announcements")
  const [f, setF] = useState({ title: "", message: "", until: "", audience: "all", email: false })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null)
  if (!data) return <Loading error={error} />
  const run = async (body: Record<string, unknown>) => {
    setBusy(true)
    const r = await postTo("/dashboard/admin", body)
    setBusy(false)
    load()
    return r
  }
  return (
    <div className="space-y-4">
      <Card title="New announcement" sub="Shows as a banner at the top of customers' dashboards until they close it. Optionally email it too.">
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault()
            if (f.email && !window.confirm("Email this to every matching customer now?")) return
            const r = await run({ op: "announce", ...f })
            if (r.ok) {
              setMsg({ tone: "good", text: f.email ? `Published and emailed to ${Number(r.emailed) || 0} customers.` : "Published." })
              setF({ title: "", message: "", until: "", audience: "all", email: false })
            } else setMsg({ tone: "bad", text: String(r.error || "That didn't work.") })
          }}
        >
          <input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={100} placeholder="Title, e.g. New: festival posts in Ideas" className={input + " w-full"} aria-label="Title" />
          <textarea required value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={1000} rows={3} placeholder="Message" className={input + " w-full font-[inherit]"} aria-label="Message" />
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              Who
              <select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })} className={input + " py-1.5"}>
                <option value="all">Everyone</option>
                <option value="trial">Trial only</option>
                <option value="paid">Paying only</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              Until
              <input type="date" value={f.until} onChange={(e) => setF({ ...f, until: e.target.value })} className={input + " py-1.5"} />
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.email} onChange={(e) => setF({ ...f, email: e.target.checked })} /> Also email it
            </label>
            <button type="submit" className={primaryBtn + " ml-auto"} disabled={busy}>
              {busy ? "Publishing…" : "Publish"}
            </button>
          </div>
          {msg ? <div className={`text-sm ${msg.tone === "good" ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{msg.text}</div> : null}
        </form>
      </Card>
      <Card title="Published" pad={false}>
        <ul className="divide-y divide-[var(--line-soft)]">
          {!data.announcements.length ? <li className="px-5 py-5 text-sm text-[var(--faint)]">Nothing yet.</li> : null}
          {data.announcements.map((a) => {
            const live = !a.until || Date.parse(a.until) > Date.now()
            return (
              <li key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-3 text-sm sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-semibold">
                    {a.title} {live ? <Pill tone="good">showing</Pill> : <Pill tone="plain">ended</Pill>}
                    <Pill tone="plain">{a.audience === "all" ? "everyone" : a.audience === "paid" ? "paying" : "trial"}</Pill>
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap text-[13px] text-[var(--muted)]">{a.message}</div>
                  <div className="mt-0.5 text-[11.5px] text-[var(--faint)]">
                    {when(a.at)}
                    {a.until ? ` · until ${dayOnly(a.until)}` : ""}
                  </div>
                </div>
                <button type="button" className={btn + " text-[var(--bad)]"} disabled={busy} onClick={() => run({ op: "announce-delete", id: a.id })}>
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}

// ---------- System health ----------

type Health = {
  checks: { name: string; ok: boolean; note: string }[]
  numbers: { draftsToday: number; postedToday: number; waitingApproval: number; scheduled: number }
  late: { tool: string; email: string; title: string; when: string }[]
  failures: { tool: string; email: string; error: string }[]
}

export function AdminHealth() {
  const { data, error } = useLoad<Health>("/dashboard/admin?section=health")
  if (!data) return <Loading error={error} />
  const bad = data.checks.filter((c) => !c.ok).length
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Drafts written, 24h" value={String(data.numbers.draftsToday)} />
        <Tile label="Published, 24h" value={String(data.numbers.postedToday)} />
        <Tile label="Waiting for approval" value={String(data.numbers.waitingApproval)} />
        <Tile label="Approved & scheduled" value={String(data.numbers.scheduled)} />
      </div>
      <Card title={bad ? `${bad} thing${bad === 1 ? "" : "s"} to fix` : "Everything is set up"} pad={false}>
        <ul className="divide-y divide-[var(--line-soft)]">
          {data.checks.map((c) => (
            <li key={c.name} className="flex items-center gap-3 px-4 py-2.5 text-sm sm:px-5">
              {c.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--good)]" /> : <XCircle className="h-4 w-4 shrink-0 text-[var(--bad)]" />}
              <span className="font-medium">{c.name}</span>
              <span className="ml-auto text-right text-[12.5px] text-[var(--muted)]">{c.note}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`Late posts · ${data.late.length}`} sub="Approved but not published 30+ minutes after their time (is the n8n publisher running?)." pad={false}>
          <ul className="divide-y divide-[var(--line-soft)]">
            {!data.late.length ? <li className="px-5 py-4 text-sm text-[var(--faint)]">None.</li> : null}
            {data.late.map((l, i) => (
              <li key={i} className="px-4 py-2.5 text-sm sm:px-5">
                <div className="truncate">{l.title}</div>
                <div className="text-[12px] text-[var(--faint)]">
                  {l.tool} · {l.email} · due {when(l.when)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={`Failures, 7 days · ${data.failures.length}`} pad={false}>
          <ul className="divide-y divide-[var(--line-soft)]">
            {!data.failures.length ? <li className="px-5 py-4 text-sm text-[var(--faint)]">None.</li> : null}
            {data.failures.map((f, i) => (
              <li key={i} className="px-4 py-2.5 text-sm sm:px-5">
                <div className="text-[var(--bad)]">{f.error || "Failed"}</div>
                <div className="text-[12px] text-[var(--faint)]">
                  {f.tool} · {f.email}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
