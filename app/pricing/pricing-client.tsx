"use client"

// Pricing: monthly / yearly, one tab per Autopilot tool (free trial, Starter, Pro), a comparison of all tools,
// the done-for-you agency packages, FAQs and the demo / start-free calls to action.

import Link from "next/link"
import { useState } from "react"
import { Section, SectionTitle, SiteFooter, SiteHeader, WhatsAppButton } from "@/components/site/site"
import { ui, WHATSAPP } from "@/components/site/ui"
import { canHaveExtra, EXTRA_LABEL, PRODUCT_KEYS, PRODUCTS, YEARLY_MONTHS, rupees, type Cycle, type ProductKey } from "@/lib/autopilot/products"

const SHORT: Record<ProductKey, string> = { linkedin: "LinkedIn", meta: "Instagram + Facebook", blog: "Blog (WordPress)", newsletter: "Email Marketing" }

const COMMON = ["Written in your voice: English, Hinglish or Hindi", "You approve every post, from email or your phone", "Your Brand kit: logo, colours, fonts, six designs", "A planned mix: teach, story, proof, conversation, offer", "This week's news on your topics, used when it fits", "Ideas and Indian festival calendar"]

const EXTRA: Record<ProductKey, string[]> = {
  linkedin: ["Text, image and PDF carousel posts", "Posts to your LinkedIn profile on schedule", "Learns from your edits"],
  meta: ["Designed single images and carousels", "Captions with hashtags", "Posts to Instagram and your Facebook Page", "Or use your own photos"],
  blog: ["SEO articles of 800 to 1,800 words, with FAQs", "Meta descriptions and clean headings", "Publishes to your WordPress site", "Publish or save as draft"],
  newsletter: ["Newsletters and AI-written campaigns", "Welcome, nurture and sales sequences", "Hosted signup page and website form", "Lists, tags, segments and CSV import", "Sent from your own email"],
}

const PRO_EXTRA: Record<ProductKey, string> = {
  linkedin: "Enough for a post every weekday",
  meta: "Enough for a post every day",
  blog: "Build topical authority fast",
  newsletter: "Bigger lists, weekly sends",
}

const FAQS = [
  { q: "Is there really a free trial?", a: "Yes. Every tool starts with 3 free posts (or articles or email issues). No card needed. You see real posts for your business before you pay anything." },
  { q: "Does anything post without my approval?", a: "No. Drafts wait for you. Approve, edit or ask the AI to rewrite from your dashboard, the Android app or straight from the email we send you." },
  { q: "How do I pay?", a: "By UPI or card. Card payments renew automatically through Razorpay. UPI payments are checked and activated by us, usually within a few hours." },
  { q: "What does yearly billing give me?", a: `You pay for ${YEARLY_MONTHS} months and get 12, with the whole year's posts available from day one.` },
  { q: "Can I cancel or change plans?", a: "Any time, from Billing in your dashboard. Your plan keeps working until the end of the period you've paid for. See our Cancellation & Refund Policy for details." },
  { q: "Which languages and platforms?", a: "English, Hinglish and Hindi. LinkedIn profiles, Instagram business accounts, Facebook Pages, WordPress sites, and any email account that can send by SMTP (Gmail, Zoho, your hosting email)." },
]

const PACKAGES = [
  { name: "Starter Automation", price: "₹9,999", items: ["Lead capture automation", "CRM setup", "WhatsApp alerts", "Basic workflows"] },
  { name: "Growth Automation", price: "₹24,999", items: ["AI workflow systems", "n8n automation", "AI content systems", "CRM pipelines", "WhatsApp automation"], popular: true },
  { name: "AI Business System", price: "Custom", items: ["Full automation stack", "AI agents", "Dashboards", "Advanced integrations", "Ongoing optimisation"] },
]

export function PricingClient() {
  const [cycle, setCycle] = useState<Cycle>("monthly")
  const [tool, setTool] = useState<ProductKey>("linkedin")
  const p = PRODUCTS[tool]
  const per = (paise: number) => (cycle === "yearly" ? Math.round((paise * YEARLY_MONTHS) / 12) : paise)

  return (
    <div className={ui.page}>
      <SiteHeader active="Pricing" />
      <WhatsAppButton />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className={ui.glow} />
        <div className={ui.wrap + " relative py-16 text-center sm:py-20 lg:py-24"}>
          <div className={ui.pill}>3 free posts on every tool · no card needed</div>
          <h1 className={ui.h1 + " mx-auto mt-6 max-w-4xl"}>
            Simple plans. <span className={ui.gradient}>Serious results.</span>
          </h1>
          <p className={ui.lead + " mx-auto mt-6 max-w-2xl"}>Pick the channels you want covered. Xredible writes in your voice, designs in your brand, and posts on schedule after you approve. Prices in Indian rupees.</p>
          <div className="mt-9 inline-flex rounded-2xl border border-white/15 bg-white/5 p-1" role="group" aria-label="Billing">
            {(["monthly", "yearly"] as const).map((c) => (
              <button key={c} type="button" aria-pressed={cycle === c} onClick={() => setCycle(c)} className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${cycle === c ? "bg-[#d4ad4b] text-[#0b1530]" : "text-slate-300 hover:text-white"}`}>
                {c === "monthly" ? "Monthly" : "Yearly · 2 months free"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Plans per tool */}
      <Section>
        <div className="flex flex-wrap justify-center gap-2" role="tablist" aria-label="Automation">
          {PRODUCT_KEYS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tool === k} onClick={() => setTool(k)} className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${tool === k ? "border-[#d4ad4b] bg-[#d4ad4b]/15 text-[#f0d68a]" : "border-white/15 text-slate-300 hover:border-white/30 hover:text-white"}`}>
              {SHORT[k]}
            </button>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-slate-400">{p.tagline}</p>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {/* Free trial */}
          <div className={ui.card + " flex flex-col p-8"}>
            <h3 className="text-2xl font-bold">Free trial</h3>
            <div className="mt-5 text-5xl font-black">₹0</div>
            <div className="mt-2 text-sm text-slate-400">
              {p.trial} {p.unit}
              {p.trialContacts ? ` · up to ${p.trialContacts} subscribers` : ""} · no card
            </div>
            <ul className="mt-8 flex-1 space-y-3 text-[15px] text-slate-300">
              <li>✔ Everything in Starter, to try it out</li>
              <li>✔ Set up your voice and Brand kit</li>
              <li>✔ Publish real posts for your business</li>
            </ul>
            <Link href="/dashboard?signup" className={ui.btnGhost + " mt-8 w-full"}>
              Start free
            </Link>
          </div>

          {p.plans.map((pl, i) => {
            const popular = i === 0
            return (
              <div key={pl.key} className={(popular ? "rounded-3xl border border-[#d4ad4b]/45 bg-[#d4ad4b]/10 shadow-2xl shadow-[#d4ad4b]/10" : ui.card) + " flex flex-col p-8"}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-bold">{pl.name}</h3>
                  {popular ? <span className="rounded-full bg-[#d4ad4b] px-3 py-1 text-xs font-bold text-[#0b1530]">MOST POPULAR</span> : null}
                </div>
                <div className="mt-5 flex items-end gap-1.5">
                  <span className="text-5xl font-black text-[#d4ad4b]">{rupees(per(pl.price))}</span>
                  <span className="pb-1.5 text-slate-400">/month</span>
                </div>
                <div className="mt-2 text-sm text-slate-400">{cycle === "yearly" ? `${rupees(pl.price * YEARLY_MONTHS)} billed yearly (save ${rupees(pl.price * 2)})` : "Billed monthly · cancel any time"}</div>
                <div className={ui.tile + " mt-6 px-4 py-3 text-[15px]"}>
                  <b className="text-white">
                    {pl.posts} {p.unit} a month
                  </b>
                  <span className="text-slate-400"> · {pl.blurb}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-3 text-[15px] text-slate-300">
                  {[...EXTRA[tool], ...COMMON.slice(0, popular ? 4 : 6), ...(popular ? [] : [PRO_EXTRA[tool]])].map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-[#35c2a7]">✔</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/dashboard?signup" className={(popular ? ui.btn : ui.btnGhost) + " mt-8 w-full"}>
                  Start free, then {pl.name}
                </Link>
              </div>
            )
          })}
        </div>
        <p className="mt-8 text-center text-sm text-slate-400">
          Pay by UPI or card. Plans are per tool: use one, or all four. See our{" "}
          <Link href="/refund-policy" className="text-[#e9cf86] underline-offset-4 hover:underline">
            Cancellation &amp; Refund Policy
          </Link>
          .
        </p>
      </Section>

      {/* Compare */}
      <Section band>
        <SectionTitle title="All tools at a glance" sub={cycle === "yearly" ? "Prices per month, billed yearly." : "Prices per month."} />
        <div className="mt-12 overflow-x-auto rounded-3xl border border-white/10">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="bg-white/5 text-sm text-slate-400">
              <tr>
                <th className="px-6 py-4 font-medium">Tool</th>
                <th className="px-6 py-4 font-medium">Free trial</th>
                <th className="px-6 py-4 font-medium">Starter</th>
                <th className="px-6 py-4 font-medium">Pro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {PRODUCT_KEYS.map((k) => {
                const x = PRODUCTS[k]
                return (
                  <tr key={k} className="align-top">
                    <td className="px-6 py-5">
                      <div className="font-semibold text-white">{x.name}</div>
                      <div className="mt-1 max-w-xs text-sm text-slate-400">{x.tagline}</div>
                    </td>
                    <td className="px-6 py-5 text-slate-300">
                      {x.trial} {x.unit}
                    </td>
                    {x.plans.map((pl) => (
                      <td key={pl.key} className="px-6 py-5">
                        <div className="text-lg font-bold text-[#d4ad4b]">{rupees(per(pl.price))}</div>
                        <div className="text-sm text-slate-400">
                          {pl.posts} {x.unit}/month
                          {pl.contacts ? ` · ${pl.contacts.toLocaleString("en-IN")} subscribers` : ""}
                        </div>
                        {canHaveExtra(k) ? <div className="mt-1 text-xs text-slate-500">+ {rupees(Math.round(per(pl.price) / 200) * 100)} per extra {EXTRA_LABEL[k].one}</div> : null}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-slate-400">
          More than one LinkedIn profile, Facebook Page or WordPress site? Add extra profiles to a plan: each one is half the plan price and comes with the plan&rsquo;s full post count.
        </p>
      </Section>

      {/* Done for you */}
      <Section>
        <SectionTitle title="Need something built for you?" sub="Custom automation systems by our team: lead capture, WhatsApp, CRM pipelines and AI agents. One-time project pricing." />
        <div className="mt-14 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {PACKAGES.map((k) => (
            <div key={k.name} className={k.popular ? "rounded-3xl border border-[#d4ad4b]/40 bg-[#d4ad4b]/10 p-8" : ui.card + " p-8"}>
              <h3 className="text-2xl font-bold">{k.name}</h3>
              <div className="mt-5 text-4xl font-black text-[#d4ad4b]">{k.price}</div>
              <ul className="mt-8 space-y-3 text-slate-300">
                {k.items.map((x) => (
                  <li key={x}>
                    <span className="text-[#35c2a7]">✔</span> {x}
                  </li>
                ))}
              </ul>
              <Link href="/#contact" className={ui.btnGhost + " mt-8 w-full"}>
                Talk to us
              </Link>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section band>
        <SectionTitle title="Questions, answered" />
        <div className="mx-auto mt-14 grid max-w-5xl gap-5 md:grid-cols-2">
          {FAQS.map((f) => (
            <div key={f.q} className={ui.card + " p-7"}>
              <h3 className="text-lg font-semibold text-[#e9cf86]">{f.q}</h3>
              <p className="mt-3 leading-relaxed text-slate-400">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="relative overflow-hidden">
        <div className={ui.glow} />
        <div className={ui.wrap + " relative py-20 text-center"}>
          <h2 className={ui.h2}>See it working for your business</h2>
          <p className={ui.lead + " mx-auto mt-5 max-w-2xl text-slate-400"}>A free 15-minute demo: we set up your brand and write your first posts together. Or start free right now.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-4">
            <Link href="/demo#book" className={ui.btn + " px-8 py-4"}>
              Book a free demo
            </Link>
            <Link href="/dashboard?signup" className={ui.btnGhost + " px-8 py-4"}>
              Start free
            </Link>
            <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className={ui.btnGhost + " px-8 py-4"}>
              WhatsApp us
            </a>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  )
}
