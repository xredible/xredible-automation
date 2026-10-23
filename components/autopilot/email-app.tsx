"use client"

// Email Marketing tabs inside the newsletter tool: Subscribers (lists, tags, import/export),
// Sequences (automated welcome and follow-up emails), Signup form, Design (branded layouts),
// plus the new-campaign card and the "send to" picker used on each email.

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Copy, Download, ExternalLink, Plus, Sparkles, Trash2, X } from "lucide-react"
import { card, field, ghost, Notice, primary, small } from "./ui"

type Contact = { id: number; email: string; name: string; status: "subscribed" | "unsubscribed" | "pending"; tags: string[]; source: string; createdAt: string | null; inSeq: boolean }
type Step = { delay: number; subject: string; preheader: string; body: string; approved: boolean }
type Seq = { id: number; name: string; trigger: string; steps: Step[]; active: boolean }
type EmailState = { ok: true; contacts: Contact[]; tags: { tag: string; count: number }[]; seqs: Seq[]; stats: Record<string, { sent: number; opens: number; clicks: number }>; formUrl: string; embed: string }
type Res = EmailState & { added?: { added: number; skipped: number; total: number }; changed?: number; deleted?: number; campaign?: boolean; steps?: Step[] }
type Settings = Record<string, unknown>
export type Audience = { tags?: string[]; segment?: "all" | "engaged" | "new" | "inactive" }

async function call(body?: Record<string, unknown>): Promise<Res | { ok: false; error: string }> {
  try {
    const r = await fetch("/dashboard/me/email", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

function useEmail() {
  const [s, setS] = useState<EmailState | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const load = useCallback(async () => {
    const r = await call()
    if (r.ok) setS(r)
    else setErr(r.error)
  }, [])
  useEffect(() => {
    load()
  }, [load])
  const act = async (body: Record<string, unknown>) => {
    setBusy(true)
    const r = await call(body)
    setBusy(false)
    if (r.ok) {
      setS(r)
      setErr(null)
      return r
    }
    setErr(r.error)
    return null
  }
  return { s, err, busy, act, load }
}

const SEGMENTS: [NonNullable<Audience["segment"]>, string][] = [
  ["all", "Everyone subscribed"],
  ["engaged", "Opened or clicked in the last 30 days"],
  ["new", "Joined in the last 30 days"],
  ["inactive", "Haven't opened in 60 days"],
]

export const EMAIL_TABS = [
  { key: "emails", label: "Emails" },
  { key: "subscribers", label: "Subscribers" },
  { key: "sequences", label: "Sequences" },
  { key: "form", label: "Signup form" },
  { key: "design", label: "Design" },
] as const
export type EmailTab = (typeof EMAIL_TABS)[number]["key"]

export function EmailTabs({ tab, onTab }: { tab: EmailTab; onTab: (t: EmailTab) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-1" role="tablist" aria-label="Email Marketing">
      {EMAIL_TABS.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => onTab(t.key)} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-[13.5px] font-medium ${tab === t.key ? "bg-[var(--nav)] text-white" : "text-[var(--muted)] hover:bg-[var(--soft)]"}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ---------- who an email goes to ----------

export function AudiencePicker({ value, tags, onChange, disabled }: { value: Audience; tags: string[]; onChange: (a: Audience) => void; disabled?: boolean }) {
  const chosen = value.tags || []
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <span className="text-[var(--muted)]">Send to</span>
      <select value={value.segment || "all"} disabled={disabled} onChange={(e) => onChange({ ...value, segment: e.target.value as Audience["segment"] })} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1">
        {SEGMENTS.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      {tags.length ? (
        <select value="" disabled={disabled} onChange={(e) => e.target.value && onChange({ ...value, tags: [...chosen, e.target.value] })} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1" aria-label="Only these tags">
          <option value="">{chosen.length ? "+ another tag" : "All tags"}</option>
          {tags.filter((t) => !chosen.includes(t)).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      ) : null}
      {chosen.map((t) => (
        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-[var(--brandsoft)] px-2 py-0.5 text-[12px] text-[var(--brand)]">
          {t}
          <button type="button" disabled={disabled} onClick={() => onChange({ ...value, tags: chosen.filter((x) => x !== t) })} aria-label={`Remove ${t}`}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  )
}

/** The tags a customer uses (for the "send to" picker on emails). */
export function useTags() {
  const [tags, setTags] = useState<string[]>([])
  useEffect(() => {
    call().then((r) => r.ok && setTags(r.tags.map((t) => t.tag)))
  }, [])
  return tags
}

// ---------- new campaign ----------

export function CampaignCard({ onDone }: { onDone: () => void }) {
  const tags = useTags()
  const [brief, setBrief] = useState("")
  const [link, setLink] = useState("")
  const [aud, setAud] = useState<Audience>({ segment: "all" })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ tone: "good" | "bad"; text: string } | null>(null)
  return (
    <div className={card}>
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Sparkles className="h-4 w-4 text-[var(--gold)]" /> New campaign
      </h2>
      <p className="mt-1 text-[13px] text-[var(--muted)]">A one-off email for an offer, launch, event or announcement. The AI writes it in your voice; you review it below before it&rsquo;s sent.</p>
      <label className="mt-3 block">
        <span className={small}>What&rsquo;s it about?</span>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={3} maxLength={1000} className={field + " font-[inherit]"} placeholder="e.g. Diwali offer: 20% off all consultations booked before 5 November. Limited to 30 slots." />
      </label>
      <label className="mt-3 block">
        <span className={small}>Button link (optional)</span>
        <input value={link} onChange={(e) => setLink(e.target.value)} className={field} placeholder="https://…" />
      </label>
      <div className="mt-3">
        <AudiencePicker value={aud} tags={tags} onChange={setAud} />
      </div>
      <button
        type="button"
        className={primary + " mt-4"}
        disabled={busy || brief.trim().length < 10}
        onClick={async () => {
          setBusy(true)
          setMsg(null)
          const r = await call({ op: "campaign", brief, link, audience: aud })
          setBusy(false)
          if (r.ok) {
            setBrief("")
            setLink("")
            setMsg({ tone: "good", text: "Campaign drafted. Review it below, then approve." })
            onDone()
          } else setMsg({ tone: "bad", text: r.error })
        }}
      >
        {busy ? "Writing…" : "Write the campaign"}
      </button>
      {msg ? <div className={`mt-2 text-sm ${msg.tone === "good" ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{msg.text}</div> : null}
    </div>
  )
}

// ---------- subscribers ----------

export function SubscribersPanel({ cap }: { cap: number }) {
  const { s, err, busy, act } = useEmail()
  const [q, setQ] = useState("")
  const [tag, setTag] = useState("")
  const [status, setStatus] = useState("")
  const [sel, setSel] = useState<Set<number>>(new Set())
  const [text, setText] = useState("")
  const [importTags, setImportTags] = useState("")
  const [startSeq, setStartSeq] = useState(false)
  const [tagText, setTagText] = useState("")
  const [note, setNote] = useState<string | null>(null)
  const list = useMemo(() => {
    const term = q.toLowerCase()
    return (s?.contacts || []).filter((c) => (!term || `${c.email} ${c.name}`.toLowerCase().includes(term)) && (!tag || c.tags.includes(tag)) && (!status || c.status === status))
  }, [s, q, tag, status])
  if (!s) return err ? <Notice tone="bad">{err}</Notice> : <div className={card + " text-sm text-[var(--muted)]"}>Loading subscribers…</div>
  const subscribed = s.contacts.filter((c) => c.status === "subscribed").length
  const ids = [...sel]
  const shown = list.slice(0, 300)
  const allOn = shown.length > 0 && shown.every((c) => sel.has(c.id))
  return (
    <div className="space-y-5">
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Subscribers</h2>
            <span className="text-[13px] text-[var(--muted)]">
              {subscribed.toLocaleString("en-IN")} subscribed · your plan sends to {cap.toLocaleString("en-IN")}
            </span>
            <button type="button" onClick={() => window.location.assign("/dashboard/me/email?export=1")} className={ghost + " ml-auto"}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email or name" className={field + " mt-0 w-full sm:w-56"} />
            <select value={tag} onChange={(e) => setTag(e.target.value)} className={field + " mt-0 w-auto"} aria-label="Tag">
              <option value="">All lists and tags</option>
              {s.tags.map((t) => (
                <option key={t.tag} value={t.tag}>
                  {t.tag} ({t.count})
                </option>
              ))}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={field + " mt-0 w-auto"} aria-label="Status">
              <option value="">Any status</option>
              <option value="subscribed">Subscribed</option>
              <option value="pending">Waiting to confirm</option>
              <option value="unsubscribed">Unsubscribed</option>
            </select>
          </div>
          {ids.length ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--soft)] px-3 py-2 text-[13px]">
              <b>{ids.length} selected</b>
              <input value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="tag or list name" className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1" aria-label="Tag" />
              <button type="button" className={ghost} disabled={busy || !tagText.trim()} onClick={async () => (await act({ op: "tag", ids, add: [tagText] })) && setTagText("")}>
                Add tag
              </button>
              <button type="button" className={ghost} disabled={busy || !tagText.trim()} onClick={async () => (await act({ op: "tag", ids, remove: [tagText] })) && setTagText("")}>
                Remove tag
              </button>
              <button type="button" className={ghost} disabled={busy} onClick={() => act({ op: "status", ids, status: "unsubscribed" })}>
                Unsubscribe
              </button>
              <button type="button" className={ghost + " text-[var(--bad)]"} disabled={busy} onClick={async () => window.confirm(`Delete ${ids.length} subscribers for good?`) && (await act({ op: "delete", ids })) && setSel(new Set())}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>
          ) : null}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13.5px]">
              <thead>
                <tr className="border-b border-[var(--line)] text-left text-[12px] text-[var(--muted)]">
                  <th className="w-8 py-2">
                    <input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((c) => c.id)))} aria-label="Select all shown" />
                  </th>
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Tags</th>
                  <th className="py-2 font-medium">From</th>
                </tr>
              </thead>
              <tbody>
                {!shown.length ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-[var(--muted)]">
                      {s.contacts.length ? "Nobody matches." : "No subscribers yet. Import them on the right, or share your signup form."}
                    </td>
                  </tr>
                ) : null}
                {shown.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--line)] last:border-0">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={sel.has(c.id)}
                        onChange={() => {
                          const n = new Set(sel)
                          if (n.has(c.id)) n.delete(c.id)
                          else n.add(c.id)
                          setSel(n)
                        }}
                        aria-label={`Select ${c.email}`}
                      />
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{c.email}</div>
                      {c.name ? <div className="text-[12px] text-[var(--muted)]">{c.name}</div> : null}
                    </td>
                    <td className="py-2 text-[12.5px]">
                      {c.status === "subscribed" ? "Subscribed" : c.status === "pending" ? "Waiting to confirm" : "Unsubscribed"}
                      {c.inSeq ? <div className="text-[11.5px] text-[var(--brand)]">In a sequence</div> : null}
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.map((t) => (
                          <span key={t} className="rounded-full bg-[var(--soft)] px-2 py-0.5 text-[11.5px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 text-[12.5px] text-[var(--muted)]">{c.source === "form" ? "Signup form" : c.source === "manual" ? "Added" : "Import"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {list.length > shown.length ? <p className="mt-2 text-[12.5px] text-[var(--muted)]">Showing the first 300 of {list.length}. Search or filter to find others.</p> : null}
          </div>
        </div>
        <div className={card}>
          <h2 className="text-base font-semibold">Add subscribers</h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Only add people who agreed to hear from you. One per line: email, or email and name, or paste a CSV.</p>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7} className={field + " font-mono text-[12.5px]"} placeholder={"priya@example.com, Priya Shah\nrahul@example.com"} />
          <label className="mt-2 block">
            <span className={small}>Add them to lists / tags (comma separated)</span>
            <input value={importTags} onChange={(e) => setImportTags(e.target.value)} className={field} placeholder="e.g. customers, diwali-2026" />
          </label>
          <label className="mt-2 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={startSeq} onChange={(e) => setStartSeq(e.target.checked)} /> Start them on the welcome sequence
          </label>
          <label className="mt-2 inline-flex cursor-pointer items-center gap-1 text-[13px] text-[var(--brand)] hover:underline">
            Or choose a CSV file
            <input
              type="file"
              accept=".csv,.txt"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (f) setText((await f.text()).slice(0, 2_000_000))
              }}
            />
          </label>
          <button
            type="button"
            className={primary + " mt-3 w-full"}
            disabled={busy || !text.trim()}
            onClick={async () => {
              const r = await act({ op: "import", text, tags: importTags, startSeq })
              if (r?.added) {
                setText("")
                setNote(`Added ${r.added.added}${r.added.skipped ? `, skipped ${r.added.skipped} (duplicates or not emails)` : ""}.`)
              }
            }}
          >
            {busy ? "Adding…" : "Add subscribers"}
          </button>
          {note ? <div className="mt-2 text-[13px] text-[var(--good)]">{note}</div> : null}
          {s.tags.length ? (
            <div className="mt-5">
              <div className={small}>Your lists and tags</div>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {s.tags.map((t) => (
                  <button key={t.tag} type="button" onClick={() => setTag(t.tag)} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[12.5px] hover:border-[var(--brand)]">
                    {t.tag} · {t.count}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

// ---------- sequences ----------

const KINDS: [string, string][] = [
  ["welcome", "Welcome series for new subscribers"],
  ["nurture", "Nurture series that builds trust"],
  ["sales", "Sales series for an offer"],
]

export function SequencesPanel() {
  const { s, err, busy, act } = useEmail()
  const [edit, setEdit] = useState<Partial<Seq> | null>(null)
  const [kind, setKind] = useState("welcome")
  const [brief, setBrief] = useState("")
  const [count, setCount] = useState(4)
  const [writing, setWriting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!s) return err ? <Notice tone="bad">{err}</Notice> : <div className={card + " text-sm text-[var(--muted)]"}>Loading sequences…</div>
  const tags = s.tags.map((t) => t.tag)
  if (edit) return <SequenceEditor seq={edit} tags={tags} busy={busy} onCancel={() => setEdit(null)} onSave={async (seq) => (await act({ op: "seq-save", seq })) && setEdit(null)} err={err} />
  return (
    <div className="space-y-5">
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div className={card}>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4 text-[var(--gold)]" /> Write a sequence with AI
        </h2>
        <p className="mt-1 text-[13px] text-[var(--muted)]">Emails that go out by themselves, one after another, to each new subscriber (or everyone given a tag). You review and approve each email first.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className={field + " mt-0"} aria-label="Kind of sequence">
            {KINDS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
          <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={field + " mt-0"} aria-label="Number of emails">
            {[3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>
                {n} emails
              </option>
            ))}
          </select>
        </div>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} maxLength={800} className={field + " font-[inherit]"} placeholder="Anything to include? e.g. our free guide link, a 15-minute call at https://…, the offer and price" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={primary}
            disabled={writing}
            onClick={async () => {
              setWriting(true)
              setMsg(null)
              const r = await call({ op: "seq-write", kind, brief, count })
              setWriting(false)
              if (r.ok && r.steps) setEdit({ name: KINDS.find((k) => k[0] === kind)?.[1].split(" for")[0] || "Sequence", trigger: "join", steps: r.steps, active: false })
              else if (!r.ok) setMsg(r.error)
            }}
          >
            {writing ? "Writing… (about 30 seconds)" : "Write it"}
          </button>
          <button type="button" className={ghost} onClick={() => setEdit({ name: "New sequence", trigger: "join", steps: [{ delay: 0, subject: "", preheader: "", body: "Hi {{name}},\n\n", approved: false }], active: false })}>
            <Plus className="h-3.5 w-3.5" /> Start from blank
          </button>
        </div>
        {msg ? <div className="mt-2 text-sm text-[var(--bad)]">{msg}</div> : null}
      </div>
      {s.seqs.map((q) => {
        const sent = q.steps.reduce((t, _, i) => t + (s.stats[String(q.id * 100 + i)]?.sent || 0), 0)
        const opens = q.steps.reduce((t, _, i) => t + (s.stats[String(q.id * 100 + i)]?.opens || 0), 0)
        return (
          <div key={q.id} className={card}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{q.name}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[12px] ${q.active ? "bg-[var(--goodbg)] text-[var(--good)]" : "bg-[var(--soft)] text-[var(--muted)]"}`}>{q.active ? "On" : "Off"}</span>
              <span className="text-[13px] text-[var(--muted)]">
                {q.steps.length} emails · starts {q.trigger === "join" ? "when someone subscribes" : `when tagged “${q.trigger.slice(4)}”`} · {sent} sent{sent ? ` · ${Math.round((opens / sent) * 100)}% opened` : ""}
              </span>
              <span className="ml-auto flex gap-2">
                <button type="button" className={ghost} onClick={() => setEdit(q)}>
                  Edit
                </button>
                <button type="button" className={ghost} disabled={busy} onClick={() => act({ op: "seq-save", seq: { ...q, active: !q.active } })}>
                  {q.active ? "Turn off" : "Turn on"}
                </button>
                <button type="button" className={ghost + " text-[var(--bad)]"} disabled={busy} onClick={() => window.confirm("Delete this sequence?") && act({ op: "seq-delete", id: q.id })} aria-label="Delete sequence">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <ol className="mt-3 space-y-1 text-[13.5px]">
              {q.steps.map((st, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-[12px] text-[var(--muted)]">{i === 0 ? (st.delay ? `Day ${st.delay}` : "Right away") : `+${st.delay} day${st.delay === 1 ? "" : "s"}`}</span>
                  <span className="truncate">{st.subject || "(no subject)"}</span>
                  {st.approved ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--good)]" /> : <span className="text-[11.5px] text-[var(--muted)]">not approved</span>}
                </li>
              ))}
            </ol>
          </div>
        )
      })}
    </div>
  )
}

function SequenceEditor({ seq, tags, busy, onCancel, onSave, err }: { seq: Partial<Seq>; tags: string[]; busy: boolean; onCancel: () => void; onSave: (s: Partial<Seq>) => void; err: string | null }) {
  const [q, setQ] = useState<Partial<Seq>>(seq)
  const steps = q.steps || []
  const setStep = (i: number, p: Partial<Step>) => setQ({ ...q, steps: steps.map((s, j) => (j === i ? { ...s, ...p, ...(p.approved === undefined ? { approved: false } : {}) } : s)) })
  const allOk = steps.length > 0 && steps.every((s) => s.approved && s.subject && s.body.length >= 20)
  return (
    <div className="space-y-4">
      {err ? <Notice tone="bad">{err}</Notice> : null}
      <div className={card}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={small}>Name</span>
            <input value={q.name || ""} onChange={(e) => setQ({ ...q, name: e.target.value })} className={field} />
          </label>
          <label className="block">
            <span className={small}>Starts when</span>
            <select value={q.trigger || "join"} onChange={(e) => setQ({ ...q, trigger: e.target.value })} className={field}>
              <option value="join">Someone subscribes (signup form, or added with &ldquo;start the welcome sequence&rdquo;)</option>
              {tags.map((t) => (
                <option key={t} value={`tag:${t}`}>
                  Someone is tagged &ldquo;{t}&rdquo;
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      {steps.map((st, i) => (
        <div key={i} className={card}>
          <div className="flex flex-wrap items-center gap-2">
            <b className="text-sm">Email {i + 1}</b>
            <label className="flex items-center gap-1.5 text-[13px] text-[var(--muted)]">
              {i === 0 ? "Send after" : "Then wait"}
              <input type="number" min={0} max={365} value={st.delay} onChange={(e) => setStep(i, { delay: Number(e.target.value) })} className="w-16 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1" aria-label="Days" />
              days
            </label>
            <span className="ml-auto flex gap-2">
              <button type="button" className={st.approved ? ghost : primary} onClick={() => setQ({ ...q, steps: steps.map((s, j) => (j === i ? { ...s, approved: !s.approved } : s)) })}>
                {st.approved ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Approved
                  </>
                ) : (
                  "Approve"
                )}
              </button>
              <button type="button" className={ghost} disabled={steps.length <= 1} onClick={() => setQ({ ...q, steps: steps.filter((_, j) => j !== i) })} aria-label="Remove email">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
          <label className="mt-2 block">
            <span className={small}>Subject</span>
            <input value={st.subject} onChange={(e) => setStep(i, { subject: e.target.value })} maxLength={120} className={field} />
          </label>
          <label className="mt-2 block">
            <span className={small}>Preview text</span>
            <input value={st.preheader} onChange={(e) => setStep(i, { preheader: e.target.value })} maxLength={200} className={field} />
          </label>
          <label className="mt-2 block">
            <span className={small}>Email ({"{{name}}"} = their first name; a link on its own line becomes a button)</span>
            <textarea value={st.body} onChange={(e) => setStep(i, { body: e.target.value })} rows={9} className={field + " font-[inherit] leading-relaxed"} />
          </label>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={ghost} onClick={() => setQ({ ...q, steps: [...steps, { delay: 3, subject: "", preheader: "", body: "Hi {{name}},\n\n", approved: false }] })}>
          <Plus className="h-3.5 w-3.5" /> Add an email
        </button>
        <span className="ml-auto" />
        <button type="button" className={ghost} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={ghost} disabled={busy} onClick={() => onSave({ ...q, active: false })}>
          Save (off)
        </button>
        <button type="button" className={primary} disabled={busy || !allOk} title={allOk ? "" : "Approve every email first"} onClick={() => onSave({ ...q, active: true })}>
          Save and turn on
        </button>
      </div>
    </div>
  )
}

// ---------- signup form ----------

type Form = { title: string; text: string; button: string; askName: boolean; tags: string; doubleOptIn: boolean; thanks: string }

export function FormPanel({ settings, connected, busy, save }: { settings: Settings; connected: boolean; busy: boolean; save: (s: Settings) => Promise<boolean> }) {
  const { s } = useEmail()
  const f0 = (settings.form || {}) as Partial<Form>
  const [f, setF] = useState<Form>({ title: f0.title || "Join my newsletter", text: f0.text || "Useful tips in your inbox. No spam, unsubscribe any time.", button: f0.button || "Subscribe", askName: f0.askName !== false, tags: String(f0.tags || ""), doubleOptIn: f0.doubleOptIn !== false, thanks: f0.thanks || "Thanks for subscribing!" })
  const [copied, setCopied] = useState("")
  const [saved, setSaved] = useState(false)
  const copy = (k: string, v: string) => navigator.clipboard.writeText(v).then(() => (setCopied(k), setTimeout(() => setCopied(""), 2000)))
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={card}>
        <h2 className="text-base font-semibold">Your signup form</h2>
        {!connected ? (
          <div className="mt-2">
            <Notice tone="info">Connect your email (Emails tab) first: the form sends the confirmation email from your address.</Notice>
          </div>
        ) : null}
        <label className="mt-3 block">
          <span className={small}>Heading</span>
          <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={80} className={field} />
        </label>
        <label className="mt-3 block">
          <span className={small}>Text</span>
          <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} maxLength={300} rows={2} className={field + " font-[inherit]"} />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className={small}>Button</span>
            <input value={f.button} onChange={(e) => setF({ ...f, button: e.target.value })} maxLength={30} className={field} />
          </label>
          <label className="block">
            <span className={small}>Tag new subscribers with</span>
            <input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} className={field} placeholder="e.g. website" />
          </label>
        </div>
        <label className="mt-3 block">
          <span className={small}>Thank-you message</span>
          <input value={f.thanks} onChange={(e) => setF({ ...f, thanks: e.target.value })} maxLength={200} className={field} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={f.askName} onChange={(e) => setF({ ...f, askName: e.target.checked })} /> Ask for their name
        </label>
        <label className="mt-2 flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={f.doubleOptIn} onChange={(e) => setF({ ...f, doubleOptIn: e.target.checked })} /> Ask them to confirm by email (recommended: keeps your list clean and your emails out of spam)
        </label>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className={primary} disabled={busy} onClick={async () => (await save({ ...settings, form: f })) && (setSaved(true), setTimeout(() => setSaved(false), 2500))}>
            Save form
          </button>
          {saved ? <span className="text-sm text-[var(--good)]">Saved</span> : null}
        </div>
      </div>
      <div className={card}>
        <h2 className="text-base font-semibold">Share it</h2>
        {s ? (
          <>
            <p className="mt-1 text-[13px] text-[var(--muted)]">Your own signup page, in your brand. Put the link in your Instagram bio, WhatsApp status, email signature or LinkedIn profile.</p>
            <div className="mt-2 flex gap-2">
              <input readOnly value={s.formUrl} className={field + " mt-0 font-mono text-[12px]"} aria-label="Signup page link" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" className={ghost + " shrink-0"} onClick={() => copy("url", s.formUrl)}>
                {copied === "url" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy
              </button>
              <a href={s.formUrl} target="_blank" rel="noreferrer" className={ghost + " shrink-0"} aria-label="Open signup page">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <p className="mt-5 text-[13px] text-[var(--muted)]">Or paste this form into your website (WordPress: add a &ldquo;Custom HTML&rdquo; block).</p>
            <textarea readOnly value={s.embed} rows={7} className={field + " font-mono text-[11.5px]"} aria-label="Embed code" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className={ghost + " mt-2"} onClick={() => copy("embed", s.embed)}>
              {copied === "embed" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy code
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
        )}
      </div>
    </div>
  )
}

// ---------- design ----------

const LAYOUTS: [string, string, string][] = [
  ["header", "Branded header", "Your logo on a band of your colour"],
  ["classic", "Classic", "Clean white card with a colour line"],
  ["letter", "Personal letter", "Looks like a note from you"],
  ["card", "Magazine", "Soft background, bold headings, accent touches"],
]

export function DesignPanel({ settings, busy, save }: { settings: Settings; busy: boolean; save: (s: Settings) => Promise<boolean> }) {
  const current = String(settings.emailTemplate || "header")
  const [pick, setPick] = useState(current)
  return (
    <div className="space-y-4">
      <p className="!m-0 text-sm text-[var(--muted)]">
        Every newsletter, campaign and sequence email uses your <a href="/dashboard?biz=autopilot&view=ap-brand" className="text-[var(--brand)] underline">Brand kit</a> (logo, colours, fonts). Pick the layout:
      </p>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {LAYOUTS.map(([k, name, blurb]) => (
          <button key={k} type="button" onClick={() => setPick(k)} aria-pressed={pick === k} className={`rounded-xl border bg-[var(--panel)] p-2 text-left ${pick === k ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-[var(--line)]"}`}>
            <iframe title={`${name} preview`} src={`/dashboard/me/email/preview?t=${k}`} className="pointer-events-none h-[420px] w-full rounded-lg border border-[var(--line)] bg-white" loading="lazy" />
            <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
              {pick === k ? <Check className="h-4 w-4 text-[var(--brand)]" /> : null}
              {name}
            </div>
            <div className="text-[12px] text-[var(--muted)]">{blurb}</div>
          </button>
        ))}
      </div>
      <button type="button" className={primary} disabled={busy || pick === current} onClick={() => save({ ...settings, emailTemplate: pick })}>
        {pick === current ? "In use" : "Use this layout"}
      </button>
    </div>
  )
}
