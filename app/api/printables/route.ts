// GET /api/printables?site=elevating-christ&ref=<sermon slug>
//
// Public: the printables that are live for a page (Sermon Notes, Bible Study Guides), so the
// website can show its downloads without being rebuilt. Only published files are listed.

import { NextResponse } from "next/server"
import { GENERIC, published } from "@/lib/printables/generic"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ORIGINS: Record<string, string[]> = { "elevating-christ": ["https://www.elevatingchrist.com", "https://elevatingchrist.com"] }

export async function GET(request: Request) {
  const u = new URL(request.url)
  const site = u.searchParams.get("site") || ""
  const ref = (u.searchParams.get("ref") || "").slice(0, 120)
  const origin = request.headers.get("origin") || ""
  const cors: Record<string, string> = ORIGINS[site]?.includes(origin) ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}
  if (!GENERIC.includes(site)) return NextResponse.json({ ok: false, error: "Unknown site." }, { status: 404, headers: cors })
  try {
    const items = await published(site, ref || undefined)
    return NextResponse.json({ ok: true, items }, { headers: { ...cors, "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600" } })
  } catch {
    return NextResponse.json({ ok: false, items: [] }, { status: 502, headers: { ...cors, "Cache-Control": "no-store" } })
  }
}
