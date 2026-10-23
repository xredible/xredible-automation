// /join/<form id> — a customer's hosted signup page, in their brand colours with their logo.

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { formFor, formOwner } from "@/lib/autopilot/email"
import { kitFor } from "@/lib/autopilot/brandkit"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { robots: { index: false, follow: false } }

const onColour = (h: string) => {
  const n = parseInt(h.slice(1), 16)
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.6 ? "#111827" : "#ffffff"
}

export default async function JoinPage(props: { params: Promise<{ fid: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { fid } = await props.params
  const q = await props.searchParams
  const owner = formOwner(fid)
  if (!owner) notFound()
  const ff = await formFor(owner)
  if (!ff) notFound()
  const kit = await kitFor(owner, { name: String(ff.channel.settings.name || ""), color: String(ff.channel.settings.color || "") })
  const name = String(ff.channel.settings.name || kit.name || "Newsletter")
  const f = ff.form
  const done = q.s === "done" || q.s === "confirm"
  const fonts = [kit.headFont, kit.bodyFont].map((x) => `family=${x.replace(/ /g, "+")}:wght@400;700`).join("&")
  return (
    <main style={{ minHeight: "100vh", background: kit.secondary, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: `"${kit.bodyFont}", system-ui, sans-serif` }}>
      <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?${fonts}&display=swap`} />
      <div style={{ width: "100%", maxWidth: 460, background: "#ffffff", borderRadius: 18, overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.08)" }}>
        <div style={{ background: kit.primary, padding: "22px 28px", color: onColour(kit.primary) }}>
          {kit.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={kit.logo} alt={name} style={{ height: 40, maxWidth: 220, objectFit: "contain" }} />
          ) : (
            <div style={{ fontFamily: `"${kit.headFont}", sans-serif`, fontWeight: 700, fontSize: 20 }}>{name}</div>
          )}
        </div>
        <div style={{ height: 4, background: kit.accent }} />
        <div style={{ padding: "26px 28px 30px", color: "#1f2937" }}>
          {done ? (
            <>
              <h1 style={{ margin: 0, fontFamily: `"${kit.headFont}", sans-serif`, fontSize: 26, color: kit.primary }}>{q.s === "confirm" ? "Check your inbox" : f.thanks}</h1>
              <p style={{ margin: "10px 0 0", fontSize: 16, lineHeight: 1.6 }}>{q.s === "confirm" ? "We've sent you an email. Tap the button in it to confirm your subscription." : `You're on the list for ${name}.`}</p>
            </>
          ) : (
            <>
              <h1 style={{ margin: 0, fontFamily: `"${kit.headFont}", sans-serif`, fontSize: 26, lineHeight: 1.2, color: kit.primary }}>{f.title}</h1>
              <p style={{ margin: "10px 0 18px", fontSize: 16, lineHeight: 1.6, color: "#4b5563" }}>{f.text}</p>
              {q.s === "err" ? <p style={{ margin: "0 0 14px", padding: "10px 12px", borderRadius: 8, background: "#fdeceb", color: "#b42318", fontSize: 14 }}>{q.m || "Something went wrong."}</p> : null}
              <form action={`/api/autopilot/join/${fid}`} method="post" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {f.askName ? (
                  <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
                    Your name
                    <input name="name" autoComplete="name" style={{ padding: "12px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 16 }} />
                  </label>
                ) : null}
                <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 14 }}>
                  Your email
                  <input name="email" type="email" required autoComplete="email" style={{ padding: "12px 14px", border: "1px solid #d1d5db", borderRadius: 10, fontSize: 16 }} />
                </label>
                <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
                <button type="submit" style={{ marginTop: 6, padding: "13px 18px", border: 0, borderRadius: 10, background: kit.accent, color: onColour(kit.accent), fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
                  {f.button}
                </button>
              </form>
              <p style={{ margin: "14px 0 0", fontSize: 12, color: "#6b7280" }}>Unsubscribe any time with one click.</p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
