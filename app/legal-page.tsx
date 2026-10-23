import type { ReactNode } from "react"
import { SiteFooter, SiteHeader } from "@/components/site/site"
import { ui } from "@/components/site/ui"

/** Terms, Privacy, Refunds, Delivery and similar pages: the site header and footer around easy-to-read text. */
export function LegalPage({ title, updated, intro, children }: { title: string; updated?: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className={ui.page}>
      <SiteHeader />
      <section className="relative overflow-hidden border-b border-white/10">
        <div className={ui.glow} />
        <div className="relative mx-auto max-w-3xl px-5 py-14 sm:px-6 sm:py-16">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">{title}</h1>
          {updated ? <p className="mt-3 text-sm text-slate-400">Last updated {updated}</p> : null}
          {intro ? <div className="mt-5 text-lg leading-relaxed text-slate-300">{intro}</div> : null}
        </div>
      </section>
      <main className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-6 sm:py-14">
        <div className="space-y-6 text-[16px] leading-relaxed text-slate-300 [&_a]:text-[#e9cf86] [&_a]:underline [&_a]:underline-offset-4 [&_b]:text-white [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-white [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-[#d4ad4b] [&_strong]:text-white [&_ul]:space-y-2">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
