"use client"

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg bg-[#10203f] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
      Print or save as PDF
    </button>
  )
}
