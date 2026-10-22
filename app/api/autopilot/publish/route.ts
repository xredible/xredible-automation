// POST /api/autopilot/publish { id } — called by n8n (XD-LI-P) for each approved post that is due.
// Needs the X-XD-Secret header. The site decrypts the customer's LinkedIn access and posts.

import { NextResponse } from "next/server"
import { fromN8n } from "@/lib/autopilot/guard"
import { publishOne } from "@/lib/autopilot/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  if (!fromN8n(request)) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 })
  let id = 0
  try {
    id = Number(((await request.json()) as { id?: unknown }).id)
  } catch {}
  if (!Number.isInteger(id) || id < 1) return NextResponse.json({ ok: false, error: "Bad id." }, { status: 400 })
  const r = await publishOne(id)
  return NextResponse.json(r)
}
