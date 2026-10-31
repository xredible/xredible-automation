import type { Metadata } from "next"
import { SiteFooter, SiteHeader } from "@/components/site/site"
import { ui } from "@/components/site/ui"
import { NoTrackSwitch } from "./notrack-switch"

export const metadata: Metadata = {
  title: "Don't count my visits | Xredible",
  description: "Leave this browser out of the website analytics.",
  robots: { index: false, follow: false },
}

export default function NoTrack() {
  return (
    <div className={ui.page}>
      <SiteHeader />
      <main className={ui.wrap + " max-w-2xl py-14 sm:py-16"}>
        <h1 className={ui.h1}>Don&rsquo;t count my visits</h1>
        <p className={ui.lead + " mt-4"}>For the team: switch this on in every browser you use, so your own clicks don&rsquo;t show up in the website numbers.</p>
        <div className="mt-8">
          <NoTrackSwitch />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
