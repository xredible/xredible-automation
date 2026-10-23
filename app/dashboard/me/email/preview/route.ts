// GET /dashboard/me/email/preview?t=<layout> — a sample email in the customer's brand (for the Design tab).

import { NextResponse } from "next/server"
import { signedIn } from "@/lib/autopilot/guard"
import { ownerKey } from "@/lib/autopilot/brands"
import { buildIssue, isEmailTemplate } from "@/lib/autopilot/mail"
import { channelFor, emailLook } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SAMPLE = `Hi {{name}},

Thanks for being here. This week I want to share one simple habit that makes a big difference.

## Show up every week

Two helpful emails a month build more trust than ten emails followed by silence. Pick a day, keep it small, and stick to it.

- Share one useful tip
- Tell one short story from your work
- Ask one question your readers can reply to

[Read the full guide](https://www.xredible.in)

Talk soon,
Your name`

export async function GET(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  const t = new URL(request.url).searchParams.get("t")
  const ch = await channelFor(owner, "newsletter")
  const look = ch ? await emailLook(owner, ch) : { kit: {}, template: "header" as const }
  const { html } = buildIssue({
    title: "One habit that changes everything",
    preheader: "A small weekly habit for steady growth",
    md: SAMPLE,
    newsletter: String(ch?.settings.name || look.kit.name || "Your newsletter"),
    address: String(ch?.settings.address || "Your business address"),
    unsubUrl: "#",
    toName: "Priya",
    ...look,
    template: isEmailTemplate(t) ? t : look.template,
  })
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
}
