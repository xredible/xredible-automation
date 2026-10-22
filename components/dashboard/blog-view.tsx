"use client"

// The Blog page (Nestoodle): what the blog automation planned and wrote, and an
// editor to review, fix, schedule, publish and share each article.
//
// Data: section "blog" (list) and "blogpost" (one post with its block content) from
// NST-D. Changes go through /dashboard/blog to NST-DB Blog Actions.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowLeft, ArrowUp, CalendarClock, Check, CircleAlert, ExternalLink, Eye, ImageOff, ImagePlus, Loader2, Pencil, Plus, Rocket, Save, Send, SkipForward, Sparkles, Trash2, Undo2, X } from "lucide-react"
import type { BlogData, BlogPost, BlogPostData, BlogTopic } from "@/lib/dashboard/types"
import type { BusinessKey } from "@/lib/dashboard/businesses"
import { blockText, edited, parseBlocks, serializeBlocks, type Block } from "@/lib/dashboard/blocks"
import { loadKey } from "./state"
import { dateTime, todayIST } from "./format"
import { Card, Notice, Skeleton } from "./ui"

type Result = { ok: boolean; error?: string; done?: string; status?: string; date?: string | null; link?: string | null }
type Toast = { tone: "ok" | "bad"; text: string } | null

const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] hover:text-[var(--ink)] disabled:opacity-50"
const primary = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:text-[var(--bg)]"
const input = "w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const label = "mb-1 flex items-center justify-between text-[11.5px] font-semibold uppercase tracking-wide text-[var(--muted)]"

const siteTime = (d: string | null) => (d ? dateTime(new Date(Date.parse(d + ":00+05:30")).toISOString()) : "")
const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-amber-50 text-amber-800 ring-amber-600/25" },
  pending: { label: "Pending review", cls: "bg-amber-50 text-amber-800 ring-amber-600/25" },
  future: { label: "Scheduled", cls: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  publish: { label: "Published", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  Planned: { label: "Planned", cls: "bg-sky-50 text-sky-800 ring-sky-600/20" },
  Failed: { label: "Failed", cls: "bg-red-50 text-red-700 ring-red-600/20" },
  Skipped: { label: "Skipped", cls: "bg-slate-100 text-slate-500 ring-slate-500/20" },
  Drafted: { label: "Written", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
}
function Pill({ s }: { s: string }) {
  const m = STATUS[s] || { label: s, cls: "bg-slate-100 text-slate-600 ring-slate-500/20" }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.cls}`}>{m.label}</span>
}

async function send(biz: BusinessKey, body: Record<string, unknown>): Promise<Result> {
  try {
    const r = await fetch("/dashboard/blog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, biz }) })
    if (r.status === 401) window.location.reload()
    return (await r.json().catch(() => ({ ok: false, error: `The dashboard server answered with HTTP ${r.status}.` }))) as Result
  } catch {
    return { ok: false, error: "No internet connection. Nothing was changed." }
  }
}

export function BlogView({ biz, data, onChanged }: { biz: BusinessKey; data: BlogData; onChanged: () => void }) {
  const [editing, setEditing] = useState<number | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((tone: "ok" | "bad", text: string) => {
    setToast({ tone, text })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), tone === "ok" ? 6000 : 12000)
  }, [])
  const act = useCallback(
    async (key: string, body: Record<string, unknown>, fallback: string) => {
      setBusy(key)
      const r = await send(biz, body)
      setBusy(null)
      show(r.ok ? "ok" : "bad", r.ok ? r.done || fallback : r.error || "That didn't work.")
      if (r.ok) onChanged()
      return r
    },
    [biz, onChanged, show],
  )

  // Open the editor from a link (?view=blog&post=123) and keep the URL in step.
  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("post"))
    if (id) setEditing(id)
  }, [])
  useEffect(() => {
    const u = new URL(window.location.href)
    if (editing) u.searchParams.set("post", String(editing))
    else u.searchParams.delete("post")
    window.history.replaceState(null, "", u.toString())
  }, [editing])

  const toast$ = toast ? (
    <div role="status" className="fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div className={`flex max-w-lg items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-xl ${toast.tone === "ok" ? "bg-[var(--nav)] text-white" : "bg-[var(--bad)] text-white"}`}>
        {toast.tone === "ok" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <X className="mt-0.5 h-4 w-4 shrink-0" />}
        <span className="leading-snug">{toast.text}</span>
        <button type="button" onClick={() => setToast(null)} className="-mr-1 ml-1 rounded p-0.5 opacity-70 hover:opacity-100" aria-label="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  ) : null

  if (editing) {
    return (
      <>
        <BlogEditor biz={biz} id={editing} onClose={() => setEditing(null)} onChanged={onChanged} show={show} />
        {toast$}
      </>
    )
  }

  const posts = data.posts || []
  const topics = data.topics || []
  const review = posts.filter((p) => p.status === "draft" || p.status === "pending")
  const scheduled = posts.filter((p) => p.status === "future").sort((a, b) => (a.date || "").localeCompare(b.date || ""))
  const published = posts.filter((p) => p.status === "publish").slice(0, 12)
  const upcoming = topics.filter((t) => t.status === "Planned" || t.status === "Failed")
  const skipped = topics.filter((t) => t.status === "Skipped")
  // Drafts the automation wrote (an Article topic points at them) can be rewritten.
  const topicOf = new Map(topics.filter((t) => t.postId && t.type !== "Refresh" && t.status === "Drafted").map((t) => [t.postId as number, t]))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={review.length} label="To review" tone={review.length ? "warn" : undefined} />
        <Stat n={scheduled.length} label="Scheduled" />
        <Stat n={upcoming.length} label="Topics planned" />
        <Stat n={posts.filter((p) => p.status === "publish").length} label="Published" />
      </div>
      {(data.notes || []).map((n) => (
        <Notice key={n} tone="info">
          {n}
        </Notice>
      ))}

      <Card title="Needs your review" sub="Drafts written by the blog automation (and any other drafts). Open one to read, edit and schedule it.">
        {review.length ? (
          <ul className="divide-y divide-[var(--line-soft)]">
            {review.map((p) => {
              const t = topicOf.get(p.id)
              return (
                <PostRow key={p.id} p={p} onEdit={() => setEditing(p.id)}>
                  {t ? (
                    <button
                      type="button"
                      className={btn}
                      disabled={!!busy}
                      title="Write this article again in the house format, into this same draft"
                      onClick={() => {
                        if (window.confirm("Rewrite this draft from scratch? The new version replaces it, including any edits you made.")) act(`r${p.id}`, { action: "write_now", row: t.row }, "Rewriting it now.")
                      }}
                    >
                      {busy === `r${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Rewrite
                    </button>
                  ) : null}
                  {t ? (
                    <button
                      type="button"
                      className={btn}
                      disabled={!!busy}
                      title="Make new photos for this draft; the text stays as it is"
                      onClick={() => {
                        if (window.confirm("Replace this draft's photos (and featured image) with new ones? The text stays as it is.")) act(`i${p.id}`, { action: "new_photos", row: t.row }, "Making new photos.")
                      }}
                    >
                      {busy === `i${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />} New photos
                    </button>
                  ) : null}
                </PostRow>
              )
            })}
          </ul>
        ) : (
          <Empty>Nothing waiting. New drafts arrive the morning after Monday&rsquo;s research.</Empty>
        )}
      </Card>

      <Card title="Up next" sub="Topics chosen by Monday's research. The writer drafts one each morning at 07:00, or press Write now.">
        {upcoming.length ? (
          <ul className="divide-y divide-[var(--line-soft)]">
            {upcoming.map((t) => (
              <TopicRow key={t.row} t={t}>
                <button type="button" className={btn} disabled={!!busy} onClick={() => act(`w${t.row}`, { action: "write_now", row: t.row }, "Writing it now.")}>
                  {busy === `w${t.row}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Write now
                </button>
                <button type="button" className={btn} disabled={!!busy} onClick={() => act(`s${t.row}`, { action: "skip_topic", row: t.row }, "Skipped.")}>
                  <SkipForward className="h-3.5 w-3.5" /> Skip
                </button>
              </TopicRow>
            ))}
          </ul>
        ) : (
          <Empty>No topics planned. Blog Research picks new ones every Monday at 06:30.</Empty>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Scheduled" sub="Goes live automatically at its time (India time).">
          {scheduled.length ? <ul className="divide-y divide-[var(--line-soft)]">{scheduled.map((p) => <PostRow key={p.id} p={p} onEdit={() => setEditing(p.id)} />)}</ul> : <Empty>Nothing scheduled.</Empty>}
        </Card>
        <Card title="Published" sub="Share an article to add it to the social calendar.">
          {published.length ? (
            <ul className="divide-y divide-[var(--line-soft)]">
              {published.map((p) => (
                <PostRow key={p.id} p={p} onEdit={() => setEditing(p.id)}>
                  <button type="button" className={btn} disabled={!!busy} onClick={() => act(`sh${p.id}`, { action: "share", id: p.id }, "Shared.")}>
                    {busy === `sh${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Share
                  </button>
                </PostRow>
              ))}
            </ul>
          ) : (
            <Empty>Nothing published yet.</Empty>
          )}
        </Card>
      </div>

      {skipped.length ? (
        <Card title="Skipped topics">
          <ul className="divide-y divide-[var(--line-soft)]">
            {skipped.map((t) => (
              <TopicRow key={t.row} t={t}>
                <button type="button" className={btn} disabled={!!busy} onClick={() => act(`r${t.row}`, { action: "restore_topic", row: t.row }, "Back in the plan.")}>
                  <Undo2 className="h-3.5 w-3.5" /> Restore
                </button>
              </TopicRow>
            ))}
          </ul>
        </Card>
      ) : null}
      {toast$}
    </div>
  )
}

function Stat({ n, label: l, tone }: { n: number; label: string; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border bg-[var(--panel)] p-3.5 ${tone ? "border-amber-300" : "border-[var(--line)]"}`}>
      <div className="text-2xl font-semibold tabular-nums tracking-tight text-[var(--ink)]">{n}</div>
      <div className="text-xs text-[var(--muted)]">{l}</div>
    </div>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <div className="py-5 text-center text-sm text-[var(--faint)]">{children}</div>

function PostRow({ p, onEdit, children }: { p: BlogPost; onEdit: () => void; children?: ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      {p.featuredImage ? (
        <img src={p.featuredImage} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" loading="lazy" />
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-[var(--chip)] text-[var(--faint)]" title="No featured image yet">
          <ImageOff className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill s={p.status} />
          {p.automated ? <span className="text-[11px] font-medium text-[var(--brand)]">Written by the automation</span> : null}
          {p.category ? <span className="text-[11px] text-[var(--faint)]">{p.category}</span> : null}
        </div>
        <button type="button" onClick={onEdit} className="mt-1 block text-left text-[0.92rem] font-semibold leading-snug text-[var(--ink)] hover:underline">
          {p.title}
        </button>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-[var(--muted)]">
          {p.date ? <span>{p.status === "publish" ? "Published" : p.status === "future" ? "Goes live" : "Planned for"} {siteTime(p.date)}</span> : null}
          <span>{p.words.toLocaleString()} words</span>
          {p.keyword ? <span>Keyword: {p.keyword}</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" className={btn} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" /> {p.status === "draft" || p.status === "pending" ? "Review & edit" : "Edit"}
          </button>
          {children}
          {p.link ? (
            <a className={btn} href={p.link} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3.5 w-3.5" /> {p.status === "publish" ? "View" : "Preview"}
            </a>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function TopicRow({ t, children }: { t: BlogTopic; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill s={t.status} />
        <span className="text-[11px] font-medium text-[var(--muted)]">{t.type === "Refresh" ? "Refresh of an existing post" : t.category}</span>
        {t.writeOn ? <span className="text-[11px] text-[var(--faint)]">Writes {t.writeOn === todayIST() ? "today" : t.writeOn}</span> : null}
        {t.publishOn ? <span className="text-[11px] text-[var(--faint)]">· slot {t.publishOn}</span> : null}
      </div>
      <div className="mt-1 text-[0.92rem] font-semibold leading-snug text-[var(--ink)]">{t.title}</div>
      {t.keyword ? <div className="text-xs text-[var(--muted)]">Keyword: {t.keyword}</div> : null}
      {t.status === "Failed" && t.notes ? (
        <div className="mt-1 flex items-start gap-1 text-xs text-[var(--bad)]">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t.notes}
        </div>
      ) : null}
      {open ? (
        <div className="mt-2 space-y-1 rounded-lg bg-[var(--chip)] p-3 text-xs leading-relaxed text-[var(--ink-2)]">
          {t.angle ? <p className="!m-0"><b>Angle:</b> {t.angle}</p> : null}
          {t.why ? <p className="!m-0"><b>Why:</b> {t.why}</p> : null}
          {t.secondary ? <p className="!m-0"><b>Also targets:</b> {t.secondary}</p> : null}
        </div>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {children}
        {t.angle || t.why ? (
          <button type="button" className={btn} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Why this topic?"}
          </button>
        ) : null}
      </div>
    </li>
  )
}

// ---------- editor ----------

function BlogEditor({ biz, id, onClose, onChanged, show }: { biz: BusinessKey; id: number; onClose: () => void; onChanged: () => void; show: (tone: "ok" | "bad", text: string) => void }) {
  const [loaded, setLoaded] = useState<BlogPostData | { ok: false; error: string } | null>(null)
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [date, setDate] = useState("")
  const [blocks, setBlocks] = useState<Block[]>([])
  const [dirty, setDirty] = useState(false)
  const [tab, setTab] = useState<"edit" | "preview">("edit")
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState("")

  const load = useCallback(() => {
    setLoaded(null)
    loadKey(new URLSearchParams({ biz, section: "blogpost", id: String(id) }).toString(), true).then((d) => {
      const r = d as BlogPostData | { ok: false; error: string }
      setLoaded(r)
      if (r.ok) {
        setTitle(r.post.title)
        setSlug(r.post.slug)
        setExcerpt(r.post.excerpt)
        setDate(r.post.date || "")
        setBlocks(parseBlocks(r.post.content))
        setStatus(r.post.status)
        setDirty(false)
      }
    })
  }, [biz, id])
  useEffect(load, [load])

  // Don't lose edits by closing the tab.
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setDirty(true)
  }
  const setBlock = (i: number, b: Block) => {
    setBlocks((all) => all.map((x, n) => (n === i ? b : x)))
    setDirty(true)
  }
  const move = (i: number, by: number) => {
    setBlocks((all) => {
      const j = i + by
      if (j < 0 || j >= all.length) return all
      const next = [...all]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    setDirty(true)
  }
  const remove = (i: number) => {
    setBlocks((all) => all.filter((_, n) => n !== i))
    setDirty(true)
  }
  const addAfter = (i: number, b: Block) => {
    setBlocks((all) => [...all.slice(0, i + 1), edited(b, {}), ...all.slice(i + 1)])
    setDirty(true)
  }

  const content = useMemo(() => serializeBlocks(blocks), [blocks])
  const post = loaded && loaded.ok ? loaded.post : null
  const topic = loaded && loaded.ok ? loaded.topic : null
  const seo = useMemo(() => checks({ title, slug, excerpt, blocks, keyword: topic?.keyword || post?.keyword || "", image: post?.featuredImage || null }), [title, slug, excerpt, blocks, topic, post])

  const run = async (action: string, label: string) => {
    if (action === "publish" && !window.confirm("Publish this article on nestoodle.com now?")) return
    setBusy(action)
    const body: Record<string, unknown> = { action, id }
    if (action !== "share") Object.assign(body, { title, slug, excerpt, date: date || undefined, ...(dirty ? { content } : {}) })
    const r = await send(biz, body)
    setBusy(null)
    if (!r.ok) return show("bad", r.error || "That didn't work. Nothing was changed.")
    if (r.status) setStatus(r.status)
    if (r.date) setDate(r.date)
    if (action !== "share") {
      setDirty(false)
      setBlocks((all) => parseBlocks(serializeBlocks(all)))
    }
    show("ok", r.done || label)
    onChanged()
  }

  const back = () => {
    if (dirty && !window.confirm("You have unsaved changes. Leave without saving?")) return
    onClose()
  }

  if (!loaded) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (!loaded.ok) {
    return (
      <div className="space-y-4">
        <button type="button" className={btn} onClick={onClose}>
          <ArrowLeft className="h-3.5 w-3.5" /> Back to blog posts
        </button>
        <Notice tone="error" title="This post didn't load">
          {loaded.error}
        </Notice>
      </div>
    )
  }

  const words = blocks.reduce((n, b) => n + blockText(b).split(/\s+/).filter(Boolean).length, 0)
  const live = status === "publish"
  const wpEdit = `https://nestoodle.com/wp-admin/post.php?post=${id}&action=edit`

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={back}>
          <ArrowLeft className="h-3.5 w-3.5" /> Blog posts
        </button>
        <Pill s={status} />
        {dirty ? <span className="text-xs font-medium text-amber-700">Unsaved changes</span> : <span className="text-xs text-[var(--faint)]">All changes saved</span>}
        <span className="ml-auto text-xs text-[var(--faint)]">{words.toLocaleString()} words</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <div className="space-y-3">
              <div>
                <div className={label}>
                  <span>Title</span>
                  <Count n={title.length} lo={30} hi={65} />
                </div>
                <input className={`${input} text-base font-semibold`} value={title} onChange={(e) => change(setTitle)(e.target.value)} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className={label}>
                    <span>URL slug</span>
                  </div>
                  <input className={input} value={slug} onChange={(e) => change(setSlug)(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} disabled={live} title={live ? "Changing a live post's URL breaks links to it" : undefined} />
                </div>
                <div>
                  <div className={label}>
                    <span>Publish date (India time)</span>
                  </div>
                  <input type="datetime-local" className={input} value={date} onChange={(e) => change(setDate)(e.target.value)} />
                </div>
              </div>
              <div>
                <div className={label}>
                  <span>Meta description (shown under the title in Google)</span>
                  <Count n={excerpt.length} lo={120} hi={160} />
                </div>
                <textarea className={input} rows={2} value={excerpt} onChange={(e) => change(setExcerpt)(e.target.value)} />
              </div>
            </div>
          </Card>

          <div className="flex gap-1 rounded-lg bg-[var(--chip)] p-1 text-xs font-medium sm:w-fit">
            {(["edit", "preview"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)} className={`flex-1 rounded-md px-3 py-1.5 sm:flex-none ${tab === t ? "bg-[var(--panel)] text-[var(--ink)] shadow-sm" : "text-[var(--muted)]"}`}>
                {t === "edit" ? (
                  <>
                    <Pencil className="mr-1 inline h-3.5 w-3.5" /> Edit
                  </>
                ) : (
                  <>
                    <Eye className="mr-1 inline h-3.5 w-3.5" /> Preview
                  </>
                )}
              </button>
            ))}
          </div>

          {tab === "preview" ? (
            <Card>
              <article className="blog-preview max-w-none text-[15px] leading-relaxed text-[var(--ink)]">
                <h1 className="!mb-3 !mt-0 text-2xl font-bold">{title}</h1>
                <div dangerouslySetInnerHTML={{ __html: previewHtml(content) }} />
              </article>
              <style>{`.blog-preview h1,.blog-preview h2,.blog-preview h3{font-family:inherit}.blog-preview h2{font-size:1.25rem;font-weight:700;margin:1.4em 0 .5em}.blog-preview h3{font-size:1.05rem;font-weight:700;margin:1.2em 0 .4em}.blog-preview p{margin:.6em 0}.blog-preview ul,.blog-preview ol{margin:.6em 0;padding-left:1.4em}.blog-preview ul{list-style:disc}.blog-preview ol{list-style:decimal}.blog-preview a{color:var(--brand);text-decoration:underline}.blog-preview .schema-faq-section{margin:.8em 0}.blog-preview .schema-faq-question{display:block}.blog-preview img{max-width:100%;height:auto;border-radius:8px}`}</style>
            </Card>
          ) : (
            <div className="space-y-2">
              {blocks.map((b, i) => (
                <BlockEditor key={i} b={b} onChange={(nb) => setBlock(i, nb)} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => remove(i)} onAdd={(nb) => addAfter(i, nb)} />
              ))}
              {!blocks.length ? <Empty>This post is empty.</Empty> : null}
            </div>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card title="Publish">
            <div className="flex flex-col gap-2">
              <button type="button" className={primary} disabled={!!busy} onClick={() => run("save", "Saved.")}>
                {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save {live ? "changes" : "draft"}
              </button>
              {!live ? (
                <button type="button" className={btn} disabled={!!busy || !date} onClick={() => run("schedule", "Scheduled.")} title={!date ? "Pick a publish date first" : undefined}>
                  {busy === "schedule" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />} {status === "future" ? "Update schedule" : `Schedule${date ? ` for ${siteTime(date)}` : ""}`}
                </button>
              ) : null}
              {!live ? (
                <button type="button" className={btn} disabled={!!busy} onClick={() => run("publish", "Published.")}>
                  {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />} Publish now
                </button>
              ) : null}
              {status === "future" || live ? (
                <button type="button" className={btn} disabled={!!busy} onClick={() => run("draft", "Moved back to Draft.")}>
                  <Undo2 className="h-3.5 w-3.5" /> {live ? "Unpublish (back to draft)" : "Unschedule"}
                </button>
              ) : null}
              {status === "future" || live ? (
                <button type="button" className={btn} disabled={!!busy || dirty} onClick={() => run("share", "Shared.")} title={dirty ? "Save first" : "Adds Facebook, Pinterest and Instagram posts to the Content calendar"}>
                  {busy === "share" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Share to social
                </button>
              ) : null}
              <div className="flex gap-2 pt-1">
                <a className={`${btn} flex-1 justify-center`} href={wpEdit} target="_blank" rel="noreferrer" title="Images, embeds and anything else">
                  <ExternalLink className="h-3.5 w-3.5" /> WordPress
                </a>
                {post?.link ? (
                  <a className={`${btn} flex-1 justify-center`} href={post.link} target="_blank" rel="noreferrer">
                    <Eye className="h-3.5 w-3.5" /> {live ? "View" : "Preview"}
                  </a>
                ) : null}
              </div>
            </div>
          </Card>

          <Card title="SEO checklist" sub={topic?.keyword || post?.keyword ? `Keyword: ${topic?.keyword || post?.keyword}` : "No keyword on file for this post"}>
            <ul className="space-y-1.5 text-xs">
              {seo.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--good)]" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                  <span className={c.ok ? "text-[var(--ink-2)]" : "text-[var(--ink)]"}>
                    {c.label}
                    {!c.ok && c.tip ? <span className="block text-[var(--faint)]">{c.tip}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Featured image">
            {post?.featuredImage ? (
              <img src={post.featuredImage} alt="" className="w-full rounded-lg" />
            ) : (
              <p className="!m-0 text-xs text-[var(--muted)]">
                None yet. Add one in{" "}
                <a href={wpEdit} target="_blank" rel="noreferrer" className="text-[var(--brand)] underline">
                  WordPress
                </a>{" "}
                (right-hand panel → Featured image), then come back and press Refresh. Pinterest and Instagram need it.
              </p>
            )}
            {topic?.notes ? <p className="!mb-0 !mt-2 text-xs text-[var(--faint)]">{topic.notes}</p> : null}
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Count({ n, lo, hi }: { n: number; lo: number; hi: number }) {
  const ok = n >= lo && n <= hi
  return <span className={`normal-case tracking-normal ${ok ? "text-[var(--good)]" : "text-amber-700"}`}>{n} / {lo}–{hi}</span>
}

const kindLabel = (b: Block) => (b.kind === "heading" ? `Heading ${b.level}` : b.kind === "paragraph" ? "Paragraph" : b.kind === "list" ? (b.ordered ? "Numbered list" : "Bulleted list") : b.kind === "faq" ? "FAQ (Google rich result)" : b.name === "html" ? "HTML" : b.name.replace(/^core\//, "").replace(/-/g, " "))

function BlockEditor({ b, onChange, onUp, onDown, onRemove, onAdd }: { b: Block; onChange: (b: Block) => void; onUp: () => void; onDown: () => void; onRemove: () => void; onAdd: (b: Block) => void }) {
  const tool = "rounded p-1 text-[var(--faint)] hover:bg-[var(--chip)] hover:text-[var(--ink)]"
  const rows = (s: string) => Math.min(14, Math.max(2, Math.ceil(s.length / 90) + (s.match(/\n/g) || []).length))
  return (
    <div className="group rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="mb-1.5 flex items-center gap-1">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--faint)]">{kindLabel(b)}</span>
        <span className="ml-auto flex items-center gap-0.5">
          <button type="button" className={tool} onClick={onUp} aria-label="Move up">
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={tool} onClick={onDown} aria-label="Move down">
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={tool} onClick={() => onAdd({ kind: "paragraph", text: "" })} aria-label="Add a paragraph below" title="Add a paragraph below">
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button type="button" className={tool} onClick={() => window.confirm("Delete this block?") && onRemove()} aria-label="Delete block">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      {b.kind === "heading" ? (
        <input className={`${input} font-semibold ${b.level === 2 ? "text-base" : ""}`} value={b.text} onChange={(e) => onChange(edited(b, { text: e.target.value }))} />
      ) : b.kind === "paragraph" ? (
        <textarea className={input} rows={rows(b.text)} value={b.text} onChange={(e) => onChange(edited(b, { text: e.target.value }))} />
      ) : b.kind === "list" ? (
        <>
          <textarea className={input} rows={Math.max(3, b.items.length + 1)} value={b.items.join("\n")} onChange={(e) => onChange(edited(b, { items: e.target.value.split("\n") }))} />
          <div className="mt-1 text-[11px] text-[var(--faint)]">One item per line. &lt;strong&gt;bold&lt;/strong&gt; and links are kept.</div>
        </>
      ) : b.kind === "faq" ? (
        <div className="space-y-2">
          {b.items.map((it, n) => (
            <div key={n} className="rounded-lg bg-[var(--chip)] p-2">
              <div className="flex gap-1">
                <input className={`${input} font-semibold`} value={it.q} placeholder="Question" onChange={(e) => onChange(edited(b, { items: b.items.map((x, k) => (k === n ? { ...x, q: e.target.value } : x)) }))} />
                <button type="button" className={tool} onClick={() => onChange(edited(b, { items: b.items.filter((_, k) => k !== n) }))} aria-label="Remove question">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <textarea className={`${input} mt-1`} rows={rows(it.a)} value={it.a} placeholder="Answer (40–60 words works best)" onChange={(e) => onChange(edited(b, { items: b.items.map((x, k) => (k === n ? { ...x, a: e.target.value } : x)) }))} />
            </div>
          ))}
          <button type="button" className={btn} onClick={() => onChange(edited(b, { items: [...b.items, { q: "", a: "" }] }))}>
            <Plus className="h-3.5 w-3.5" /> Add a question
          </button>
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--chip)] p-2 text-xs text-[var(--muted)]">
          Kept as is. Edit it in WordPress.
          <div className="blog-preview mt-1 max-h-40 overflow-hidden text-[var(--ink-2)]" dangerouslySetInnerHTML={{ __html: previewHtml(b.raw) }} />
        </div>
      )}
    </div>
  )
}

/** Block markup → safe-ish preview HTML (no scripts, styles, handlers or iframes). */
function previewHtml(markup: string): string {
  return markup
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|iframe|object|embed)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(script|style|iframe|object|embed)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "$1=$2#$2")
}

function checks({ title, slug, excerpt, blocks, keyword, image }: { title: string; slug: string; excerpt: string; blocks: Block[]; keyword: string; image: string | null }) {
  const k = keyword.toLowerCase().trim()
  const has = (s: string) => !!k && s.toLowerCase().includes(k)
  const text = blocks.map(blockText).join(" ")
  const words = text.split(/\s+/).filter(Boolean).length
  const firstPara = blocks.find((b) => b.kind === "paragraph")
  const h2s = blocks.filter((b) => b.kind === "heading" && b.level === 2).map((b) => blockText(b))
  const html = serializeBlocks(blocks)
  const internal = (html.match(/href="https?:\/\/(www\.)?nestoodle\.com[^"]*"/g) || []).length
  const kslug = k.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
  return [
    { label: "Title is 30–65 characters", ok: title.length >= 30 && title.length <= 65, tip: `It's ${title.length}.` },
    { label: "Meta description is 120–160 characters", ok: excerpt.length >= 120 && excerpt.length <= 160, tip: `It's ${excerpt.length}.` },
    ...(k
      ? [
          { label: "Keyword in the title", ok: has(title), tip: "Use it near the start." },
          { label: "Keyword in the first paragraph", ok: !!firstPara && has(blockText(firstPara)), tip: "Answer-first openings help snippets and AI overviews." },
          { label: "Keyword in a heading", ok: h2s.some(has), tip: "Work it into one H2 naturally." },
          { label: "Keyword in the URL", ok: !!kslug && slug.includes(kslug.split("-").slice(0, 3).join("-")), tip: "Short slugs with the keyword rank best." },
        ]
      : []),
    { label: "At least 900 words", ok: words >= 900, tip: `It's ${words}.` },
    { label: "FAQ section (FAQ rich results)", ok: blocks.some((b) => b.kind === "faq" && b.items.length >= 3), tip: "3–6 questions parents really ask." },
    { label: "2+ links to other Nestoodle pages", ok: internal >= 2, tip: `It has ${internal}.` },
    { label: "Featured image set", ok: !!image, tip: "Add it in WordPress; social shares need it too." },
  ]
}
