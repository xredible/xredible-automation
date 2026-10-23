// /join/confirm?c=<contact>&s=<signature> — the link in the double opt-in email.

import type { Metadata } from "next"
import { confirm, confirmOk } from "@/lib/autopilot/email"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Subscription confirmed", robots: { index: false, follow: false } }

export default async function Confirm(props: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await props.searchParams
  const id = Number(q.c)
  const ok = Number.isInteger(id) && id > 0 && confirmOk(id, String(q.s || ""))
  const r = ok ? await confirm(id) : null
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#f4f5f7", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 440, width: "100%", background: "#fff", borderRadius: 16, padding: 28, textAlign: "center", color: "#1f2937" }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>{r ? "You're subscribed ✓" : "This link has expired"}</h1>
        <p style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.6 }}>{r ? `Thanks for confirming. Your first email from ${r.name} is on its way soon.` : "Please sign up again from the form."}</p>
      </div>
    </main>
  )
}
