"use client"

// "Rewrite with AI" menu for a draft. Asks the server for a suggestion (in the customer's own voice)
// and hands it back to the editor; nothing is saved until they press Save.

import { useState } from "react"
import { Wand2 } from "lucide-react"
import { field, ghost } from "./ui"

const OPTIONS: [string, string][] = [
  ["hook", "Stronger first line"],
  ["shorter", "Shorter"],
  ["longer", "Longer, more useful"],
  ["friendly", "Warmer tone"],
  ["formal", "More professional"],
  ["cta", "Add a call to action"],
  ["emoji", "Add a few emojis"],
  ["hinglish", "Hinglish"],
  ["hindi", "Hindi"],
  ["english", "English"],
  ["custom", "Something else…"],
]

export function RewriteMenu({ endpoint, id, text, title, onResult }: { endpoint: string; id: number; text: string; title?: string; onResult: (r: { text: string; title?: string }) => void }) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState("")
  const [busy, setBusy] = useState("")
  const [err, setErr] = useState("")
  const run = async (how: string) => {
    if (how === "custom" && custom.trim().length < 3) return setErr("Say how to change it.")
    setBusy(how)
    setErr("")
    try {
      const r = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "rewrite", id, how, custom, text, ...(title !== undefined ? { title } : {}) }) })
      const b = (await r.json()) as { ok: boolean; error?: string; rewrite?: { text: string; title?: string } }
      if (!b.ok || !b.rewrite) setErr(b.error || "Couldn't rewrite it. Try again.")
      else {
        onResult(b.rewrite)
        setOpen(false)
      }
    } catch {
      setErr("No connection. Try again.")
    }
    setBusy("")
  }
  return (
    <div className="relative inline-block">
      <button type="button" className={ghost} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Wand2 className="h-3.5 w-3.5" /> Rewrite
      </button>
      {open ? (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-2 shadow-lg">
          <div className="px-2 pb-1 pt-0.5 text-[11px] text-[var(--faint)]">Uses your own edits to match how you write.</div>
          {OPTIONS.filter(([k]) => k !== "custom").map(([k, label]) => (
            <button key={k} type="button" disabled={!!busy} onClick={() => run(k)} className="block w-full rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-[var(--soft)] disabled:opacity-50">
              {busy === k ? "Rewriting…" : label}
            </button>
          ))}
          <div className="mt-1 border-t border-[var(--line)] pt-2">
            <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. mention our Diwali sale" maxLength={300} className={field + " mt-0 text-[13px]"} onKeyDown={(e) => e.key === "Enter" && run("custom")} />
            <button type="button" disabled={!!busy} onClick={() => run("custom")} className="mt-1.5 w-full rounded-lg bg-[var(--soft)] px-2 py-1.5 text-[13px] font-medium disabled:opacity-50">
              {busy === "custom" ? "Rewriting…" : "Rewrite"}
            </button>
          </div>
          {err ? <div className="px-2 pt-1.5 text-[12px] text-[var(--bad)]">{err}</div> : null}
          {busy ? <div className="px-2 pt-1 text-[11px] text-[var(--faint)]">This takes 5–20 seconds.</div> : null}
        </div>
      ) : null}
    </div>
  )
}
