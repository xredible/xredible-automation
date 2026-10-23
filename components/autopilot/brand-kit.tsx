"use client"

// Brand kit: the logo, colours, fonts and design templates used on every image and carousel.
// Fill it from the customer's website, from a niche preset, or by hand; previews update live.

import { useEffect, useMemo, useState } from "react"
import { Check, Globe, Sparkles } from "lucide-react"
import { Card, Notice, Skeleton } from "@/components/dashboard/ui"
import { FONTS, NICHES, TEMPLATES, type BrandKit } from "@/lib/autopilot/brand-presets"
import { PhotoPicker } from "./design-editor"

type Kit = BrandKit & { saved: boolean }

const SOCIAL = /^https?:\/\/([a-z0-9-]+\.)*(linkedin\.com|instagram\.com|facebook\.com|fb\.com|x\.com|twitter\.com|youtube\.com|youtu\.be|threads\.net|tiktok\.com|pinterest\.com|wa\.me|whatsapp\.com|linktr\.ee)(\/|$)/i

/** A template preview: shows a placeholder while drawing, and a retry if it fails. */
function Preview({ src, name }: { src: string; name: string }) {
  const [state, setState] = useState<"load" | "ok" | "bad">("load")
  const [tries, setTries] = useState(0)
  const url = tries ? `${src}&r=${tries}` : src
  return (
    <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg bg-[var(--chip)]">
      {state !== "bad" ? (
        <img key={url} src={url} ref={(el) => { if (el?.complete && el.naturalWidth && state === "load") setState("ok") }} alt={`${name} template preview`} width={216} height={270} onLoad={() => setState("ok")} onError={() => setState("bad")} className={`h-full w-full object-cover transition-opacity ${state === "ok" ? "opacity-100" : "opacity-0"}`} />
      ) : null}
      {state === "load" ? <div className="absolute inset-0 animate-pulse bg-[var(--chip)]" /> : null}
      {state === "bad" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-3 text-center text-[12px] text-[var(--muted)]">
          Preview didn&apos;t load.
          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); setTries((n) => n + 1); setState("load") }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); setTries((n) => n + 1); setState("load") } }} className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-2.5 py-1 font-medium text-[var(--ink-2)]">
            Try again
          </span>
        </div>
      ) : null}
    </div>
  )
}

const btn = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-[13px] font-medium text-[var(--ink-2)] hover:border-[var(--line-strong)] disabled:opacity-50"
const primaryBtn = "inline-flex items-center gap-1.5 rounded-lg bg-[var(--nav)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50"
const input = "mt-1 w-full rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm text-[var(--ink)] outline-none focus:border-[var(--brand)]"
const label = "text-[12.5px] font-medium text-[var(--muted)]"

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")

async function call(body?: Record<string, unknown>): Promise<{ ok: boolean; error?: string; kit?: Kit; found?: string[]; niche?: string }> {
  try {
    const r = await fetch("/dashboard/me/brand", body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" })
    return await r.json()
  } catch {
    return { ok: false, error: "No connection. Try again." }
  }
}

function Colour({ name, value, onChange }: { name: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className={label}>{name}</span>
      <span className="mt-1 flex items-center gap-2">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-[var(--line)] bg-[var(--panel)] p-1" aria-label={name} />
        <input value={value} onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)} className={input + " mt-0 w-28 font-mono uppercase"} aria-label={`${name} code`} />
      </span>
    </label>
  )
}

export function BrandKitView() {
  const [kit, setKit] = useState<Kit | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [site, setSite] = useState("")
  const [niche, setNiche] = useState("")
  const [variant, setVariant] = useState<"single" | "cover" | "slide">("single")
  const [stamp, setStamp] = useState("")

  useEffect(() => {
    call().then((r) => {
      if (r.ok && r.kit) {
        setKit(r.kit)
        setSite(r.kit.website)
        setNiche(r.kit.niche)
      } else setErr(r.error || "Couldn't load your brand kit.")
    })
  }, [])
  // Previews follow the form, a moment after typing stops.
  useEffect(() => {
    if (!kit) return
    const t = setTimeout(() => {
      const { saved: _s, ...k } = kit
      void _s
      setStamp(b64(JSON.stringify({ ...k, name: k.name || "Your brand" })))
    }, 600)
    return () => clearTimeout(t)
  }, [kit])

  const set = (patch: Partial<Kit>) => {
    setKit((k) => (k ? { ...k, ...patch } : k))
    setMsg(null)
  }
  const run = async (key: string, body: Record<string, unknown>, ok: (r: Awaited<ReturnType<typeof call>>) => string) => {
    setBusy(key)
    setErr(null)
    const r = await call(body)
    setBusy(null)
    if (r.ok && r.kit) {
      setKit(r.kit)
      if (r.kit.niche) setNiche(r.kit.niche)
      setMsg(ok(r))
    } else setErr(r.error || "That didn't work.")
  }
  const fontsCss = useMemo(() => `https://fonts.googleapis.com/css2?${FONTS.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700`).join("&")}&display=swap`, [])

  if (!kit) return err ? <Notice tone="error">{err}</Notice> : <Skeleton className="h-96" />
  return (
    <div className="space-y-5">
      <link rel="stylesheet" href={fontsCss} />
      <p className="!m-0 max-w-3xl text-sm text-[var(--muted)]">Your logo, colours and fonts go on every image and carousel Xredible makes for you, on LinkedIn, Instagram and Facebook. Pick a template, or let Xredible rotate all five so your feed never looks repetitive.</p>
      {err ? <Notice tone="error">{err}</Notice> : null}

      <Card title="Start quickly" sub="Read your brand from your website, or start from a look made for your kind of business. Nothing is saved until you press Save.">
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <span className={label}>Your website</span>
            <div className="mt-1 flex gap-2">
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://www.yourbusiness.com" className={input + " mt-0"} aria-label="Your website" />
              <button type="button" className={btn + " shrink-0"} disabled={!!busy || !/^https?:\/\//.test(site)} onClick={() => (SOCIAL.test(site) ? setErr("That's a social media page, so it would pick up that site's logo and colours, not yours. Enter your own website, or use Suggest a look.") : run("site", { op: "website", url: site }, (r) => (r.found?.length ? `Found your ${r.found.join(", ")}. Check below, then Save.` : "Couldn't find much there. Fill it in below.")))}>
                <Globe className="h-4 w-4" /> {busy === "site" ? "Reading…" : "Read my brand"}
              </button>
            </div>
          </div>
          <div>
            <span className={label}>Your kind of business</span>
            <div className="mt-1 flex gap-2">
              <select value={niche} onChange={(e) => setNiche(e.target.value)} className={input + " mt-0"} aria-label="Your kind of business">
                <option value="">Let Xredible guess from your About</option>
                {Object.entries(NICHES).map(([k, n]) => (
                  <option key={k} value={k}>
                    {n.label}
                  </option>
                ))}
              </select>
              <button type="button" className={btn + " shrink-0"} disabled={!!busy} onClick={() => run("suggest", { op: "suggest", niche }, (r) => `A look for ${NICHES[r.niche || ""]?.label.toLowerCase() || "you"} is ready below. Adjust it, then Save.`)}>
                <Sparkles className="h-4 w-4" /> {busy === "suggest" ? "Choosing…" : "Suggest a look"}
              </button>
            </div>
          </div>
        </div>
        {msg ? <div className="mt-3 text-sm text-[var(--good)]">{msg}</div> : null}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Name and logo">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Brand name on designs</span>
              <input value={kit.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} className={input} />
            </label>
            <label className="block">
              <span className={label}>Handle or website (optional)</span>
              <input value={kit.handle} onChange={(e) => set({ handle: e.target.value })} maxLength={60} placeholder="@yourbrand" className={input} />
            </label>
          </div>
          <div className="mt-3">
            <span className={label}>Logo (PNG with a transparent background looks best)</span>
            <div className="mt-1.5 flex flex-wrap items-start gap-3">
              <PhotoPicker logo photos={kit.logo ? [kit.logo] : []} max={1} onChange={(p) => set({ logo: p[0] || "" })} />
              <input value={kit.logo} onChange={(e) => set({ logo: e.target.value.trim() })} placeholder="or paste a link: https://…/logo.png" className={input + " mt-0 min-w-0 flex-1"} aria-label="Logo link" />
            </div>
          </div>
          <div className="mt-3">
            <span className={label}>Logo for dark backgrounds (optional, usually a white version)</span>
            <div className="mt-1.5 flex flex-wrap items-start gap-3">
              <PhotoPicker logo dark photos={kit.logoDark ? [kit.logoDark] : []} max={1} onChange={(p) => set({ logoDark: p[0] || "" })} />
              <input value={kit.logoDark} onChange={(e) => set({ logoDark: e.target.value.trim() })} placeholder="or paste a link: https://…/logo-white.png" className={input + " mt-0 min-w-0 flex-1"} aria-label="Dark background logo link" />
            </div>
            <p className="!mb-0 mt-1.5 text-[12px] text-[var(--muted)]">Bold, Split and Spark put your logo on your main colour. Without a version for dark backgrounds, your logo sits on a small white tile there so it stays visible.</p>
          </div>
        </Card>
        <Card title="Colours and fonts">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Colour name="Main" value={kit.primary} onChange={(v) => set({ primary: v })} />
            <Colour name="Light background" value={kit.secondary} onChange={(v) => set({ secondary: v })} />
            <Colour name="Accent" value={kit.accent} onChange={(v) => set({ accent: v })} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={label}>Headings</span>
              <select value={kit.headFont} onChange={(e) => set({ headFont: e.target.value as Kit["headFont"] })} className={input} style={{ fontFamily: `"${kit.headFont}", sans-serif`, fontWeight: 700 }}>
                {FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={label}>Text</span>
              <select value={kit.bodyFont} onChange={(e) => set({ bodyFont: e.target.value as Kit["bodyFont"] })} className={input} style={{ fontFamily: `"${kit.bodyFont}", sans-serif` }}>
                {FONTS.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 rounded-lg p-4" style={{ background: kit.secondary, color: "#15171c" }}>
            <div style={{ fontFamily: `"${kit.headFont}", sans-serif`, fontWeight: 700, fontSize: 22, color: kit.primary }}>Your headline looks like this</div>
            <div style={{ fontFamily: `"${kit.bodyFont}", sans-serif`, fontSize: 14, marginTop: 4 }}>And your text looks like this, with a touch of <span style={{ color: kit.accent, fontWeight: 700 }}>accent colour</span>.</div>
          </div>
        </Card>
      </div>

      <Card title="Design templates" sub="Tap one to use it for every post, or rotate all five for variety. You can still change the design on any single post.">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex max-w-full overflow-x-auto rounded-lg border border-[var(--line)] p-0.5 text-[12.5px]" role="group" aria-label="Preview">
            {(["single", "cover", "slide"] as const).map((v) => (
              <button key={v} type="button" aria-pressed={variant === v} onClick={() => setVariant(v)} className={`whitespace-nowrap rounded-md px-2.5 py-1 font-medium ${variant === v ? "bg-[var(--nav)] text-white" : "text-[var(--muted)]"}`}>
                {v === "single" ? "Image" : v === "cover" ? "Carousel cover" : "Carousel slide"}
              </button>
            ))}
          </div>
        </div>
        <button type="button" onClick={() => set({ template: "rotate" })} aria-pressed={kit.template === "rotate"} className={`mb-3 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium ${kit.template === "rotate" ? "border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]" : "border-[var(--line)] text-[var(--muted)]"}`}>
          {kit.template === "rotate" ? <Check className="h-4 w-4" /> : null} Rotate all five templates (recommended)
        </button>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {TEMPLATES.map((t) => {
            const on = kit.template === t.key
            return (
              <button key={t.key} type="button" onClick={() => set({ template: on ? "rotate" : t.key })} aria-pressed={on} className={`rounded-xl border p-2 text-left transition ${on ? "border-[var(--brand)] ring-2 ring-[var(--brand)]" : "border-[var(--line)] hover:border-[var(--line-strong)]"}`}>
                {stamp ? (
                  <Preview key={`${t.key}-${variant}-${stamp}`} src={`/dashboard/me/brand/preview?t=${t.key}&v=${variant}&k=${stamp}`} name={t.name} />
                ) : (
                  <div className="aspect-[4/5] w-full animate-pulse rounded-lg bg-[var(--chip)]" />
                )}
                <div className="mt-2 flex items-center gap-1.5 text-sm font-semibold">
                  {on ? <Check className="h-4 w-4 text-[var(--brand)]" /> : null}
                  {t.name}
                </div>
                <div className="text-[12px] text-[var(--muted)]">{t.blurb}</div>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Leaves room on the right for the chat button on phones. */}
      <div className="sticky bottom-3 z-10 mr-[76px] flex flex-col gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-sm sm:mr-[88px] sm:flex-row sm:items-center sm:gap-3">
        <span className="text-[13px] text-[var(--muted)]">{msg && kit.saved ? msg : kit.saved ? "Changes apply to every design, including drafts not yet posted." : "Not saved yet: your designs use these defaults until you save."}</span>
        <button type="button" className={primaryBtn + " justify-center sm:ml-auto sm:shrink-0"} disabled={!!busy} onClick={() => run("save", { op: "save", kit }, () => "Saved. Your next designs use this brand kit.")}>
          {busy === "save" ? "Saving…" : "Save brand kit"}
        </button>
      </div>
    </div>
  )
}

/** Compact read-only view of the saved Brand kit, shown inside each tool's settings instead of separate name and colour boxes. */
export function BrandKitSummary({ what = "images and carousels" }: { what?: string }) {
  const [kit, setKit] = useState<Kit | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let live = true
    call().then((r) => {
      if (!live) return
      if (r.ok && r.kit) setKit(r.kit)
      else setFailed(true)
    })
    return () => {
      live = false
    }
  }, [])
  const href = "/dashboard?biz=autopilot&view=ap-brand"
  if (failed) return null
  if (!kit) return <div className="mt-3 h-[74px] animate-pulse rounded-lg bg-[var(--chip)]" />
  return (
    <div className="mt-3 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-white p-1">
          {kit.logo ? (
            <img src={kit.logo} alt="Your logo" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-lg font-bold" style={{ color: kit.primary }}>
              {(kit.name || "?").slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-[var(--ink)]">{kit.name || "No brand name yet"}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--muted)]">
            {[kit.primary, kit.secondary, kit.accent].map((c, i) => (
              <span key={i} title={c} className="inline-block h-4 w-4 rounded border border-[var(--line)]" style={{ background: c }} />
            ))}
            <span className="ml-1 truncate">
              {kit.headFont} · {kit.bodyFont}
            </span>
          </div>
        </div>
        <a href={href} className={btn}>
          {kit.saved ? "Edit brand kit" : "Set up brand kit"}
        </a>
      </div>
      <p className="!mb-0 mt-2 text-[12px] text-[var(--muted)]">
        {kit.saved ? `Your ${what} use your Brand kit: logo, colours and fonts.` : `Your ${what} use these starting colours until you save a Brand kit.`}
      </p>
    </div>
  )
}
