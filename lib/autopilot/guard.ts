// lib/autopilot/guard.ts — shared checks for the Autopilot routes.

import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import { currentUser, type StoredUser } from "@/lib/dashboard/auth"
import { gatewaySecret } from "@/lib/dashboard/gateway"

export const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } })

/** Signed-in account (any role) and, for POSTs, only from this site's own pages. */
export async function signedIn(request: Request): Promise<StoredUser | NextResponse> {
  const me = await currentUser()
  if (!me) return json({ ok: false, error: "Signed out. Reload the page to sign in again." }, 401)
  if (request.method !== "GET") {
    const origin = request.headers.get("origin")
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
    if (origin && host && new URL(origin).host !== host) return json({ ok: false, error: "Not allowed." }, 403)
  }
  return me
}

/** Calls from n8n carry the same X-XD-Secret the gateway uses. */
export function fromN8n(request: Request): boolean {
  const want = gatewaySecret()
  const got = request.headers.get("x-xd-secret") || ""
  if (!want || !got) return false
  const a = Buffer.from(want)
  const b = Buffer.from(got)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Try again.")
