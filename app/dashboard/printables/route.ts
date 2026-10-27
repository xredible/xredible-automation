// POST /dashboard/printables  { op, … }  (Nestoodle's Printables page)
//
//   list                         articles with their current download, and every printable
//   draft    { postId }          ask the AI for a printable from the article (it arrives in a minute or two)
//   save     { id, spec, fileName, linkText }
//   preview  { spec, postId? }   the PDF, to look at (nothing is saved)
//   publish  { id, postId, spec, fileName, linkText, deleteOld }
//                                lays the PDF out, uploads it to WordPress and puts the download in the article
//   discard  { id }
//
// Signed-in only, for accounts that may see Nestoodle. The data lives in n8n (NST-PR, data
// table "XD NST Printables"), reached through the dashboard gateway (path -print).

import { NextResponse } from "next/server"
import { canSee, currentUser } from "@/lib/dashboard/server"
import { gateway } from "@/lib/dashboard/gateway"
import { renderPrintable } from "@/lib/printables/pdf"
import { cleanLinkText, cleanSpec, fileNameFor, type PrintablePost, type PrintableRow, type Spec } from "@/lib/printables/spec"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })

async function nst(body: Record<string, unknown>, timeoutMs = 55_000): Promise<{ status: number; body: Record<string, unknown> }> {
  const r = await gateway({ kind: "proxy", biz: "nestoodle", path: "-print", method: "POST", body }, timeoutMs)
  const b = (r.body || {}) as Record<string, unknown>
  return { status: r.status === 200 && b.ok !== false ? 200 : r.status === 200 ? 400 : r.status, body: b }
}

const int = (v: unknown) => (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) < 1e9 ? Number(v) : null)

function row(r: Record<string, unknown>): PrintableRow {
  let spec: Spec | null = null
  try {
    spec = r.spec ? cleanSpec(JSON.parse(String(r.spec))) : null
  } catch {}
  const s = (k: string) => (r[k] == null ? "" : String(r[k]))
  return {
    id: Number(r.id),
    postId: Number(r.postId),
    status: (["drafting", "draft", "published", "failed"].includes(s("status")) ? s("status") : "draft") as PrintableRow["status"],
    title: s("title"),
    postTitle: s("postTitle"),
    postLink: s("postLink"),
    spec,
    fileName: s("fileName"),
    linkText: s("linkText"),
    source: s("source"),
    mediaId: Number(r.mediaId) || null,
    mediaUrl: s("mediaUrl"),
    oldMediaUrl: s("oldMediaUrl"),
    pages: Number(r.pages) || 0,
    error: s("error"),
    changedAt: s("changedAt") || s("updatedAt"),
    publishedAt: s("publishedAt"),
  }
}

/** The names that go with a spec: a clean link text and a file name in the house pattern. */
function names(spec: Spec, fileName: unknown, linkText: unknown) {
  const f = String(fileName || "").trim()
  return {
    fileName: /^Nestoodle-[A-Za-z0-9-]+\.pdf$/.test(f) ? f : fileNameFor(f.replace(/\.pdf$/i, "") || spec.title),
    linkText: cleanLinkText(String(linkText || "")) || cleanLinkText(spec.title),
  }
}

export async function POST(request: Request) {
  if (!(await currentUser())) return json({ ok: false, error: "Signed out. Reload the page to sign in again." }, 401)
  const origin = request.headers.get("origin")
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
  if (origin && host && new URL(origin).host !== host) return json({ ok: false, error: "Not allowed." }, 403)
  if (!(await canSee("nestoodle"))) return json({ ok: false, error: "Your account doesn't include Nestoodle." }, 403)

  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  const op = String(b.op || "")

  if (op === "list") {
    const r = await nst({ op: "list" })
    if (r.status !== 200) return json({ ok: false, error: String(r.body.error || "The printables didn't load.") }, r.status)
    const posts = (Array.isArray(r.body.posts) ? r.body.posts : []) as PrintablePost[]
    const rows = (Array.isArray(r.body.rows) ? r.body.rows : []).map((x) => row(x as Record<string, unknown>))
    return json({ ok: true, posts, rows })
  }

  if (op === "draft") {
    const postId = int(b.postId)
    if (!postId) return json({ ok: false, error: "Which article?" }, 400)
    const r = await nst({ op: "draft", postId, source: "manual" })
    return json(r.status === 200 ? { ok: true, done: "Drafting the printable from the article. It takes a minute or two." } : { ok: false, error: String(r.body.error || "That didn't start.") }, r.status)
  }

  if (op === "discard") {
    const id = int(b.id)
    if (!id) return json({ ok: false, error: "Which printable?" }, 400)
    const r = await nst({ op: "discard", id })
    return json(r.status === 200 ? { ok: true, done: "Removed. Make a new one any time." } : { ok: false, error: String(r.body.error || "That didn't work.") }, r.status)
  }

  const spec = cleanSpec(b.spec)
  if (["save", "preview", "publish"].includes(op) && !spec) return json({ ok: false, error: "The printable needs a title and at least one block with content." }, 400)

  if (op === "preview") {
    try {
      const out = await renderPrintable(spec!, { postTitle: typeof b.postTitle === "string" ? b.postTitle.slice(0, 200) : undefined, postUrl: typeof b.postLink === "string" ? b.postLink.slice(0, 300) : undefined })
      const { fileName } = names(spec!, b.fileName, "")
      return new NextResponse(Buffer.from(out.pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${fileName}"`, "Cache-Control": "private, no-store", "X-Pages": String(out.pages) },
      })
    } catch (e) {
      return json({ ok: false, error: `The PDF couldn't be made: ${e instanceof Error ? e.message : "unknown error"}` }, 500)
    }
  }

  if (op === "save") {
    const id = int(b.id)
    if (!id) return json({ ok: false, error: "Which printable?" }, 400)
    const n = names(spec!, b.fileName, b.linkText)
    const r = await nst({ op: "save", id, spec: JSON.stringify(spec), title: spec!.title, ...n, status: b.published === true ? "published" : "draft" })
    return json(r.status === 200 ? { ok: true, done: "Saved.", ...n } : { ok: false, error: String(r.body.error || "That didn't save.") }, r.status)
  }

  if (op === "publish") {
    const id = int(b.id)
    const postId = int(b.postId)
    if (!id || !postId) return json({ ok: false, error: "Which printable and article?" }, 400)
    const n = names(spec!, b.fileName, b.linkText)
    let out: Awaited<ReturnType<typeof renderPrintable>>
    try {
      out = await renderPrintable(spec!, { postTitle: typeof b.postTitle === "string" ? b.postTitle.slice(0, 200) : undefined, postUrl: typeof b.postLink === "string" ? b.postLink.slice(0, 300) : undefined })
    } catch (e) {
      return json({ ok: false, error: `The PDF couldn't be made: ${e instanceof Error ? e.message : "unknown error"}` }, 500)
    }
    // Keep the latest edits with the row, then upload and place it.
    const saved = await nst({ op: "save", id, spec: JSON.stringify(spec), title: spec!.title, ...n, pages: out.pages })
    if (saved.status !== 200) return json({ ok: false, error: String(saved.body.error || "Couldn't save the printable before publishing.") }, saved.status)
    const r = await nst({ op: "publish", id, postId, pdf: Buffer.from(out.pdf).toString("base64"), title: spec!.title, ...n, pages: out.pages, deleteOld: b.deleteOld === true })
    if (r.status !== 200) return json({ ok: false, error: String(r.body.error || "Publishing didn't work.") }, r.status)
    return json({ ok: true, done: "Published. The download in the article now uses the new PDF.", ...n, pages: out.pages, result: r.body })
  }

  return json({ ok: false, error: "That change isn't valid." }, 400)
}
