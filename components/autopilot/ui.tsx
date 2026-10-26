"use client"

// Shared pieces of the customer dashboard: styles, notices, and the plan / payment card
// used by every Autopilot tool.

import { useEffect, useState, type ReactNode } from "react"
import { useInApp } from "@/lib/dashboard/app-mode"
import { isFree, lapsed, limitOf, pendingUpi, priceOf, PRODUCTS, remaining, rupees, type Cycle, type PlanKey, type ProductKey, type Subscription } from "@/lib/autopilot/products"

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
  const [cycle, setCycle] = useState<Cycle>(sub.cycle === "yearly" ? "yearly" : "monthly")
  const [changing, setChanging] = useState(false)
  const left = remaining(sub)
  const trial = sub.status === "trial"
  const active = sub.status === "active" && !lapsed(sub)
  const pend = pendingUpi(sub)
  const inApp = useInApp()
  const free = isFree(sub)
  const showPlans = !free && !inApp && (!active || renewSoon(sub) || changing)

  const subscribe = async (plan: PlanKey) => {
    setBusy(plan)
    setMsg(null)
    try {
      const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "subscribe", product, plan, cycle }) })
      const j = (await r.json()) as { ok: boolean; error?: string; subscriptionId?: string; key?: string; name?: string; email?: string }
      if (!j.ok || !j.subscriptionId) throw new Error(j.error || "Could not start checkout.")
      await loadRazorpay()
      const Rzp = (window as unknown as { Razorpay: new (o: Record<string, unknown>) => { open: () => void } }).Razorpay
      const rz = new Rzp({
        key: j.key,
        subscription_id: j.subscriptionId,
        name: "Xredible",
        description: `${p.name} ${plan === "pro" ? "Pro" : "Starter"} (${cycle})`,
        prefill: { name: j.name, email: j.email },
        theme: { color: "#10203f" },
        handler: async (resp: Record<string, string>) => {
          const c = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "confirm", ...resp }) })
          const cj = (await c.json()) as { ok: boolean; error?: string }
          setMsg(cj.ok ? { tone: "good", text: "You're subscribed. A receipt is on its way to your email." } : { tone: "bad", text: cj.error || "Payment received; it will show here in a few minutes." })
          setChanging(false)
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
    if (!window.confirm("Stop this plan at the end of the period you've paid for?")) return
    setBusy("cancel")
    const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "cancel", product }) })
    const j = (await r.json()) as { ok: boolean; error?: string }
    setMsg(j.ok ? { tone: "info", text: "Your plan will stop at the end of the period you've paid for." } : { tone: "bad", text: j.error || "Could not cancel." })
    setBusy(null)
    onChanged()
  }

  const planName = (k: string) => (k === "pro" ? "Pro" : "Starter")
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <div className={small}>Plan</div>
          <div className="text-base font-semibold">{free ? "Pro · free access" : trial ? "Free trial" : `${planName(sub.plan)}${sub.cycle === "yearly" ? " · yearly" : ""} · ${active ? "active" : lapsed(sub) ? "ended" : sub.status}`}</div>
        </div>
        <div>
          <div className={small}>{trial ? `Free ${p.unit} left` : `${p.unit[0].toUpperCase() + p.unit.slice(1)} left this ${free ? "month" : sub.cycle === "yearly" ? "year" : "period"}`}</div>
          <div className="text-base font-semibold tabular-nums">
            {left} of {sub.postLimit}
          </div>
        </div>
        {sub.periodEnd && !trial ? (
          <div>
            <div className={small}>{free ? "New month starts" : sub.rzpSubId && active ? "Renews" : "Paid until"}</div>
            <div className="text-base font-semibold">{istTime(sub.periodEnd).split(",").slice(0, 2).join(",")}</div>
          </div>
        ) : null}
        <div className="ml-auto flex flex-wrap gap-2">
          {active && !free && !changing && !inApp ? (
            <button type="button" className={ghost} onClick={() => setChanging(true)}>
              Change plan
            </button>
          ) : null}
          {active && sub.rzpSubId && !inApp ? (
            <button type="button" className={ghost} disabled={busy !== null} onClick={cancel}>
              Cancel plan
            </button>
          ) : null}
        </div>
      </div>
      {sub.note && !sub.note.startsWith("checkout:") && !pend ? <div className="mt-3"><Notice tone="info">{sub.note}</Notice></div> : null}
      {lapsed(sub) ? <div className="mt-3"><Notice tone="bad">{inApp ? "Your paid period has ended." : "Your paid period has ended. Renew to keep posting."}</Notice></div> : null}
      {inApp && !free && (!active || renewSoon(sub)) ? <div className="mt-3"><Notice tone="info">Plans can&rsquo;t be bought or changed in the app.</Notice></div> : null}
      {pend ? (
        <div className="mt-3">
          <Notice tone="info">
            We got your UPI payment{pend.amount ? ` of ${rupees(pend.amount)}` : ""} (UTR {pend.utr}). We&rsquo;ll switch on {planName(pend.plan)} {pend.cycle === "yearly" ? "(yearly)" : ""} after checking it, usually within a few hours, and email your receipt.
          </Notice>
        </div>
      ) : null}
      {showPlans ? (
        <div className="mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5 text-[13px]" role="group" aria-label="Billing period">
              {(["monthly", "yearly"] as Cycle[]).map((c) => (
                <button key={c} type="button" onClick={() => { setCycle(c); setUpiPlan(null) }} aria-pressed={cycle === c} className={`rounded-md px-3 py-1.5 font-medium ${cycle === c ? "bg-[var(--nav)] text-white" : "text-[var(--ink2)]"}`}>
                  {c === "monthly" ? "Monthly" : "Yearly · 2 months free"}
                </button>
              ))}
            </div>
            {changing ? (
              <button type="button" className="text-[13px] text-[var(--muted)] underline" onClick={() => { setChanging(false); setUpiPlan(null) }}>
                Keep my current plan
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {p.plans.map((pl) => {
              const price = priceOf(product, pl.key, cycle)
              const current = active && sub.plan === pl.key && sub.cycle === cycle
              return (
                <div key={pl.key} className={`rounded-xl border p-4 ${current ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="font-semibold">
                      {pl.name}
                      {current ? <span className="ml-2 rounded bg-[var(--brandsoft)] px-1.5 py-0.5 text-[11px] text-[var(--brand)]">Current</span> : null}
                    </div>
                    <div className="text-right text-lg font-semibold">
                      {rupees(price)}
                      <span className="text-sm font-normal text-[var(--muted)]">/{cycle === "yearly" ? "year" : "month"}</span>
                    </div>
                  </div>
                  <div className="mt-1 text-sm text-[var(--muted)]">
                    {cycle === "yearly" ? `${limitOf(product, pl.key, cycle)} ${p.unit} a year · ${rupees(Math.round(price / 12 / 100) * 100)}/month` : `${pl.posts} ${p.unit} a month · ${pl.blurb}`}
                  </div>
                  {s.ready.payments ? (
                    <button type="button" className={primary + " mt-3 w-full"} disabled={busy !== null} onClick={() => subscribe(pl.key)}>
                      {busy === pl.key ? "Opening checkout…" : `Pay by card · ${pl.name}`}
                    </button>
                  ) : null}
                  {s.ready.upi ? (
                    <button type="button" className={(s.ready.payments ? ghost : primary) + " mt-2 w-full justify-center"} onClick={() => setUpiPlan(upiPlan === pl.key ? null : pl.key)}>
                      {upiPlan === pl.key ? "Hide UPI details" : `Pay ${rupees(price)} by UPI`}
                    </button>
                  ) : null}
                </div>
              )
            })}
            {upiPlan && s.ready.upi ? (
              <UpiPay key={upiPlan + cycle} product={product} plan={upiPlan} cycle={cycle} onDone={(t) => { setMsg({ tone: "good", text: t }); setUpiPlan(null); setChanging(false); onChanged() }} />
            ) : null}
            {!s.ready.payments && !s.ready.upi ? <div className="text-xs text-[var(--faint)] sm:col-span-2">Payments are being switched on. Your free trial works meanwhile.</div> : null}
            {active || sub.plan !== "trial" ? <div className="text-xs text-[var(--faint)] sm:col-span-2">Paying again for the same plan adds to your current period. A different plan starts on the day it&rsquo;s activated. UPI plans don&rsquo;t renew by themselves; we email you 3 days before they end.</div> : null}
          </div>
        </div>
      ) : null}
      {msg ? <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
    </div>
  )
}

const renewSoon = (s: Subscription) => !isFree(s) && s.status === "active" && !s.rzpSubId && !!s.periodEnd && Date.parse(s.periodEnd) - Date.now() < 5 * 864e5

type Quote = { amount: number; full: number; couponError: string | null; percent: number; upi: { id: string; link: string; qr: string } | null }

function UpiPay({ product, plan, cycle, onDone }: { product: ProductKey; plan: PlanKey; cycle: Cycle; onDone: (msg: string) => void }) {
  const p = PRODUCTS[product].plans.find((x) => x.key === plan)!
  const [coupon, setCoupon] = useState("")
  const [applied, setApplied] = useState("")
  const [q, setQ] = useState<Quote | null>(null)
  const [utr, setUtr] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "quote", product, plan, cycle, coupon: applied }) })
      .then((r) => r.json())
      .then((j: Quote & { ok: boolean; error?: string }) => {
        if (!alive) return
        if (j.ok) setQ(j)
        else setErr(j.error || "Could not get the price.")
      })
      .catch(() => alive && setErr("No connection. Try again."))
    return () => {
      alive = false
    }
  }, [product, plan, cycle, applied])
  const amount = q ? q.amount : priceOf(product, plan, cycle)
  return (
    <div className="rounded-xl border border-[var(--brand)] p-4 sm:col-span-2">
      <div className="font-semibold">
        Pay {rupees(amount)} for {p.name} ({cycle}) by UPI
        {q && q.amount < q.full ? <span className="ml-2 text-sm font-normal text-[var(--good)]">{q.percent}% off · was {rupees(q.full)}</span> : null}
      </div>
      <form
        className="mt-2 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setApplied(coupon.trim().toUpperCase())
        }}
      >
        <input value={coupon} onChange={(e) => setCoupon(e.target.value)} placeholder="Coupon code (optional)" className={field + " mt-0 w-48 uppercase"} />
        <button type="submit" className={ghost} disabled={!coupon.trim()}>
          Apply
        </button>
        {q?.couponError ? <span className="text-xs text-[var(--bad)]">{q.couponError}</span> : null}
      </form>
      <div className="mt-3 flex flex-wrap items-start gap-5">
        {q?.upi ? <img src={q.upi.qr} alt="UPI QR code" width={160} height={160} className="h-40 w-40 rounded-lg bg-white p-1" /> : <div className="h-40 w-40 animate-pulse rounded-lg bg-[var(--soft)]" />}
        <ol className="min-w-[220px] flex-1 list-decimal space-y-1.5 pl-5 text-sm">
          <li>
            Scan the QR with any UPI app, or{" "}
            {q?.upi ? (
              <a href={q.upi.link} className="font-semibold text-[var(--brand)] underline">
                open your UPI app
              </a>
            ) : (
              "open your UPI app"
            )}{" "}
            on this phone.
          </li>
          <li>
            Pay <b>{rupees(amount)}</b> to <b className="font-mono">{q?.upi?.id || "…"}</b>.
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
            const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "upi", product, plan, cycle, coupon: applied, utr }) })
            const j = (await r.json()) as { ok: boolean; error?: string }
            if (j.ok) onDone("Thanks! We'll switch on your plan after checking the payment, usually within a few hours, and email your receipt.")
            else setErr(j.error || "That didn't work.")
          } catch {
            setErr("No connection. Try again.")
          }
          setBusy(false)
        }}
      >
        <input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="UTR / reference number" inputMode="numeric" maxLength={12} pattern="[0-9]{12}" title="The 12-digit UTR number from your UPI app" className={field + " mt-0 w-56 font-mono"} required />
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

