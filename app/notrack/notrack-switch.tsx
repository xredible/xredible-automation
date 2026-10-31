"use client"

import { useState, useSyncExternalStore } from "react"
import { noTrack, setNoTrack } from "@/lib/notrack"
import { ui } from "@/components/site/ui"

const subscribe = () => () => {}

const OTHER_SITES = [
  { name: "elevatingchrist.com", href: "https://www.elevatingchrist.com/?notrack=1" },
  { name: "nestoodle.com", href: "https://nestoodle.com/?notrack=1" },
]

export function NoTrackSwitch() {
  const saved = useSyncExternalStore(subscribe, () => (noTrack() ? "off" : "on"), () => "unknown")
  const [changed, setChanged] = useState<null | "on" | "off">(null)
  const state = changed || saved
  if (state === "unknown") return null
  const off = state === "off"
  return (
    <div className="space-y-6">
      <div className={ui.card + " p-7"}>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">This browser on xredible.in</div>
        <p className="mt-2 text-2xl font-bold">{off ? "Not counted in analytics" : "Counted in analytics"}</p>
        <p className="mt-2 text-slate-400">
          {off ? "Your visits here don't reach Google Analytics." : "Your visits here are counted like any visitor's."}
        </p>
        <button
          type="button"
          className={ui.btn + " mt-5"}
          onClick={() => {
            setNoTrack(!off)
            setChanged(off ? "on" : "off")
          }}
        >
          {off ? "Count my visits again" : "Don't count my visits"}
        </button>
      </div>
      <div className={ui.card + " p-7"}>
        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">The other websites</div>
        <p className="mt-2 text-slate-400">Each website keeps its own setting. Open each link once in this browser:</p>
        <ul className="mt-4 space-y-2">
          {OTHER_SITES.map((s) => (
            <li key={s.name}>
              <a href={s.href} target="_blank" rel="noopener" className="font-semibold text-[#e9cf86] underline underline-offset-4">
                Don&rsquo;t count me on {s.name}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-500">Do this on every phone, laptop and browser you use (and again after clearing browser data). To be counted again, open the site with ?notrack=0 at the end of the address.</p>
      </div>
    </div>
  )
}
