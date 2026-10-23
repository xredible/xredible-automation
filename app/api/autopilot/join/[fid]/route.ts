// POST /api/autopilot/join/<form id> — a signup from a customer's form (hosted page or embedded on their site).
// Fields: email, name, website (a hidden trap field: bots fill it, people don't).

import { formOwner, join } from "@/lib/autopilot/email"
import { SITE } from "@/lib/autopilot/linkedin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, ctx: { params: Promise<{ fid: string }> }) {
  const { fid } = await ctx.params
  const owner = formOwner(fid)
  const wantsJson = (request.headers.get("accept") || "").includes("application/json")
  const back = (q: string) => (wantsJson ? Response.json({ ok: q.startsWith("s=") && !q.startsWith("s=err"), status: q }) : Response.redirect(`${SITE}/join/${fid}?${q}`, 303))
  if (!owner) return back("s=err&m=" + encodeURIComponent("This form isn't valid."))
  let f: Record<string, string> = {}
  try {
    if ((request.headers.get("content-type") || "").includes("application/json")) f = (await request.json()) as Record<string, string>
    else f = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]))
  } catch {}
  if (f.website) return back("s=done") // a bot: pretend it worked
  try {
    const r = await join(owner, String(f.email || ""), String(f.name || "").trim())
    return back(`s=${r}`)
  } catch (e) {
    return back("s=err&m=" + encodeURIComponent(e instanceof Error ? e.message : "Something went wrong."))
  }
}
