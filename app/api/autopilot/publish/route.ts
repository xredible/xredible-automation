// POST /api/autopilot/publish { id, kind? } — called by n8n for each approved item that is due.
//   kind "linkedin" (default, XD-LI-P) or "item" (Instagram/Facebook, WordPress, newsletter, XD-AP-P).
// Needs the X-XD-Secret header. The site decrypts the customer's access and publishes.

import { NextResponse } from "next/server"
import { fromN8n } from "@/lib/autopilot/guard"
import { publishOne } from "@/lib/autopilot/service"
import { publishItem } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(request: Request) {
  if (!fromN8n(request)) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 })
  let id = 0
  let kind = "linkedin"
  try {
    const b = (await request.json()) as { id?: unknown; kind?: unknown }
    id = Number(b.id)
    kind = b.kind === "item" ? "item" : "linkedin"
  } catch {}
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "Bad id." }, { status: 400 })
  const r = kind === "item" ? await publishItem(id) : await publishOne(id)
  return NextResponse.json(r)
}
