"use client"

// The Printables page (Nestoodle): every article with its download, a printable draft the AI
// made from the article, an editor for every part of it, a PDF preview, and Publish, which
// uploads the PDF to WordPress and puts the download card in the article.
//
// Data: /dashboard/printables (lib/printables/*, n8n NST-PR).

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ArrowDown, ArrowLeft, ArrowUp, Check, CircleAlert, Download, ExternalLink, Eye, FileText, Loader2, Plus, Rocket, Save, Sparkles, Trash2, Undo2, X } from "lucide-react"
import { BLOCK_TYPES, cleanLinkText, describe, fileNameFor, type Block, type BlockType, type Card as CardT, type PrintablePost, type PrintableRow, type Spec } from "@/lib/printables/spec"
import { ICON_NAMES } from "@/lib/printables/icons"
import { SHAPES } from "@/lib/printables/shapes"
import { dateTime } from "./format"
import { Card, Notice, Skeleton } from "./ui"

type Result = { ok: boolean; error?: string; done?: string; fileName?: string; linkText?: string; pages?: number; result?: { mediaUrl?: string; link?: string; how?: string; oldHref?: string; deletedOld?: boolean; keptOld?: string } }
type Toast = { tone: "ok" | "bad"; text: string } | null
type ListData = { posts: PrintablePost[]; rows: PrintableRow[] }

const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] hover:text-[var(--ink)] disabled:opacity-50"
const primary = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:text-[var(--bg)]"
const input = "w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const small = "w-full rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1.5 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const lab = "mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-[var(--muted)]"
const hint = "mt-1 text-[11.5px] leading-snug text-[var(--faint)]"

async function call(body: Record<string, unknown>): Promise<Result & Partial<ListData>> {
  try {
    const r = await fetch("/dashboard/printables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    if (r.status === 401) window.location.reload()
    return (await r.json().catch(() => ({ ok: false, error: `The dashboard server answered with HTTP ${r.status}.` }))) as Result & Partial<ListData>
  } catch {
    return { ok: false, error: "No internet connection. Nothing was changed." }
  }
}

async function pdfOf(body: Record<string, unknown>): Promise<{ url: string; pages: number } | { error: string }> {
  try {
    const r = await fetch("/dashboard/printables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, op: "preview" }) })
    if (r.status === 401) window.location.reload()
    if (!r.ok || !(r.headers.get("content-type") || "").includes("pdf")) {
      const j = (await r.json().catch(() => null)) as { error?: string } | null
      return { error: j?.error || `The PDF couldn't be made (HTTP ${r.status}).` }
    }
    return { url: URL.createObjectURL(await r.blob()), pages: Number(r.headers.get("x-pages")) || 0 }
  } catch {
    return { error: "No internet connection." }
  }
}

// ---------- what's wrong with an article's current download ----------

function fileIssues(p: PrintablePost): string[] {
  const out: string[] = []
  const f = p.file
  if (!f) return p.spot ? ["No download yet: the article has an [Add download] spot waiting."] : ["No download in the article yet."]
  if (/\.html?$/i.test(f.name)) out.push("It's a web page file (.html), not a PDF.")
  if (/claude/i.test(f.name) || /claude/i.test(f.text)) out.push("“Claude” is in the file name or link text.")
  if (/[[\]]/.test(f.text)) out.push("The link text has [brackets].")
  if (/^nestoodle\s*[-–]/i.test(f.text)) out.push("The link text starts with “Nestoodle -”.")
  if (/^(1st|2nd|copy|final|draft)/i.test(f.name) || /printable-printable|design\.pdf$/i.test(f.name)) out.push("The file name looks like a working file.")
  return out
}

const STATUS: Record<string, { label: string; cls: string }> = {
  none: { label: "No printable draft", cls: "bg-slate-100 text-slate-600 ring-slate-500/20" },
  drafting: { label: "Drafting…", cls: "bg-sky-50 text-sky-800 ring-sky-600/20" },
  draft: { label: "Draft to review", cls: "bg-amber-50 text-amber-800 ring-amber-600/25" },
  published: { label: "Published", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  failed: { label: "Needs attention", cls: "bg-red-50 text-red-700 ring-red-600/20" },
  publish: { label: "Live", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  future: { label: "Scheduled", cls: "bg-violet-50 text-violet-700 ring-violet-600/20" },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-800 ring-amber-600/25" },
  private: { label: "Private", cls: "bg-slate-100 text-slate-600 ring-slate-500/20" },
}
const Pill = ({ s, label }: { s: string; label?: string }) => {
  const m = STATUS[s] || { label: s, cls: "bg-slate-100 text-slate-600 ring-slate-500/20" }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${m.cls}`}>{label || m.label}</span>
}
const postPill = (s: string) => (s === "draft" ? <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/20">Article draft</span> : <Pill s={s} />)

// ---------- the page ----------

export function PrintablesView() {
  const [data, setData] = useState<ListData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((tone: "ok" | "bad", text: string) => {
    setToast({ tone, text })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), tone === "ok" ? 6000 : 12000)
  }, [])

  const load = useCallback(async () => {
    const r = await call({ op: "list" })
    if (r.ok && r.posts) {
      setData({ posts: r.posts, rows: r.rows || [] })
      setError(null)
    } else setError(r.error || "The printables didn't load.")
  }, [])
  useEffect(() => {
    load()
  }, [load])
  // While a draft is being written, check again every few seconds.
  const drafting = !!data?.rows.some((r) => r.status === "drafting")
  useEffect(() => {
    if (!drafting) return
    const t = setInterval(load, 7000)
    return () => clearInterval(t)
  }, [drafting, load])

  useEffect(() => {
    const id = Number(new URLSearchParams(window.location.search).get("post"))
    if (id) setOpen(id)
  }, [])
  useEffect(() => {
    const u = new URL(window.location.href)
    if (open) u.searchParams.set("post", String(open))
    else u.searchParams.delete("post")
    window.history.replaceState(null, "", u.toString())
  }, [open])

  const draft = async (postId: number) => {
    setBusy(`d${postId}`)
    const r = await call({ op: "draft", postId })
    setBusy(null)
    show(r.ok ? "ok" : "bad", r.ok ? r.done || "Drafting it now." : r.error || "That didn't start.")
    if (r.ok) load()
  }

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

  if (error && !data) return <Notice tone="error" title="Printables didn't load">{error} Try Refresh in a minute.</Notice>
  if (!data) return <ListSkeleton />

  const rowOf = new Map(data.rows.map((r) => [r.postId, r]))
  if (open) {
    const post = data.posts.find((p) => p.id === open)
    const row = rowOf.get(open)
    if (post && row && row.spec && row.status !== "drafting") {
      return (
        <>
          <Editor key={`${row.id}-${row.changedAt}`} post={post} row={row} onClose={() => setOpen(null)} onChanged={load} show={show} />
          {toast$}
        </>
      )
    }
  }

  const posts = data.posts
  const review = posts.filter((p) => rowOf.get(p.id)?.status === "draft")
  const needs = posts.filter((p) => !rowOf.get(p.id) || rowOf.get(p.id)!.status === "failed")
  const done = posts.filter((p) => rowOf.get(p.id)?.status === "published")

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={review.length} label="Drafts to review" tone={review.length ? "warn" : undefined} />
        <Stat n={needs.length} label="Need a printable" />
        <Stat n={data.rows.filter((r) => r.status === "drafting").length} label="Being drafted" />
        <Stat n={done.length} label="Published" />
      </div>
      <Notice tone="info">
        Every new article gets a printable draft each morning (08:17). Review it, change anything, look at the PDF, then <b>Publish</b>: the PDF is uploaded to WordPress and the download in the article is switched to it, with the right file name and link text.
      </Notice>
      <Card title="Articles" sub="Newest first. The current download is shown under each article, with anything that needs fixing.">
        <ul className="divide-y divide-[var(--line-soft)]">
          {posts.map((p) => {
            const r = rowOf.get(p.id)
            const issues = fileIssues(p)
            const ok = r?.status === "published" && p.file && r.mediaUrl && p.file.href === r.mediaUrl
            return (
              <li key={p.id} className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {postPill(p.status)}
                    <Pill s={r ? r.status : "none"} />
                    {r?.status === "draft" && r.source === "auto" ? <span className="text-[11px] font-medium text-[var(--brand)]">Drafted automatically</span> : null}
                  </div>
                  <a href={p.link} target="_blank" rel="noreferrer" className="mt-1 block text-sm font-semibold leading-snug text-[var(--ink)] hover:underline">
                    {p.title}
                  </a>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {p.file ? (
                      <>
                        <FileText className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
                        <a href={p.file.href} target="_blank" rel="noreferrer" className="hover:underline">
                          {p.file.name}
                        </a>
                        {p.file.text ? <span className="text-[var(--faint)]"> · “{p.file.text}”</span> : null}
                      </>
                    ) : null}
                  </div>
                  {!ok && issues.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-amber-700 dark:text-amber-400">
                      {issues.map((i) => (
                        <li key={i}>
                          <CircleAlert className="mr-1 inline h-3 w-3 align-[-1px]" />
                          {i}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {r?.status === "failed" && r.error ? <p className="mt-1 text-xs text-[var(--bad)]">{r.error}</p> : null}
                  {r?.status === "draft" && r.spec ? <p className="mt-1 text-xs text-[var(--faint)]">Draft: “{r.spec.title}” · {describe(r.spec)}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-1.5">
                  {r?.status === "drafting" ? (
                    <span className="inline-flex h-8 items-center gap-1.5 px-1 text-xs text-[var(--muted)]">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Drafting from the article…
                    </span>
                  ) : r?.spec && r.status !== "failed" ? (
                    <button type="button" className={r.status === "draft" ? primary : btn} onClick={() => setOpen(p.id)}>
                      <Eye className="h-3.5 w-3.5" /> {r.status === "draft" ? "Review" : "Open"}
                    </button>
                  ) : null}
                  {r?.status !== "drafting" ? (
                    <button
                      type="button"
                      className={r ? btn : primary}
                      disabled={!!busy}
                      onClick={() => {
                        if (!r || window.confirm("Make a new printable draft from the article? It replaces the current draft (the live download stays until you publish).")) draft(p.id)
                      }}
                    >
                      {busy === `d${p.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {r ? "Redo with AI" : "Make printable"}
                    </button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
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

function ListSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[70px]" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  )
}

// ---------- the editor ----------

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean)
const join = (a?: string[]) => (a || []).join("\n")

function newBlock(type: BlockType): Block {
  switch (type) {
    case "section":
      return { type, title: "New section" }
    case "cards":
      return { type, columns: 2, cards: [{ title: "New card" }] }
    case "checklist":
      return { type, title: "Checklist", items: ["First thing"] }
    case "chart":
      return { type, title: "Weekly chart", columns: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], rows: [{ label: "First task" }] }
    case "planner":
      return { type, title: "Weekly plan", columns: ["Activity", "What you need"], rows: ["Mon", "Tue", "Wed", "Thu", "Fri"] }
    case "steps":
      return { type, title: "How to do it", steps: ["First step"] }
    case "table":
      return { type, head: ["If you need…", "Try…"], rows: [["", ""]] }
    case "lines":
      return { type, title: "Write it down", prompts: ["Your prompt"], lines: 2 }
    case "list":
      return { type, title: "", items: ["First point"] }
    case "tip":
      return { type, text: "Your tip" }
    case "shapes":
      return { type, title: "Templates", size: "medium", shapes: [{ shape: "star" }] }
    case "pagebreak":
      return { type }
  }
}

function Editor({ post, row, onClose, onChanged, show }: { post: PrintablePost; row: PrintableRow; onClose: () => void; onChanged: () => void; show: (t: "ok" | "bad", s: string) => void }) {
  const [spec, setSpec] = useState<Spec>(row.spec!)
  const [linkText, setLinkText] = useState(row.linkText || cleanLinkText(row.spec!.title))
  const [fileName, setFileName] = useState(row.fileName || fileNameFor(row.spec!.title))
  const [autoName, setAutoName] = useState(!row.fileName || row.fileName === fileNameFor(row.spec!.title))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ url: string; pages: number } | null>(null)
  const [stale, setStale] = useState(true)
  const [confirm, setConfirm] = useState(false)
  const [deleteOld, setDeleteOld] = useState(true)
  const [result, setResult] = useState<Result["result"] | null>(null)

  useEffect(() => () => (preview ? URL.revokeObjectURL(preview.url) : undefined), [preview])
  const edit = (next: Spec) => {
    setSpec(next)
    setDirty(true)
    setStale(true)
    if (autoName) setFileName(fileNameFor(next.title))
  }
  const setBlock = (i: number, b: Block) => edit({ ...spec, blocks: spec.blocks.map((x, j) => (j === i ? b : x)) })
  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= spec.blocks.length) return
    const b = [...spec.blocks]
    ;[b[i], b[j]] = [b[j], b[i]]
    edit({ ...spec, blocks: b })
  }
  const body = { id: row.id, postId: post.id, spec, fileName, linkText, postTitle: post.title, postLink: post.link }

  const save = async () => {
    setBusy("save")
    const r = await call({ op: "save", ...body })
    setBusy(null)
    if (r.ok) {
      setDirty(false)
      if (r.fileName) setFileName(r.fileName)
      if (r.linkText) setLinkText(r.linkText)
    }
    show(r.ok ? "ok" : "bad", r.ok ? "Saved." : r.error || "That didn't save.")
  }
  const look = async () => {
    setBusy("preview")
    const r = await pdfOf(body)
    setBusy(null)
    if ("error" in r) return show("bad", r.error)
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(r)
    setStale(false)
  }
  const publish = async () => {
    setConfirm(false)
    setBusy("publish")
    const r = await call({ op: "publish", ...body, deleteOld })
    setBusy(null)
    if (!r.ok) return show("bad", r.error || "Publishing didn't work.")
    setDirty(false)
    setResult(r.result || {})
    show("ok", r.done || "Published.")
    onChanged()
  }
  const discard = async () => {
    if (!window.confirm("Remove this printable draft? The article's current download stays as it is.")) return
    setBusy("discard")
    const r = await call({ op: "discard", id: row.id })
    setBusy(null)
    show(r.ok ? "ok" : "bad", r.ok ? r.done || "Removed." : r.error || "That didn't work.")
    if (r.ok) {
      onChanged()
      onClose()
    }
  }

  const issues = fileIssues(post)
  const replaces = post.file ? post.file.name : post.spot ? "the [Add download] spot" : "a new download card in the Free printable section"

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={btn} onClick={() => (!dirty || window.confirm("Leave without saving your changes?") ? onClose() : null)}>
          <ArrowLeft className="h-3.5 w-3.5" /> All articles
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--ink)]">{post.title}</div>
        <Pill s={row.status} />
      </div>

      {result ? (
        <Notice tone="info" title="Published">
          <span className="block">
            The article now offers <b>{fileName}</b> with the link text “{linkText}” ({result.how || "placed"}).
          </span>
          <span className="mt-1 flex flex-wrap gap-3">
            {result.link ? (
              <a className="font-semibold underline" href={result.link} target="_blank" rel="noreferrer">
                Open the article
              </a>
            ) : null}
            {result.mediaUrl ? (
              <a className="font-semibold underline" href={result.mediaUrl} target="_blank" rel="noreferrer">
                Open the PDF
              </a>
            ) : null}
          </span>
          {result.oldHref ? <span className="mt-1 block text-xs">{result.deletedOld ? `The old file (${result.oldHref.split("/").pop()}) was deleted from Media.` : `The old file (${result.oldHref.split("/").pop()}) is still in Media${result.keptOld ? `: ${result.keptOld}` : ""}.`}</span> : null}
          <span className="mt-1 block text-xs">Purge LiteSpeed (Toolbox → Purge All) if the article still shows the old download.</span>
        </Notice>
      ) : null}
      {row.status === "failed" && row.error ? <Notice tone="error">{row.error}</Notice> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="space-y-4">
          <Card title="Download in the article" sub="What parents see and what their file is called.">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={lab}>Link text</span>
                <input className={input} value={linkText} maxLength={90} onChange={(e) => (setLinkText(e.target.value), setDirty(true))} />
                <span className={hint}>Shown as the card title. No “Free” or “Nestoodle” (the card already says both).</span>
              </label>
              <label className="block">
                <span className={lab}>File name</span>
                <input
                  className={input}
                  value={fileName}
                  onChange={(e) => {
                    setFileName(e.target.value)
                    setAutoName(false)
                    setDirty(true)
                  }}
                  onBlur={() => setFileName(fileNameFor(fileName.replace(/\.pdf$/i, "")) === fileName ? fileName : /^Nestoodle-[A-Za-z0-9-]+\.pdf$/.test(fileName) ? fileName : fileNameFor(fileName.replace(/\.pdf$/i, "")))}
                />
                <span className={hint}>
                  {autoName ? "Follows the title. " : ""}Pattern: Nestoodle-Name-Of-Printable.pdf
                  {!autoName ? (
                    <button type="button" className="ml-1 underline" onClick={() => (setAutoName(true), setFileName(fileNameFor(spec.title)))}>
                      Use the title
                    </button>
                  ) : null}
                </span>
              </label>
            </div>
            <dl className="mt-3 grid gap-x-4 gap-y-1 rounded-lg bg-[var(--chip)] p-3 text-xs sm:grid-cols-[auto_1fr]">
              <dt className="font-semibold text-[var(--muted)]">Article</dt>
              <dd className="min-w-0 truncate">
                <a href={post.link} target="_blank" rel="noreferrer" className="hover:underline">
                  {post.title}
                </a>
              </dd>
              <dt className="font-semibold text-[var(--muted)]">Replaces</dt>
              <dd className="min-w-0 break-all">{replaces}</dd>
              {issues.length && post.file ? (
                <>
                  <dt className="font-semibold text-[var(--muted)]">Now</dt>
                  <dd className="text-amber-700 dark:text-amber-400">{issues.join(" ")}</dd>
                </>
              ) : null}
            </dl>
          </Card>

          <Card title="Page 1" sub="The logo and colors are added automatically.">
            <div className="space-y-3">
              <label className="block">
                <span className={lab}>Title</span>
                <input className={input} value={spec.title} maxLength={90} onChange={(e) => edit({ ...spec, title: e.target.value })} />
              </label>
              <label className="block">
                <span className={lab}>Subtitle</span>
                <input className={input} value={spec.subtitle || ""} maxLength={160} onChange={(e) => edit({ ...spec, subtitle: e.target.value })} />
              </label>
              <label className="block">
                <span className={lab}>Intro</span>
                <textarea className={input} rows={2} value={spec.intro || ""} maxLength={700} onChange={(e) => edit({ ...spec, intro: e.target.value })} />
              </label>
              <label className="block">
                <span className={lab}>Labels under the title</span>
                <input className={input} value={(spec.chips || []).join(", ")} onChange={(e) => edit({ ...spec, chips: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                <span className={hint}>Separate with commas, e.g. Ages 3–8, 12 crafts, Paper only</span>
              </label>
            </div>
          </Card>

          {spec.blocks.map((b, i) => (
            <BlockCard key={i} b={b} i={i} n={spec.blocks.length} onChange={(x) => setBlock(i, x)} onMove={(d) => move(i, d)} onDelete={() => edit({ ...spec, blocks: spec.blocks.filter((_, j) => j !== i) })} />
          ))}
          <AddBlock onAdd={(t) => edit({ ...spec, blocks: [...spec.blocks, newBlock(t)] })} />
        </div>

        <div className="space-y-3 xl:sticky xl:top-4 xl:self-start">
          <Card title="PDF" sub={preview ? `${preview.pages} page${preview.pages === 1 ? "" : "s"} · Letter, prints on A4 too` : "Letter size, prints on A4 too."}>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={btn} disabled={!!busy} onClick={look}>
                {busy === "preview" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />} {preview ? (stale ? "Update preview" : "Preview") : "Preview"}
              </button>
              {preview ? (
                <>
                  <a className={btn} href={preview.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open
                  </a>
                  <a className={btn} href={preview.url} download={fileName}>
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </>
              ) : null}
            </div>
            {preview ? (
              <div className="relative mt-3">
                {stale ? <div className="absolute inset-x-0 top-0 z-10 rounded-t-lg bg-amber-50 px-3 py-1.5 text-[11.5px] text-amber-800">You changed something: press Update preview.</div> : null}
                <iframe title="Printable preview" src={`${preview.url}#view=FitH`} className="hidden h-[70vh] w-full rounded-lg border border-[var(--line)] bg-white sm:block" />
                <p className="text-xs text-[var(--muted)] sm:hidden">Tap Open to see the PDF.</p>
              </div>
            ) : (
              <p className="mt-3 text-xs text-[var(--faint)]">Press Preview to see the pages exactly as parents will print them.</p>
            )}
          </Card>
          <Card>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" className={btn} disabled={!!busy || !dirty} onClick={save}>
                {busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} {dirty ? "Save draft" : "Saved"}
              </button>
              <button type="button" className={primary} disabled={!!busy} onClick={() => setConfirm(true)}>
                {busy === "publish" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />} Publish to the article
              </button>
              <button type="button" className={btn} disabled={!!busy} onClick={discard} title="Remove this printable draft">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            {confirm ? (
              <div className="mt-3 space-y-2 rounded-lg border border-[var(--line)] p-3 text-sm">
                <p className="font-semibold text-[var(--ink)]">Publish this printable?</p>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-[var(--ink-2)]">
                  <li>
                    Uploads <b>{fileName}</b> to WordPress Media.
                  </li>
                  <li>
                    In “{post.title}”, the download {post.file ? <>replaces <b>{post.file.name}</b></> : <>goes to {replaces}</>} with the link text “{cleanLinkText(linkText) || spec.title}”.
                  </li>
                  <li>Your edits are saved first.</li>
                </ul>
                {post.file ? (
                  <label className="flex items-start gap-2 text-xs text-[var(--ink-2)]">
                    <input type="checkbox" className="mt-0.5" checked={deleteOld} onChange={(e) => setDeleteOld(e.target.checked)} />
                    <span>Delete the old file from Media (only if no other article uses it).</span>
                  </label>
                ) : null}
                <div className="flex gap-1.5">
                  <button type="button" className={primary} onClick={publish}>
                    <Rocket className="h-3.5 w-3.5" /> Publish now
                  </button>
                  <button type="button" className={btn} onClick={() => setConfirm(false)}>
                    <Undo2 className="h-3.5 w-3.5" /> Not yet
                  </button>
                </div>
              </div>
            ) : null}
            {row.publishedAt ? <p className="mt-2 text-xs text-[var(--faint)]">Last published {dateTime(row.publishedAt)}.</p> : null}
          </Card>
        </div>
      </div>
    </div>
  )
}

function AddBlock({ onAdd }: { onAdd: (t: BlockType) => void }) {
  const [t, setT] = useState<BlockType>("cards")
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] p-3">
      <select className={`${small} w-auto`} value={t} onChange={(e) => setT(e.target.value as BlockType)} aria-label="Block to add">
        {BLOCK_TYPES.map((b) => (
          <option key={b.type} value={b.type}>
            {b.label}
          </option>
        ))}
      </select>
      <button type="button" className={btn} onClick={() => onAdd(t)}>
        <Plus className="h-3.5 w-3.5" /> Add block
      </button>
      <span className="text-[11.5px] text-[var(--faint)]">{BLOCK_TYPES.find((b) => b.type === t)?.hint}</span>
    </div>
  )
}

function IconPick({ value, onChange }: { value?: string; onChange: (v?: string) => void }) {
  return (
    <select className={small} value={value || ""} onChange={(e) => onChange(e.target.value || undefined)} aria-label="Icon">
      <option value="">No icon (number)</option>
      {ICON_NAMES.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  )
}

function Field({ label: l, children, help }: { label: string; children: ReactNode; help?: string }) {
  return (
    <label className="block">
      <span className={lab}>{l}</span>
      {children}
      {help ? <span className={hint}>{help}</span> : null}
    </label>
  )
}

/** A textarea for "one per line" lists that only turns the text into a list when you leave it. */
function LinesInput({ value, onChange, rows = 4, placeholder }: { value: string[]; onChange: (v: string[]) => void; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(join(value))
  const last = useRef(join(value))
  useEffect(() => {
    const j = join(value)
    if (j !== last.current) {
      last.current = j
      setText(j)
    }
  }, [value])
  return (
    <textarea
      className={small}
      rows={rows}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        setText(e.target.value)
        last.current = join(lines(e.target.value))
        onChange(lines(e.target.value))
      }}
    />
  )
}

function BlockCard({ b, i, n, onChange, onMove, onDelete }: { b: Block; i: number; n: number; onChange: (b: Block) => void; onMove: (d: -1 | 1) => void; onDelete: () => void }) {
  const meta = BLOCK_TYPES.find((t) => t.type === b.type)!
  const head = (
    <div className="flex items-center gap-1">
      <button type="button" className="rounded p-1 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" disabled={i === 0} onClick={() => onMove(-1)} aria-label="Move up">
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded p-1 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" disabled={i === n - 1} onClick={() => onMove(1)} aria-label="Move down">
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
      <button type="button" className="rounded p-1 text-[var(--faint)] hover:text-[var(--bad)]" onClick={() => window.confirm(`Remove this ${meta.label.toLowerCase()}?`) && onDelete()} aria-label="Remove">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
  const title =
    b.type !== "cards" && b.type !== "tip" && b.type !== "pagebreak" ? (
      <Field label={b.type === "section" ? "Heading" : "Small heading (optional)"}>
        <input className={small} value={("title" in b && b.title) || ""} onChange={(e) => onChange({ ...b, title: e.target.value } as Block)} />
      </Field>
    ) : null

  let fields: ReactNode = null
  switch (b.type) {
    case "section":
      fields = (
        <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
          <Field label="Intro (optional)">
            <textarea className={small} rows={2} value={b.text || ""} onChange={(e) => onChange({ ...b, text: e.target.value })} />
          </Field>
          <div className="space-y-2">
            <Field label="Icon">
              <IconPick value={b.icon} onChange={(icon) => onChange({ ...b, icon })} />
            </Field>
            <label className="flex items-center gap-2 text-xs text-[var(--ink-2)]">
              <input type="checkbox" checked={!!b.newPage} onChange={(e) => onChange({ ...b, newPage: e.target.checked || undefined })} /> Start on a new page
            </label>
          </div>
        </div>
      )
      break
    case "cards":
      fields = (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--ink-2)]">
            <label className="flex items-center gap-1.5">
              Cards per row
              <select className={`${small} w-auto`} value={b.columns || 2} onChange={(e) => onChange({ ...b, columns: Number(e.target.value) as 1 | 2 | 3 })}>
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!!b.cut} onChange={(e) => onChange({ ...b, cut: e.target.checked || undefined })} /> Cut-out cards (dashed lines)
            </label>
          </div>
          {b.cards.map((c, k) => (
            <CardEditor
              key={k}
              c={c}
              k={k}
              n={b.cards.length}
              onChange={(x) => onChange({ ...b, cards: b.cards.map((y, j) => (j === k ? x : y)) })}
              onMove={(d) => {
                const j = k + d
                if (j < 0 || j >= b.cards.length) return
                const cs = [...b.cards]
                ;[cs[k], cs[j]] = [cs[j], cs[k]]
                onChange({ ...b, cards: cs })
              }}
              onDelete={() => onChange({ ...b, cards: b.cards.filter((_, j) => j !== k) })}
            />
          ))}
          <button type="button" className={btn} onClick={() => onChange({ ...b, cards: [...b.cards, { title: "New card" }] })}>
            <Plus className="h-3.5 w-3.5" /> Add card
          </button>
        </div>
      )
      break
    case "checklist":
    case "list":
      fields = (
        <div className="space-y-2">
          {title}
          <Field label="Items, one per line" help="Use **Label:** for a bold start.">
            <LinesInput value={b.items} onChange={(items) => onChange({ ...b, items })} rows={Math.min(10, Math.max(3, b.items.length + 1))} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-[var(--ink-2)]">
            <input type="checkbox" checked={(b.columns || 1) === 2} onChange={(e) => onChange({ ...b, columns: e.target.checked ? 2 : 1 })} /> Two columns
          </label>
        </div>
      )
      break
    case "chart":
      fields = (
        <div className="space-y-2">
          {title}
          <Field label="Columns" help="Separated by commas, e.g. Mon, Tue, Wed, Thu, Fri, Sat, Sun">
            <input className={small} value={b.columns.join(", ")} onChange={(e) => onChange({ ...b, columns: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Rows, one per line" help="Add an icon after a bar, e.g. Brush teeth | smile">
            <LinesInput
              value={b.rows.map((r) => (r.icon ? `${r.label} | ${r.icon}` : r.label))}
              onChange={(v) => onChange({ ...b, rows: v.map((s) => ({ label: s.split("|")[0].trim(), icon: (s.split("|")[1] || "").trim() || undefined })) })}
              rows={Math.min(12, Math.max(3, b.rows.length + 1))}
            />
          </Field>
        </div>
      )
      break
    case "planner":
      fields = (
        <div className="space-y-2">
          {title}
          <Field label="Columns" help="Separated by commas">
            <input className={small} value={b.columns.join(", ")} onChange={(e) => onChange({ ...b, columns: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Rows, one per line">
            <LinesInput value={b.rows} onChange={(rows) => onChange({ ...b, rows })} rows={Math.min(10, Math.max(3, b.rows.length + 1))} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-[var(--ink-2)]">
            <input type="checkbox" checked={!!b.tall} onChange={(e) => onChange({ ...b, tall: e.target.checked || undefined })} /> Tall rows (more room to write)
          </label>
        </div>
      )
      break
    case "steps":
      fields = (
        <div className="space-y-2">
          {title}
          <Field label="Steps, one per line">
            <LinesInput value={b.steps} onChange={(steps) => onChange({ ...b, steps })} rows={Math.min(10, Math.max(3, b.steps.length + 1))} />
          </Field>
        </div>
      )
      break
    case "table":
      fields = (
        <div className="space-y-2">
          {title}
          <Field label="Heading row" help="Columns separated by |">
            <input className={small} value={b.head.join(" | ")} onChange={(e) => onChange({ ...b, head: e.target.value.split("|").map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Rows, one per line" help="Columns separated by |">
            <LinesInput value={b.rows.map((r) => r.join(" | "))} onChange={(v) => onChange({ ...b, rows: v.map((s) => s.split("|").map((x) => x.trim())) })} rows={Math.min(12, Math.max(3, b.rows.length + 1))} />
          </Field>
        </div>
      )
      break
    case "lines":
      fields = (
        <div className="space-y-2">
          {title}
          <Field label="Prompts, one per line">
            <LinesInput value={b.prompts} onChange={(prompts) => onChange({ ...b, prompts })} rows={Math.min(10, Math.max(3, b.prompts.length + 1))} />
          </Field>
          <label className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]">
            Writing lines under each
            <input type="number" min={1} max={8} className={`${small} w-16`} value={b.lines || 2} onChange={(e) => onChange({ ...b, lines: Math.min(8, Math.max(1, Number(e.target.value) || 2)) })} />
          </label>
        </div>
      )
      break
    case "tip":
      fields = (
        <div className="space-y-2">
          <Field label="Label (optional)" help="Defaults to “Tip:”">
            <input className={small} value={b.title || ""} onChange={(e) => onChange({ ...b, title: e.target.value })} />
          </Field>
          <Field label="Text">
            <textarea className={small} rows={2} value={b.text} onChange={(e) => onChange({ ...b, text: e.target.value })} />
          </Field>
        </div>
      )
      break
    case "shapes":
      fields = (
        <div className="space-y-2">
          {title}
          <Field label="Shapes, one per line" help={`Shape | label. Shapes: ${Object.keys(SHAPES).join(", ")}`}>
            <LinesInput value={b.shapes.map((s) => (s.label ? `${s.shape} | ${s.label}` : s.shape))} onChange={(v) => onChange({ ...b, shapes: v.map((s) => ({ shape: s.split("|")[0].trim().toLowerCase(), label: (s.split("|")[1] || "").trim() || undefined })) })} rows={Math.min(8, Math.max(3, b.shapes.length + 1))} />
          </Field>
          <label className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]">
            Size
            <select className={`${small} w-auto`} value={b.size || "medium"} onChange={(e) => onChange({ ...b, size: e.target.value as "small" | "medium" | "large" })}>
              <option value="small">Small (4 per row)</option>
              <option value="medium">Medium (3 per row)</option>
              <option value="large">Large (2 per row)</option>
            </select>
          </label>
        </div>
      )
      break
    case "pagebreak":
      fields = <p className="text-xs text-[var(--faint)]">What follows starts on a new page.</p>
      break
  }

  return (
    <Card title={meta.label} sub={b.type === "section" ? undefined : meta.hint} action={head}>
      {b.type === "section" ? <div className="space-y-2">{title}{fields}</div> : fields}
    </Card>
  )
}

function CardEditor({ c, k, n, onChange, onMove, onDelete }: { c: CardT; k: number; n: number; onChange: (c: CardT) => void; onMove: (d: -1 | 1) => void; onDelete: () => void }) {
  const [openMore, setOpenMore] = useState(!!(c.list?.length || c.tip))
  const summary = useMemo(() => [c.meta?.join(" · "), c.list?.length ? `${c.list.length} ${c.numbered ? "steps" : "items"}` : "", c.tip ? "tip" : ""].filter(Boolean).join(" · "), [c])
  return (
    <div className="rounded-lg border border-[var(--line)] bg-[var(--hover)] p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[10px] font-bold text-white dark:text-[var(--bg)]">{k + 1}</span>
        <input className={`${small} font-semibold`} value={c.title} onChange={(e) => onChange({ ...c, title: e.target.value })} aria-label="Card title" />
        <button type="button" className="rounded p-1 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" disabled={k === 0} onClick={() => onMove(-1)} aria-label="Move card up">
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded p-1 text-[var(--faint)] hover:text-[var(--ink)] disabled:opacity-30" disabled={k === n - 1} onClick={() => onMove(1)} aria-label="Move card down">
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="rounded p-1 text-[var(--faint)] hover:text-[var(--bad)]" onClick={() => window.confirm("Remove this card?") && onDelete()} aria-label="Remove card">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <Field label="Labels" help="Commas: Ages 3–6, 10 min, Low mess">
          <input className={small} value={(c.meta || []).join(", ")} onChange={(e) => onChange({ ...c, meta: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
        </Field>
        <Field label="Icon">
          <IconPick value={c.icon} onChange={(icon) => onChange({ ...c, icon })} />
        </Field>
      </div>
      <div className="mt-2">
        <Field label="Text">
          <textarea className={small} rows={2} value={c.text || ""} onChange={(e) => onChange({ ...c, text: e.target.value })} />
        </Field>
      </div>
      {openMore ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <Field label="List, one per line">
              <LinesInput value={c.list || []} onChange={(list) => onChange({ ...c, list })} rows={4} />
            </Field>
            <label className="mt-1 flex items-center gap-2 text-xs text-[var(--ink-2)]">
              <input type="checkbox" checked={!!c.numbered} onChange={(e) => onChange({ ...c, numbered: e.target.checked || undefined })} /> Numbered steps
            </label>
          </div>
          <Field label="Tip">
            <textarea className={small} rows={4} value={c.tip || ""} onChange={(e) => onChange({ ...c, tip: e.target.value })} />
          </Field>
        </div>
      ) : (
        <button type="button" className="mt-2 text-xs font-medium text-[var(--brand)] hover:underline" onClick={() => setOpenMore(true)}>
          + List and tip{summary ? ` (${summary})` : ""}
        </button>
      )}
    </div>
  )
}
