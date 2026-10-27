"use client"

// The printables page for workspaces other than Nestoodle (lib/printables/kinds.ts):
//   Elevating CHRIST  Sermon Notes and Bible Study Guides, English and Hindi, shown on the sermon page
//   LinkedIn Agency   Lead Magnets from the newsletters or any topic, as a link to share
//   Autopilot         a Free download for each published article, added to the article
// Make one with AI, edit it, look at the PDF, then Publish.
//
// Data: /dashboard/printables with { biz } (lib/printables/generic.ts).

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Check, Copy, ExternalLink, Eye, Loader2, Sparkles, X } from "lucide-react"
import { WORKSPACES, LANG_LABEL, sourceKey, type GRow, type GSource } from "@/lib/printables/kinds"
import { describe, fileNameFor } from "@/lib/printables/spec"
import { longDate } from "./format"
import { Card, Notice } from "./ui"
import { Editor, ListSkeleton, Pill, Stat, call } from "./printables-view"

type Toast = { tone: "ok" | "bad"; text: string } | null

const btn = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] hover:text-[var(--ink)] disabled:opacity-50"
const primary = "inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:text-[var(--bg)]"

export function GenericPrintables({ biz }: { biz: string }) {
  const ws = WORKSPACES[biz]
  const [data, setData] = useState<{ sources: GSource[]; rows: GRow[]; brand: { prefix: string; name: string } } | null>(null)
  const [topic, setTopic] = useState({ title: "", notes: "" })
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null)
  const stop = useRef(false)
  const [toast, setToast] = useState<Toast>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((tone: "ok" | "bad", text: string) => {
    setToast({ tone, text })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), tone === "ok" ? 6000 : 12000)
  }, [])

  const load = useCallback(async () => {
    const r = (await call({ op: "list", biz })) as { ok: boolean; error?: string; sources?: GSource[]; rows?: GRow[]; brand?: { prefix: string; name: string } }
    if (r.ok && r.sources) {
      setData({ sources: r.sources, rows: r.rows || [], brand: r.brand || { prefix: "Download", name: "" } })
      setError(null)
    } else setError(r.error || "The printables didn't load.")
  }, [biz])
  useEffect(() => {
    load()
  }, [load])
  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("p")
    if (k) setOpen(k)
  }, [])
  useEffect(() => {
    const u = new URL(window.location.href)
    if (open) u.searchParams.set("p", open)
    else u.searchParams.delete("p")
    window.history.replaceState(null, "", u.toString())
  }, [open])

  const rowOf = useMemo(() => new Map((data?.rows || []).map((r) => [sourceKey(r.ref, r.kind, r.lang), r])), [data])

  const draft = async (s: GSource, quiet = false) => {
    setBusy(s.key)
    const r = (await call({ op: "draft", biz, ref: s.ref, kind: s.kind, lang: s.lang })) as { ok: boolean; error?: string; done?: string }
    setBusy(null)
    if (!quiet) show(r.ok ? "ok" : "bad", r.ok ? r.done || "Draft ready." : r.error || "That didn't work.")
    return r.ok
  }
  const makeOne = async (s: GSource) => {
    if (await draft(s)) {
      await load()
      setOpen(s.key)
    }
  }
  const fromTopic = async () => {
    setBusy("topic")
    const r = (await call({ op: "draft", biz, kind: ws.kinds[0].key, lang: "en", topic })) as { ok: boolean; error?: string; done?: string; row?: GRow }
    setBusy(null)
    show(r.ok ? "ok" : "bad", r.ok ? r.done || "Draft ready." : r.error || "That didn't work.")
    if (r.ok && r.row) {
      setTopic({ title: "", notes: "" })
      await load()
      setOpen(sourceKey(r.row.ref, r.row.kind, r.row.lang))
    }
  }
  const makeAll = async (list: GSource[]) => {
    stop.current = false
    setBatch({ done: 0, total: list.length })
    let ok = 0
    for (let i = 0; i < list.length && !stop.current; i++) {
      if (await draft(list[i], true)) ok++
      setBatch({ done: i + 1, total: list.length })
      await load()
    }
    setBatch(null)
    show(ok ? "ok" : "bad", ok ? `${ok} draft${ok === 1 ? "" : "s"} ready to review.` : "No drafts were made. Try again in a minute.")
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

  if (!ws) return <Notice tone="info">Printables are not set up for this workspace yet.</Notice>
  if (error && !data) return <Notice tone="error" title="Printables didn't load">{error} Try Refresh in a minute.</Notice>
  if (!data) return <ListSkeleton />

  const kindLabel = (k: string, lang?: string) => {
    const x = ws.kinds.find((y) => y.key === k)
    return lang === "hi" ? x?.labelHi || x?.label || k : x?.label || k
  }

  if (open) {
    const s = data.sources.find((x) => x.key === open)
    const row = rowOf.get(open)
    if (s && row && row.spec) {
      return (
        <>
          <Editor
            key={`${row.id}-${row.changedAt}`}
            ctx={{
              biz,
              heading: ws.langs.length > 1 || ws.kinds.length > 1 ? `${kindLabel(s.kind)} (${LANG_LABEL[s.lang]}) · ${s.title}` : s.title,
              back: `All ${ws.sources.toLowerCase()}`,
              link: s.link,
              prefix: data.brand.prefix,
              brand: data.brand.name,
              extra: { ref: s.ref, kind: s.kind, sourceTitle: s.title, shownTitle: s.shownTitle, postLink: s.link },
              target: ws.publishTo,
              autoFile: biz === "elevating-christ" ? fileNameFor(`${kindLabel(s.kind)} ${s.title}${s.lang === "hi" ? " Hindi" : ""}`, data.brand.prefix) : undefined,
            }}
            row={row}
            onClose={() => setOpen(null)}
            onChanged={load}
            show={show}
          />
          {toast$}
        </>
      )
    }
  }

  // Sermons, newest first, each with its kinds × languages.
  const groups = new Map<string, GSource[]>()
  for (const s of data.sources) groups.set(s.ref, [...(groups.get(s.ref) || []), s])
  const list = [...groups.values()].sort((a, b) => (a[0].date < b[0].date ? 1 : -1))
  const auto = new Set(ws.kinds.filter((k) => k.auto).map((k) => k.key))
  const missing = data.sources.filter((s) => s.available && auto.has(s.kind) && !rowOf.get(s.key))
  const review = data.rows.filter((r) => r.status === "draft")
  const live = data.rows.filter((r) => r.status === "published")

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat n={list.length} label={ws.sources} />
        <Stat n={review.length} label="Drafts to review" tone={review.length ? "warn" : undefined} />
        <Stat n={missing.length} label={`${kindLabel([...auto][0] || ws.kinds[0].key)} still to make`} />
        <Stat n={live.length} label="Live on the website" />
      </div>
      <Notice tone="info">
        {ws.kinds.map((k) => `${k.label}: ${k.hint}`).join(" ")} Make one with AI from the {ws.source}&apos;s own text (Bible verses are kept only when they are word for word in the {ws.source}), edit anything, look at the PDF, then <b>Publish</b>: it shows on {ws.publishTo}.
      </Notice>
      {ws.topics ? (
        <Card title={`New ${kindLabel(ws.kinds[0].key).toLowerCase()} from a topic`} sub="Any subject you post about. The AI writes a practical checklist and guide; you edit it before it goes anywhere.">
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Topic</span>
              <input className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]" value={topic.title} maxLength={120} placeholder="e.g. Google Ads checklist for local businesses" onChange={(e) => setTopic({ ...topic, title: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wide text-[var(--muted)]">Notes (optional)</span>
              <input className="w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]" value={topic.notes} maxLength={2000} placeholder="Points you want in it, who it's for" onChange={(e) => setTopic({ ...topic, notes: e.target.value })} />
            </label>
            <button type="button" className={primary} disabled={!!busy || topic.title.trim().length < 4} onClick={fromTopic}>
              {busy === "topic" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Make it
            </button>
          </div>
        </Card>
      ) : null}
      {!list.length ? <Notice tone="info">No {ws.sources.toLowerCase()} yet{biz === "autopilot" ? ": once the Blog tool publishes an article, it shows up here" : ""}.</Notice> : null}
      {missing.length ? (
        <div className="flex flex-wrap items-center gap-2">
          {batch ? (
            <>
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--muted)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing {batch.done + 1 > batch.total ? batch.total : batch.done + 1} of {batch.total}… (about 15 seconds each)
              </span>
              <button type="button" className={btn} onClick={() => (stop.current = true)}>
                Stop after this one
              </button>
            </>
          ) : (
            <button type="button" className={primary} disabled={!!busy} onClick={() => makeAll(missing)}>
              <Sparkles className="h-3.5 w-3.5" /> Make all missing {kindLabel([...auto][0])} ({missing.length})
            </button>
          )}
        </div>
      ) : null}
      {list.map((items) => {
        const s0 = items[0]
        return (
          <Card
            key={s0.ref}
            title={s0.title}
            sub={longDate(s0.date)}
            action={
              s0.link ? (
                <a href={s0.link} target="_blank" rel="noreferrer" className={btn}>
                  <ExternalLink className="h-3.5 w-3.5" /> Page
                </a>
              ) : null
            }
          >
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((s) => {
                const r = rowOf.get(s.key)
                const changed = r && r.status === "published" && r.publishedAt && r.changedAt > r.publishedAt
                return (
                  <li key={s.key} className="rounded-lg border border-[var(--line)] p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[var(--ink)]">{kindLabel(s.kind)}</span>
                      {ws.langs.length > 1 ? <span className="rounded bg-[var(--chip)] px-1.5 py-px text-[11px] font-medium text-[var(--muted)]">{LANG_LABEL[s.lang]}</span> : null}
                      <Pill s={r ? r.status : "none"} label={r ? undefined : "Not made yet"} />
                      {changed ? <span className="text-[11px] font-medium text-amber-700">Edited since publishing</span> : null}
                    </div>
                    {r?.spec ? <p className="mt-1 text-xs text-[var(--faint)]">“{r.spec.title}” · {describe(r.spec)}{r.pages ? ` · ${r.pages} page${r.pages === 1 ? "" : "s"}` : ""}</p> : null}
                    {!s.available ? <p className="mt-1 text-xs text-[var(--faint)]">{s.note}</p> : null}
                    {r?.status === "failed" && r.error ? <p className="mt-1 text-xs text-[var(--bad)]">{r.error}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {busy === s.key ? (
                        <span className="inline-flex h-8 items-center gap-1.5 px-1 text-xs text-[var(--muted)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Writing it from the {ws.source}… (about 15 seconds)
                        </span>
                      ) : (
                        <>
                          {r?.spec ? (
                            <button type="button" className={r.status === "draft" ? primary : btn} onClick={() => setOpen(s.key)}>
                              <Eye className="h-3.5 w-3.5" /> {r.status === "draft" ? "Review" : "Open"}
                            </button>
                          ) : null}
                          {s.available ? (
                            <button
                              type="button"
                              className={r ? btn : primary}
                              disabled={!!busy || !!batch}
                              onClick={() => {
                                if (!r || window.confirm(`Write this ${kindLabel(s.kind)} again with AI? It replaces the current text${r.url ? " (the live PDF stays until you publish)" : ""}.`)) makeOne(s)
                              }}
                            >
                              <Sparkles className="h-3.5 w-3.5" /> {r ? "Redo with AI" : "Make with AI"}
                            </button>
                          ) : null}
                          {r?.url ? (
                            <>
                              <a href={r.url} target="_blank" rel="noreferrer" className={btn}>
                                <ExternalLink className="h-3.5 w-3.5" /> PDF
                              </a>
                              <button type="button" className={btn} onClick={() => navigator.clipboard?.writeText(r.url).then(() => show("ok", "Link copied."), () => show("bad", "Couldn't copy. Open the PDF and copy its address."))}>
                                <Copy className="h-3.5 w-3.5" /> Copy link
                              </button>
                            </>
                          ) : null}
                        </>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>
        )
      })}
      {toast$}
    </div>
  )
}
