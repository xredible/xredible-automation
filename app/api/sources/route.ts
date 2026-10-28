// POST /api/sources  (header X-XD-Secret: the XD_N8N_SECRET value)
// { title, body, format: "md" | "html", own: ["nestoodle.com"], site, audience? }
// → { ok, body, report }  (lib/sources: checks the article's external links and adds 3–4 verified ones)
// For n8n workflows (e.g. a blog writer) and the dashboard; nothing is saved here.

import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import { gatewaySecret } from "@/lib/dashboard/gateway"
import { checkSources } from "@/lib/sources"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function allowed(request: Request): boolean {
  const want = Buffer.from(gatewaySecret() || "")
  const got = Buffer.from(request.headers.get("x-xd-secret") || "")
  return want.length > 0 && want.length === got.length && timingSafeEqual(want, got)
}

export async function POST(request: Request) {
  if (!allowed(request)) return NextResponse.json({ ok: false, error: "Not allowed." }, { status: 401 })
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  const body = String(b.body || "")
  const format = b.format === "html" ? "html" : "md"
  if (body.length < 300 || body.length > 400_000) return NextResponse.json({ ok: false, error: "Send the article in body." }, { status: 400 })
  const own = (Array.isArray(b.own) ? b.own : []).map((x) => String(x).slice(0, 100)).slice(0, 5)
  try {
    const out = await checkSources({ title: String(b.title || "").slice(0, 300), body, format, own, site: String(b.site || own[0] || "").slice(0, 100), audience: String(b.audience || "").slice(0, 300) })
    return NextResponse.json({ ok: true, ...out }, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "The check failed." }, { status: 502 })
  }
}
