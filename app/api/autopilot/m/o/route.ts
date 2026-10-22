// GET /api/autopilot/m/o?i=<issue>&c=<subscriber>&s=<sig> — newsletter open pixel (1×1 GIF).

import { after } from "next/server"
import { signed } from "@/lib/autopilot/crypto"
import { recordMail } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams
  const i = Number(q.get("i"))
  const c = Number(q.get("c"))
  if (Number.isInteger(i) && i > 0 && Number.isInteger(c) && c > 0 && signed(`mo:${i}:${c}`, q.get("s") || "")) after(() => recordMail("open", i, c).catch(() => {}))
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0", "Content-Length": String(GIF.length) } })
}
