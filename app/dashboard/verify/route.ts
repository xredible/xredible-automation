// GET /dashboard/verify?t=<token> — the "Confirm my email" link from the welcome email.

import { NextResponse } from "next/server"
import { addNotice, isVerified, noticesFor, readToken } from "@/lib/autopilot/account"
import { SITE } from "@/lib/autopilot/linkedin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const email = await readToken("verify", new URL(request.url).searchParams.get("t") || "")
  if (!email) return NextResponse.redirect(`${SITE}/dashboard?biz=autopilot&verified=expired`)
  if (!isVerified(await noticesFor(email))) await addNotice(email, "verified")
  return NextResponse.redirect(`${SITE}/dashboard?biz=autopilot&verified=1`)
}
