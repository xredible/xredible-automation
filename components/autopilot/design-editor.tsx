"use client"

// Post types on a draft: switch between Text / Image / Carousel / Your photos, see the images,
// and edit the image headline, the carousel slides or the uploaded photos.

import { useState } from "react"
import { ArrowDown, ArrowUp, ImagePlus, Plus, X } from "lucide-react"
import { FORMAT_LABEL, GOAL_PLANS, GOALS, MAX_PHOTOS, MAX_SLIDES, type Design, type Format } from "@/lib/autopilot/formats"
import { TEMPLATES } from "@/lib/autopilot/brand-presets"
import { field, small } from "./ui"

export function FormatPicker({ formats, value, busy, onPick }: { formats: Format[]; value: Format; busy: boolean; onPick: (f: Format) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Post type">
      {formats.map((f) => (
        <button
          key={f}
          type="button"
          disabled={busy || f === value}
          aria-pressed={f === value}
          onClick={() => onPick(f)}
          className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${f === value ? "border-[var(--brand)] bg-[var(--brandsoft)] text-[var(--brand)]" : "border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]"} disabled:cursor-default`}
        >
          {FORMAT_LABEL[f]}
        </button>
      ))}
    </div>
  )
}

/** Which of the six templates this post's design uses ("" = the brand kit's choice). */
export function TemplatePicker({ value, busy, onPick }: { value: string; busy: boolean; onPick: (t: string) => void }) {
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
      Design
      <select value={value} disabled={busy} onChange={(e) => onPick(e.target.value)} className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[12.5px] text-[var(--ink2)]">
        <option value="">Brand kit</option>
        {TEMPLATES.map((t) => (
          <option key={t.key} value={t.key}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** The images of a post, side by side (swipe on a phone). */
export function DesignPreview({ urls, alt }: { urls: string[]; alt: string }) {
  if (!urls.length) return null
  return (
    <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={u + i}
          src={u}
          alt={urls.length > 1 ? `${alt}, slide ${i + 1}` : alt}
          width={176}
          height={220}
          loading="lazy"
          onError={(e) => {
            const el = e.currentTarget
            if (!el.dataset.retried) {
              el.dataset.retried = "1"
              el.src = u + (u.includes("?") ? "&" : "?") + "r=" + Date.now()
            }
          }}
          className="h-[220px] w-[176px] shrink-0 snap-start rounded-lg border border-[var(--line)] bg-[var(--soft)] object-cover"
        />
      ))}
    </div>
  )
}

/** Shrinks a photo to at most 1600 px as JPEG, then uploads it. */
/** Photos are shrunk to a 1600 px JPEG; logos to a 1000 px PNG so a transparent background stays transparent. */
async function upload(file: File, logo = false): Promise<string> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, (logo ? 1000 : 1600) / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const type = logo ? "image/png" : "image/jpeg"
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86))
  if (!blob) throw new Error("Couldn't read that picture.")
  const fd = new FormData()
  fd.append("file", new File([blob], logo ? "logo.png" : "photo.jpg", { type }))
  const res = await fetch("/dashboard/me/upload", { method: "POST", body: fd })
  const j = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string }
  if (!j.ok || !j.url) throw new Error(j.error || "Upload failed.")
  return j.url
}

export function PhotoPicker({ photos, max, onChange, logo = false, dark = false }: { photos: string[]; max: number; onChange: (p: string[]) => void; logo?: boolean; dark?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const add = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setErr("")
    const out = [...photos]
    for (const f of Array.from(files).slice(0, max - photos.length)) {
      try {
        out.push(await upload(f, logo))
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Upload failed.")
        break
      }
    }
    onChange(out)
    setBusy(false)
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {photos.map((p, i) => (
          <div key={p} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p} alt={logo ? "Logo" : `Photo ${i + 1}`} className={`h-24 w-24 rounded-lg border border-[var(--line)] ${logo ? `object-contain p-2 ${dark ? "bg-[#10203f]" : "bg-white"}` : "object-cover"}`} />
            <button type="button" onClick={() => onChange(photos.filter((x) => x !== p))} className="absolute -right-2 -top-2 rounded-full bg-[var(--nav)] p-1 text-white" aria-label={`Remove photo ${i + 1}`}>
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {photos.length < max ? (
          <label className={`flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--line)] text-[12px] text-[var(--muted)] hover:border-[var(--brand)] ${busy ? "opacity-60" : ""}`}>
            <ImagePlus className="h-5 w-5" />
            {busy ? "Uploading…" : logo ? "Add logo" : "Add photos"}
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => add(e.target.files)} />
          </label>
        ) : null}
      </div>
      {err ? <div className="mt-1.5 text-[12.5px] text-[var(--bad)]">{err}</div> : null}
    </div>
  )
}

/** Edits the design that goes with the text (shown while a draft is being edited). */
export function DesignFields({ format, design, onChange, headlineLabel = "Words on the image" }: { format: Format; design: Design; onChange: (d: Design) => void; headlineLabel?: string }) {
  const slides = design.slides || []
  const setSlide = (i: number, k: "title" | "body", v: string) => onChange({ ...design, slides: slides.map((s, j) => (j === i ? { ...s, [k]: v } : s)) })
  const move = (i: number, d: number) => {
    const next = [...slides]
    const [x] = next.splice(i, 1)
    next.splice(i + d, 0, x)
    onChange({ ...design, slides: next })
  }
  if (format === "image")
    return (
      <div className="space-y-3">
        <label className="block">
          <span className={small}>{headlineLabel}</span>
          <input value={design.headline || ""} onChange={(e) => onChange({ ...design, headline: e.target.value })} maxLength={90} className={field} />
        </label>
        <div>
          <span className={small}>Or use your own photo instead of the design</span>
          <div className="mt-1.5">
            <PhotoPicker photos={design.photos || []} max={1} onChange={(photos) => onChange({ ...design, photos })} />
          </div>
        </div>
      </div>
    )
  if (format === "photo")
    return (
      <div>
        <span className={small}>Your photos (up to {MAX_PHOTOS}; 2 or more post as a swipeable set)</span>
        <div className="mt-1.5">
          <PhotoPicker photos={design.photos || []} max={MAX_PHOTOS} onChange={(photos) => onChange({ ...design, photos })} />
        </div>
      </div>
    )
  if (format === "carousel")
    return (
      <div>
        <span className={small}>Slides (the first is the cover, the last is your closing line)</span>
        <ol className="mt-1.5 space-y-2">
          {slides.map((s, i) => (
            <li key={i} className="rounded-lg border border-[var(--line)] p-2.5">
              <div className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                <span className="font-semibold">{i === 0 ? "Cover" : i === slides.length - 1 ? "Last slide" : `Slide ${i + 1}`}</span>
                <span className="ml-auto flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-[var(--soft)] disabled:opacity-30" aria-label="Move up">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" disabled={i === slides.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-[var(--soft)] disabled:opacity-30" aria-label="Move down">
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button type="button" disabled={slides.length <= 2} onClick={() => onChange({ ...design, slides: slides.filter((_, j) => j !== i) })} className="rounded p-1 hover:bg-[var(--soft)] disabled:opacity-30" aria-label="Remove slide">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </div>
              <input value={s.title} onChange={(e) => setSlide(i, "title", e.target.value)} maxLength={80} placeholder="Title" className={field + " mt-1 font-semibold"} aria-label={`Slide ${i + 1} title`} />
              <textarea value={s.body} onChange={(e) => setSlide(i, "body", e.target.value)} maxLength={260} rows={2} placeholder="Text" className={field + " mt-1.5 font-[inherit]"} aria-label={`Slide ${i + 1} text`} />
            </li>
          ))}
        </ol>
        {slides.length < MAX_SLIDES ? (
          <button type="button" onClick={() => onChange({ ...design, slides: [...slides.slice(0, -1), { title: "", body: "" }, ...slides.slice(-1)] })} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-[var(--brand)] hover:underline">
            <Plus className="h-3.5 w-3.5" /> Add a slide
          </button>
        ) : null}
      </div>
    )
  return null
}

/** Settings block: the mix of post goals, and the offer + keyword that Offer posts use. */
export function GoalFields({ value, onChange, channel }: { value: { goals: string; offer: string; cta: string }; onChange: (v: { goals: string; offer: string; cta: string }) => void; channel: "linkedin" | "meta" }) {
  const plan = GOAL_PLANS.find((p) => p.key === value.goals) || GOAL_PLANS[0]
  const reach = channel === "linkedin" ? 'comment "AUDIT" and I\'ll message you' : 'DM us "MENU" for prices'
  return (
    <div className="mt-3 rounded-lg border border-[var(--line)] p-3">
      <label className="block">
        <span className={small}>What your posts are for</span>
        <select value={plan.key} onChange={(e) => onChange({ ...value, goals: e.target.value })} className={field}>
          {GOAL_PLANS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {GOALS.map((g) => (
          <span key={g.key} title={g.blurb} className="rounded-full bg-[var(--chip)] px-2 py-0.5 text-[11.5px] text-[var(--ink-2)]">
            {g.label} {plan.mix[g.key]}%
          </span>
        ))}
      </div>
      <p className="!mb-0 mt-2 text-[12px] text-[var(--muted)]">Most posts earn attention and trust. Only Offer posts ask for business, so your feed never feels like an ad. Each draft also checks this week&apos;s news on your topics and uses it when it fits.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="block">
          <span className={small}>Your offer (used only in Offer posts)</span>
          <input value={value.offer} onChange={(e) => onChange({ ...value, offer: e.target.value })} maxLength={300} className={field} placeholder={channel === "linkedin" ? "e.g. Free 20-minute marketing audit for D2C brands" : "e.g. Diwali hampers from Rs 799 with free delivery"} />
        </label>
        <label className="block">
          <span className={small}>How people respond</span>
          <input value={value.cta} onChange={(e) => onChange({ ...value, cta: e.target.value })} maxLength={120} className={field} placeholder={reach} />
        </label>
      </div>
    </div>
  )
}
