"use client"

// Full-article reader for report rows that carry the article itself (e.g. LinkedIn newsletter drafts):
// read it, copy it with formatting for LinkedIn's editor, or download it as an HTML file. Pictures made
// for the article (cover + section images) show in place, each with its own download button.

import { useEffect, useMemo, useState } from "react"
import { Check, Copy, Download, ImageDown, X } from "lucide-react"

export type DocImage = { slot: string; url: string; alt?: string; w?: number | null; h?: number | null }

const ALLOWED = new Set(["P", "H1", "H2", "H3", "H4", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "A", "BR", "BLOCKQUOTE"])

/** Keeps only simple article markup (no scripts, styles, images or event attributes). */
function clean(html: string): string {
  if (typeof window === "undefined") return ""
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      if (!ALLOWED.has(child.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(child.tagName)) child.remove()
        else child.replaceWith(...[...child.childNodes])
        continue
      }
      for (const a of [...child.attributes]) {
        const keep = child.tagName === "A" && a.name === "href" && /^https?:\/\//i.test(a.value)
        if (!keep) child.removeAttribute(a.name)
      }
      if (child.tagName === "A") {
        child.setAttribute("target", "_blank")
        child.setAttribute("rel", "noopener noreferrer")
      }
      walk(child)
    }
  }
  const root = doc.body.firstElementChild as Element
  walk(root)
  return root.innerHTML
}

/** A download link for a picture served by the li-img webhook (it adds Content-Disposition for dl=1). */
function downloadUrl(img: DocImage, base: string): string {
  const name = `${base || "newsletter"}-${img.slot}.jpg`.toLowerCase().replace(/[^a-z0-9._-]+/g, "-")
  return `${img.url}${img.url.includes("?") ? "&" : "?"}dl=1&n=${encodeURIComponent(name)}`
}

function Picture({ img, base, label }: { img: DocImage; base: string; label: string }) {
  return (
    <figure className="my-5">
      <img src={img.url} alt={img.alt || label} loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full rounded-xl bg-[var(--chip)] object-cover" />
      <figcaption className="mt-1.5 flex items-center gap-2 text-xs text-[var(--muted)]">
        <span className="font-medium text-[var(--ink-2)]">{label}</span>
        <a href={downloadUrl(img, base)} className="ml-auto inline-flex items-center gap-1 rounded-md border border-[var(--line)] px-2 py-1 font-medium text-[var(--ink)] hover:bg-[var(--hover)]">
          <ImageDown className="h-3.5 w-3.5" />
          Download
        </a>
      </figcaption>
    </figure>
  )
}

const PROSE =
  "space-y-4 text-[15px] leading-relaxed text-[var(--ink-2)] [&_a]:text-[var(--brand)] [&_a]:underline [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[var(--ink)] [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc [&_ul]:space-y-1"

export function DocViewer({
  title,
  subtitle,
  html,
  images = [],
  fileBase = "",
  onClose,
}: {
  title: string
  subtitle?: string
  html: string
  images?: DocImage[]
  fileBase?: string
  onClose: () => void
}) {
  const body = useMemo(() => clean(html), [html])
  // The body split at each <h2>: [intro, section 1, section 2, ...], so section pictures (s1, s2..) sit under their heading.
  const parts = useMemo(() => {
    return body.split(/(?=<h2[\s>])/i).map((part) => {
      const m = /^<h2[^>]*>[\s\S]*?<\/h2>/i.exec(part)
      return m ? { head: m[0], rest: part.slice(m[0].length) } : { head: "", rest: part }
    })
  }, [body])
  const pic = (slot: string) => images.find((i) => i.slot === slot && /^https:\/\//.test(i.url))
  const cover = pic("cover")
  const [copied, setCopied] = useState(false)
  const words = useMemo(() => body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length, [body])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const copy = async () => {
    const text = new DOMParser().parseFromString(`<div>${body}</div>`, "text/html").body.innerText
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([body], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })])
    } catch {
      await navigator.clipboard.writeText(text)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const save = () => {
    const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    const page = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.65}</style></head><body><h1>${esc(title)}</h1>${subtitle ? `<p><em>${esc(subtitle)}</em></p>` : ""}${body}</body></html>`
    const url = URL.createObjectURL(new Blob([page], { type: "text/html;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "article"}.html`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-6" onClick={onClose} role="dialog" aria-modal="true" aria-label={title}>
      <div className="relative my-4 w-full max-w-3xl rounded-2xl bg-[var(--panel)] shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-t-2xl border-b border-[var(--line)] bg-[var(--panel)] px-4 py-3 sm:px-6">
          <span className="text-xs text-[var(--muted)]">{words.toLocaleString("en-IN")} words</span>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy article"}
            </button>
            <button type="button" onClick={save} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--hover)]">
              <Download className="h-4 w-4" />
              HTML
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <article className="px-4 pb-8 pt-5 sm:px-8">
          <h1 className="text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-2 text-base text-[var(--muted)]">{subtitle}</p> : null}
          {cover ? <Picture img={cover} base={fileBase} label="Cover image (1920 × 1080)" /> : null}
          <div className="mt-6 space-y-4">
            {parts.map((p, i) => {
              const img = i > 0 ? pic(`s${i}`) : undefined
              return (
                <div key={i}>
                  {p.head ? <div className={PROSE} dangerouslySetInnerHTML={{ __html: p.head }} /> : null}
                  {img ? <Picture img={img} base={fileBase} label={`Picture for section ${i}`} /> : null}
                  {p.rest ? <div className={`${PROSE} mt-4`} dangerouslySetInnerHTML={{ __html: p.rest }} /> : null}
                </div>
              )
            })}
          </div>
          <p className="mt-8 rounded-lg bg-[var(--chip)] px-3 py-2 text-xs text-[var(--muted)]">
            To publish: on LinkedIn open <b>Write article</b>, pick the newsletter, put the title and subtitle in their own fields, then paste (Copy article keeps the headings, bullets and link).
            {images.length ? (
              <>
                {" "}
                Pictures don&apos;t travel with the paste: download them here, upload the cover with <b>Upload from computer</b> at the top of the article, and add each section picture under its heading with <b>+ → Image</b>.
              </>
            ) : null}
          </p>
        </article>
      </div>
    </div>
  )
}
