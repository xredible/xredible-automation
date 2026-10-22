"use client"

// Customer pages for Instagram + Facebook Autopilot, Blog Writer for WordPress and
// Email Newsletter Autopilot: plan, settings, connection, subscribers and the review queue.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { Check, ExternalLink, PenLine, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react"
import { PRODUCTS, type ProductKey, type Subscription } from "@/lib/autopilot/products"
import { card, field, ghost, istTime, Notice, PlanCard, primary, small, toLocalInput, type Upi } from "./ui"
import { RewriteMenu } from "./rewrite"

type Tool = Exclude<ProductKey, "linkedin">
type Settings = Record<string, string | number>
type Channel = { settings: Settings; connName: string; connected: boolean; meta: { choose?: { id: string; name: string; igUser: string }[]; igId?: string; site?: string; from?: string; host?: string } }
type Item = {
  id: number
  status: "draft" | "approved" | "posted" | "failed" | "blocked"
  title: string
  summary: string
  text: string
  topic: string
  image: string
  preview: string
  scheduledAt: string | null
  postedAt: string | null
  ref: string
  progress: number
  error: string
}
type Contacts = { total: number; subscribed: number; cap: number; recent: { id: number; email: string; name: string; status: string }[] }
type State = { ok: true; sub: Subscription; channel: Channel | null; items: Item[]; contacts: Contacts | null; ready: { connect: boolean; payments: boolean; razorpayKey: string; upi: Upi | null }; added?: { added: number; skipped: number; total: number }; tested?: boolean }
type Act = (b: Record<string, unknown>) => Promise<State | null>

const COPY: Record<Tool, { flow: string; about: string; aboutHint: string; topics: string; topicsHint: string; item: string; account: string }> = {
  meta: {
    flow: "Captions and post designs for your brand → you approve → they post to Instagram and your Facebook Page.",
    about: "About your business or page",
    aboutHint: "e.g. A home bakery in Indore making eggless cakes and cookies to order. We deliver across the city.",
    topics: "What to post about",
    topicsHint: "e.g. new flavours, behind the scenes, customer occasions, baking tips, festive offers",
    item: "post",
    account: "Facebook + Instagram",
  },
  blog: {
    flow: "SEO articles on your topics → you approve → they publish to your WordPress site on schedule.",
    about: "About your business and website",
    aboutHint: "e.g. We sell handmade wooden toys for toddlers across India. Our readers are parents of 1–5 year olds.",
    topics: "Topics or keywords to rank for",
    topicsHint: "e.g. montessori toys for 2 year olds, screen-free activities, safe wooden toys, gift ideas for toddlers",
    item: "article",
    account: "WordPress",
  },
  newsletter: {
    flow: "A newsletter written for your subscribers → you approve → it's sent from your own email.",
    about: "About you or your business",
    aboutHint: "e.g. I'm a fitness coach for busy working women. My readers want simple home workouts and healthy Indian meals.",
    topics: "What each issue should cover",
    topicsHint: "e.g. one quick workout, one recipe, one habit tip, client questions",
    item: "issue",
    account: "your email",
  },
}

async function call(product: Tool, body?: Record<string, unknown>): Promise<State | { ok: false; error: string }> {
  try {
    const r = await fetch(`/dashboard/me/${product}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

const Step = ({ n, children }: { n: number; children: ReactNode }) => (
  <h2 className="flex items-center gap-2 text-base font-semibold">
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brandsoft)] text-xs text-[var(--brand)]">{n}</span>
    {children}
  </h2>
)

export function ToolApp({ product, bare = false }: { product: Tool; bare?: boolean }) {
  const [s, setS] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await call(product)
    if (r.ok) {
      setS(r)
      setError(null)
    } else setError(r.error)
  }, [product])
  useEffect(() => {
    setS(null)
    load()
  }, [load])
  // Drafts arrive from n8n and newsletters send in the background: check again meanwhile.
  useEffect(() => {
    if (!s) return
    const waiting = s.channel?.connected && s.channel.settings.about && !s.items.some((i) => i.status === "draft" || i.status === "approved")
    const sending = s.items.some((i) => i.status === "approved" && i.progress > 0)
    if (!waiting && !sending) return
    const t = setInterval(load, 20_000)
    return () => clearInterval(t)
  }, [s, load])

  const act: Act = async (body) => {
    setBusy(true)
    const r = await call(product, body)
    setBusy(false)
    if (r.ok) {
      setS(r)
      setError(null)
      return r
    }
    setError(r.error)
    return null
  }

  const p = PRODUCTS[product]
  if (!s) return <div className={card + " text-sm text-[var(--muted)]"}>{error || `Loading ${p.name}…`}</div>
  const c = COPY[product]
  const ready = !!s.channel?.settings.about && !!s.channel?.connected
  return (
    <>
      <div>
        {bare ? null : <h1 className="text-xl font-semibold">{p.name}</h1>}
        <p className="mt-1 text-sm text-[var(--muted)]">{c.flow}</p>
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <PlanCard product={product} s={s} onChanged={load} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsCard key={JSON.stringify(s.channel?.settings || {})} product={product} settings={s.channel?.settings || {}} busy={busy} act={act} />
        <div className="space-y-5">
          <ConnectCard product={product} s={s} busy={busy} act={act} />
          {product === "newsletter" && s.contacts ? <ContactsCard contacts={s.contacts} busy={busy} act={act} /> : null}
        </div>
      </div>
      <Items product={product} s={s} busy={busy} ready={ready} act={act} />
    </>
  )
}

// ---------- settings ----------

function SettingsCard({ product, settings, busy, act }: { product: Tool; settings: Settings; busy: boolean; act: Act }) {
  const c = COPY[product]
  const d: Settings = {
    about: "",
    audience: "",
    topics: "",
    tone: "",
    language: "English",
    perWeek: product === "meta" ? 3 : product === "blog" ? 2 : 1,
    time: product === "newsletter" ? "08:05" : "10:05",
    brand: "",
    color: "#24438a",
    targets: "both",
    words: 1200,
    publishMode: "publish",
    cta: "",
    name: "",
    fromName: "",
    address: "",
    notes: "",
  }
  const [f, setF] = useState<Settings>({ ...d, ...settings })
  const [saved, setSaved] = useState(false)
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const maxWeek = product === "newsletter" ? 3 : 7
  return (
    <form
      className={card}
      onSubmit={async (e) => {
        e.preventDefault()
        if (await act({ op: "settings", ...f })) {
          setSaved(true)
          setTimeout(() => setSaved(false), 2500)
        }
      }}
    >
      <Step n={1}>Your details</Step>
      <p className="mt-1 text-[13px] text-[var(--muted)]">The more specific, the better the drafts fit you.</p>
      {product === "newsletter" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={small}>Newsletter name</span>
            <input required value={f.name} onChange={set("name")} className={field} placeholder="e.g. The Sunday Fit Note" />
          </label>
          <label className="block">
            <span className={small}>From name</span>
            <input required value={f.fromName} onChange={set("fromName")} className={field} placeholder="e.g. Priya from FitHer" />
          </label>
        </div>
      ) : null}
      {product === "meta" ? (
        <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className={small}>Brand name (shown on the post design)</span>
            <input required value={f.brand} onChange={set("brand")} className={field} placeholder="e.g. Sweet Crumbs Bakery" />
          </label>
          <label className="block">
            <span className={small}>Brand colour</span>
            <input type="color" value={String(f.color)} onChange={set("color")} className={field + " h-[38px] w-16 p-1"} />
          </label>
        </div>
      ) : null}
      <label className="mt-3 block">
        <span className={small}>{c.about}</span>
        <textarea required value={f.about} onChange={set("about")} rows={3} className={field} placeholder={c.aboutHint} />
      </label>
      <label className="mt-3 block">
        <span className={small}>Who you want to reach</span>
        <input value={f.audience} onChange={set("audience")} className={field} placeholder="e.g. young families in my city" />
      </label>
      <label className="mt-3 block">
        <span className={small}>{c.topics}</span>
        <input value={f.topics} onChange={set("topics")} className={field} placeholder={c.topicsHint} />
      </label>
      <label className="mt-3 block">
        <span className={small}>Tone</span>
        <input value={f.tone} onChange={set("tone")} className={field} placeholder="e.g. warm, simple, a little playful" />
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
          <span className={small}>{product === "newsletter" ? "Issues a week" : product === "blog" ? "Articles a week" : "Posts a week"}</span>
          <select value={f.perWeek} onChange={set("perWeek")} className={field}>
            {Array.from({ length: maxWeek }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={small}>Time (India)</span>
          <input type="time" value={f.time} onChange={set("time")} className={field} />
        </label>
      </div>
      {product === "meta" ? (
        <label className="mt-3 block">
          <span className={small}>Post to</span>
          <select value={f.targets} onChange={set("targets")} className={field}>
            <option value="both">Instagram and Facebook</option>
            <option value="instagram">Instagram only</option>
            <option value="facebook">Facebook only</option>
          </select>
        </label>
      ) : null}
      {product === "blog" ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block">
              <span className={small}>Article length</span>
              <select value={f.words} onChange={set("words")} className={field}>
                <option value={800}>Short (~800 words)</option>
                <option value={1200}>Medium (~1,200 words)</option>
                <option value={1800}>Long (~1,800 words)</option>
              </select>
            </label>
            <label className="block">
              <span className={small}>On WordPress</span>
              <select value={f.publishMode} onChange={set("publishMode")} className={field}>
                <option value="publish">Publish it</option>
                <option value="draft">Save as a WordPress draft</option>
              </select>
            </label>
          </div>
          <label className="mt-3 block">
            <span className={small}>Line to end every article with (optional)</span>
            <input value={f.cta} onChange={set("cta")} className={field} placeholder="e.g. Shop our toddler toys at [our store](https://example.com/shop)" />
          </label>
        </>
      ) : null}
      {product === "newsletter" ? (
        <>
          <label className="mt-3 block">
            <span className={small}>News for the next issue (optional)</span>
            <textarea value={f.notes} onChange={set("notes")} rows={2} className={field} placeholder="e.g. New batch starts 1 Nov. Diwali offer: 20% off the 8-week plan." />
          </label>
          <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
            <label className="block">
              <span className={small}>Business address (shown at the bottom, required by law)</span>
              <input required value={f.address} onChange={set("address")} className={field} placeholder="Business name, street, city, PIN" />
            </label>
            <label className="block">
              <span className={small}>Colour</span>
              <input type="color" value={String(f.color)} onChange={set("color")} className={field + " h-[38px] w-16 p-1"} />
            </label>
          </div>
        </>
      ) : null}
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

// ---------- connection ----------

const SMTP_PRESETS: { name: string; host: string; port: number; hint: string }[] = [
  { name: "Gmail / Google Workspace", host: "smtp.gmail.com", port: 465, hint: "Use an App Password (Google Account → Security → 2-Step Verification → App passwords). Gmail sends up to 500 a day, Workspace 2,000." },
  { name: "Zoho Mail", host: "smtp.zoho.in", port: 465, hint: "Use your Zoho email and password, or an app-specific password if 2FA is on." },
  { name: "Microsoft 365 / Outlook", host: "smtp.office365.com", port: 587, hint: "SMTP sending must be allowed for the mailbox by your admin." },
  { name: "Hostinger", host: "smtp.hostinger.com", port: 465, hint: "Your email address and its password from hPanel → Emails." },
  { name: "GoDaddy", host: "smtpout.secureserver.net", port: 465, hint: "Your GoDaddy email address and password." },
]

function ConnectCard({ product, s, busy, act }: { product: Tool; s: State; busy: boolean; act: Act }) {
  const ch = s.channel
  const title = product === "meta" ? "Connect Facebook + Instagram" : product === "blog" ? "Connect your WordPress site" : "Connect your email"
  if (ch?.connected)
    return (
      <div className={card}>
        <Step n={2}>{title}</Step>
        <p className="mt-2 text-sm">
          Connected: <b>{ch.connName}</b>. Nothing goes out until you approve it.
        </p>
        {product === "meta" && !ch.meta.igId ? (
          <div className="mt-3">
            <Notice tone="info">
              Only Facebook is connected: no Instagram account came with this Page, so posts go to Facebook only. To add Instagram: make your Instagram a Business or Creator account, link it to this Facebook Page (Instagram app → Settings → Accounts Center, or Page settings → Linked accounts), then press Reconnect and tick the Instagram account when Facebook asks.
            </Notice>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {product === "meta" ? (
            <a href="/dashboard/meta/connect" className={ghost}>
              <RefreshCw className="h-3.5 w-3.5" /> Reconnect
            </a>
          ) : null}
          <button type="button" className={ghost} disabled={busy} onClick={() => act({ op: "disconnect" })}>
            Disconnect
          </button>
        </div>
      </div>
    )
  return (
    <div className={card}>
      <Step n={2}>{title}</Step>
      {!s.ready.connect ? (
        <div className="mt-3">
          <Notice tone="info">Connecting is being switched on. Fill in your details meanwhile.</Notice>
        </div>
      ) : product === "meta" ? (
        <MetaConnect ch={ch} busy={busy} act={act} />
      ) : product === "blog" ? (
        <WordPressConnect busy={busy} act={act} />
      ) : (
        <SmtpConnect busy={busy} act={act} />
      )}
    </div>
  )
}

function MetaConnect({ ch, busy, act }: { ch: Channel | null; busy: boolean; act: Act }) {
  const choose = ch?.meta.choose || []
  return (
    <>
      {choose.length ? (
        <>
          <p className="mt-2 text-sm">
            <b>One more step:</b> pick the Facebook Page to post to. Posting is paused until you pick one.
          </p>
          <div className="mt-3 space-y-2">
            {choose.map((p) => (
              <div key={p.id} className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${p.igUser ? "border-[var(--brand)]" : "border-[var(--line)]"}`}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-[12.5px] text-[var(--muted)]">{p.igUser ? `Facebook + Instagram @${p.igUser}` : "Facebook only (no Instagram linked)"}</div>
                </div>
                <button type="button" className={p.igUser ? primary : ghost} disabled={busy} onClick={() => act({ op: "page", pageId: p.id })}>
                  {busy ? "Saving…" : "Use this Page"}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-[var(--muted)]">
          Facebook will ask you to allow Xredible to post to your Page. For Instagram, your Instagram must be a Business or Creator account linked to that Facebook Page. We never see your password.
        </p>
      )}
      <a href="/dashboard/meta/connect" className={primary + " mt-4"}>
        {choose.length ? "Connect again" : "Connect with Facebook"}
      </a>
    </>
  )
}

function WordPressConnect({ busy, act }: { busy: boolean; act: Act }) {
  const [f, setF] = useState({ site: "", user: "", pass: "" })
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (await act({ op: "connect", ...f })) setF({ site: "", user: "", pass: "" })
      }}
    >
      <p className="mt-2 text-sm text-[var(--muted)]">
        In WordPress go to <b>Users → Profile → Application Passwords</b>, type &ldquo;Xredible&rdquo;, click <b>Add New</b> and paste the password here. Your normal login password stays private.
      </p>
      <label className="mt-3 block">
        <span className={small}>Site address</span>
        <input required value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} className={field} placeholder="https://yoursite.com" inputMode="url" />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={small}>WordPress username</span>
          <input required value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} className={field} autoComplete="off" />
        </label>
        <label className="block">
          <span className={small}>Application Password</span>
          <input required value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} className={field + " font-mono"} type="password" autoComplete="new-password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" />
        </label>
      </div>
      <button type="submit" className={primary + " mt-4"} disabled={busy}>
        {busy ? "Checking…" : "Connect WordPress"}
      </button>
    </form>
  )
}

function SmtpConnect({ busy, act }: { busy: boolean; act: Act }) {
  const [f, setF] = useState({ from: "", host: "smtp.gmail.com", port: "465", user: "", pass: "" })
  const preset = SMTP_PRESETS.find((p) => p.host === f.host)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (await act({ op: "connect", ...f, port: Number(f.port), user: f.user || f.from })) setF({ ...f, pass: "" })
      }}
    >
      <p className="mt-2 text-sm text-[var(--muted)]">Newsletters are sent from your own email account, so they come from you and land better in inboxes.</p>
      <label className="mt-3 block">
        <span className={small}>Email provider</span>
        <select value={preset ? f.host : "other"} onChange={(e) => { const p = SMTP_PRESETS.find((x) => x.host === e.target.value); setF({ ...f, host: p ? p.host : "", port: String(p ? p.port : 465) }) }} className={field}>
          {SMTP_PRESETS.map((p) => (
            <option key={p.host} value={p.host}>
              {p.name}
            </option>
          ))}
          <option value="other">Other (enter SMTP details)</option>
        </select>
      </label>
      {preset ? <div className="mt-1.5 text-xs text-[var(--muted)]">{preset.hint}</div> : null}
      {!preset ? (
        <div className="mt-3 grid grid-cols-[1fr_96px] gap-3">
          <label className="block">
            <span className={small}>SMTP server</span>
            <input required value={f.host} onChange={(e) => setF({ ...f, host: e.target.value })} className={field} placeholder="smtp.yourhost.com" />
          </label>
          <label className="block">
            <span className={small}>Port</span>
            <select value={f.port} onChange={(e) => setF({ ...f, port: e.target.value })} className={field}>
              <option value="465">465</option>
              <option value="587">587</option>
            </select>
          </label>
        </div>
      ) : null}
      <label className="mt-3 block">
        <span className={small}>Send from (email address)</span>
        <input required type="email" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} className={field} placeholder="you@yourbusiness.com" />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={small}>Username (usually the same email)</span>
          <input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value })} className={field} placeholder={f.from || "you@yourbusiness.com"} autoComplete="off" />
        </label>
        <label className="block">
          <span className={small}>Password / App Password</span>
          <input required type="password" value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} className={field} autoComplete="new-password" />
        </label>
      </div>
      <button type="submit" className={primary + " mt-4"} disabled={busy}>
        {busy ? "Checking…" : "Connect email"}
      </button>
    </form>
  )
}

// ---------- subscribers ----------

function ContactsCard({ contacts, busy, act }: { contacts: Contacts; busy: boolean; act: Act }) {
  const [text, setText] = useState("")
  const [msg, setMsg] = useState<string | null>(null)
  const over = contacts.subscribed > contacts.cap
  return (
    <div className={card}>
      <Step n={3}>Subscribers</Step>
      <div className="mt-2 text-sm">
        <b className="tabular-nums">{contacts.subscribed.toLocaleString("en-IN")}</b> subscribed
        {contacts.total > contacts.subscribed ? <span className="text-[var(--muted)]"> · {contacts.total - contacts.subscribed} unsubscribed</span> : null}
        <span className="text-[var(--muted)]"> · your plan sends to up to {contacts.cap.toLocaleString("en-IN")}</span>
      </div>
      {over ? (
        <div className="mt-2">
          <Notice tone="info">Only the first {contacts.cap.toLocaleString("en-IN")} subscribers get each issue on this plan.</Notice>
        </div>
      ) : null}
      <form
        className="mt-3"
        onSubmit={async (e) => {
          e.preventDefault()
          const r = await act({ op: "contacts-add", text })
          if (r?.added) {
            setMsg(`Added ${r.added.added}${r.added.skipped ? `, skipped ${r.added.skipped} (duplicates or not emails)` : ""}.`)
            setText("")
          }
        }}
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={field + " font-mono text-[13px]"} placeholder={"one per line, or paste from a spreadsheet:\nasha@example.com, Asha\nrahul@example.com"} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="submit" className={ghost} disabled={busy || !text.trim()}>
            Add subscribers
          </button>
          <span className="text-xs text-[var(--faint)]">Only add people who agreed to get your emails.</span>
        </div>
      </form>
      {msg ? <div className="mt-2 text-sm text-[var(--good)]">{msg}</div> : null}
      {contacts.recent.length ? (
        <details className="mt-3">
          <summary className="cursor-pointer text-[13px] font-medium text-[var(--ink2)]">Latest {contacts.recent.length}</summary>
          <ul className="mt-2 max-h-60 space-y-1 overflow-auto text-[13px]">
            {contacts.recent.map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <span className={"min-w-0 flex-1 truncate" + (c.status === "unsubscribed" ? " text-[var(--faint)] line-through" : "")}>
                  {c.email}
                  {c.name ? <span className="text-[var(--muted)]"> · {c.name}</span> : null}
                </span>
                <button type="button" className="rounded p-1 text-[var(--faint)] hover:text-[var(--bad)]" disabled={busy} onClick={() => act({ op: "contact-remove", id: c.id })} aria-label={`Remove ${c.email}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

// ---------- review queue ----------

function Items({ product, s, busy, ready, act }: { product: Tool; s: State; busy: boolean; ready: boolean; act: Act }) {
  const c = COPY[product]
  const groups = useMemo(() => {
    const g = { draft: [] as Item[], approved: [] as Item[], problem: [] as Item[], posted: [] as Item[] }
    for (const i of s.items) {
      if (i.status === "draft") g.draft.push(i)
      else if (i.status === "approved") g.approved.push(i)
      else if (i.status === "posted") g.posted.push(i)
      else g.problem.push(i)
    }
    g.posted.reverse()
    return g
  }, [s.items])
  const n = product === "newsletter" ? 4 : 3
  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <Step n={n}>Your {c.item}s</Step>
        <button type="button" className={ghost + " ml-auto"} disabled={busy || !ready} onClick={() => act({ op: "generate", count: product === "meta" ? 3 : 2 })} title={ready ? "" : `Fill in your details and connect ${c.account} first`}>
          <Sparkles className="h-3.5 w-3.5" /> Write new drafts
        </button>
      </div>
      {!s.items.length ? (
        <p className="mt-3 text-sm text-[var(--muted)]">{ready ? `Your first drafts are being written. They appear here in a minute or two.` : `Fill in your details and connect ${c.account}, and your first drafts appear here.`}</p>
      ) : null}
      <Group title="Waiting for your approval" items={groups.draft} product={product} busy={busy} act={act} />
      <Group title={product === "newsletter" ? "Approved, will send at" : "Approved, will publish at"} items={groups.approved} product={product} busy={busy} act={act} />
      <Group title="Needs attention" items={groups.problem} product={product} busy={busy} act={act} />
      <Group title={product === "newsletter" ? "Sent" : "Published"} items={groups.posted} product={product} busy={busy} act={act} />
    </div>
  )
}

function Group({ title, items, product, busy, act }: { title: string; items: Item[]; product: Tool; busy: boolean; act: Act }) {
  if (!items.length) return null
  return (
    <div className="mt-5">
      <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">
        {title} · {items.length}
      </div>
      <ul className="mt-2 space-y-3">
        {items.map((i) => (
          <ItemCard key={i.id} it={i} product={product} busy={busy} act={act} />
        ))}
      </ul>
    </div>
  )
}

const LABELS: Record<Tool, { title: string; summary?: string; text: string }> = {
  meta: { title: "Words on the image", text: "Caption" },
  blog: { title: "Title", summary: "Meta description (shown on Google)", text: "Article" },
  newsletter: { title: "Subject line", summary: "Preview text", text: "Email" },
}

function ItemCard({ it, product, busy, act }: { it: Item; product: Tool; busy: boolean; act: Act }) {
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({ title: it.title, summary: it.summary, text: it.text, image: it.image })
  const [when, setWhen] = useState(toLocalInput(it.scheduledAt))
  const [moving, setMoving] = useState(false)
  const [full, setFull] = useState(product === "meta")
  const [tested, setTested] = useState(false)
  const L = LABELS[product]
  const open = it.status !== "posted" && !(it.status === "approved" && it.progress > 0)
  const sending = it.status === "approved" && it.progress > 0
  const sent = Number(it.ref.replace(/^sent:/, "")) || 0
  const links = product === "newsletter" ? [] : it.ref.split(" ").filter((u) => /^https:\/\//.test(u))
  const long = it.text.length > 700
  return (
    <li className="rounded-xl border border-[var(--line)] p-4">
      <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--muted)]">
        {it.topic ? <span className="rounded bg-[var(--soft)] px-1.5 py-0.5 text-[var(--ink2)]">{it.topic}</span> : null}
        <span>
          {it.status === "posted"
            ? `${product === "newsletter" ? `Sent to ${sent.toLocaleString("en-IN")}` : "Published"} ${istTime(it.postedAt)}`
            : sending
              ? `Sending… ${sent.toLocaleString("en-IN")} sent so far`
              : it.scheduledAt
                ? `Planned for ${istTime(it.scheduledAt)}`
                : ""}
        </span>
        {links.map((u) => (
          <a key={u} href={u} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--brand)] hover:underline">
            {u.includes("instagram.com") ? "Instagram" : u.includes("facebook.com") ? "Facebook" : "View article"} <ExternalLink className="h-3 w-3" />
          </a>
        ))}
      </div>
      {editing ? (
        <div className="mt-2 space-y-3">
          <label className="block">
            <span className={small}>{L.title}</span>
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={field} />
          </label>
          {L.summary ? (
            <label className="block">
              <span className={small}>{L.summary}</span>
              <input value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} className={field} />
            </label>
          ) : null}
          <label className="block">
            <span className={small}>
              {L.text}
              {product !== "meta" ? " (## for headings, - for lists, **bold**, [link](https://…))" : ""}
            </span>
            <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} rows={product === "meta" ? 8 : 16} className={field + " font-[inherit] leading-relaxed"} />
          </label>
          {product === "meta" ? (
            <label className="block">
              <span className={small}>Use your own image instead (optional link to a JPG or PNG)</span>
              <input value={f.image} onChange={(e) => setF({ ...f, image: e.target.value })} className={field} placeholder="https://…" />
            </label>
          ) : null}
        </div>
      ) : product === "meta" ? (
        <div className="mt-2 flex flex-col gap-4 sm:flex-row">
          {it.preview ? <img src={it.preview} onError={(e) => { const el = e.currentTarget; if (!el.dataset.retried) { el.dataset.retried = "1"; el.src = it.preview + "&r=" + Date.now() } }} alt={it.title} width={216} height={270} className="h-[270px] w-[216px] shrink-0 rounded-lg border border-[var(--line)] object-cover" loading="lazy" /> : null}
          <div className="min-w-0 whitespace-pre-wrap text-sm leading-relaxed">{it.text}</div>
        </div>
      ) : (
        <div className="mt-2">
          <div className="text-base font-semibold">{it.title}</div>
          {it.summary ? <div className="mt-0.5 text-[13px] text-[var(--muted)]">{it.summary}</div> : null}
          <div className={"mt-2 whitespace-pre-wrap text-sm leading-relaxed" + (!full && long ? " line-clamp-[10]" : "")}>{it.text}</div>
          {long ? (
            <button type="button" className="mt-1 text-[13px] font-medium text-[var(--brand)] hover:underline" onClick={() => setFull(!full)}>
              {full ? "Show less" : "Show all"}
            </button>
          ) : null}
        </div>
      )}
      {it.error ? (
        <div className="mt-2">
          <Notice tone={it.status === "posted" ? "info" : "bad"}>{it.error}</Notice>
        </div>
      ) : null}
      {tested ? (
        <div className="mt-2">
          <Notice tone="good">Test sent to your sign-in email.</Notice>
        </div>
      ) : null}
      {open || it.status === "failed" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button type="button" className={primary} disabled={busy} onClick={async () => (await act({ op: "edit", id: it.id, ...f })) && setEditing(false)}>
                Save
              </button>
              <button type="button" className={ghost} onClick={() => { setF({ title: it.title, summary: it.summary, text: it.text, image: it.image }); setEditing(false) }}>
                Cancel
              </button>
              <RewriteMenu endpoint={`/dashboard/me/${product}`} id={it.id} text={f.text} title={f.title} onResult={(r) => setF((x) => ({ ...x, text: r.text, title: r.title ?? x.title }))} />
            </>
          ) : (
            <>
              {it.status !== "approved" ? (
                <button type="button" className={primary} disabled={busy} onClick={() => act({ op: "approve", id: it.id })}>
                  <Check className="h-4 w-4" /> {it.status === "failed" && it.progress > 0 ? "Send to the rest" : "Approve"}
                </button>
              ) : (
                <button type="button" className={ghost} disabled={busy} onClick={() => act({ op: "unapprove", id: it.id })}>
                  Hold back
                </button>
              )}
              {it.progress === 0 ? (
                <>
                  <button type="button" className={ghost} onClick={() => setEditing(true)}>
                    <PenLine className="h-3.5 w-3.5" /> Edit
                  </button>
                  <RewriteMenu endpoint={`/dashboard/me/${product}`} id={it.id} text={it.text} title={it.title} onResult={(r) => { setF((x) => ({ ...x, text: r.text, title: r.title ?? x.title })); setEditing(true) }} />
                  <button type="button" className={ghost} onClick={() => setMoving((m) => !m)}>
                    Change time
                  </button>
                  {product === "newsletter" ? (
                    <button type="button" className={ghost} disabled={busy} onClick={async () => setTested(!!(await act({ op: "test", id: it.id })))}>
                      <Send className="h-3.5 w-3.5" /> Send me a test
                    </button>
                  ) : null}
                  <button type="button" className={ghost + " text-[var(--bad)]"} disabled={busy} onClick={() => act({ op: "reject", id: it.id })}>
                    Discard
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      ) : null}
      {moving && open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={field + " mt-0 w-auto"} />
          <button type="button" className={ghost} disabled={busy} onClick={async () => (await act({ op: "reschedule", id: it.id, when })) && setMoving(false)}>
            Save time
          </button>
          <span className="text-xs text-[var(--faint)]">India time</span>
        </div>
      ) : null}
    </li>
  )
}
