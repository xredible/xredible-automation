// "Don't count my visits": the owner's and team's own browsers are left out of the website analytics.
// A browser opts out by opening any page with ?notrack=1 (or the switch on /notrack); ?notrack=0 opts back in.
// The flag lives in this browser's localStorage, so each device and browser is switched once.

export const NOTRACK_KEY = "xd_notrack"
export const GA_ID = "G-7QM23N79WN"

/** True when this browser is opted out. Applies a ?notrack=1 / ?notrack=0 in the address first. */
export function noTrack(): boolean {
  if (typeof window === "undefined") return true
  try {
    const p = new URLSearchParams(window.location.search).get("notrack")
    if (p === "1") window.localStorage.setItem(NOTRACK_KEY, "1")
    else if (p === "0") window.localStorage.removeItem(NOTRACK_KEY)
    return window.localStorage.getItem(NOTRACK_KEY) === "1"
  } catch {
    return false
  }
}

export function setNoTrack(on: boolean) {
  try {
    if (on) window.localStorage.setItem(NOTRACK_KEY, "1")
    else window.localStorage.removeItem(NOTRACK_KEY)
  } catch {}
  // Google's own switch: stops any Google tag already on the page from sending more hits.
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${GA_ID}`] = on
}
