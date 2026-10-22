// /dashboard/quick?k=li|item&i=<id>&a=approve|reject&t=<token> — Approve / Skip from the drafts email.
// GET shows the draft and one button (so email link scanners can't approve anything); POST does it.

import { readQuick } from "@/lib/autopilot/quick"
import { postAction, postsFor } from "@/lib/autopilot/service"
import { itemAction, itemById, isTool } from "@/lib/autopilot/tools"
import { PRODUCTS } from "@/lib/autopilot/products"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title>
<style>body{margin:0;min-height:100vh;background:#f4f5f7;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0e1627;padding:16px;box-sizing:border-box;display:flex;justify-content:center;align-items:flex-start}
.c{max-width:560px;width:100%;background:#fff;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-top:6vh}h1{font-size:19px;margin:0 0 6px}.m{color:#5d6676;font-size:14px;margin:0 0 14px}
.t{white-space:pre-wrap;font-size:14.5px;line-height:1.55;background:#f7f8fa;border-radius:10px;padding:14px;max-height:50vh;overflow:auto}
.b{display:inline-block;border:0;border-radius:9px;padding:12px 18px;font-size:15px;font-weight:600;cursor:pointer;text-decoration:none}.p{background:#10203f;color:#fff}.g{background:#eef0f3;color:#334155;margin-left:8px}
@media (prefers-color-scheme:dark){body{background:#0b111c;color:#eef2f8}.c{background:#121a28}.m{color:#98a2b3}.t{background:#1a2332}.g{background:#1a2332;color:#c7cfdb}.p{background:#8aa6ee;color:#0b111c}}</style></head>
<body><div class="c">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  )

async function find(kind: string, id: number, owner: string) {
  if (kind === "li") {
    const p = (await postsFor(owner)).find((x) => x.id === id)
    return p ? { tool: "LinkedIn", title: p.topic, text: p.text, status: p.status, when: p.scheduledAt } : null
  }
  const it = await itemById(id)
  return it && it.email === owner ? { tool: PRODUCTS[it.product].name, title: it.title, text: it.text, status: it.status, when: it.scheduledAt } : null
}

async function check(url: URL) {
  const k = url.searchParams.get("k") || ""
  const i = Number(url.searchParams.get("i"))
  const a = url.searchParams.get("a") || ""
  if (!["li", "item"].includes(k) || !Number.isInteger(i) || !["approve", "reject"].includes(a)) return null
  const owner = await readQuick(k, i, a, url.searchParams.get("t") || "")
  return owner ? { k, i, a, owner } : null
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" }) : "")

export async function GET(request: Request) {
  const url = new URL(request.url)
  const q = await check(url)
  if (!q) return page("Link expired", `<h1>This link has expired</h1><p class="m">Open your dashboard to review your drafts.</p><a class="b p" href="/dashboard?biz=autopilot&view=schedule">Open dashboard</a>`, 400)
  const d = await find(q.k, q.i, q.owner)
  if (!d) return page("Not found", `<h1>This draft is gone</h1><p class="m">It may have been discarded already.</p><a class="b p" href="/dashboard?biz=autopilot&view=schedule">Open dashboard</a>`, 404)
  if (d.status !== "draft") return page("Already done", `<h1>Already ${d.status === "approved" ? "approved" : "handled"}</h1><p class="m">${esc(d.tool)} · ${esc(d.title || "")}</p><a class="b p" href="/dashboard?biz=autopilot&view=schedule">Open dashboard</a>`)
  const approve = q.a === "approve"
  return page(
    approve ? "Approve this post?" : "Skip this post?",
    `<h1>${approve ? "Approve this post?" : "Skip this post?"}</h1><p class="m">${esc(d.tool)}${d.when ? ` · planned for ${esc(when(d.when))}` : ""}</p>
<div class="t">${d.title && q.k === "item" ? `<b>${esc(d.title)}</b>\n\n` : ""}${esc(d.text.slice(0, 4000))}</div>
<form method="post" style="margin-top:16px"><button class="b p" type="submit">${approve ? "Approve" : "Skip it"}</button><a class="b g" href="/dashboard?biz=autopilot&view=schedule">Edit in dashboard</a></form>`,
  )
}

export async function POST(request: Request) {
  const url = new URL(request.url)
  const q = await check(url)
  if (!q) return page("Link expired", `<h1>This link has expired</h1><a class="b p" href="/dashboard?biz=autopilot&view=schedule">Open dashboard</a>`, 400)
  try {
    if (q.k === "li") await postAction(q.owner, { op: q.a, id: q.i })
    else {
      const it = await itemById(q.i)
      if (!it || it.email !== q.owner || !isTool(it.product)) throw new Error("This draft is gone.")
      await itemAction(q.owner, it.product, { op: q.a, id: q.i })
    }
  } catch (e) {
    return page("Not changed", `<h1>Not changed</h1><p class="m">${esc(e instanceof Error ? e.message : "Something went wrong.")}</p><a class="b p" href="/dashboard?biz=autopilot&view=schedule">Open dashboard</a>`, 400)
  }
  return page(
    "Done",
    q.a === "approve"
      ? `<h1>Approved ✓</h1><p class="m">It will go out at its planned time. You can still change it in the dashboard.</p><a class="b p" href="/dashboard?biz=autopilot&view=schedule">Open dashboard</a>`
      : `<h1>Skipped</h1><p class="m">That draft won't be posted.</p><a class="b p" href="/dashboard?biz=autopilot&view=schedule">Open dashboard</a>`,
  )
}
