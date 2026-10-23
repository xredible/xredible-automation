"use client"

// Public demo page: a sample week for four kinds of business (designs drawn live by the real template engine),
// how it works, what's included, and a "Book a live demo" form that goes to /api/demo.

import Link from "next/link"
import { useState } from "react"
import { SiteFooter, SiteHeader, WhatsAppButton } from "@/components/site/site"
import { ui, WHATSAPP } from "@/components/site/ui"
import { DEMO_BRANDS } from "@/lib/autopilot/demo-samples"
import { GOAL_LABEL, type Goal } from "@/lib/autopilot/formats"

const INTERESTS = ["LinkedIn", "Instagram + Facebook", "Blog writing", "Email marketing", "Custom automation"]
const GOAL_STYLE: Record<Goal, string> = {
  teach: "bg-[#6f93f0]/15 text-[#b4c8fb]",
  story: "bg-[#d4ad4b]/15 text-[#f0d68a]",
  proof: "bg-[#35c2a7]/15 text-[#86e3d0]",
  talk: "bg-[#b49cf0]/15 text-[#d3c5f8]",
  offer: "bg-[#d4ad4b] text-[#0b1530]",
}

const STEPS = [
  { t: "Tell us about your business", d: "Two minutes: what you do, who you want to reach, your topics and tone. Pick Hindi, Hinglish or English." },
  { t: "Set your brand once", d: "Logo, colours and fonts. Every image and carousel comes out in your brand, in one of six designs." },
  { t: "Approve from your phone", d: "Drafts arrive by email every week. Approve, edit or ask the AI to rewrite. Nothing posts without your OK." },
  { t: "It posts and grows your list", d: "Posts go out on schedule. Signup forms and email sequences turn followers into customers." },
]

const INCLUDED = [
  { t: "LinkedIn Autopilot", d: "Posts, image posts and PDF carousels for your profile, in your voice." },
  { t: "Instagram + Facebook", d: "Designed posts and carousels with captions and hashtags, to your Page and Instagram." },
  { t: "Blog Writer", d: "SEO articles published to your WordPress site, with FAQs and meta descriptions." },
  { t: "Email Marketing", d: "Newsletters, welcome sequences, signup forms and lists, sent from your own email." },
  { t: "A planned content mix", d: "Teach, story, proof, conversation and offer posts in the right ratio, using this week's news on your topics." },
  { t: "Ideas and festival calendar", d: "Diwali, Holi, Independence Day and more, ready as posts for every channel." },
]

export function DemoClient() {
  const [brand, setBrand] = useState(DEMO_BRANDS[0].key)
  const b = DEMO_BRANDS.find((x) => x.key === brand) || DEMO_BRANDS[0]
  return (
    <div className={ui.page}>
      <SiteHeader active="Autopilot" />
      <WhatsAppButton />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10 text-white">
        <div className={ui.glow} />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div>
            <div className="inline-flex rounded-full border border-[#d4ad4b]/40 bg-[#d4ad4b]/10 px-3 py-1 text-sm text-[#e9cf86]">Xredible Autopilot · for Indian businesses</div>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
              Your social media, written and posted for you. <span className="text-[#d4ad4b]">You just approve.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/80">
              LinkedIn, Instagram, Facebook, your blog and your email list, in your voice and your brand. A planned mix of posts that builds trust first and brings enquiries, not just likes.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#book" className="rounded-xl bg-[#d4ad4b] px-6 py-3 font-semibold text-[#10203f] hover:brightness-105">
                Book a free 15-minute demo
              </a>
              <a href="#sample" className="rounded-xl border border-white/25 px-6 py-3 font-semibold hover:bg-white/5">
                See a sample week
              </a>
            </div>
            <p className="mt-4 text-sm text-white/60">
              Or <Link href="/dashboard" className="underline hover:text-white">start free</Link>: every automation includes 3 free posts. No card needed.
            </p>
          </div>
          <div className="mx-auto w-full max-w-sm">
            <div className="rounded-3xl border border-white/10 bg-white p-4 text-[#15171c] shadow-2xl">
              <div className="flex items-center gap-2 text-xs text-[#5d6676]">
                <span className="rounded-full bg-[#e7eefc] px-2 py-0.5 font-medium text-[#24438a]">Teach</span>
                <span>Planned for Mon, 9:05 am</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/api/autopilot/demo?b=coach&v=cover" alt="Sample carousel cover in the Playbook design" width={1080} height={1350} className="mt-3 aspect-[4/5] w-full rounded-xl object-cover" />
              <p className="mt-3 text-sm leading-relaxed">Most candidates lose the offer in the first 60 seconds. Swipe for the 5 answers I fix first with every client.</p>
              <div className="mt-3 flex gap-2">
                <span className="rounded-lg bg-[#10203f] px-3 py-1.5 text-sm font-semibold text-white">Approve</span>
                <span className="rounded-lg border border-[#e6e3da] px-3 py-1.5 text-sm">Edit</span>
                <span className="rounded-lg border border-[#e6e3da] px-3 py-1.5 text-sm">Rewrite</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sample week */}
      <section id="sample" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">A sample week for a business like yours</h2>
        <p className="mt-2 max-w-2xl text-slate-400">Pick a business. Every week mixes posts that teach, tell a story, show proof, start a conversation and, now and then, make an offer.</p>
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Sample business">
          {DEMO_BRANDS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === brand} onClick={() => setBrand(x.key)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${x.key === brand ? "border-[#d4ad4b] bg-[#d4ad4b]/15 text-[#f0d68a]" : "border-white/15 text-slate-300 hover:border-white/30 hover:text-white"}`}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className={ui.card + " p-6"}>
            <div className="text-sm text-slate-400">Sample brand</div>
            <div className="text-lg font-bold text-white">{b.name}</div>
            <ul className="mt-4 divide-y divide-white/10">
              {b.week.map((p) => (
                <li key={p.day} className="flex gap-3 py-3">
                  <div className="w-10 shrink-0 text-sm font-semibold text-[#d4ad4b]">{p.day}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${GOAL_STYLE[p.goal]}`}>{GOAL_LABEL[p.goal]}</span>
                      <span className="text-slate-400">
                        {p.channel} · {p.format === "carousel" ? "Carousel" : p.format === "image" ? "Image post" : "Text post"}
                      </span>
                    </div>
                    <div className="mt-1 text-[15px] leading-snug text-slate-200">{p.hook}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-3">
              {(["cover", "slide", "offer"] as const).map((v) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={b.key + v} src={`/api/autopilot/demo?b=${b.key}&v=${v}`} alt={`${b.name}: ${v === "offer" ? "offer post" : v === "cover" ? "carousel cover" : "carousel slide"}`} width={1080} height={1350} loading="lazy" className="aspect-[4/5] w-full rounded-2xl border border-white/10 bg-white/5 object-cover shadow-2xl" />
              ))}
            </div>
            <p className="mt-4 text-sm text-slate-400">Carousel cover, a slide and an offer post, drawn by Xredible in this brand&apos;s colours and fonts. Yours use your own logo and colours, in six designs.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={ui.band + " scroll-mt-20"}>
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">How it works</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className={ui.card + " p-6"}>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d4ad4b] font-bold text-[#0b1530]">{i + 1}</div>
                <div className="mt-4 font-semibold text-white">{s.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{s.d}</p>
              </li>
            ))}
          </ol>
          <h3 className="mt-14 text-2xl font-bold text-white">What&apos;s included</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((x) => (
              <div key={x.t} className={ui.tile + " p-6"}>
                <div className="font-semibold text-[#e9cf86]">{x.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{x.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-sm text-slate-400">
            Plans from ₹999 a month per automation. <Link href="/pricing" className="font-medium text-[#e9cf86] underline underline-offset-4">See pricing</Link>
          </p>
        </div>
      </section>

      <BookDemo />

      <SiteFooter />
    </div>
  )
}

function BookDemo() {
  const [f, setF] = useState({ name: "", email: "", phone: "", business: "", website: "", when: "", note: "", consent: false, interests: [] as string[], fax: "" })
  const [state, setState] = useState<"idle" | "sending" | "done">("idle")
  const [err, setErr] = useState("")
  const input = "mt-1 w-full rounded-xl border border-[#e6e3da] bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#10203f]"
  const label = "text-sm font-medium text-[#10203f]"
  const toggle = (x: string) => setF({ ...f, interests: f.interests.includes(x) ? f.interests.filter((y) => y !== x) : [...f.interests, x] })
  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi, I'm ${f.name || "interested"}${f.business ? ` from ${f.business}` : ""}. I'd like a demo of Xredible Autopilot.`)}`

  return (
    <section id="book" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6">
      <div className="grid gap-8 rounded-3xl border border-[#d4ad4b]/30 bg-gradient-to-br from-[#d4ad4b]/10 via-white/5 to-[#35c2a7]/5 p-6 text-white sm:p-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">Book a free 15-minute demo</h2>
          <p className="mt-3 leading-relaxed text-white/80">We&apos;ll set up your brand, write your first posts together and show you how approving and posting works. In Hindi or English.</p>
          <ul className="mt-6 space-y-2 text-sm text-white/80">
            <li>✓ See posts written for your own business</li>
            <li>✓ Your brand colours and logo on the designs</li>
            <li>✓ No obligation: start free afterwards if you like it</li>
          </ul>
          <a href={wa} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold hover:bg-white/5">
            Prefer WhatsApp? Message us
          </a>
        </div>
        <div className="rounded-2xl bg-white p-5 text-[#15171c] sm:p-6">
          {state === "done" ? (
            <div className="py-6 text-center">
              <div className="text-2xl font-bold text-[#10203f]">Thank you, {f.name.split(" ")[0] || "we've got it"}!</div>
              <p className="mt-2 text-[#5d6676]">We&apos;ll message you on WhatsApp within one working day to fix a time. A confirmation is on its way to your email.</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <a href={wa} target="_blank" rel="noreferrer" className="rounded-xl bg-[#25d366] px-5 py-2.5 font-semibold text-white">
                  Message us now on WhatsApp
                </a>
                <Link href="/dashboard" className="rounded-xl border border-[#e6e3da] px-5 py-2.5 font-semibold">
                  Start free meanwhile
                </Link>
              </div>
            </div>
          ) : (
            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault()
                setErr("")
                setState("sending")
                try {
                  const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) })
                  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
                  if (j.ok) setState("done")
                  else {
                    setErr(j.error || "That didn't go through. Please try again or message us on WhatsApp.")
                    setState("idle")
                  }
                } catch {
                  setErr("No connection. Please try again or message us on WhatsApp.")
                  setState("idle")
                }
              }}
            >
              <label className="block">
                <span className={label}>Your name</span>
                <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} className={input} autoComplete="name" />
              </label>
              <label className="block">
                <span className={label}>Business name</span>
                <input value={f.business} onChange={(e) => setF({ ...f, business: e.target.value })} maxLength={120} className={input} autoComplete="organization" />
              </label>
              <label className="block">
                <span className={label}>Email</span>
                <input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} maxLength={160} className={input} autoComplete="email" />
              </label>
              <label className="block">
                <span className={label}>WhatsApp number</span>
                <input required type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={20} placeholder="98765 43210" className={input} autoComplete="tel" />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Website or Instagram (optional)</span>
                <input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} maxLength={200} className={input} />
              </label>
              <div className="sm:col-span-2">
                <span className={label}>What would you like help with?</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {INTERESTS.map((x) => (
                    <button key={x} type="button" aria-pressed={f.interests.includes(x)} onClick={() => toggle(x)} className={`rounded-full border px-3 py-1.5 text-sm ${f.interests.includes(x) ? "border-[#10203f] bg-[#10203f] text-white" : "border-[#e6e3da] hover:border-[#10203f]/40"}`}>
                      {x}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className={label}>Best time for a call</span>
                <select value={f.when} onChange={(e) => setF({ ...f, when: e.target.value })} className={input}>
                  <option value="">Any time</option>
                  <option>Weekday morning</option>
                  <option>Weekday afternoon</option>
                  <option>Weekday evening</option>
                  <option>Saturday</option>
                </select>
              </label>
              <label className="block">
                <span className={label}>Anything else? (optional)</span>
                <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={600} className={input} />
              </label>
              {/* Bots fill this in; people never see it. */}
              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.fax} onChange={(e) => setF({ ...f, fax: e.target.value })} className="hidden" name="fax" />
              <label className="flex items-start gap-2 text-sm text-[#5d6676] sm:col-span-2">
                <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} className="mt-0.5 h-4 w-4 accent-[#10203f]" />
                Also send me practical marketing tips by email (about twice a month, unsubscribe anytime).
              </label>
              {err ? <div className="text-sm text-[#b42318] sm:col-span-2">{err}</div> : null}
              <button type="submit" disabled={state === "sending"} className="rounded-xl bg-[#d4ad4b] px-5 py-3 font-semibold text-[#10203f] hover:brightness-105 disabled:opacity-60 sm:col-span-2">
                {state === "sending" ? "Sending…" : "Book my free demo"}
              </button>
              <p className="text-xs text-[#5d6676] sm:col-span-2">
                We use your details only to arrange the demo{f.consent ? " and send the tips you asked for" : ""}. See our <Link href="/privacy" className="underline">Privacy Policy</Link>.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
