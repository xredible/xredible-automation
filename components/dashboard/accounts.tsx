"use client"

// Admin "Accounts" panel (add people, choose their businesses, reset passwords,
// switch off or remove access) and everyone's "My password" panel.

import { useActionState, useCallback, useEffect, useState, type ReactNode } from "react"
import { Check, Copy, KeyRound, Plus, RefreshCw, Trash2, X } from "lucide-react"
import { BUSINESSES, BUSINESS_KEYS, type BusinessKey } from "@/lib/dashboard/businesses"
import { changeMyPassword, type FormState } from "@/app/dashboard/actions"

export type Me = { name: string; email: string; role: "admin" | "member" | "customer" }

type Account = { email: string; name: string; role: "admin" | "member"; businesses: BusinessKey[]; active: boolean; lastLogin: string | null }

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
      <p className="text-sm text-[var(--muted)]">Everyone signs in at xredible.in/dashboard with their email and password, and sees only the businesses ticked for them. Admins see every business and can manage accounts.</p>
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
  sub: { id: number; email: string; product: string; plan: string; status: string; postLimit: number; used: number; periodEnd: string | null; note: string; rzpSubId: string }
  name: string
  liName: string
  connected: boolean
}

/** Admin: Autopilot customers, their plans, and UPI payments waiting to be checked. */
export function CustomersPanel({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<CustomerRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const load = useCallback(async () => {
    try {
      const r = await fetch("/dashboard/customers", { cache: "no-store" })
      const j = (await r.json()) as { ok?: boolean; customers?: CustomerRow[]; error?: string }
      if (j.ok && j.customers) {
        setList(j.customers)
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
    setBusy(Number(body.id))
    try {
      const r = await fetch("/dashboard/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const j = (await r.json()) as { ok?: boolean; error?: string }
      if (!j.ok) setError(j.error || "That didn't work.")
    } catch {
      setError("No connection. Try again.")
    }
    setBusy(null)
    load()
  }
  const upi = (note: string) => /^upi:(starter|pro):([A-Za-z0-9]+):(.+)$/.exec(note)
  return (
    <Modal title="Customers" onClose={onClose} wide>
      <p className="text-sm text-[var(--muted)]">People who signed up for an automation. UPI payments waiting for you are at the top: check the UTR in your bank or UPI app, then activate.</p>
      {error ? <div className="mt-3 rounded-lg bg-[var(--bad-bg)] px-3 py-2 text-sm text-[var(--bad)]">{error}</div> : null}
      <ul className="mt-4 divide-y divide-[var(--line-soft)] rounded-xl border border-[var(--line)]">
        {!list ? <li className="px-4 py-6 text-sm text-[var(--faint)]">Loading customers…</li> : null}
        {list && !list.length ? <li className="px-4 py-6 text-sm text-[var(--faint)]">No customers yet. Share xredible.in/dashboard?signup to get the first ones.</li> : null}
        {list?.map(({ sub, name, liName, connected }) => {
          const u = upi(sub.note)
          return (
            <li key={sub.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{name || sub.email}</div>
                  <div className="truncate text-[12px] text-[var(--muted)]">
                    {sub.email} · {sub.product === "linkedin" ? "LinkedIn Autopilot" : sub.product} · LinkedIn {connected ? `connected (${liName})` : "not connected"}
                  </div>
                </div>
                <div className="text-right text-[12.5px]">
                  <div className="font-semibold capitalize">
                    {sub.plan} · {sub.status}
                  </div>
                  <div className="text-[var(--muted)]">
                    {sub.used}/{sub.postLimit} used{sub.periodEnd ? ` · until ${when(sub.periodEnd)}` : ""}
                  </div>
                </div>
              </div>
              {u ? (
                <div className="mt-2 rounded-lg bg-[var(--brand-soft)] px-3 py-2 text-[13px]">
                  UPI payment for <b className="capitalize">{u[1]}</b> · UTR <b className="font-mono">{u[2]}</b> · sent {when(u[3])}
                </div>
              ) : sub.note ? (
                <div className="mt-2 text-[12.5px] text-[var(--muted)]">{sub.note}</div>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <button type="button" className={ghost} disabled={busy === sub.id} onClick={() => run({ op: "activate", id: sub.id, plan: "starter" })}>
                  {sub.status === "active" ? "+30 days Starter" : "Activate Starter"}
                </button>
                <button type="button" className={ghost} disabled={busy === sub.id} onClick={() => run({ op: "activate", id: sub.id, plan: "pro" })}>
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
    </Modal>
  )
}
