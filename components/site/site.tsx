"use client"

// The public website's shared look: header (Spark X logo, menu, Sign in, Book a demo), footer, the WhatsApp
// button and the class names every page uses, so all pages match the homepage in the navy + gold brand.

import Link from "next/link"
import { useState, type ReactNode } from "react"

import { ui, WHATSAPP } from "./ui"

const NAV = [
  { href: "/#services", label: "Services" },
  { href: "/demo", label: "Autopilot" },
  { href: "/pricing", label: "Pricing" },
  { href: "/#portfolio", label: "Projects" },
  { href: "/#faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
]

export function Logo({ className = "h-9 w-auto" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/xredible-logo-white.webp" alt="Xredible Automation" width={709} height={224} className={className} />
}

export function SiteHeader({ active }: { active?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1530]/80 backdrop-blur-xl">
      <div className={ui.wrap + " flex items-center gap-4 py-3.5"}>
        <Link href="/" className="flex shrink-0 items-center" aria-label="Xredible home">
          <Logo />
        </Link>
        <nav className="ml-auto hidden items-center gap-7 text-sm font-medium lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={`transition hover:text-[#d4ad4b] ${active === n.label ? "text-[#d4ad4b]" : "text-slate-300"}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 lg:ml-4">
          <Link href="/dashboard" className="hidden rounded-2xl px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:text-white sm:inline-flex">
            Sign in
          </Link>
          <Link href="/demo#book" className="rounded-2xl bg-[#d4ad4b] px-4 py-2.5 text-sm font-semibold text-[#0b1530] transition hover:bg-[#e2c063] sm:px-5">
            Book a demo
          </Link>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Menu" className="rounded-xl border border-white/15 p-2.5 text-slate-200 lg:hidden">
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 bg-current" />
            <span className="mt-1.5 block h-0.5 w-5 bg-current" />
          </button>
        </div>
      </div>
      {open ? (
        <nav className="border-t border-white/10 bg-[#0b1530] lg:hidden">
          <div className={ui.wrap + " grid gap-1 py-3"}>
            {[...NAV, { href: "/dashboard", label: "Sign in" }].map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 text-[15px] font-medium text-slate-200 hover:bg-white/5">
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  )
}

export function SiteFooter() {
  const col = "grid gap-2.5 text-sm text-slate-400"
  const a = "transition hover:text-[#d4ad4b]"
  return (
    <footer className="border-t border-white/10 bg-[#081026]">
      <div className={ui.wrap + " grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]"}>
        <div>
          <Logo className="h-10 w-auto" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">AI automation for Indian businesses: content that posts itself, leads that follow up on their own, and systems that save hours every week.</p>
          <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-[#d4ad4b]/50">
            WhatsApp +91 80859 49384
          </a>
        </div>
        <div className={col}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Autopilot</div>
          <Link href="/demo" className={a}>See a demo</Link>
          <Link href="/pricing" className={a}>Pricing</Link>
          <Link href="/dashboard" className={a}>Sign in / Start free</Link>
          <Link href="/android" className={a}>Android app</Link>
        </div>
        <div className={col}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Agency</div>
          <Link href="/#services" className={a}>Services</Link>
          <Link href="/#portfolio" className={a}>Projects</Link>
          <Link href="/#faq" className={a}>FAQ</Link>
          <Link href="/contact" className={a}>Contact us</Link>
        </div>
        <div className={col}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Policies</div>
          <Link href="/terms" className={a}>Terms</Link>
          <Link href="/privacy" className={a}>Privacy</Link>
          <Link href="/refund-policy" className={a}>Cancellation &amp; refunds</Link>
          <Link href="/shipping-policy" className={a}>Delivery policy</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className={ui.wrap + " flex flex-wrap items-center gap-x-6 gap-y-2 py-5 text-xs text-slate-500"}>
          <span>© {new Date().getFullYear()} Xredible. Indore, Madhya Pradesh, India.</span>
          <span className="sm:ml-auto">Made with AI and n8n, approved by humans.</span>
        </div>
      </div>
    </footer>
  )
}

export function WhatsAppButton() {
  return (
    <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp" className="fixed bottom-6 left-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] shadow-2xl shadow-[#25d366]/30 transition hover:scale-105">
      <svg viewBox="0 0 24 24" width="28" height="28" fill="#fff" aria-hidden="true">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.09c-.24.68-1.42 1.3-1.95 1.35-.5.05-.97.23-3.28-.68-2.78-1.1-4.55-3.94-4.69-4.12-.14-.18-1.12-1.49-1.12-2.85 0-1.35.71-2.02.96-2.29.25-.27.55-.34.73-.34h.52c.17 0 .4-.06.62.47.24.56.8 1.94.87 2.08.07.14.12.3.02.48-.09.18-.14.3-.27.46-.14.16-.29.36-.41.48-.14.14-.28.29-.12.56.16.27.71 1.17 1.52 1.9 1.05.93 1.93 1.22 2.2 1.36.27.14.43.12.59-.07.16-.18.68-.79.86-1.07.18-.27.36-.23.61-.14.25.09 1.6.75 1.87.89.27.14.46.2.52.32.07.11.07.66-.17 1.34Z" />
      </svg>
    </a>
  )
}

export function Section({ id, band = false, children, className = "" }: { id?: string; band?: boolean; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={(band ? ui.band + " " : "") + "scroll-mt-20 " + className}>
      <div className={ui.wrap + " py-20 lg:py-24"}>{children}</div>
    </section>
  )
}

export function SectionTitle({ title, sub, center = true }: { title: ReactNode; sub?: ReactNode; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <h2 className={ui.h2}>{title}</h2>
      {sub ? <p className={"mt-5 " + ui.lead + " text-slate-400"}>{sub}</p> : null}
    </div>
  )
}
