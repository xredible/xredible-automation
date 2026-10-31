// GET /dashboard/linkedin/callback — LinkedIn sends the customer back here after they allow posting.

import { timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { currentUser } from "@/lib/dashboard/auth"
import { exchangeCode, SITE } from "@/lib/autopilot/linkedin"
import { connectLinkedIn, ensureTrial, postsFor, profileFor } from "@/lib/autopilot/service"
import { requestDrafts } from "@/lib/autopilot/db"
import { ownerKey } from "@/lib/autopilot/brands"
import { addExtra } from "@/lib/autopilot/profiles"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const back = (q: string) => NextResponse.redirect(`${SITE}/dashboard?p=linkedin&${q}`)

export async function GET(request: Request) {
  const me = await currentUser()
  if (!me) return NextResponse.redirect(`${SITE}/dashboard`)
  const owner = await ownerKey(me.email)
  const url = new URL(request.url)
  const jar = await cookies()
  const want = jar.get("xd_li_state")?.value || ""
  jar.delete({ name: "xd_li_state", path: "/dashboard" })
  const extra = jar.get("xd_li_extra")?.value === "1"
  jar.delete({ name: "xd_li_extra", path: "/dashboard" })
  const got = url.searchParams.get("state") || ""
  if (url.searchParams.get("error")) return back("li=cancelled")
  if (!want || want.length !== got.length || !timingSafeEqual(Buffer.from(want), Buffer.from(got))) return back("li=expired")
  try {
    const li = await exchangeCode(url.searchParams.get("code") || "")
    await ensureTrial(owner, "linkedin")
    if (extra) {
      // Another person's LinkedIn profile for this brand (paid add-on).
      const main = await profileFor(owner)
      await addExtra(owner, "linkedin", { name: li.name || "LinkedIn profile", key: `li:${li.sub}`, meta: { sub: li.sub, expires: li.expiresAt }, secret: { token: li.token } }, main?.liSub ? `li:${main.liSub}` : "")
      return back("li=extra")
    }
    await connectLinkedIn(owner, li)
    const prof = await profileFor(owner)
    const posts = await postsFor(owner)
    if (prof?.about && !posts.some((p) => p.status === "draft" || p.status === "approved")) await requestDrafts(owner, 3).catch(() => {})
    return back("li=connected")
  } catch (e) {
    return back("li=error&msg=" + encodeURIComponent(e instanceof Error ? e.message.slice(0, 160) : "LinkedIn sign-in failed."))
  }
}
