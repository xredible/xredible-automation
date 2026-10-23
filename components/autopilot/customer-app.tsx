"use client"

// LinkedIn Autopilot's own page inside a customer's dashboard (Automations → LinkedIn Autopilot):
// plan + usage, profile, Connect LinkedIn, and the posts to review.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, PenLine, RefreshCw, Sparkles } from "lucide-react"
import { Linkedin as LinkedinIcon } from "@/components/dashboard/brand"
import type { Subscription } from "@/lib/autopilot/products"
import { card, field, ghost, istTime, Notice, PlanCard, primary, small, toLocalInput, type Upi } from "./ui"
import { RewriteMenu } from "./rewrite"
import { DesignFields, DesignPreview, FormatPicker } from "./design-editor"
import { LI_FORMATS, LI_MIXES, type Design, type Format } from "@/lib/autopilot/formats"

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
  prefs: { mix: string; color: string; brand: string }
}
type Post = { id: number; status: "draft" | "approved" | "posted" | "failed" | "blocked"; text: string; topic: string; scheduledAt: string | null; postedAt: string | null; postUrn: string; error: string; format: Format; design: Design; previews: string[] }
type LiState = { ok: true; sub: Subscription; profile: Profile | null; posts: Post[]; ready: { linkedin: boolean; payments: boolean; razorpayKey: string; upi: Upi | null } }

// ---------- LinkedIn Autopilot ----------

async function liCall(body?: Record<string, unknown>): Promise<LiState | { ok: false; error: string }> {
  try {
    const r = await fetch("/dashboard/me/linkedin", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

export function LinkedInAutopilot({ bare = false }: { bare?: boolean }) {
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
          {bare ? null : <h1 className="text-xl font-semibold">LinkedIn Autopilot</h1>}
          <p className="mt-1 text-sm text-[var(--muted)]">Drafts in your voice → you approve → they post to your LinkedIn on schedule.</p>
        </div>
      </div>
      {error ? <Notice tone="bad">{error}</Notice> : null}
      <PlanCard product="linkedin" s={s} onChanged={load} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ProfileCard profile={s.profile} busy={busy} onSave={(f) => act({ op: "profile", ...f })} />
        <ConnectCard s={s} busy={busy} onDisconnect={() => act({ op: "disconnect" })} />
      </div>
      <Posts s={s} busy={busy} canGenerate={hasProfile && !!s.profile?.connected} act={act} />
    </>
  )
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
    mix: profile?.prefs?.mix || "balanced",
    color: profile?.prefs?.color || "#10203f",
    brand: profile?.prefs?.brand || "",
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
      <label className="mt-3 block">
        <span className={small}>Mix of post types</span>
        <select value={f.mix} onChange={set("mix")} className={field}>
          {LI_MIXES.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
        <label className="block">
          <span className={small}>Name on your images and carousels</span>
          <input value={f.brand} onChange={set("brand")} maxLength={60} className={field} placeholder="Your name or brand" />
        </label>
        <label className="block">
          <span className={small}>Colour</span>
          <input type="color" value={f.color} onChange={set("color")} className="mt-1 h-[38px] w-16 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1" />
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
  const [design, setDesign] = useState<Design>(p.design)
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
      {open && !editing ? (
        <div className="mt-2">
          <FormatPicker formats={LI_FORMATS} value={p.format} busy={busy} onPick={(format) => act({ op: "format", id: p.id, format })} />
        </div>
      ) : null}
      {editing ? (
        <div className="mt-2 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} className={field + " font-[inherit] leading-relaxed"} aria-label="Post text" />
          <DesignFields format={p.format} design={design} onChange={setDesign} />
        </div>
      ) : (
        <>
          {p.format === "photo" && !p.previews.length ? <div className="mt-3 text-[13px] text-[var(--muted)]">Tap Edit to add your photos.</div> : null}
          <DesignPreview urls={p.previews} alt={p.design.headline || p.topic} />
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{p.text}</div>
        </>
      )}
      {p.error && p.status !== "posted" ? <div className="mt-2"><Notice tone="bad">{p.error}</Notice></div> : null}
      {open ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {editing ? (
            <>
              <button type="button" className={primary} disabled={busy} onClick={async () => (await act({ op: "edit", id: p.id, text, design })) && setEditing(false)}>
                Save text
              </button>
              <button type="button" className={ghost} onClick={() => { setText(p.text); setDesign(p.design); setEditing(false) }}>
                Cancel
              </button>
              <RewriteMenu endpoint="/dashboard/me/linkedin" id={p.id} text={text} onResult={(r) => setText(r.text)} />
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
              <button type="button" className={ghost} onClick={() => { setDesign(p.design); setEditing(true) }}>
                <PenLine className="h-3.5 w-3.5" /> Edit
              </button>
              <RewriteMenu endpoint="/dashboard/me/linkedin" id={p.id} text={p.text} onResult={(r) => { setText(r.text); setEditing(true) }} />
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
