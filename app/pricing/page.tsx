import type { Metadata } from "next"
import Link from "next/link"
import { PRODUCT_KEYS, PRODUCTS, rupees } from "@/lib/autopilot/products"

export const metadata: Metadata = {
  title: "Pricing | Xredible Autopilot",
  description: "AI that writes and publishes your LinkedIn, Instagram, Facebook, blog and newsletter content. 3 free posts on every tool, then monthly plans from ₹999.",
}

export default function Pricing() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Xredible
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Autopilot pricing</h1>
      <p className="mt-2 max-w-2xl text-[15px] text-slate-600">
        Each tool writes content in your voice (English, Hinglish or Hindi), you approve every piece, and it publishes on your schedule. Every tool starts with 3 free posts, no card needed. Prices are per month in Indian rupees; cancel any time.
      </p>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {PRODUCT_KEYS.map((k) => {
          const p = PRODUCTS[k]
          return (
            <section key={k} className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-900">
              <h2 className="text-lg font-semibold">{p.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{p.tagline}</p>
              <div className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <b>Free trial:</b> {p.trial} {p.unit}
              </div>
              <ul className="mt-3 space-y-2">
                {p.plans.map((pl) => (
                  <li key={pl.key} className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-2 text-sm">
                    <span>
                      <b>{pl.name}</b> · {pl.posts} {p.unit} a month · {pl.blurb}
                    </span>
                    <span className="whitespace-nowrap text-base font-semibold">
                      {rupees(pl.price)}
                      <span className="text-xs font-normal text-slate-500">/mo</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/dashboard?signup" className="rounded-lg bg-[#10203f] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">
          Start free
        </Link>
        <span className="text-sm text-slate-500">
          Pay by UPI or card. See <Link className="underline" href="/refund-policy">Cancellation &amp; Refund Policy</Link> and <Link className="underline" href="/terms">Terms</Link>.
        </span>
      </div>
    </main>
  )
}
