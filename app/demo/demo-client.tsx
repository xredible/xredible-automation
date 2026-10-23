"use client"

// Public demo page: a sample week for four kinds of business (designs drawn live by the real template engine),
// how it works, what's included, and a "Book a live demo" form that goes to /api/demo.

import Link from "next/link"
import { useState } from "react"
import { DEMO_BRANDS } from "@/lib/autopilot/demo-samples"
import { GOAL_LABEL, type Goal } from "@/lib/autopilot/formats"

const WHATSAPP = "918085949384"
const INTERESTS = ["LinkedIn", "Instagram + Facebook", "Blog writing", "Email marketing", "Custom automation"]
const GOAL_STYLE: Record<Goal, string> = {
  teach: "bg-[#e7eefc] text-[#24438a]",
  story: "bg-[#fbf1dc] text-[#7a5a12]",
  proof: "bg-[#e3f4ef] text-[#17695a]",
  talk: "bg-[#efe9fb] text-[#5a3d9a]",
  offer: "bg-[#d4ad4b] text-[#10203f]",
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
    <main className="min-h-screen bg-[#f6f4ee] text-[#15171c]">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#10203f]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center" aria-label="Xredible home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/xredible-logo-white.png" alt="Xredible Automation" width={142} height={45} className="h-9 w-auto" />
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm text-white/80 sm:flex">
            <a href="#sample" className="hover:text-white">Sample week</a>
            <a href="#how" className="hover:text-white">How it works</a>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
          </nav>
          <a href="#book" className="ml-auto rounded-xl bg-[#d4ad4b] px-4 py-2 text-sm font-semibold text-[#10203f] hover:brightness-105 sm:ml-0">
            Book a demo
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[#10203f] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
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
                <span className={`rounded-full px-2 py-0.5 font-medium ${GOAL_STYLE.teach}`}>Teach</span>
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
      <section id="sample" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#10203f]">A sample week for a business like yours</h2>
        <p className="mt-2 max-w-2xl text-[#5d6676]">Pick a business. Every week mixes posts that teach, tell a story, show proof, start a conversation and, now and then, make an offer.</p>
        <div className="mt-6 flex flex-wrap gap-2" role="tablist" aria-label="Sample business">
          {DEMO_BRANDS.map((x) => (
            <button key={x.key} type="button" role="tab" aria-selected={x.key === brand} onClick={() => setBrand(x.key)} className={`rounded-full border px-4 py-2 text-sm font-medium transition ${x.key === brand ? "border-[#10203f] bg-[#10203f] text-white" : "border-[#e6e3da] bg-white hover:border-[#10203f]/40"}`}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-[#e6e3da] bg-white p-5">
            <div className="text-sm text-[#5d6676]">Sample brand</div>
            <div className="text-lg font-bold text-[#10203f]">{b.name}</div>
            <ul className="mt-4 divide-y divide-[#efece4]">
              {b.week.map((p) => (
                <li key={p.day} className="flex gap-3 py-3">
                  <div className="w-10 shrink-0 text-sm font-semibold text-[#10203f]">{p.day}</div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${GOAL_STYLE[p.goal]}`}>{GOAL_LABEL[p.goal]}</span>
                      <span className="text-[#5d6676]">
                        {p.channel} · {p.format === "carousel" ? "Carousel" : p.format === "image" ? "Image post" : "Text post"}
                      </span>
                    </div>
                    <div className="mt-1 text-[15px] leading-snug">{p.hook}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="grid grid-cols-3 gap-3">
              {(["cover", "slide", "offer"] as const).map((v) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={b.key + v} src={`/api/autopilot/demo?b=${b.key}&v=${v}`} alt={`${b.name}: ${v === "offer" ? "offer post" : v === "cover" ? "carousel cover" : "carousel slide"}`} width={1080} height={1350} loading="lazy" className="aspect-[4/5] w-full rounded-xl border border-[#e6e3da] bg-[#efece4] object-cover" />
              ))}
            </div>
            <p className="mt-3 text-sm text-[#5d6676]">Carousel cover, a slide and an offer post, drawn by Xredible in this brand&apos;s colours and fonts. Yours use your own logo and colours, in six designs.</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-[#e6e3da] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="text-3xl font-extrabold tracking-tight text-[#10203f]">How it works</h2>
          <ol className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.t} className="rounded-2xl border border-[#e6e3da] p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#10203f] font-bold text-[#d4ad4b]">{i + 1}</div>
                <div className="mt-3 font-semibold text-[#10203f]">{s.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-[#5d6676]">{s.d}</p>
              </li>
            ))}
          </ol>
          <h3 className="mt-12 text-xl font-bold text-[#10203f]">What&apos;s included</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INCLUDED.map((x) => (
              <div key={x.t} className="rounded-2xl bg-[#f6f4ee] p-5">
                <div className="font-semibold text-[#10203f]">{x.t}</div>
                <p className="mt-1 text-sm leading-relaxed text-[#5d6676]">{x.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-[#5d6676]">
            Plans from ₹999 a month per automation. <Link href="/pricing" className="font-medium text-[#24438a] underline">See pricing</Link>
          </p>
        </div>
      </section>

      <BookDemo />

      <footer className="bg-[#10203f] text-white/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-8 text-sm sm:px-6">
          <span>© Xredible</span>
          <Link href="/contact" className="hover:text-white">Contact</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
          <a href={`https://wa.me/${WHATSAPP}`} className="ml-auto hover:text-white">WhatsApp +91 80859 49384</a>
        </div>
      </footer>
    </main>
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
    <section id="book" className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="grid gap-8 rounded-3xl bg-[#10203f] p-6 text-white sm:p-10 lg:grid-cols-[0.8fr_1.2fr]">
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
