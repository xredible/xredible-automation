"use client"

// Report tables: sortable, searchable, exportable, and (where it makes sense)
// click a row to filter the whole page by it.

import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Download, ExternalLink, Filter, Search } from "lucide-react"
import type { Column, DataTable, Items, Row } from "@/lib/dashboard/types"
import { countryName, dateTime, download, flag, fmt, prettyLabel, toCsv } from "./format"
import { Card } from "./ui"
import { ShareBar } from "./charts"

const label = (t: DataTable, r: Row, c: Column) => {
  const raw = r[c.key]
  if (c.key === "k" && t.countryCodes && typeof r.code === "string") return `${flag(r.code)}  ${countryName(r.code) || prettyLabel(raw)}`
  if (c.key === "k" && t.countryCodes3 && typeof r.code === "string") return `${flag(r.code, true)}  ${countryName(r.code, true)}`
  return prettyLabel(raw)
}

function exportName(title: string) {
  return `elevating-christ-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.csv`
}

function ExportButton({ title, columns, rows }: { title: string; columns: Column[]; rows: Row[] }) {
  if (!rows.length) return null
  return (
    <button
      type="button"
      onClick={() => download(exportName(title), toCsv(columns, rows))}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[var(--muted)] hover:bg-[var(--chip)] hover:text-[var(--ink)]"
      title="Download as a spreadsheet (CSV)"
    >
      <Download className="h-3.5 w-3.5" />
      CSV
    </button>
  )
}

/** +23% in green, −12% in red ("New" counts as up). */
function ChangeCell({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="text-[var(--faint)]">—</span>
  const n = v === "new" ? 1 : Number(v)
  const tone = n > 0.005 ? "text-[var(--good)]" : n < -0.005 ? "text-[var(--bad)]" : "text-[var(--muted)]"
  return <span className={`font-medium ${tone}`}>{fmt(v, "change")}</span>
}

export function ReportTable({ t, onFilter }: { t: DataTable; onFilter?: (key: string, value: string) => void }) {
  const first = t.columns[0]
  const numeric = t.columns.slice(1)
  const barCol = t.columns.find((c) => c.bar) || numeric[0]
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [q, setQ] = useState("")
  const [all, setAll] = useState(false)
  const rows = useMemo(() => {
    let r = t.rows.filter((x) => !q || String(x[first.key] ?? "").toLowerCase().includes(q.toLowerCase()) || String(x[first.sub || ""] ?? "").toLowerCase().includes(q.toLowerCase()))
    if (sort) r = [...r].sort((a, b) => (Number(a[sort.key] ?? -Infinity) - Number(b[sort.key] ?? -Infinity) || String(a[sort.key]).localeCompare(String(b[sort.key]))) * sort.dir)
    return r
  }, [t.rows, q, sort, first])
  const max = Math.max(1, ...t.rows.map((r) => Number(r[barCol?.key] ?? 0) || 0))
  const LIMIT = 10
  const shown = all ? rows : rows.slice(0, LIMIT)
  const filterable = first.filter && onFilter

  if (t.kind === "share" && t.rows.length && t.rows.length <= 8 && barCol) {
    return (
      <Card title={t.title} sub={t.note} action={<ExportButton title={t.title} columns={t.columns} rows={t.rows} />}>
        <ShareBar parts={t.rows.map((r) => ({ label: label(t, r, first), value: Number(r[barCol.key]) || 0, display: `${fmt(r[barCol.key], barCol.format, true)} ${barCol.label.toLowerCase()}` }))} />
      </Card>
    )
  }

  const head = (c: Column, i: number) => (
    <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 text-[11.5px] font-medium text-[var(--muted)] ${i === 0 ? "text-left" : "text-right"}`}>
      {i === 0 ? (
        c.label
      ) : (
        <button type="button" className="inline-flex items-center gap-0.5 hover:text-[var(--ink)]" onClick={() => setSort((s) => (s && s.key === c.key ? { key: c.key, dir: s.dir === -1 ? 1 : -1 } : { key: c.key, dir: -1 }))}>
          {c.label}
          {sort?.key === c.key ? sort.dir === -1 ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" /> : null}
        </button>
      )}
    </th>
  )

  return (
    <Card
      pad={false}
      title={t.title}
      sub={t.note}
      action={
        <div className="flex items-center gap-1">
          <ExportButton title={t.title} columns={t.columns} rows={t.rows} />
        </div>
      }
    >
      {t.rows.length > LIMIT ? (
        <div className="px-4 pt-3 sm:px-5">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-sm focus-within:border-[var(--brand)]">
            <Search className="h-3.5 w-3.5 text-[var(--faint)]" />
            <input id={`q-${t.key}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="w-full bg-transparent text-[var(--ink)] outline-none placeholder:text-[var(--faint)]" />
          </label>
        </div>
      ) : null}
      {!t.rows.length ? (
        <div className="px-4 pb-5 pt-3 text-sm text-[var(--faint)] sm:px-5">{t.emptyNote || "Nothing to show for these dates."}</div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">{t.columns.map(head)}</tr>
            </thead>
            <tbody>
              {shown.map((r, ri) => {
                const name = label(t, r, first)
                const href = first.link ? String(r[first.link] || "") : t.link && typeof r[first.key] === "string" && String(r[first.key]).startsWith("/") ? t.link + r[first.key] : ""
                const fv = first.filterKey ? String(r[first.filterKey] ?? "") : String(r[first.key] ?? "")
                return (
                  <tr key={ri} className="group border-b border-[var(--line-soft)] last:border-0 hover:bg-[var(--hover)]">
                    <td className="relative max-w-[340px] px-3 py-2 align-middle">
                      {barCol ? <span className="absolute inset-y-1 left-0 rounded-r bg-[var(--bar)]" style={{ width: `${(Math.max(0, Number(r[barCol.key]) || 0) / max) * 100}%` }} aria-hidden /> : null}
                      <span className="relative flex min-w-0 items-center gap-2">
                        {first.thumb && r[first.thumb] ? <img onError={(e) => { e.currentTarget.style.visibility = "hidden" }} src={String(r[first.thumb])} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-8 w-12 shrink-0 rounded object-cover" /> : null}
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            {href ? (
                              <a href={href} target="_blank" rel="noreferrer" className="truncate text-[var(--ink)] hover:underline" title={name}>
                                {name || "(not set)"}
                              </a>
                            ) : (
                              <span className="truncate text-[var(--ink)]" title={name}>
                                {name || "(not set)"}
                              </span>
                            )}
                            {first.badge && r[first.badge] ? <span className="shrink-0 rounded bg-amber-100 px-1.5 py-px text-[10.5px] font-semibold capitalize text-amber-800">{String(r[first.badge])}</span> : null}
                            {filterable && fv && fv !== "(not set)" ? (
                              <button
                                type="button"
                                onClick={() => onFilter?.(first.filter as string, fv)}
                                className="shrink-0 rounded p-0.5 text-[var(--faint)] opacity-0 hover:text-[var(--brand)] focus:opacity-100 group-hover:opacity-100"
                                title={`Show only ${name}`}
                                aria-label={`Filter by ${name}`}
                              >
                                <Filter className="h-3 w-3" />
                              </button>
                            ) : null}
                          </span>
                          {first.sub && r[first.sub] ? <span className="block truncate text-[11.5px] text-[var(--faint)]">{String(r[first.sub])}</span> : null}
                        </span>
                      </span>
                    </td>
                    {numeric.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-[var(--ink-2)]">
                        {c.format === "date" && typeof r[c.key] === "string" ? dateTime(String(r[c.key])) : c.format === "change" ? <ChangeCell v={r[c.key]} /> : fmt(r[c.key], c.format)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {rows.length > LIMIT ? (
        <div className="border-t border-[var(--line-soft)] px-4 py-2 sm:px-5">
          <button type="button" onClick={() => setAll((a) => !a)} className="text-xs font-medium text-[var(--brand)] hover:underline">
            {all ? "Show fewer" : `Show all ${rows.length}`}
          </button>
        </div>
      ) : (
        <div className="h-2" />
      )}
    </Card>
  )
}

export function PostsTable({ items, color }: { items: Items; color: string }) {
  const types = useMemo(() => Array.from(new Set(items.rows.map((r) => r.type).filter(Boolean))) as string[], [items.rows])
  const [type, setType] = useState("all")
  const [sort, setSort] = useState<string>(items.sortBy || "time")
  const rows = useMemo(() => {
    const r = items.rows.filter((x) => type === "all" || x.type === type)
    return [...r].sort((a, b) => (sort === "time" ? String(b.time || "").localeCompare(String(a.time || "")) : (Number(b[sort]) || 0) - (Number(a[sort]) || 0)))
  }, [items.rows, type, sort])
  const cols = items.columns
  const exportCols: Column[] = [{ key: "title", label: "Title" }, { key: "type", label: "Type" }, { key: "time", label: "Published" }, ...cols, { key: "url", label: "Link" }]
  return (
    <Card
      pad={false}
      title={items.title}
      sub={`${rows.length} ${rows.length === 1 ? "item" : "items"}`}
      action={<ExportButton title={items.title} columns={exportCols} rows={items.rows} />}
    >
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3 sm:px-5">
        {items.typeFilter && types.length > 1 ? (
          <div className="flex flex-wrap gap-1">
            {["all", ...types].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                aria-pressed={type === t}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${type === t ? "bg-[var(--ink)] text-white ring-[var(--ink)]" : "text-[var(--muted)] ring-[var(--line)] hover:text-[var(--ink)]"}`}
              >
                {t === "all" ? "All" : t}
              </button>
            ))}
          </div>
        ) : null}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Sort by
          <select id="posts-sort" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-1.5 py-1 text-xs text-[var(--ink)]">
            <option value="time">Newest</option>
            {cols.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!rows.length ? (
        <div className="px-4 pb-5 pt-3 text-sm text-[var(--faint)] sm:px-5">Nothing published in these dates.</div>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--line)]">
                <th scope="col" className="px-3 py-2 text-left text-[11.5px] font-medium text-[var(--muted)] sm:pl-5">
                  Post
                </th>
                {cols.map((c) => (
                  <th key={c.key} scope="col" className="whitespace-nowrap px-3 py-2 text-right text-[11.5px] font-medium text-[var(--muted)]">
                    <button type="button" onClick={() => setSort(c.key)} className={`hover:text-[var(--ink)] ${sort === c.key ? "text-[var(--ink)]" : ""}`}>
                      {c.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--line-soft)] last:border-0 hover:bg-[var(--hover)]">
                  <td className="min-w-[240px] max-w-[420px] px-3 py-2.5 sm:pl-5">
                    <a href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-3">
                      {r.thumb ? (
                        <img onError={(e) => { e.currentTarget.style.visibility = "hidden" }} src={r.thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-12 w-12 shrink-0 rounded-md bg-[var(--chip)] object-cover" />
                      ) : (
                        <span className="h-12 w-12 shrink-0 rounded-md" style={{ background: color, opacity: 0.12 }} />
                      )}
                      <span className="min-w-0">
                        <span className="line-clamp-2 text-[13px] leading-snug text-[var(--ink)] hover:underline">{r.title || "Untitled"}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[var(--faint)]">
                          {r.type ? <span className="rounded bg-[var(--chip)] px-1.5 py-px font-medium text-[var(--muted)]">{r.type}</span> : null}
                          {r.privacy && r.privacy !== "public" ? <span className="rounded bg-amber-100 px-1.5 py-px font-semibold capitalize text-amber-800">{r.privacy}</span> : null}
                          {r.time ? <span>{dateTime(r.time)}</span> : null}
                          <ExternalLink className="h-3 w-3" />
                        </span>
                      </span>
                    </a>
                  </td>
                  {cols.map((c) => (
                    <td key={c.key} className={`whitespace-nowrap px-3 py-2.5 text-right tabular-nums ${sort === c.key ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-2)]"}`}>
                      {fmt(r[c.key], c.format)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="h-2" />
    </Card>
  )
}
