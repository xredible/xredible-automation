"use client";

import Link from "next/link";
import { useState } from "react";
import { Section, SectionTitle, SiteFooter, SiteHeader, WhatsAppButton } from "@/components/site/site";
import { ui, WHATSAPP } from "@/components/site/ui";

const services = [
  { title: "n8n Workflow Automation", desc: "Custom workflows that automate repetitive business tasks, CRM updates, lead routing, notifications, reporting, and more.", icon: "⚡" },
  { title: "AI Marketing Systems", desc: "AI-powered content generation, lead nurturing, automated campaigns, and smart customer engagement systems.", icon: "🤖" },
  { title: "WhatsApp Automation", desc: "Automated WhatsApp lead capture, follow-ups, reminders, customer support, and sales pipelines.", icon: "💬" },
  { title: "Instagram Automation", desc: "AI captions, automated posting workflows, analytics dashboards, and social media automation systems.", icon: "📱" },
  { title: "CRM & Lead Pipelines", desc: "Connect ads, forms, emails, WhatsApp, and CRMs into one centralized automation ecosystem.", icon: "📊" },
  { title: "Custom AI Agents", desc: "Build intelligent AI assistants for sales, support, onboarding, content creation, and internal operations.", icon: "🧠" },
];

const testimonials = [
  { name: "Digital Marketing Agency", feedback: "Xredible automated our lead management system and saved us hours every day." },
  { name: "Local Business Owner", feedback: "The WhatsApp automation setup dramatically improved customer response times." },
  { name: "Content Creator", feedback: "AI workflow systems helped automate our content pipeline completely." },
];

const faqs = [
  { q: "What businesses can benefit from automation?", a: "Any business handling leads, content, customer support, or repetitive operations can benefit from automation systems." },
  { q: "Do you provide custom AI solutions?", a: "Yes. We build custom AI agents, workflows, dashboards, and business automation systems." },
  { q: "Can you integrate WhatsApp with my business?", a: "Absolutely. We build WhatsApp automation systems for sales, support, reminders, and lead generation." },
  { q: "What is Xredible Autopilot?", a: "Our ready-made tools that write and publish your LinkedIn, Instagram, Facebook, blog and email content in your voice and brand. You approve every post. Plans start at ₹999 a month, and every tool starts with 3 free posts." },
];

const packages = [
  { name: "Starter Automation", price: "₹9,999", items: ["Lead Capture Automation", "CRM Setup", "WhatsApp Alerts", "Basic Workflows"] },
  { name: "Growth Automation", price: "₹24,999", items: ["AI Workflow Systems", "n8n Automation", "AI Content Systems", "CRM Pipelines", "WhatsApp Automation"], popular: true },
  { name: "AI Business System", price: "Custom", items: ["Full Automation Stack", "AI Agents", "Dashboards", "Advanced Integrations", "Ongoing Optimization"] },
];

const projects = [
  { t: "WhatsApp Lead Automation", d: "Automated lead capture and instant notifications for faster customer response times." },
  { t: "AI Content Workflow", d: "AI-powered content generation and automated publishing systems." },
  { t: "CRM Pipeline Automation", d: "Centralized automation system connecting forms, email, sheets, and notifications." },
];

export default function XredibleAutomationWebsite() {
  const [sent, setSent] = useState<"idle" | "sending" | "done">("idle");
  const [err, setErr] = useState("");

  return (
    <div className={ui.page + " scroll-smooth"}>
      <SiteHeader />
      <WhatsAppButton />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/10">
        <div className={ui.glow} />
        <div className={ui.wrap + " relative py-20 sm:py-28 lg:py-36"}>
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
            <div>
              <div className={ui.pill + " mb-6"}>AI + Automation Agency</div>
              <h1 className={ui.h1}>
                Automate Your Business With <span className={ui.gradient}>AI &amp; n8n</span>
              </h1>
              <p className={ui.lead + " mt-8 max-w-xl"}>
                We build intelligent automation systems using AI agents, n8n, WhatsApp automation, CRM workflows, and scalable business systems that save time and increase revenue.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className={ui.btn + " px-8 py-4"}>
                  Book Free Consultation
                </a>
                <a href="#services" className={ui.btnGhost + " px-8 py-4"}>
                  Explore Services
                </a>
              </div>
            </div>

            <div className={ui.card + " p-6 shadow-2xl backdrop-blur-xl sm:p-8"}>
              <div className="grid grid-cols-2 gap-4">
                {[
                  ["24/7", "Automation Running"],
                  ["80%+", "Time Saved"],
                  ["AI", "Smart Workflows"],
                  ["n8n", "Custom Integrations"],
                ].map(([big, small]) => (
                  <div key={small} className={ui.tile + " p-5"}>
                    <div className="text-3xl font-bold text-[#d4ad4b]">{big}</div>
                    <div className="mt-2 text-slate-400">{small}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services */}
      <Section id="services">
        <SectionTitle title="Automation Services" sub="End-to-end automation systems for businesses looking to scale smarter using AI and workflow automation." />
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {services.map((s) => (
            <div key={s.title} className={ui.card + " p-8 transition duration-300 hover:-translate-y-1 hover:border-[#d4ad4b]/30"}>
              <div className="mb-5 text-4xl">{s.icon}</div>
              <h3 className="mb-4 text-2xl font-semibold text-[#e9cf86]">{s.title}</h3>
              <p className="leading-relaxed text-slate-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Autopilot */}
      <Section band>
        <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <div className={ui.pill}>New · Xredible Autopilot</div>
            <h2 className={ui.h2 + " mt-5"}>
              Your social media, <span className={ui.gradient}>written and posted for you</span>
            </h2>
            <p className={ui.lead + " mt-5 text-slate-400"}>
              LinkedIn, Instagram, Facebook, your blog and your email list, in your voice and your brand colours. A planned mix of posts that builds trust first and brings enquiries. You just approve, from your phone.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/demo" className={ui.btn}>
                See it in action
              </Link>
              <Link href="/pricing" className={ui.btnGhost}>
                Plans from ₹999/month
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(["cover", "slide", "offer"] as const).map((v, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={v} src={`/api/autopilot/demo?b=${["coach", "d2c", "cafe"][i]}&v=${v}`} alt="A post designed by Xredible Autopilot" width={1080} height={1350} loading="lazy" className={"aspect-[4/5] w-full rounded-2xl border border-white/10 object-cover shadow-2xl " + (i === 1 ? "-translate-y-4" : "")} />
            ))}
          </div>
        </div>
      </Section>

      {/* Packages */}
      <Section id="pricing">
        <SectionTitle title="Automation Packages" sub="Scalable AI automation systems built for modern businesses." />
        <div className="mt-16 grid gap-6 lg:grid-cols-3 lg:gap-8">
          {packages.map((p) => (
            <div key={p.name} className={p.popular ? "rounded-3xl border border-[#d4ad4b]/40 bg-[#d4ad4b]/10 p-8 shadow-2xl shadow-[#d4ad4b]/10" : ui.card + " p-8"}>
              {p.popular ? <div className="mb-4 inline-block rounded-full bg-[#d4ad4b] px-4 py-2 text-xs font-bold text-[#0b1530]">MOST POPULAR</div> : null}
              <h3 className="text-3xl font-bold">{p.name}</h3>
              <div className="mt-6 text-5xl font-black text-[#d4ad4b]">{p.price}</div>
              <ul className="mt-10 space-y-4 text-slate-300">
                {p.items.map((x) => (
                  <li key={x}>
                    <span className="text-[#35c2a7]">✔</span> {x}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-10 text-center text-slate-400">
          Want it done for you without a custom build? <Link href="/pricing" className="font-semibold text-[#e9cf86] underline-offset-4 hover:underline">See Autopilot plans</Link>
        </p>
      </Section>

      {/* Portfolio */}
      <Section id="portfolio" band>
        <SectionTitle title="Automation Projects" sub="Smart systems designed to increase efficiency and automate business operations." />
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {projects.map((p) => (
            <div key={p.t} className={ui.card + " p-8"}>
              <h3 className="text-2xl font-bold text-[#e9cf86]">{p.t}</h3>
              <p className="mt-4 text-slate-400">{p.d}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Testimonials */}
      <Section>
        <SectionTitle title="Client Feedback" />
        <div className="mt-16 grid gap-6 md:grid-cols-3 lg:gap-8">
          {testimonials.map((t) => (
            <div key={t.name} className={ui.card + " p-8"}>
              <p className="leading-relaxed text-slate-300">&ldquo;{t.feedback}&rdquo;</p>
              <div className="mt-6 font-semibold text-[#d4ad4b]">{t.name}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" band>
        <SectionTitle title="Frequently Asked Questions" />
        <div className="mx-auto mt-16 max-w-4xl space-y-5">
          {faqs.map((f) => (
            <details key={f.q} className={ui.card + " group p-7 open:border-[#d4ad4b]/30"}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xl font-semibold text-[#e9cf86]">
                {f.q}
                <span className="text-2xl leading-none text-slate-500 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 leading-relaxed text-slate-400">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      {/* Contact */}
      <section id="contact" className="scroll-mt-20">
        <div className="mx-auto max-w-4xl px-5 py-20 sm:px-6 lg:py-24">
          <div className={ui.card + " p-7 backdrop-blur-xl sm:p-10"}>
            <div className="text-center">
              <h2 className="text-3xl font-bold sm:text-4xl">Let&rsquo;s Build Your Automation System</h2>
              <p className="mt-4 text-slate-400">Fill out the form below and we&rsquo;ll contact you regarding your automation requirements.</p>
            </div>
            {sent === "done" ? (
              <div className="mt-10 rounded-2xl border border-[#35c2a7]/30 bg-[#35c2a7]/10 p-6 text-center">
                <div className="text-xl font-semibold">Thank you! Your inquiry is in.</div>
                <p className="mt-2 text-slate-300">We&rsquo;ll reply within one working day. In a hurry? Message us on WhatsApp.</p>
                <a href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer" className={ui.btn + " mt-5"}>
                  WhatsApp us now
                </a>
              </div>
            ) : (
              <form
                className="mt-10 grid gap-5 md:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setErr("");
                  setSent("sending");
                  const fd = new FormData(e.currentTarget);
                  const data = { kind: "inquiry", name: fd.get("name"), email: fd.get("email"), business: fd.get("business"), phone: fd.get("whatsapp"), note: fd.get("message"), interests: ["Custom automation"], fax: fd.get("fax") };
                  try {
                    const r = await fetch("/api/demo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
                    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
                    if (!j.ok) {
                      setErr(j.error || "That didn't go through. Please try again or message us on WhatsApp.");
                      setSent("idle");
                      return;
                    }
                  } catch {
                    setErr("No connection. Please try again or message us on WhatsApp.");
                    setSent("idle");
                    return;
                  }
                  setSent("done");
                }}
              >
                <input name="name" type="text" placeholder="Your Name" className={ui.input} required autoComplete="name" />
                <input name="email" type="email" placeholder="Your Email" className={ui.input} required autoComplete="email" />
                <input name="business" type="text" placeholder="Business Name" className={ui.input} autoComplete="organization" />
                <input name="whatsapp" type="tel" placeholder="WhatsApp Number" className={ui.input} autoComplete="tel" required />
                <input name="fax" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                <textarea name="message" placeholder="Tell us what you want to automate" rows={5} className={ui.input + " md:col-span-2"} required />
                {err ? <div className="text-sm text-[#ff8a80] md:col-span-2">{err}</div> : null}
                <button type="submit" disabled={sent === "sending"} className={ui.btn + " py-4 md:col-span-2 disabled:opacity-60"}>
                  {sent === "sending" ? "Sending…" : "Submit Inquiry"}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <SiteFooter />

      {/* Tawk.to Live Chat */}
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: `
            var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
            (function(){
            var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
            s1.async=true;
            s1.src='https://embed.tawk.to/6a1324055568261c36f51b35/1jpdc9dsq';
            s1.charset='UTF-8';
            s1.setAttribute('crossorigin','*');
            s0.parentNode.insertBefore(s1,s0);
            })();
          `,
        }}
      />
    </div>
  );
}
