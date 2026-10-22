"use client"

// Registers the service worker (installable app + offline page) and remembers when we're inside the Android app.

import { useEffect } from "react"
import { noteAppMode } from "@/lib/dashboard/app-mode"

export function RegisterSW() {
  useEffect(() => {
    noteAppMode()
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {})
  }, [])
  return null
}
