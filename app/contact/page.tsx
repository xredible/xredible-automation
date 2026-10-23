import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter, SiteHeader, WhatsAppButton } from "@/components/site/site"
import { ui, WHATSAPP } from "@/components/site/ui"

export const metadata: Metadata = { title: "Contact Us | Xredible", description: "Contact Xredible for help with your automations, billing or refunds, or to book a demo." }

const CARDS = [
  { t: "WhatsApp or call", v: "+91 80859 49384", href: `https://wa.me/${WHATSAPP}`, d: "Fastest for quick questions and demos." },
  { t: "Email", v: "accounts@xredible.in", href: "mailto:accounts@xredible.in", d: "For billing, refunds and anything you want in writing." },
  { t: "Hours", v: "Mon to Sat, 10 am to 7 pm IST", d: "We reply within one working day." },
  { t: "Business", v: "Xredible, run by Abhijit Kaushik", d: "Sole proprietor, Indore, Madhya Pradesh, India." },
]

export default function Contact() {
  return (
    <div className={ui.page}>
      <SiteHeader active="Contact" />
      <WhatsAppButton />
      <section className="relative overflow-hidden border-b border-white/10">
        <div className={ui.glow} />
        <div className={ui.wrap + " relative py-16 sm:py-20"}>
          <div className={ui.pill}>We&rsquo;re happy to help</div>
          <h1 className={ui.h1 + " mt-6 max-w-3xl"}>
            Contact <span className={ui.gradient}>Xredible</span>
          </h1>
          <p className={ui.lead + " mt-6 max-w-2xl"}>Questions about your automations, your plan, payments or refunds? Or want to see Autopilot working for your business? Reach us any way you like.</p>
        </div>
      </section>
      <main className={ui.wrap + " py-14 sm:py-16"}>
        <div className="grid gap-5 sm:grid-cols-2">
          {CARDS.map((c) => (
            <div key={c.t} className={ui.card + " p-7"}>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{c.t}</div>
              {c.href ? (
                <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" className="mt-2 block text-2xl font-bold text-[#d4ad4b] hover:underline">
                  {c.v}
                </a>
              ) : (
                <div className="mt-2 text-2xl font-bold">{c.v}</div>
              )}
              <p className="mt-2 text-slate-400">{c.d}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className={"rounded-3xl border border-[#d4ad4b]/40 bg-[#d4ad4b]/10 p-7"}>
            <h2 className="text-2xl font-bold">Want a demo?</h2>
            <p className="mt-2 text-slate-300">A free 15-minute call: we set up your brand and write your first posts together.</p>
            <Link href="/demo#book" className={ui.btn + " mt-5"}>
              Book a free demo
            </Link>
          </div>
          <div className={ui.card + " p-7"}>
            <h2 className="text-2xl font-bold">Billing question?</h2>
            <p className="mt-2 text-slate-400">Include your account email and the payment reference (UPI UTR or Razorpay payment ID), so we can find it quickly.</p>
            <p className="mt-4 text-sm text-slate-400">
              See also our <Link className="text-[#e9cf86] underline underline-offset-4" href="/terms">Terms</Link>, <Link className="text-[#e9cf86] underline underline-offset-4" href="/privacy">Privacy Policy</Link>, <Link className="text-[#e9cf86] underline underline-offset-4" href="/refund-policy">Cancellation &amp; Refund Policy</Link> and <Link className="text-[#e9cf86] underline underline-offset-4" href="/shipping-policy">Delivery Policy</Link>.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
