// GET /api/autopilot/m/c?i=<issue>&c=<subscriber>&u=<url>&s=<sig> — counts a newsletter click, then opens the link.

import { after } from "next/server"
import { signed } from "@/lib/autopilot/crypto"
import { recordMail } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const i = Number(q.get("i"))
  const c = Number(q.get("c"))
  const u = q.get("u") || ""
  const ok = Number.isInteger(i) && i > 0 && Number.isInteger(c) && c > 0 && /^https?:\/\//i.test(u) && signed(`mc:${i}:${c}:${u}`, q.get("s") || "")
  if (!ok) return new Response("This link isn't valid.", { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } })
  after(() => recordMail("click", i, c, u).catch(() => {}))
  return Response.redirect(u, 302)
}
