// POST /dashboard/me/upload (multipart, field "file") — a customer's own photo for a post.
// Stored in Vercel Blob (needs BLOB_READ_WRITE_TOKEN: Vercel → Storage → Blob → connect to the project).
// The browser shrinks photos to at most 1600 px JPEG first, so they stay small.

import { NextResponse } from "next/server"
import { randomBytes, createHash } from "node:crypto"
import { put } from "@vercel/blob"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { ownerKey } from "@/lib/autopilot/brands"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }

export async function POST(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ ok: false, error: "Photo uploads are being switched on. Please try again soon." }, 503)
  const owner = await ownerKey(me.email)
  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!(file instanceof File)) return json({ ok: false, error: "Pick a photo." }, 400)
    const ext = TYPES[file.type]
    if (!ext) return json({ ok: false, error: "Use a JPG, PNG or WebP photo." }, 400)
    if (file.size > 4 * 1024 * 1024) return json({ ok: false, error: "That photo is too big (4 MB at most)." }, 400)
    const folder = createHash("sha256").update(owner).digest("hex").slice(0, 16)
    const blob = await put(`autopilot/${folder}/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`, file, { access: "public", contentType: file.type, addRandomSuffix: false })
    return json({ ok: true, url: blob.url })
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}
