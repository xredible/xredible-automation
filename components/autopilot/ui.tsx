"use client"

// Shared pieces of the customer dashboard: styles, notices, and the plan / payment card
// used by every Autopilot tool.

import { useState, type ReactNode } from "react"
import { lapsed, pendingUpi, PRODUCTS, remaining, rupees, type PlanKey, type ProductKey, type Subscription } from "@/lib/autopilot/products"

export type Upi = { id: string; plans: { key: PlanKey; link: string; qr: string }[] }
export type PlanState = { sub: Subscription; ready: { payments: boolean; razorpayKey: string; upi: Upi | null } }

export const CSS = `
.xd{--bg:#f4f5f7;--panel:#fff;--ink:#0e1627;--ink2:#334155;--muted:#5d6676;--faint:#8b93a1;--line:#e3e6eb;--soft:#eef0f3;--brand:#24438a;--brandsoft:#eef2fb;--nav:#10203f;--gold:#d4ad4b;--good:#0e7a48;--goodbg:#e7f5ec;--bad:#c2372d;--badbg:#fdeceb;background:var(--bg);color:var(--ink)}
.xd .dash-root{--ink-2:var(--ink2);--hover:var(--soft);--line-strong:var(--brand);--bad-bg:var(--badbg);--good-bg:var(--goodbg)}
@media (prefers-color-scheme:dark){.xd{--bg:#0b111c;--panel:#121a28;--ink:#eef2f8;--ink2:#c7cfdb;--muted:#98a2b3;--faint:#6f7a8c;--line:#222c3c;--soft:#1a2332;--brand:#8aa6ee;--brandsoft:#1a2747;--nav:#0a1222;--good:#4fcf8f;--goodbg:#11291e;--bad:#ff8a80;--badbg:#2c1716;color-scheme:dark}}
`
export const card = "rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6"
export const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
export const small = "text-[12.5px] font-medium text-[var(--muted)]"
export const primary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--nav)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
export const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink2)] hover:border-[var(--brand)] disabled:opacity-50"

export const istTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—"
export const toLocalInput = (iso: string | null) => {
  const d = iso ? new Date(Date.parse(iso) + 330 * 60000) : new Date(Date.now() + 330 * 60000 + 3600_000)
  return d.toISOString().slice(0, 16)
}

export function Notice({ tone, children }: { tone: "good" | "bad" | "info"; children: ReactNode }) {
  const c = tone === "good" ? "bg-[var(--goodbg)] text-[var(--good)]" : tone === "bad" ? "bg-[var(--badbg)] text-[var(--bad)]" : "bg-[var(--brandsoft)] text-[var(--brand)]"
  return <div className={`rounded-lg px-3 py-2 text-sm ${c}`}>{children}</div>
}


export function PlanCard({ product, s, onChanged }: { product: ProductKey; s: PlanState; onChanged: () => void }) {
  const p = PRODUCTS[product]
  const sub = s.sub
  const [msg, setMsg] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null)
  const [busy, setBusy] = useState<PlanKey | "cancel" | null>(null)
  const [upiPlan, setUpiPlan] = useState<PlanKey | null>(null)
  const left = remaining(sub)
  const trial = sub.status === "trial"

  const subscribe = async (plan: PlanKey) => {
    setBusy(plan)
    setMsg(null)
    try {
      const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "subscribe", product, plan }) })
      const j = (await r.json()) as { ok: boolean; error?: string; subscriptionId?: string; key?: string; name?: string; email?: string }
      if (!j.ok || !j.subscriptionId) throw new Error(j.error || "Could not start checkout.")
      await loadRazorpay()
      const Rzp = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay
      const rz = new Rzp({
        key: j.key,
        subscription_id: j.subscriptionId,
        name: "Xredible",
        description: `${p.name} ${plan === "pro" ? "Pro" : "Starter"}`,
        prefill: { name: j.name, email: j.email },
        theme: { color: "#10203f" },
        handler: async (resp: Record<string, string>) => {
          const c = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "confirm", ...resp }) })
          const cj = (await c.json()) as { ok: boolean; error?: string }
          setMsg(cj.ok ? { tone: "good", text: `You're subscribed. Approved ${p.unit} will keep going out.` } : { tone: "bad", text: cj.error || "Payment received; it will show here in a few minutes." })
          onChanged()
        },
        modal: { ondismiss: () => setBusy(null) },
      })
      rz.open()
    } catch (e) {
      setMsg({ tone: "bad", text: e instanceof Error ? e.message : "Could not start checkout." })
    }
    setBusy(null)
  }

  const cancel = async () => {
    setBusy("cancel")
    const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "cancel", product }) })
    const j = (await r.json()) as { ok: boolean; error?: string }
    setMsg(j.ok ? { tone: "info", text: "Your plan will stop at the end of this month." } : { tone: "bad", text: j.error || "Could not cancel." })
    setBusy(null)
    onChanged()
  }

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className={small}>Plan</div>
          <div className="text-base font-semibold">{trial ? "Free trial" : `${sub.plan === "pro" ? "Pro" : "Starter"} · ${sub.status === "active" ? "active" : sub.status}`}</div>
        </div>
        <div>
          <div className={small}>{trial ? `Free ${p.unit} left` : `${p.unit[0].toUpperCase() + p.unit.slice(1)} left this month`}</div>
          <div className="text-base font-semibold tabular-nums">
            {left} of {sub.postLimit}
          </div>
        </div>
        {sub.periodEnd && !trial ? (
          <div>
            <div className={small}>Renews</div>
            <div className="text-base font-semibold">{istTime(sub.periodEnd).split(",").slice(0, 2).join(",")}</div>
          </div>
        ) : null}
        {sub.status === "active" && sub.rzpSubId ? (
          <button type="button" className={ghost + " ml-auto"} disabled={busy !== null} onClick={cancel}>
            Cancel plan
          </button>
        ) : null}
      </div>
      {sub.note && !sub.note.startsWith("checkout:") && !pendingUpi(sub) ? <div className="mt-3"><Notice tone="info">{sub.note}</Notice></div> : null}
      {lapsed(sub) ? <div className="mt-3"><Notice tone="bad">Your paid month has ended. Renew to keep going.</Notice></div> : null}
      {pendingUpi(sub) ? (
        <div className="mt-3">
          <Notice tone="info">
            We got your UPI payment details (UTR {pendingUpi(sub)?.utr}). We&rsquo;ll switch on your {pendingUpi(sub)?.plan === "pro" ? "Pro" : "Starter"} plan after checking it, usually within a few hours.
          </Notice>
        </div>
      ) : null}
      {sub.status !== "active" || lapsed(sub) || renewSoon(sub) ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {p.plans.map((pl) => (
            <div key={pl.key} className="rounded-xl border border-[var(--line)] p-4">
              <div className="flex items-baseline justify-between">
                <div className="font-semibold">{pl.name}</div>
                <div className="text-lg font-semibold">
                  {rupees(pl.price)}
                  <span className="text-sm font-normal text-[var(--muted)]">/month</span>
                </div>
              </div>
              <div className="mt-1 text-sm text-[var(--muted)]">
                {pl.posts} {p.unit} a month · {pl.blurb}
              </div>
              {s.ready.payments ? (
                <button type="button" className={primary + " mt-3 w-full"} disabled={busy !== null} onClick={() => subscribe(pl.key)}>
                  {busy === pl.key ? "Opening checkout…" : `${sub.status === "active" ? "Renew" : "Subscribe to"} ${pl.name}`}
                </button>
              ) : null}
              {s.ready.upi ? (
                <button type="button" className={(s.ready.payments ? ghost : primary) + " mt-2 w-full justify-center"} onClick={() => setUpiPlan(upiPlan === pl.key ? null : pl.key)}>
                  {upiPlan === pl.key ? "Hide UPI details" : `Pay ${rupees(pl.price)} by UPI`}
                </button>
              ) : null}
            </div>
          ))}
          {upiPlan && s.ready.upi ? <UpiPay product={product} upi={s.ready.upi} plan={upiPlan} onDone={(t) => { setMsg({ tone: "good", text: t }); setUpiPlan(null); onChanged() }} /> : null}
          {!s.ready.payments && !s.ready.upi ? <div className="text-xs text-[var(--faint)] sm:col-span-2">Payments are being switched on. Your free trial works meanwhile.</div> : null}
          {sub.status === "active" && !s.ready.payments ? <div className="text-xs text-[var(--faint)] sm:col-span-2">UPI plans don&rsquo;t renew by themselves. Pay again before the renewal date to keep going.</div> : null}
        </div>
      ) : null}
      {msg ? <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
    </div>
  )
}

const renewSoon = (s: Subscription) => s.status === "active" && !s.rzpSubId && !!s.periodEnd && Date.parse(s.periodEnd) - Date.now() < 5 * 864e5

function UpiPay({ product, upi, plan, onDone }: { product: ProductKey; upi: Upi; plan: PlanKey; onDone: (msg: string) => void }) {
  const p = PRODUCTS[product].plans.find((x) => x.key === plan)!
  const opt = upi.plans.find((x) => x.key === plan)
  const [utr, setUtr] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="rounded-xl border border-[var(--brand)] p-4 sm:col-span-2">
      <div className="font-semibold">
        Pay {rupees(p.price)} for {p.name} by UPI
      </div>
      <div className="mt-3 flex flex-wrap items-start gap-5">
        {opt ? <img src={opt.qr} alt="UPI QR code" width={160} height={160} className="h-40 w-40 rounded-lg bg-white p-1" /> : null}
        <ol className="min-w-[220px] flex-1 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Scan the QR with any UPI app, or{" "}
            {opt ? (
              <a href={opt.link} className="font-semibold text-[var(--brand)] underline">
                open your UPI app
              </a>
            ) : null}{" "}
            on this phone.
          </li>
          <li>
            Pay <b>{rupees(p.price)}</b> to <b className="font-mono">{upi.id}</b>.
          </li>
          <li>Copy the 12-digit UTR / reference number from the payment receipt and paste it here.</li>
        </ol>
      </div>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setErr(null)
          try {
            const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "upi", product, plan, utr }) })
            const j = (await r.json()) as { ok: boolean; error?: string }
            if (j.ok) onDone("Thanks! We'll switch on your plan after checking the payment, usually within a few hours.")
            else setErr(j.error || "That didn't work.")
          } catch {
            setErr("No connection. Try again.")
          }
          setBusy(false)
        }}
      >
        <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR / reference number" inputMode="numeric" className={field + " mt-0 w-56 font-mono"} required />
        <button type="submit" className={primary} disabled={busy}>
          {busy ? "Sending…" : "I've paid"}
        </button>
      </form>
      {err ? <div className="mt-2"><Notice tone="bad">{err}</Notice></div> : null}
    </div>
  )
}

function loadRazorpay(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve()
    const sc = document.createElement("script")
    sc.src = "https://checkout.razorpay.com/v1/checkout.js"
    sc.onload = () => resolve()
    sc.onerror = () => reject(new Error("Could not load Razorpay. Check your connection."))
    document.body.appendChild(sc)
  })
}

