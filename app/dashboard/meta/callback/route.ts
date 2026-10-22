// GET /dashboard/meta/callback — Facebook sends the customer back here after they allow posting.

import { timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { currentUser } from "@/lib/dashboard/auth"
import { SITE } from "@/lib/autopilot/linkedin"
import { metaExchange } from "@/lib/autopilot/meta"
import { ensureTrial } from "@/lib/autopilot/service"
import { requestToolDrafts } from "@/lib/autopilot/db"
import { channelFor, connectMeta, itemsFor } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const back = (q: string) => NextResponse.redirect(`${SITE}/dashboard?p=meta&${q}`)

export async function GET(request: Request) {
  const me = await currentUser()
  if (!me) return NextResponse.redirect(`${SITE}/dashboard`)
  const url = new URL(request.url)
  const jar = await cookies()
  const want = jar.get("xd_meta_state")?.value || ""
  jar.delete({ name: "xd_meta_state", path: "/dashboard" })
  const got = url.searchParams.get("state") || ""
  if (url.searchParams.get("error")) return back("c=cancelled")
  if (!want || want.length !== got.length || !timingSafeEqual(Buffer.from(want), Buffer.from(got))) return back("c=expired")
  try {
    const pages = await metaExchange(url.searchParams.get("code") || "")
    await ensureTrial(me.email, "meta")
    await connectMeta(me.email, pages)
    const ch = await channelFor(me.email, "meta")
    if (!ch?.connected) return back("c=choose")
    const items = await itemsFor(me.email, "meta")
    if (ch.settings.about && !items.length) await requestToolDrafts(me.email, "meta", 3).catch(() => {})
    return back("c=connected")
  } catch (e) {
    return back("c=error&msg=" + encodeURIComponent(e instanceof Error ? e.message.slice(0, 160) : "Facebook sign-in failed."))
  }
}
