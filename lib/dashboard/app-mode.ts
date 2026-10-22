"use client"

// Inside the Xredible Android app (a Trusted Web Activity) the dashboard hides buying and changing
// plans: Google Play requires its own billing for that, so customers subscribe on the website.
// The app opens /dashboard?app=android; we remember it in a cookie for later page loads.

import { useSyncExternalStore } from "react"

export const ANDROID_PACKAGE = "com.xredible.app"
const COOKIE = "xd_app=android"

export function noteAppMode() {
  if (typeof window === "undefined") return
  const fromApp = new URLSearchParams(window.location.search).get("app") === "android" || document.referrer.startsWith(`android-app://${ANDROID_PACKAGE}`)
  if (fromApp && !document.cookie.includes(COOKIE)) document.cookie = `${COOKIE}; path=/; max-age=31536000; samesite=lax; secure`
}

const read = () => typeof document !== "undefined" && (document.cookie.includes(COOKIE) || new URLSearchParams(window.location.search).get("app") === "android")

/** True inside the Android app. */
export const useInApp = () =>
  useSyncExternalStore(
    () => () => {},
    read,
    () => false,
  )
