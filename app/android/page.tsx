import type { Metadata } from "next"
import Link from "next/link"
import { SiteFooter, SiteHeader } from "@/components/site/site"
import { ui } from "@/components/site/ui"

export const metadata: Metadata = {
  title: "Android app | Xredible Autopilot",
  description: "Get Xredible Autopilot on your Android phone: approve posts, see results and get ideas on the go.",
}

const STEPS = [
  ["Download", "Tap the button above on your Android phone. The file is small (under 1 MB)."],
  ["Allow the install", "Android asks once to allow installs from your browser. Tap Settings → turn on “Allow from this source” → go back."],
  ["Install and open", "Tap Install, then Open. Sign in with your Xredible email and password."],
] as const

const PERKS = ["Approve, edit or rewrite drafts in seconds", "See what posted and how it did", "Ideas and festival posts on the go", "Works with all your Autopilot tools"]

export default function AndroidApp() {
  return (
    <div className={ui.page}>
      <SiteHeader />
      <section className="relative overflow-hidden border-b border-white/10">
        <div className={ui.glow} />
        <div className={ui.wrap + " relative grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.2fr_0.8fr]"}>
          <div>
            <div className={ui.pill}>Android app</div>
            <h1 className={ui.h1 + " mt-6"}>
              Xredible Autopilot, <span className={ui.gradient}>in your pocket</span>
            </h1>
            <p className={ui.lead + " mt-6 max-w-xl"}>Approve posts, see results and get ideas from your phone. Your drafts arrive, you tap Approve, they post on schedule.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a href="/app/xredible-autopilot.apk" download className={ui.btn + " px-8 py-4"}>
                Download for Android
              </a>
              <Link href="/dashboard" className={ui.btnGhost + " px-8 py-4"}>
                Open in browser
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-400">Android 6 or newer. Coming soon to Google Play.</p>
          </div>
          <div className={ui.card + " p-8"}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/app/icon-192.png" alt="Xredible Autopilot app icon" width={96} height={96} className="h-24 w-24 rounded-3xl shadow-2xl" />
            <ul className="mt-6 space-y-3 text-slate-300">
              {PERKS.map((p) => (
                <li key={p} className="flex gap-2">
                  <span className="text-[#35c2a7]">✔</span>
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <main className={ui.wrap + " py-14 sm:py-16"}>
        <h2 className="text-3xl font-bold tracking-tight">Install in three steps</h2>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className={ui.card + " p-7"}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#d4ad4b] font-bold text-[#0b1530]">{i + 1}</span>
              <div className="mt-4 text-lg font-semibold">{t}</div>
              <div className="mt-1 text-slate-400">{d}</div>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-3xl text-slate-400">
          The app opens your dashboard, so everything you can do there works here too. Plans are bought and changed on the website, not in the app.{" "}
          <Link href="/pricing" className="text-[#e9cf86] underline underline-offset-4">
            See plans
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}
