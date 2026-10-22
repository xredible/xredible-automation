// POST /dashboard/blog  { biz, action: "save" | "schedule" | "publish" | "draft" | "skip_topic" | "restore_topic" | "write_now" | "share", … }
// Signed-in only, for businesses this device may see and that have a Blog page.
// Edits and publishes WordPress posts and manages the Topics tab through the
// business's n8n Blog Actions workflow (Nestoodle: NST-DB).

import { NextResponse } from "next/server"
import { canSee, currentUser, parseBlogAction, runBlogAction } from "@/lib/dashboard/server"
import { BUSINESSES, DEFAULT_BUSINESS, isBusiness } from "@/lib/dashboard/businesses"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(request: Request) {
  if (!(await currentUser())) {
    return NextResponse.json({ ok: false, error: "Signed out. Reload the page to sign in again." }, { status: 401 })
  }
  // Only this site's own pages may send changes.
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 403 })
  }
  let input: unknown = null
  try {
    input = await request.json()
  } catch {}
  const biz = (input as { biz?: unknown } | null)?.biz ?? DEFAULT_BUSINESS
  if (!isBusiness(biz) || !(await canSee(biz))) {
    return NextResponse.json({ ok: false, error: "Your account doesn't include this business." }, { status: 403 })
  }
  if (!BUSINESSES[biz].blog) {
    return NextResponse.json({ ok: false, error: "This business has no Blog page." }, { status: 400 })
  }
  const action = parseBlogAction(input)
  if (!action) return NextResponse.json({ ok: false, error: "That change isn't valid." }, { status: 400 })
  const result = await runBlogAction(biz, action)
  return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "private, no-store" } })
}
