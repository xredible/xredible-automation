"use client"

// Google Analytics for xredible.in, except in browsers that opted out ("Don't count my visits", see /notrack).

import { useSyncExternalStore } from "react"
import { GoogleAnalytics } from "@next/third-parties/google"
import { GA_ID, noTrack } from "@/lib/notrack"

const subscribe = () => () => {}

export function SiteAnalytics() {
  // On the server (and the first paint) nothing loads; in the browser it loads unless opted out.
  const track = useSyncExternalStore(subscribe, () => !noTrack(), () => false)
  return track ? <GoogleAnalytics gaId={GA_ID} /> : null
}
