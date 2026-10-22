"use client"

// Ideas: one idea → drafts for every channel, festival & special-day posts, news for their topics,
// and when their Instagram followers are online. Drafts land in each tool's queue for approval.

import { useCallback, useEffect, useState } from "react"
import { CalendarHeart, Clock, Link2, Newspaper, Sparkles } from "lucide-react"
import { Card, Notice, Skeleton } from "@/components/dashboard/ui"
import type { View } from "@/components/dashboard/state"

type Ch = { key: "linkedin" | "meta" | "blog" | "newsletter"; name: string; ready: boolean; connected: boolean }
type Moment = { id: string; date: string; name: string; idea: string; kind: string; inDays: number }
type News = { topic: string; title: string; link: string; source: string; at: string }
type Hours = { hours: { hour: number; share: number }[]; error?: string } | null
type Data = { ok: true; moments: Moment[]; news: News[]; hours: Hours; channels: Ch[] }
type Result = { channel: Ch["key"]; id?: number; title?: string; error?: string }

const VIEW: Record<Ch["key"], View> = { linkedin: "ap-linkedin", meta: "ap-meta", blog: "ap-blog", newsletter: "ap-newsletter" }
const btn = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-1.5 text-[13px] font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] disabled:opacity-50"
const primaryBtn = "inline-flex items-center gap-1.5 rounded-lg bg-[var(--nav)] px-3.5 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
const input = "w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const hour = (h: number) => `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`
const day = (d: string) => new Date(d + "T00:00:00+05:30").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })

async function post(body: Record<string, unknown>): Promise<{ ok: boolean; error?: string; results?: Result[] }> {
  try {
    const r = await fetch("/dashboard/me/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

function Channels({ list, value, onChange }: { list: Ch[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((c) => {
        const on = value.includes(c.key)
        return (
          <label key={c.key} className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${on ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)]"} ${c.ready ? "" : "opacity-50"}`}>
            <input type="checkbox" disabled={!c.ready} checked={on} onChange={(e) => onChange(e.target.checked ? [...value, c.key] : value.filter((x) => x !== c.key))} />
            {c.name}
            {!c.ready ? <span className="text-[11px] text-[var(--faint)]">set up first</span> : null}
          </label>
        )
      })}
    </div>
  )
}

function Results({ list, channels, go }: { list: Result[]; channels: Ch[]; go: (v: View) => void }) {
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {list.map((r, i) => (
        <li key={i} className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{channels.find((c) => c.key === r.channel)?.name}:</span>
          {r.error ? (
            <span className="text-[var(--bad)]">{r.error}</span>
          ) : (
            <>
              <span className="text-[var(--muted)]">draft ready · {r.title}</span>
              <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => go(VIEW[r.channel])}>
                Review
              </button>
            </>
          )}
        </li>
      ))}
    </ul>
  )
}

export function IdeasView({ go }: { go: (v: View) => void }) {
  const [d, setD] = useState<Data | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [angle, setAngle] = useState("")
  const [picked, setPicked] = useState<string[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [out, setOut] = useState<{ key: string; list: Result[] } | null>(null)
  const [fail, setFail] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/dashboard/me/ideas", { cache: "no-store" })
      const j = await r.json()
      if (j.ok) {
        setD(j)
        setPicked((p) => (p.length ? p : (j as Data).channels.filter((c) => c.ready).map((c) => c.key)))
      } else setErr(j.error || "Couldn't load ideas.")
    } catch {
      setErr("No connection. Try again.")
    }
  }, [])
  useEffect(() => {
    load()
  }, [load])

  const run = async (key: string, body: Record<string, unknown>) => {
    setBusy(key)
    setFail(null)
    setOut(null)
    const r = await post({ ...body, channels: picked })
    setBusy(null)
    if (r.ok && r.results) setOut({ key, list: r.results })
    else setFail(r.error || "That didn't work.")
  }

  if (err) return <Notice tone="error">{err}</Notice>
  if (!d) return <Skeleton className="h-72" />
  const none = !d.channels.some((c) => c.ready)
  const best = d.hours?.hours.length ? [...d.hours.hours].sort((a, b) => b.share - a.share).slice(0, 3) : []
  const peak = d.hours?.hours.length ? Math.max(...d.hours.hours.map((h) => h.share)) : 0

  return (
    <div className="space-y-5">
      {fail ? <Notice tone="error">{fail}</Notice> : null}
      {none ? (
        <Notice title="Set up a tool first">Open any automation (LinkedIn, Instagram + Facebook, Blog or Newsletter) and fill in &ldquo;About&rdquo;. Ideas then writes drafts in your voice for each one.</Notice>
      ) : null}

      <Card title={<span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-[var(--gold)]" /> One idea → every channel</span>} sub="Paste a thought, a link to your article, or a YouTube video. You get a draft for each channel, ready to approve.">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={"e.g. https://youtube.com/watch?v=…  or  \"3 mistakes people make when choosing a CA for GST\""} className={input + " font-[inherit]"} maxLength={6000} />
        <input value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="Angle (optional): e.g. aimed at first-time founders" className={input + " mt-2"} maxLength={200} />
        <div className="mt-3">
          <Channels list={d.channels} value={picked} onChange={setPicked} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" className={primaryBtn} disabled={!!busy || none || !picked.length || text.trim().length < 15} onClick={() => run("repurpose", { op: "repurpose", input: text, angle })}>
            <Link2 className="h-4 w-4" /> {busy === "repurpose" ? "Writing drafts…" : "Make drafts"}
          </button>
          {busy === "repurpose" ? <span className="text-xs text-[var(--faint)]">About 20–60 seconds.</span> : null}
        </div>
        {out?.key === "repurpose" ? <Results list={out.list} channels={d.channels} go={go} /> : null}
      </Card>

      <Card title={<span className="inline-flex items-center gap-2"><CalendarHeart className="h-4 w-4 text-[var(--gold)]" /> Festivals & special days</span>} sub="Coming up in India. One tap writes posts for that day for the channels ticked above. Dates of some festivals can differ by a day in some regions.">
        {!d.moments.length ? <p className="text-sm text-[var(--faint)]">Nothing in the next few weeks.</p> : null}
        <ul className="divide-y divide-[var(--line-soft)]">
          {d.moments.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <div className="w-24 shrink-0 text-[12.5px] text-[var(--muted)]">{day(m.date)}</div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{m.name}</div>
                <div className="text-[12px] text-[var(--faint)]">
                  {m.inDays === 0 ? "Today" : m.inDays === 1 ? "Tomorrow" : `In ${m.inDays} days`} · {m.idea}
                </div>
                {out?.key === m.id ? <Results list={out.list} channels={d.channels} go={go} /> : null}
              </div>
              <button type="button" className={btn} disabled={!!busy || none || !picked.length || m.inDays < 0} onClick={() => run(m.id, { op: "moment", id: m.id })}>
                {busy === m.id ? "Writing…" : "Create posts"}
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-2"><Newspaper className="h-4 w-4 text-[var(--gold)]" /> In the news this week</span>} sub="From your topics. Copy a link into the box above to post your take on it.">
          {!d.news.length ? <p className="text-sm text-[var(--faint)]">Add topics in your tools&rsquo; settings to see news here.</p> : null}
          <ul className="space-y-2.5">
            {d.news.map((n, i) => (
              <li key={i} className="text-sm">
                <a href={n.link} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                  {n.title}
                </a>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--faint)]">
                  <span>{n.source}</span>
                  <span>· {n.topic}</span>
                  <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => { setText(n.link); setAngle(`My take on this news: ${n.title}`); window.scrollTo({ top: 0, behavior: "smooth" }) }}>
                    Use this
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title={<span className="inline-flex items-center gap-2"><Clock className="h-4 w-4 text-[var(--gold)]" /> When your Instagram followers are online</span>} sub="India time, from Instagram. Set your post time in Instagram + Facebook settings.">
          {!d.hours ? (
            <p className="text-sm text-[var(--faint)]">Connect Instagram + Facebook to see this.</p>
          ) : d.hours.error ? (
            <p className="text-sm text-[var(--muted)]">{d.hours.error}</p>
          ) : (
            <>
              <p className="text-sm">
                Best hours: <b>{best.map((b) => hour(b.hour)).join(", ")}</b>. Post about 30 minutes before.
              </p>
              <div className="mt-3 flex h-24 items-end gap-[3px]" role="img" aria-label="Followers online by hour">
                {d.hours.hours.map((h) => (
                  <div key={h.hour} className="flex-1 rounded-t-sm bg-[var(--brand)]" style={{ height: `${Math.max(3, (h.share / (peak || 1)) * 100)}%`, opacity: best.some((b) => b.hour === h.hour) ? 1 : 0.35 }} title={`${hour(h.hour)}: ${(h.share * 100).toFixed(1)}%`} />
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[10.5px] text-[var(--faint)]">
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>11 PM</span>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
