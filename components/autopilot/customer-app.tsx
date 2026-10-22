"use client"

// What a self-signed-up customer sees at xredible.in/dashboard: their automations,
// and LinkedIn Autopilot (profile, Connect LinkedIn, plan + usage, the post calendar).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, ExternalLink, KeyRound, LogOut, PenLine, RefreshCw, Sparkles, X } from "lucide-react"
import { Linkedin as LinkedinIcon } from "@/components/dashboard/brand"
import { signOut } from "@/app/dashboard/actions"
import { PasswordPanel, type Me } from "@/components/dashboard/accounts"
import { lapsed, pendingUpi, PRODUCTS, PRODUCT_KEYS, remaining, rupees, type PlanKey, type ProductKey, type Subscription } from "@/lib/autopilot/products"

type Profile = {
  about: string
  audience: string
  topics: string
  tone: string
  language: string
  postsPerWeek: number
  postTime: string
  liName: string
  connected: boolean
  tokenExpiringSoon: boolean
  tokenExpires: string | null
}
type Post = { id: number; status: "draft" | "approved" | "posted" | "failed" | "blocked"; text: string; topic: string; scheduledAt: string | null; postedAt: string | null; postUrn: string; error: string }
type Upi = { id: string; plans: { key: PlanKey; link: string; qr: string }[] }
type LiState = { ok: true; sub: Subscription; profile: Profile | null; posts: Post[]; ready: { linkedin: boolean; payments: boolean; razorpayKey: string; upi: Upi | null } }

const CSS = `
.xd{--bg:#f4f5f7;--panel:#fff;--ink:#0e1627;--ink2:#334155;--muted:#5d6676;--faint:#8b93a1;--line:#e3e6eb;--soft:#eef0f3;--brand:#24438a;--brandsoft:#eef2fb;--nav:#10203f;--gold:#d4ad4b;--good:#0e7a48;--goodbg:#e7f5ec;--bad:#c2372d;--badbg:#fdeceb;background:var(--bg);color:var(--ink)}
.xd .dash-root{--ink-2:var(--ink2);--hover:var(--soft);--line-strong:var(--brand);--bad-bg:var(--badbg);--good-bg:var(--goodbg)}
@media (prefers-color-scheme:dark){.xd{--bg:#0b111c;--panel:#121a28;--ink:#eef2f8;--ink2:#c7cfdb;--muted:#98a2b3;--faint:#6f7a8c;--line:#222c3c;--soft:#1a2332;--brand:#8aa6ee;--brandsoft:#1a2747;--nav:#0a1222;--good:#4fcf8f;--goodbg:#11291e;--bad:#ff8a80;--badbg:#2c1716;color-scheme:dark}}
`
const card = "rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6"
const field = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const small = "text-[12.5px] font-medium text-[var(--muted)]"
const primary = "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--nav)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
const ghost = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink2)] hover:border-[var(--brand)] disabled:opacity-50"

const istTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "—"
const toLocalInput = (iso: string | null) => {
  const d = iso ? new Date(Date.parse(iso) + 330 * 60000) : new Date(Date.now() + 330 * 60000 + 3600_000)
  return d.toISOString().slice(0, 16)
}

function Notice({ tone, children }: { tone: "good" | "bad" | "info"; children: ReactNode }) {
  const c = tone === "good" ? "bg-[var(--goodbg)] text-[var(--good)]" : tone === "bad" ? "bg-[var(--badbg)] text-[var(--bad)]" : "bg-[var(--brandsoft)] text-[var(--brand)]"
  return <div className={`rounded-lg px-3 py-2 text-sm ${c}`}>{children}</div>
}

export function CustomerApp({ me }: { me: Me }) {
  const [view, setView] = useState<"home" | ProductKey>("home")
  const [pw, setPw] = useState(false)
  const [flash, setFlash] = useState<{ tone: "good" | "bad" | "info"; text: string } | null>(null)

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const p = q.get("p")
    if (p && p in PRODUCTS) setView(p as ProductKey)
    const li = q.get("li")
    if (li === "connected") setFlash({ tone: "good", text: "LinkedIn connected. Your first drafts will appear here in a minute or two." })
    else if (li === "cancelled") setFlash({ tone: "info", text: "LinkedIn connection was cancelled." })
    else if (li === "expired") setFlash({ tone: "bad", text: "That LinkedIn sign-in took too long. Please try again." })
    else if (li === "notready") setFlash({ tone: "info", text: "Connecting LinkedIn is being switched on. Please try again soon." })
    else if (li === "error") setFlash({ tone: "bad", text: q.get("msg") || "LinkedIn sign-in failed." })
    if (li) window.history.replaceState(null, "", "/dashboard" + (p ? `?p=${p}` : ""))
  }, [])

  return (
    <div className="xd min-h-[100dvh] font-[family-name:var(--font-dash),system-ui,sans-serif] antialiased">
      <style>{CSS}</style>
      <header className="bg-[var(--nav)] text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <button type="button" onClick={() => setView("home")} className="flex items-center gap-2.5">
            <img src="/dashboard/xredible.svg" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
            <span className="text-[15px] font-semibold">Xredible</span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            <span className="mr-2 hidden text-[13px] text-white/70 sm:inline">{me.name}</span>
            <button type="button" onClick={() => setPw(true)} className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="My password">
              <KeyRound className="h-4 w-4" />
            </button>
            <form action={signOut}>
              <button type="submit" className="rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white" title="Sign out">
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
        {flash ? (
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Notice tone={flash.tone}>{flash.text}</Notice>
            </div>
            <button type="button" onClick={() => setFlash(null)} className="rounded p-1.5 text-[var(--faint)]" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {view === "home" ? <Home me={me} open={setView} /> : view === "linkedin" ? <LinkedInAutopilot /> : <ComingSoon product={view} back={() => setView("home")} />}
      </main>
      {pw ? (
        <div className="dash-root">
          <PasswordPanel onClose={() => setPw(false)} />
        </div>
      ) : null}
    </div>
  )
}

function Home({ me, open }: { me: Me; open: (p: ProductKey) => void }) {
  return (
    <>
      <div>
        <h1 className="text-xl font-semibold">Hi {me.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Pick an automation. Each one starts with a free trial; subscribe when you&rsquo;re happy with it.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {PRODUCT_KEYS.map((k) => {
          const p = PRODUCTS[k]
          return (
            <div key={k} className={card + " flex flex-col"}>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">{p.name}</h2>
                {!p.live ? <span className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--muted)]">Coming soon</span> : null}
              </div>
              <p className="mt-1.5 flex-1 text-sm text-[var(--muted)]">{p.tagline}</p>
              {p.live ? (
                <div className="mt-3 text-[13px] text-[var(--ink2)]">
                  {p.trial} free {p.unit}, then from {rupees(Math.min(...p.plans.map((x) => x.price)))}/month
                </div>
              ) : null}
              <button type="button" onClick={() => open(k)} className={(p.live ? primary : ghost) + " mt-4 self-start"}>
                {p.live ? "Open" : "Get notified"}
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

function ComingSoon({ product, back }: { product: ProductKey; back: () => void }) {
  const p = PRODUCTS[product]
  return (
    <div className={card}>
      <h1 className="text-lg font-semibold">{p.name}</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">{p.tagline}</p>
      <p className="mt-4 text-sm">This automation opens soon. We&rsquo;ll email you when it&rsquo;s ready, with {p.trial} free {p.unit} to try it.</p>
      <button type="button" className={ghost + " mt-4"} onClick={back}>
        Back
      </button>
    </div>
  )
}

// ---------- LinkedIn Autopilot ----------

async function liCall(body?: Record<string, unknown>): Promise<LiState | { ok: false; error: string }> {
  try {
    const r = await fetch("/dashboard/me/linkedin", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

function LinkedInAutopilot() {
  const [s, setS] = useState<LiState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await liCall()
    if (r.ok) {
      setS(r)
      setError(null)
    } else setError(r.error)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // New drafts arrive from n8n in the background; check again while some are expected.
  useEffect(() => {
    if (!s?.profile?.connected || s.posts.some((p) => p.status === "draft" || p.status === "approved")) return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [s, load])

  const act = async (body: Record<string, unknown>) => {
    setBusy(true)
    const r = await liCall(body)
    setBusy(false)
    if (r.ok) {
      setS(r)
      setError(null)
      return true
    }
    setError(r.error)
    return false
  }

  if (!s) return <div className={card + " text-sm text-[var(--muted)]"}>{error || "Loading LinkedIn Autopilot…"}</div>
  const hasProfile = !!s.profile?.about
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">LinkedIn Autopilot</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Drafts in your voice → you approve → they post to your LinkedIn on schedule.</p>
        </div>
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <PlanCard s={s} onChanged={load} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard profile={s.profile} busy={busy} onSave={(f) => act({ op: "profile", ...f })} />
        <ConnectCard s={s} busy={busy} onDisconnect={() => act({ op: "disconnect" })} />
      </div>
      <Posts s={s} busy={busy} canGenerate={hasProfile && !!s.profile?.connected} act={act} />
    </>
  )
}

function PlanCard({ s, onChanged }: { s: LiState; onChanged: () => void }) {
  const p = PRODUCTS.linkedin
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
      const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "subscribe", product: "linkedin", plan }) })
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
          setMsg(cj.ok ? { tone: "good", text: "You're subscribed. Approved posts will keep going out." } : { tone: "bad", text: cj.error || "Payment received; it will show here in a few minutes." })
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
    const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "cancel", product: "linkedin" }) })
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
          <div className={small}>{trial ? "Free posts left" : "Posts left this month"}</div>
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
      {lapsed(sub) ? <div className="mt-3"><Notice tone="bad">Your paid month has ended. Renew to keep posting.</Notice></div> : null}
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
                {pl.posts} posts a month · {pl.blurb}
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
          {upiPlan && s.ready.upi ? <UpiPay upi={s.ready.upi} plan={upiPlan} onDone={(t) => { setMsg({ tone: "good", text: t }); setUpiPlan(null); onChanged() }} /> : null}
          {!s.ready.payments && !s.ready.upi ? <div className="text-xs text-[var(--faint)] sm:col-span-2">Payments are being switched on. Your free trial works meanwhile.</div> : null}
          {sub.status === "active" && !s.ready.payments ? <div className="text-xs text-[var(--faint)] sm:col-span-2">UPI plans don&rsquo;t renew by themselves. Pay again before the renewal date to keep posting.</div> : null}
        </div>
      ) : null}
      {msg ? <div className="mt-3"><Notice tone={msg.tone}>{msg.text}</Notice></div> : null}
    </div>
  )
}

const renewSoon = (s: Subscription) => s.status === "active" && !s.rzpSubId && !!s.periodEnd && Date.parse(s.periodEnd) - Date.now() < 5 * 864e5

function UpiPay({ upi, plan, onDone }: { upi: Upi; plan: PlanKey; onDone: (msg: string) => void }) {
  const p = PRODUCTS.linkedin.plans.find((x) => x.key === plan)!
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
            const r = await fetch("/dashboard/billing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "upi", product: "linkedin", plan, utr }) })
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

function ProfileCard({ profile, busy, onSave }: { profile: Profile | null; busy: boolean; onSave: (f: Record<string, unknown>) => Promise<boolean> }) {
  const [f, setF] = useState({
    about: profile?.about || "",
    audience: profile?.audience || "",
    topics: profile?.topics || "",
    tone: profile?.tone || "",
    language: profile?.language || "English",
    postsPerWeek: profile?.postsPerWeek || 3,
    postTime: profile?.postTime || "09:05",
  })
  const [saved, setSaved] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: k === "postsPerWeek" ? Number(e.target.value) : e.target.value })
  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault()
        if (await onSave(f)) {
          setSaved(true)
          setTimeout(() => setSaved(false), 2500)
        }
      }}
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brandsoft)] text-xs text-[var(--brand)]">1</span>
        About you
      </h2>
      <p className="mt-1 text-[13px] text-[var(--muted)]">The more specific, the more the drafts sound like you.</p>
      <label className="mt-3 block">
        <span className={small}>What you do and your experience</span>
        <textarea required value={f.about} onChange={set("about")} rows={3} className={field} placeholder="e.g. I run a 6-person digital agency in Pune helping D2C brands with Meta ads. 9 years in performance marketing." />
      </label>
      <label className="mt-3 block">
        <span className={small}>Who you want to reach</span>
        <input value={f.audience} onChange={set("audience")} className={field} placeholder="e.g. Founders of small Shopify brands in India" />
      </label>
      <label className="mt-3 block">
        <span className={small}>Topics to post about</span>
        <input value={f.topics} onChange={set("topics")} className={field} placeholder="e.g. ad creative tests, ROAS mistakes, hiring, lessons from clients" />
      </label>
      <label className="mt-3 block">
        <span className={small}>Tone</span>
        <input value={f.tone} onChange={set("tone")} className={field} placeholder="e.g. practical, friendly, no jargon, short sentences" />
      </label>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <label className="block">
          <span className={small}>Language</span>
          <select value={f.language} onChange={set("language")} className={field}>
            <option>English</option>
            <option>Hinglish</option>
            <option>Hindi</option>
          </select>
        </label>
        <label className="block">
          <span className={small}>Posts a week</span>
          <select value={f.postsPerWeek} onChange={set("postsPerWeek")} className={field}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={small}>Time (India)</span>
          <input type="time" value={f.postTime} onChange={set("postTime")} className={field} />
        </label>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" className={primary} disabled={busy}>
          Save
        </button>
        {saved ? (
          <span className="flex items-center gap-1 text-sm text-[var(--good)]">
            <Check className="h-4 w-4" /> Saved
          </span>
        ) : null}
      </div>
    </form>
  )
}

function ConnectCard({ s, busy, onDisconnect }: { s: LiState; busy: boolean; onDisconnect: () => void }) {
  const p = s.profile
  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brandsoft)] text-xs text-[var(--brand)]">2</span>
        Connect LinkedIn
      </h2>
      {p?.connected ? (
        <>
          <p className="mt-2 text-sm">
            Connected as <b>{p.liName || "your LinkedIn profile"}</b>. Posts go out only after you approve them.
          </p>
          {p.tokenExpiringSoon ? (
            <div className="mt-3">
              <Notice tone="info">LinkedIn asks you to reconnect every 60 days. Reconnect now so posting doesn&rsquo;t pause.</Notice>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/dashboard/linkedin/connect" className={ghost}>
              <RefreshCw className="h-3.5 w-3.5" /> Reconnect
            </a>
            <button type="button" className={ghost} disabled={busy} onClick={onDisconnect}>
              Disconnect
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-[var(--muted)]">LinkedIn will ask you to allow Xredible to post on your behalf. We never see your password, and nothing is posted until you approve it.</p>
          {s.ready.linkedin ? (
            <a href="/dashboard/linkedin/connect" className={primary + " mt-4"}>
              <LinkedinIcon className="h-4 w-4" /> Connect LinkedIn
            </a>
          ) : (
            <div className="mt-4">
              <Notice tone="info">Connecting LinkedIn is being switched on. Fill in &ldquo;About you&rdquo; meanwhile.</Notice>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Posts({ s, busy, canGenerate, act }: { s: LiState; busy: boolean; canGenerate: boolean; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const groups = useMemo(() => {
    const g = { draft: [] as Post[], approved: [] as Post[], problem: [] as Post[], posted: [] as Post[] }
    for (const p of s.posts) {
      if (p.status === "draft") g.draft.push(p)
      else if (p.status === "approved") g.approved.push(p)
      else if (p.status === "posted") g.posted.push(p)
      else g.problem.push(p)
    }
    g.posted.reverse()
    return g
  }, [s.posts])
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brandsoft)] text-xs text-[var(--brand)]">3</span>
          Your posts
        </h2>
        <button type="button" className={ghost + " ml-auto"} disabled={busy || !canGenerate} onClick={() => act({ op: "generate", count: 3 })} title={canGenerate ? "" : "Fill in About you and connect LinkedIn first"}>
          <Sparkles className="h-3.5 w-3.5" /> Write 3 new drafts
        </button>
      </div>
      {!s.posts.length ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{canGenerate ? "Your first drafts are being written. They appear here in a minute or two." : "Fill in About you and connect LinkedIn, and your first drafts appear here."}</p>
      ) : null}
      <Section title="Waiting for your approval" posts={groups.draft} busy={busy} act={act} />
      <Section title="Approved, will post at" posts={groups.approved} busy={busy} act={act} />
      <Section title="Needs attention" posts={groups.problem} busy={busy} act={act} />
      <Section title="Posted" posts={groups.posted} busy={busy} act={act} />
    </div>
  )
}

function Section({ title, posts, busy, act }: { title: string; posts: Post[]; busy: boolean; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  if (!posts.length) return null
  return (
    <div className="mt-5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">
        {title} · {posts.length}
      </div>
      <ul className="mt-2 space-y-3">
        {posts.map((p) => (
          <PostItem key={p.id} p={p} busy={busy} act={act} />
        ))}
      </ul>
    </div>
  )
}

function PostItem({ p, busy, act }: { p: Post; busy: boolean; act: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(p.text)
  const [when, setWhen] = useState(toLocalInput(p.scheduledAt))
  const [moving, setMoving] = useState(false)
  const open = p.status !== "posted"
  return (
    <li className="rounded-xl border border-[var(--line)] p-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--muted)]">
        {p.topic ? <span className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[var(--ink2)]">{p.topic}</span> : null}
        <span>{p.status === "posted" ? `Posted ${istTime(p.postedAt)}` : p.scheduledAt ? `Planned for ${istTime(p.scheduledAt)}` : ""}</span>
        {p.status === "posted" && p.postUrn.startsWith("urn:li:") ? (
          <a href={`https://www.linkedin.com/feed/update/${p.postUrn}/`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-[var(--brand)] hover:underline">
            View on LinkedIn <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
      {editing ? (
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className={field + " mt-2 font-[inherit] leading-relaxed"} />
      ) : (
        <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.text}</div>
      )}
      {p.error && p.status !== "posted" ? <div className="mt-2"><Notice tone="bad">{p.error}</Notice></div> : null}
      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button type="button" className={primary} disabled={busy} onClick={async () => (await act({ op: "edit", id: p.id, text })) && setEditing(false)}>
                Save text
              </button>
              <button type="button" className={ghost} onClick={() => { setText(p.text); setEditing(false) }}>
                Cancel
              </button>
            </>
          ) : (
            <>
              {p.status !== "approved" ? (
                <button type="button" className={primary} disabled={busy} onClick={() => act({ op: "approve", id: p.id })}>
                  <Check className="h-4 w-4" /> Approve
                </button>
              ) : (
                <button type="button" className={ghost} disabled={busy} onClick={() => act({ op: "unapprove", id: p.id })}>
                  Hold back
                </button>
              )}
              <button type="button" className={ghost} onClick={() => setEditing(true)}>
                <PenLine className="h-3.5 w-3.5" /> Edit
              </button>
              <button type="button" className={ghost} onClick={() => setMoving((m) => !m)}>
                Change time
              </button>
              <button type="button" className={ghost + " text-[var(--bad)]"} disabled={busy} onClick={() => act({ op: "reject", id: p.id })}>
                Discard
              </button>
            </>
          )}
        </div>
      ) : null}
      {moving && open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field + " mt-0 w-auto"} />
          <button type="button" className={ghost} disabled={busy} onClick={async () => (await act({ op: "reschedule", id: p.id, when })) && setMoving(false)}>
            Save time
          </button>
          <span className="text-xs text-[var(--faint)]">India time</span>
        </div>
      ) : null}
    </li>
  )
}
