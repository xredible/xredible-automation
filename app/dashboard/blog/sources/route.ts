// POST /dashboard/blog/sources  { biz, title, content }
// Signed-in only, for businesses with a Blog page. Checks the article's external links (dead ones
// are unlinked) and adds verified authoritative ones until it has 3–4 (lib/sources). Nothing is
// saved here: the editor shows the result and the person saves it.

import { NextResponse } from "next/server"
import { canSee, currentUser } from "@/lib/dashboard/server"
import { BUSINESSES, isBusiness, type BusinessKey } from "@/lib/dashboard/businesses"
import { checkSources } from "@/lib/sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const AUDIENCE: Partial<Record<BusinessKey, string>> = { nestoodle: "parents of young children in the US and Canada" }

export async function POST(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ ok: false, error: "Signed out. Reload the page to sign in again." }, { status: 401 })
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 })
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  const biz = b.biz
  if (!isBusiness(biz) || !(await canSee(biz))) return NextResponse.json({ ok: false, error: "Your account doesn't include this business." }, { status: 403 })
  if (!BUSINESSES[biz].blog) return NextResponse.json({ ok: false, error: "This business has no Blog page." }, { status: 400 })
  const content = String(b.content || "")
  if (content.length < 300 || content.length > 400_000) return NextResponse.json({ ok: false, error: "This article is too short to add sources to." }, { status: 400 })
  const site = new URL(BUSINESSES[biz].site).hostname.replace(/^www\./, "")
  try {
    const out = await checkSources({ title: String(b.title || "").slice(0, 300), body: content, format: "html", own: [site], site, audience: AUDIENCE[biz] })
    return NextResponse.json({ ok: true, ...out }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "The check failed. Try again." }, { status: 502 })
  }
}
