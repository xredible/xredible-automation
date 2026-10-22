"use client"

// Last-resort screen for the private dashboard: shows what went wrong instead of a blank page.

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div translate="no" className="notranslate flex min-h-[100dvh] items-center justify-center bg-[#f5f6f8] px-4">
      <div className="w-full max-w-md rounded-xl border border-[#e3e6eb] bg-white p-6 shadow-sm">
        <div className="text-base font-semibold text-[#10203f]">The dashboard hit a problem</div>
        <div className="mt-2 text-sm text-[#5b6577]">Try again. If it keeps happening, send a screenshot of this box.</div>
        <pre className="mt-4 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[#f5f6f8] p-3 text-[12px] text-[#b42318]">
          {error.message || "Unknown error"}
          {error.digest ? `\nRef: ${error.digest}` : ""}
        </pre>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => reset()} className="rounded-md bg-[#10203f] px-4 py-2 text-sm font-medium text-white">
            Try again
          </button>
          <button type="button" onClick={() => window.location.reload()} className="rounded-md border border-[#e3e6eb] px-4 py-2 text-sm font-medium text-[#10203f]">
            Reload page
          </button>
        </div>
      </div>
    </div>
  )
}
