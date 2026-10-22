// GET /dashboard/data?biz=linkedin-agency&section=results&start=2026-09-19&end=2026-10-16&cmp=prev&…
// Signed-in only, and only for businesses this account was given.
// Forwards to that business's n8n Dashboard API through the n8n gateway.

import { NextResponse } from "next/server"
import { canSee, currentUser, loadSection, sectionAllowed } from "@/lib/dashboard/server"
import { DEFAULT_BUSINESS, isBusiness } from "@/lib/dashboard/businesses"
import { loadAutopilotSection } from "@/lib/autopilot/report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// n8n on the Pi can take 10–25 s for a long date range.
export const maxDuration = 60

export async function GET(request: Request) {
  const me = await currentUser()
  if (!me) {
    return NextResponse.json({ ok: false, error: "Signed out. Reload the page to sign in again." }, { status: 401 })
  }
  const search = new URL(request.url).searchParams
  const biz = search.get("biz") || DEFAULT_BUSINESS
  if (!isBusiness(biz) || !(await canSee(biz))) {
    return NextResponse.json({ ok: false, error: "Your account doesn't include this business." }, { status: 403 })
  }
  const section = search.get("section") || ""
  if (!sectionAllowed(biz, section)) {
    return NextResponse.json({ ok: false, error: "Unknown section." }, { status: 400 })
  }
  // A customer's own automations are computed here, from their data and connected accounts.
  const result = biz === "autopilot" ? await loadAutopilotSection(me.email, section, search) : await loadSection(biz, section, search, search.get("fresh") === "1")
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } })
}
