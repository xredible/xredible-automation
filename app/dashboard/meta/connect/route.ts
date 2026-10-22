// GET /dashboard/meta/connect — sends the signed-in customer to Facebook to allow posting to their Page and Instagram.

import { randomBytes } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { currentUser } from "@/lib/dashboard/auth"
import { SITE } from "@/lib/autopilot/linkedin"
import { metaAuthorizeUrl, metaConfigured } from "@/lib/autopilot/meta"
import { tokenKeySet } from "@/lib/autopilot/crypto"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const me = await currentUser()
  if (!me) return NextResponse.redirect(`${SITE}/dashboard`)
  if (!metaConfigured() || !tokenKeySet()) return NextResponse.redirect(`${SITE}/dashboard?p=meta&c=notready`)
  const state = randomBytes(18).toString("base64url")
  const jar = await cookies()
  jar.set("xd_meta_state", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/dashboard", maxAge: 600 })
  return NextResponse.redirect(metaAuthorizeUrl(state))
}
