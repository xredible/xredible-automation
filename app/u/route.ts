// /u?c=<contact id>&s=<signature> — newsletter unsubscribe.
// GET shows a confirm button (so link scanners don't unsubscribe people); POST unsubscribes
// (also used by Gmail/Outlook one-click unsubscribe via the List-Unsubscribe-Post header).

import { signed } from "@/lib/autopilot/crypto"
import { unsubscribe } from "@/lib/autopilot/tools"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f4f5f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0e1627;padding:16px}
.c{max-width:420px;width:100%;background:#fff;border-radius:14px;padding:28px;box-shadow:0 1px 3px rgba(0,0,0,.08)}h1{font-size:20px;margin:0 0 10px}p{color:#5d6676;line-height:1.55;margin:0 0 16px}
button{background:#10203f;color:#fff;border:0;border-radius:8px;padding:11px 18px;font-size:15px;font-weight:600;cursor:pointer}
@media (prefers-color-scheme:dark){body{background:#0b111c;color:#eef2f8}.c{background:#121a28}p{color:#98a2b3}button{background:#8aa6ee;color:#0b111c}}</style></head>
<body><div class="c">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  )

function check(url: URL): number | null {
  const id = Number(url.searchParams.get("c"))
  return Number.isInteger(id) && id > 0 && signed(`u:${id}`, url.searchParams.get("s") || "") ? id : null
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = check(url)
  if (!id) return page("Unsubscribe", "<h1>Unsubscribe</h1><p>This link isn't complete. Use the Unsubscribe link at the bottom of the newsletter email.</p>", 400)
  return page(
    "Unsubscribe",
    `<h1>Unsubscribe?</h1><p>You won't get this newsletter any more.</p><form method="post" action="/u?c=${id}&amp;s=${encodeURIComponent(url.searchParams.get("s") || "")}"><button type="submit">Unsubscribe</button></form>`,
  )
}

export async function POST(request: Request) {
  const id = check(new URL(request.url))
  if (!id) return page("Unsubscribe", "<h1>Unsubscribe</h1><p>This link isn't complete.</p>", 400)
  try {
    await unsubscribe(id)
  } catch {
    return page("Unsubscribe", "<h1>Something went wrong</h1><p>Please try again in a minute.</p>", 502)
  }
  return page("Unsubscribed", "<h1>You're unsubscribed</h1><p>You won't get this newsletter again.</p>")
}
