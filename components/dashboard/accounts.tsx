"use client"

import { PRODUCTS, type ProductKey } from "@/lib/autopilot/products"

// Admin "Accounts" panel (add people, choose their businesses, reset passwords,
// switch off or remove access) and everyone's "My password" panel.

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react"
import { Check, Copy, KeyRound, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { BUSINESSES, BUSINESS_KEYS, type BusinessKey } from "@/lib/dashboard/businesses"
import { changeMyPassword, type FormState } from "@/app/dashboard/actions"

export type Me = { name: string; email: string; role: "admin" | "member" | "customer" }

type Account = { email: string; name: string; role: "admin" | "member"; businesses: BusinessKey[]; active: boolean; lastLogin: string | null; free?: boolean }

const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const small = "text-[12px] font-medium text-[var(--muted)]"
const primary = "inline-flex items-center gap-1.5 rounded-lg bg-[var(--nav)] px-3.5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] disabled:opacity-50"

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", esc)
    return () => document.removeEventListener("keydown", esc)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-6 sm:py-12" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="fixed inset-0 cursor-default" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-2xl bg-[var(--panel)] text-[var(--ink)] shadow-2xl`}>
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-md p-1.5 text-[var(--muted)] hover:bg-[var(--hover)]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

/** A readable random password: 14 letters/digits, no look-alikes. */
function makePassword() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const a = new Uint32Array(14)
  crypto.getRandomValues(a)
  return Array.from(a, (n) => abc[n % abc.length]).join("")
}

function PasswordBox({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="mt-1 flex gap-1.5">
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={field + " mt-0 font-mono"} autoComplete="new-password" spellCheck={false} />
      <button type="button" className={ghost} onClick={() => onChange(makePassword())} title="Make a random password">
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={ghost}
        disabled={!value}
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
        title="Copy"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

function BusinessPicks({ value, onChange, disabled }: { value: BusinessKey[]; onChange: (v: BusinessKey[]) => void; disabled?: boolean }) {
  return (
    <div className="mt-1 flex flex-wrap gap-2">
      {BUSINESS_KEYS.map((k) => {
        const on = disabled || value.includes(k)
        return (
          <label key={k} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[13px] ${on ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)]"} ${disabled ? "cursor-default opacity-70" : ""}`}>
            <input type="checkbox" className="h-3.5 w-3.5" checked={on} disabled={disabled} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
            <img src={BUSINESSES[k].icon} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded" />
            {BUSINESSES[k].name}
          </label>
        )
      })}
    </div>
  )
}

/** A member's own "My automations" (Autopilot workspace), next to the businesses they help with. Admins always have it. */
function OwnAutomations({ value, onChange, admin }: { value: BusinessKey[]; onChange: (v: BusinessKey[]) => void; admin: boolean }) {
  const on = admin || value.includes("autopilot")
  return (
    <label className={`mt-3 flex items-start gap-2 text-sm ${admin ? "opacity-70" : ""}`}>
      <input type="checkbox" className="mt-0.5" checked={on} disabled={admin} onChange={(e) => onChange(e.target.checked ? [...value.filter((x) => x !== "autopilot"), "autopilot"] : value.filter((x) => x !== "autopilot"))} />
      <span>
        Their own <b>My automations</b>
        <span className="block text-[12px] text-[var(--muted)]">A private Autopilot workspace for their own brand (posts, blog, newsletter). Nobody else sees it.</span>
      </span>
    </label>
  )
}

async function send(body: Record<string, unknown>): Promise<string | null> {
  try {
    const r = await fetch("/dashboard/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    const j = (await r.json()) as { ok?: boolean; error?: string }
    return j.ok ? null : j.error || "That didn't work."
  } catch {
    return "No connection. Try again."
  }
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "Never")

export function AccountsPanel({ me, onClose }: { me: Me; onClose: () => void }) {
  const [list, setList] = useState<Account[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/dashboard/accounts", { cache: "no-store" })
      const j = (await r.json()) as { ok?: boolean; users?: Account[]; error?: string }
      if (j.ok && j.users) {
        setList(j.users)
        setError(null)
      } else setError(j.error || "Could not load accounts.")
    } catch {
      setError("No connection. Try again.")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  return (
    <Modal title="Accounts" onClose={onClose} wide>
      <p className="text-sm text-[var(--muted)]">Everyone signs in at xredible.in/dashboard with their email and password, and sees only the businesses ticked for them, plus their own My automations when ticked. Admins see every business and can manage accounts. Free access lets someone use every Autopilot tool on Pro without paying.</p>
      {error ? <div className="mt-3 rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</div> : null}
      <div className="mt-4 flex justify-end">
        {!adding ? (
          <button type="button" className={primary} onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add account
          </button>
        ) : null}
      </div>
      {adding ? <NewAccount onDone={(saved) => { setAdding(false); if (saved) load() }} /> : null}
      <ul className="mt-4 divide-y divide-[var(--line-soft)] rounded-xl border border-[var(--line)]">
        {!list ? <li className="px-4 py-6 text-sm text-[var(--faint)]">Loading accounts…</li> : null}
        {list?.map((a) => (
          <li key={a.email} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">{a.name || a.email}</span>
                  {a.role === "admin" ? <span className="rounded bg-[var(--brand-soft)] px-1.5 py-px text-[10.5px] font-semibold text-[var(--brand)]">Admin</span> : null}
                  {a.free ? <span className="rounded bg-[var(--good-bg)] px-1.5 py-px text-[10.5px] font-semibold text-[var(--good)]">Free access</span> : null}
                  {!a.active ? <span className="rounded bg-[var(--bad-bg)] px-1.5 py-px text-[10.5px] font-semibold text-[var(--bad)]">Switched off</span> : null}
                  {a.email === me.email ? <span className="text-[11px] text-[var(--faint)]">(you)</span> : null}
                </div>
                <div className="truncate text-[12px] text-[var(--muted)]">
                  {a.email} · last sign-in {when(a.lastLogin)}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {(a.role === "admin" ? BUSINESS_KEYS : a.businesses).map((k) => (
                  <span key={k} className="flex items-center gap-1 rounded-md bg-[var(--chip)] px-1.5 py-0.5 text-[11.5px] text-[var(--ink-2)]">
                    <img src={BUSINESSES[k].icon} alt="" width={14} height={14} className="h-3.5 w-3.5 rounded-sm" />
                    {BUSINESSES[k].name}
                  </span>
                ))}
              </div>
              <button type="button" className={ghost} onClick={() => setOpen(open === a.email ? null : a.email)}>
                {open === a.email ? "Close" : "Edit"}
              </button>
            </div>
            {open === a.email ? <EditAccount a={a} self={a.email === me.email} onSaved={() => { setOpen(null); load() }} /> : null}
          </li>
        ))}
      </ul>
    </Modal>
  )
}

function NewAccount({ onDone }: { onDone: (saved: boolean) => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState(makePassword)
  const [role, setRole] = useState<"member" | "admin">("member")
  const [biz, setBiz] = useState<BusinessKey[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  if (done)
    return (
      <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--good-bg)] p-4 text-sm">
        <div className="font-semibold text-[var(--good)]">Account created for {name}.</div>
        <div className="mt-1 text-[var(--ink-2)]">
          Send them: <b>xredible.in/dashboard</b>, their email <b>{email}</b> and this password: <code className="rounded bg-[var(--panel)] px-1.5 py-0.5 font-mono">{password}</code>. They can change it under &ldquo;My password&rdquo; after signing in.
        </div>
        <button type="button" className={ghost + " mt-3"} onClick={() => onDone(true)}>
          Done
        </button>
      </div>
    )
  return (
    <form
      className="mt-3 rounded-xl border border-[var(--line)] p-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const err = await send({ op: "create", name, email, password, role, businesses: biz })
        setBusy(false)
        if (err) setError(err)
        else setDone(true)
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={small}>Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className={small}>Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className={small}>Temporary password</span>
          <PasswordBox id="new-pw" value={password} onChange={setPassword} />
        </label>
        <label className="block">
          <span className={small}>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as "member" | "admin")} className={field}>
            <option value="member">Member: only the businesses ticked below</option>
            <option value="admin">Admin: every business + manage accounts</option>
          </select>
        </label>
      </div>
      <div className="mt-3">
        <span className={small}>Businesses</span>
        <BusinessPicks value={biz} onChange={setBiz} disabled={role === "admin"} />
        <OwnAutomations value={biz} onChange={setBiz} admin={role === "admin"} />
      </div>
      {error ? <div className="mt-3 rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</div> : null}
      <div className="mt-4 flex gap-2">
        <button type="submit" className={primary} disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <button type="button" className={ghost} onClick={() => onDone(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function EditAccount({ a, self, onSaved }: { a: Account; self: boolean; onSaved: () => void }) {
  const [name, setName] = useState(a.name)
  const [role, setRole] = useState(a.role)
  const [biz, setBiz] = useState<BusinessKey[]>(a.businesses)
  const [active, setActive] = useState(a.active)
  const [pw, setPw] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const run = async (body: Record<string, unknown>, okText: string, close = true) => {
    setBusy(true)
    const err = await send({ ...body, email: a.email })
    setBusy(false)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: okText })
    if (!err && close) onSaved()
  }
  return (
    <div className="mt-3 rounded-xl border border-[var(--line)] p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={small}>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <label className="block">
          <span className={small}>Role</span>
          <select value={role} disabled={self} onChange={(e) => setRole(e.target.value as "member" | "admin")} className={field}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      </div>
      <div className="mt-3">
        <span className={small}>Businesses</span>
        <BusinessPicks value={biz} onChange={setBiz} disabled={role === "admin"} />
        <OwnAutomations value={biz} onChange={setBiz} admin={role === "admin"} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} disabled={self} onChange={(e) => setActive(e.target.checked)} />
        Can sign in
      </label>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={primary} disabled={busy} onClick={() => run({ op: "update", name, role, businesses: biz, active }, "Saved.")}>
          Save changes
        </button>
      </div>

      <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
        <span className={small}>Free access</span>
        <p className="mt-1 text-[13px] text-[var(--ink-2)]">
          {a.free
            ? "On: every Autopilot tool runs on the Pro plan without payment. The post limit resets every 30 days. It doesn't count as revenue."
            : "Let them use every Autopilot tool on the Pro plan without paying, with no end date. You can switch it off anytime."}
        </p>
        <button type="button" className={ghost + " mt-2"} disabled={busy} onClick={() => run({ op: "free", on: !a.free }, a.free ? "Free access switched off." : "Free access switched on.")}>
          {a.free ? "Switch off free access" : "Give free access"}
        </button>
      </div>

      <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
        <span className={small}>Set a new password (signs them out everywhere)</span>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-[220px] flex-1">
            <PasswordBox id={`pw-${a.email}`} value={pw} onChange={setPw} />
          </div>
          <button type="button" className={ghost + " mt-1"} disabled={busy || !pw} onClick={() => run({ op: "reset", password: pw }, `New password set. Send it to ${a.name || a.email}.`, false)}>
            <KeyRound className="h-3.5 w-3.5" /> Set password
          </button>
        </div>
      </div>

      {!self ? (
        <div className="mt-5 border-t border-[var(--line-soft)] pt-4">
          {!confirmDelete ? (
            <button type="button" className={ghost + " text-[var(--bad)]"} onClick={() => setConfirmDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Remove account
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              Remove {a.name || a.email} for good?
              <button type="button" className={ghost + " border-[var(--bad-line)] text-[var(--bad)]"} disabled={busy} onClick={() => run({ op: "delete" }, "Removed.")}>
                Yes, remove
              </button>
              <button type="button" className={ghost} onClick={() => setConfirmDelete(false)}>
                Keep
              </button>
            </div>
          )}
        </div>
      ) : null}
      {msg ? <div className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-[var(--good-bg)] text-[var(--good)]" : "bg-[var(--bad-bg)] text-[var(--bad)]"}`}>{msg.text}</div> : null}
    </div>
  )
}

export function PasswordPanel({ onClose }: { onClose: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changeMyPassword, { error: null })
  return (
    <Modal title="My password" onClose={onClose}>
      <form action={action}>
        <label className="block">
          <span className={small}>Current password</span>
          <input name="current" type="password" autoComplete="current-password" required className={field} />
        </label>
        <label className="mt-3 block">
          <span className={small}>New password (at least 10 characters)</span>
          <input name="next" type="password" autoComplete="new-password" minLength={10} required className={field} />
        </label>
        {state.error ? <div className="mt-3 rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{state.error}</div> : null}
        {state.ok ? <div className="mt-3 rounded-lg bg-[var(--good-bg)] px-3 py-2 text-sm text-[var(--good)]">{state.ok}</div> : null}
        <div className="mt-4 flex gap-2">
          <button type="submit" className={primary} disabled={pending}>
            {pending ? "Saving…" : "Change password"}
          </button>
          <button type="button" className={ghost} onClick={onClose}>
            Close
          </button>
        </div>
      </form>
    </Modal>
  )
}

type CustomerRow = {
  sub: { id: number; email: string; product: string; plan: string; cycle?: string; status: string; postLimit: number; used: number; periodEnd: string | null; note: string; rzpSubId: string }
  name: string
  liName: string
  connected: boolean
  upi: { plan: string; utr: string; at: string; cycle: string; coupon: string; amount: number | null } | null
}
type Stats = { mrr: number; activePaid: number; trials: number; customers: number; conversion: number; revenue30: number; revenueAll: number; churn30: number; pending: number; byProduct: Record<string, number> }
type CouponRow = { id: number; code: string; percent: number; products: string; maxUses: number; used: number; expires: string | null; active: boolean }

const inr = (paise: number) => `₹${Math.round(paise / 100).toLocaleString("en-IN")}`
const pct = (n: number) => `${Math.round(n * 100)}%`

/** Admin: Autopilot revenue, customers, UPI payments waiting to be checked, and coupon codes. */
export function CustomersPanel({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<CustomerRow[] | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [coupons, setCoupons] = useState<CouponRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [tab, setTab] = useState<"customers" | "coupons">("customers")
  const [q, setQ] = useState("")
  const [c, setC] = useState({ code: "", percent: "20", products: "", maxUses: "", expires: "" })
  const load = useCallback(async () => {
    try {
      const r = await fetch("/dashboard/customers", { cache: "no-store" })
      const j = (await r.json()) as { ok?: boolean; customers?: CustomerRow[]; stats?: Stats; coupons?: CouponRow[]; error?: string }
      if (j.ok && j.customers) {
        setList(j.customers)
        setStats(j.stats || null)
        setCoupons(j.coupons || [])
        setError(null)
      } else setError(j.error || "Could not load customers.")
    } catch {
      setError("No connection. Try again.")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const run = async (body: Record<string, unknown>) => {
    setBusy(Number(body.id ?? body.couponId ?? -1))
    let ok = false
    try {
      const r = await fetch("/dashboard/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const j = (await r.json()) as { ok?: boolean; error?: string }
      ok = !!j.ok
      if (!j.ok) setError(j.error || "That didn't work.")
      else setError(null)
    } catch {
      setError("No connection. Try again.")
    }
    setBusy(null)
    load()
    return ok
  }
  const shown = (list || []).filter((x) => !q || `${x.name} ${x.sub.email} ${x.sub.product}`.toLowerCase().includes(q.toLowerCase()))
  const tile = (label: string, value: string, sub?: string) => (
    <div className="rounded-lg border border-[var(--line)] px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--faint)]">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      {sub ? <div className="text-[11px] text-[var(--muted)]">{sub}</div> : null}
    </div>
  )
  return (
    <Modal title="Customers & revenue" onClose={onClose} wide>
      {stats ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tile("Monthly recurring", inr(stats.mrr), `${stats.activePaid} paid plans`)}
          {tile("Revenue, 30 days", inr(stats.revenue30), `${inr(stats.revenueAll)} all time`)}
          {tile("Trial → paid", pct(stats.conversion), `${stats.customers} customers · ${stats.trials} on trial`)}
          {tile("Churn, 30 days", pct(stats.churn30), stats.pending ? `${stats.pending} UPI payments to check` : "No UPI payments waiting")}
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["customers", "coupons"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${tab === t ? "bg-[var(--brand-soft)] text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--chip)]"}`}>
            {t === "customers" ? "Customers" : "Coupon codes"}
          </button>
        ))}
        {tab === "customers" ? <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email or tool" className="ml-auto w-56 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-sm" /> : null}
      </div>
      {error ? <div className="mt-3 rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</div> : null}
      {tab === "coupons" ? (
        <div className="mt-3 space-y-3">
          <form
            className="grid gap-2 rounded-xl border border-[var(--line)] p-3 sm:grid-cols-6"
            onSubmit={async (e) => {
              e.preventDefault()
              if (await run({ op: "coupon", ...c })) setC({ code: "", percent: "20", products: "", maxUses: "", expires: "" })
            }}
          >
            <input required value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} placeholder="CODE" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-sm uppercase sm:col-span-2" />
            <input required type="number" min={1} max={100} value={c.percent} onChange={(e) => setC({ ...c, percent: e.target.value })} placeholder="% off" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-sm" />
            <input type="number" min={0} value={c.maxUses} onChange={(e) => setC({ ...c, maxUses: e.target.value })} placeholder="Max uses" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-sm" />
            <input type="date" value={c.expires} onChange={(e) => setC({ ...c, expires: e.target.value })} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-sm" title="Expires (optional)" />
            <button type="submit" className="rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-semibold text-white dark:text-[var(--nav)]">
              Create
            </button>
            <select value={c.products} onChange={(e) => setC({ ...c, products: e.target.value })} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-sm sm:col-span-6">
              <option value="">All automations</option>
              {Object.values(PRODUCTS).map((p) => (
                <option key={p.key} value={p.key}>
                  Only {p.name}
                </option>
              ))}
            </select>
          </form>
          <p className="text-xs text-[var(--muted)]">Customers type the code when paying by UPI. The discount is shown to them and to you when you activate.</p>
          <ul className="divide-y divide-[var(--line-soft)] rounded-xl border border-[var(--line)]">
            {!coupons.length ? <li className="px-4 py-4 text-sm text-[var(--faint)]">No coupon codes yet.</li> : null}
            {coupons.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <span className="font-mono font-semibold">{x.code}</span>
                <span>{x.percent}% off</span>
                <span className="text-[var(--muted)]">
                  {x.products ? PRODUCTS[x.products as ProductKey]?.name || x.products : "all automations"} · used {x.used}
                  {x.maxUses ? ` of ${x.maxUses}` : ""}
                  {x.expires ? ` · until ${when(x.expires)}` : ""}
                </span>
                <button type="button" className={ghost + " ml-auto"} disabled={busy === x.id} onClick={() => run({ op: "coupon-active", couponId: x.id, active: !x.active })}>
                  {x.active ? "Turn off" : "Turn on"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--line-soft)] rounded-xl border border-[var(--line)]">
          {!list ? <li className="px-4 py-6 text-sm text-[var(--faint)]">Loading customers…</li> : null}
          {list && !list.length ? <li className="px-4 py-6 text-sm text-[var(--faint)]">No customers yet. Share xredible.in/dashboard?signup to get the first ones.</li> : null}
          {shown.map(({ sub, name, liName, connected, upi: u }) => {
            const brand = sub.email.includes("::") ? ` · brand ${sub.email.split("::")[1]}` : ""
            return (
              <li key={sub.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{name || sub.email}</div>
                    <div className="truncate text-[12px] text-[var(--muted)]">
                      {sub.email.split("::")[0]}
                      {brand} · {PRODUCTS[sub.product as ProductKey]?.name || sub.product} · {connected ? `connected (${liName})` : "not connected"}
                    </div>
                  </div>
                  <div className="text-right text-[12.5px]">
                    <div className="font-semibold capitalize">
                      {sub.plan}
                      {sub.cycle === "yearly" ? " · yearly" : ""} · {sub.status}
                    </div>
                    <div className="text-[var(--muted)]">
                      {sub.used}/{sub.postLimit} used{sub.periodEnd ? ` · until ${when(sub.periodEnd)}` : ""}
                    </div>
                  </div>
                </div>
                {u ? (
                  <div className="mt-2 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-[13px]">
                    UPI payment{u.amount ? ` of ${inr(u.amount)}` : ""} for <b className="capitalize">{u.plan}</b> ({u.cycle}){u.coupon ? ` with coupon ${u.coupon}` : ""} · UTR <b className="font-mono">{u.utr}</b> · sent {when(u.at)}
                  </div>
                ) : sub.note ? (
                  <div className="mt-2 text-[12.5px] text-[var(--muted)]">{sub.note}</div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {u ? (
                    <button type="button" className={ghost + " border-[var(--brand)] text-[var(--brand)]"} disabled={busy === sub.id} onClick={() => run({ op: "activate", id: sub.id })}>
                      Payment received: activate {u.plan} ({u.cycle})
                    </button>
                  ) : null}
                  <button type="button" className={ghost} disabled={busy === sub.id} onClick={() => window.confirm("Record a manual payment and start Starter (monthly) for this customer?") && run({ op: "activate", id: sub.id, plan: "starter", cycle: "monthly" })}>
                    {sub.status === "active" ? "+30 days Starter" : "Activate Starter"}
                  </button>
                  <button type="button" className={ghost} disabled={busy === sub.id} onClick={() => window.confirm("Record a manual payment and start Pro (monthly) for this customer?") && run({ op: "activate", id: sub.id, plan: "pro", cycle: "monthly" })}>
                    {sub.status === "active" ? "+30 days Pro" : "Activate Pro"}
                  </button>
                  {u ? (
                    <button type="button" className={ghost + " text-[var(--bad)]"} disabled={busy === sub.id} onClick={() => run({ op: "reject", id: sub.id })}>
                      Payment not found
                    </button>
                  ) : null}
                  {sub.status === "active" ? (
                    <button type="button" className={ghost} disabled={busy === sub.id} onClick={() => run({ op: "stop", id: sub.id })}>
                      Stop plan
                    </button>
                  ) : null}
                  <button type="button" className={ghost} disabled={busy === sub.id} onClick={() => run({ op: "trial", id: sub.id })}>
                    Reset free trial
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Modal>
  )
}
