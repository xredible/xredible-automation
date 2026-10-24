"use client"

// Full-screen look at a post's pictures or video: swipe or use the arrows to go through carousel
// slides, read the caption underneath, open the live post. Works before and after posting.

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react"

const VIDEO = /\.(mp4|mov|webm|m4v)(\?|$)/i

export function isVideoUrl(u: string) {
  return VIDEO.test(u)
}

export function MediaViewer({
  media,
  start = 0,
  video = false,
  title,
  caption,
  url,
  urlLabel = "Open the live post",
  onClose,
}: {
  media: string[]
  start?: number
  video?: boolean
  title?: string
  caption?: string
  url?: string | null
  urlLabel?: string
  onClose: () => void
}) {
  const [i, setI] = useState(Math.min(start, Math.max(0, media.length - 1)))
  const [loaded, setLoaded] = useState<Record<number, boolean>>({})
  const touch = useRef<number | null>(null)
  const n = media.length
  const go = useCallback((d: number) => setI((x) => Math.min(n - 1, Math.max(0, x + d))), [n])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", key)
      document.body.style.overflow = overflow
    }
  }, [go, onClose])

  if (typeof document === "undefined" || !n) return null
  const src = media[i]
  const isVid = video || isVideoUrl(src)

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title || "Post preview"} className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm" onClick={onClose}>
      <div className="flex items-center gap-3 px-4 py-3 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          {title ? <div className="truncate text-sm font-semibold">{title}</div> : null}
          {n > 1 ? <div className="text-xs text-white/60">{isVid ? "Video" : "Slide"} {i + 1} of {n}</div> : null}
        </div>
        {url ? (
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">
            {urlLabel} <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current === null) return
          const dx = e.changedTouches[0].clientX - touch.current
          touch.current = null
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1)
        }}
      >
        {isVid ? (
          <video key={src} src={src} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg bg-black" onClick={(e) => e.stopPropagation()} />
        ) : (
          <>
            {!loaded[i] ? <div className="absolute h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : null}
            <img
              key={src}
              src={src}
              alt={n > 1 ? `Slide ${i + 1}` : "Post image"}
              onLoad={() => setLoaded((l) => ({ ...l, [i]: true }))}
              onClick={(e) => e.stopPropagation()}
              className={`max-h-full max-w-full rounded-lg object-contain shadow-2xl transition-opacity ${loaded[i] ? "opacity-100" : "opacity-0"}`}
            />
          </>
        )}
        {n > 1 ? (
          <>
            <button type="button" aria-label="Previous" disabled={i === 0} onClick={(e) => { e.stopPropagation(); go(-1) }} className="absolute left-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 sm:h-11 sm:w-11 sm:bg-white/15 text-white hover:bg-white/25 disabled:opacity-0 sm:left-4">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" aria-label="Next" disabled={i === n - 1} onClick={(e) => { e.stopPropagation(); go(1) }} className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 sm:h-11 sm:w-11 sm:bg-white/15 text-white hover:bg-white/25 disabled:opacity-0 sm:right-4">
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        ) : null}
      </div>

      <div className="px-4 pb-4 pt-3" onClick={(e) => e.stopPropagation()}>
        {n > 1 ? (
          <div className="mx-auto mb-3 flex max-w-full justify-center gap-2 overflow-x-auto pb-1">
            {media.map((m, k) => (
              <button key={m + k} type="button" onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-14 w-11 shrink-0 overflow-hidden rounded-md ring-2 transition ${k === i ? "ring-white" : "ring-transparent opacity-50 hover:opacity-80"}`}>
                {isVideoUrl(m) ? <span className="flex h-full w-full items-center justify-center bg-white/10 text-[10px] text-white">Video</span> : (
                  <img src={m} alt="" loading="lazy" className="h-full w-full object-cover" />
                )}
              </button>
            ))}
          </div>
        ) : null}
        {caption ? <div className="mx-auto max-h-32 max-w-2xl overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-white/80">{caption}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
