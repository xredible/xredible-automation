// GET /dashboard/linkedin/connect — sends the signed-in customer to LinkedIn to allow posting.

import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { currentUser } from "@/lib/dashboard/auth"
import { authorizeUrl, linkedinConfigured, SITE } from "@/lib/autopilot/linkedin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const me = await currentUser()
  if (!me) return NextResponse.redirect(`${SITE}/dashboard`)
  if (!linkedinConfigured()) return NextResponse.redirect(`${SITE}/dashboard?p=linkedin&li=notready`)
  const state = randomBytes(18).toString("base64url")
  const jar = await cookies()
  jar.set("xd_li_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/dashboard", maxAge: 600 })
  return NextResponse.redirect(authorizeUrl(state))
}
