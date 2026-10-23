// POST /api/demo — "Book a live demo" from xredible.in/demo. Public: honeypot, size and rate limits.

import { requestDemo } from "@/lib/autopilot/demo"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function POST(request: Request) {
  const raw = await request.text()
  if (raw.length > 8000) return Response.json({ ok: false, error: "That's too long." }, { status: 413 })
  let b: Record<string, unknown> = {}
  try {
    b = JSON.parse(raw)
  } catch {
    return Response.json({ ok: false, error: "Please try again." }, { status: 400 })
  }
  if (b.fax) return Response.json({ ok: true }) // a bot: pretend it worked
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
  try {
    await requestDemo(b, ip)
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Please try again." }, { status: 400 })
  }
}
