// lib/autopilot/crypto.ts
//
// Server-only. Customers' access tokens and passwords (LinkedIn, Facebook, WordPress, email)
// are stored encrypted (AES-256-GCM) with XD_TOKEN_KEY, so n8n and its data tables never hold them readable.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto"

function key(): Buffer {
  const k = process.env.XD_TOKEN_KEY?.trim()
  if (!k || k.length < 32) throw new Error("XD_TOKEN_KEY is not set on Vercel (64 random characters).")
  return createHash("sha256").update(k).digest()
}

export function seal(plain: string): string {
  const iv = randomBytes(12)
  const c = createCipheriv("aes-256-gcm", key(), iv)
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()])
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".")
}

export function open(sealed: string): string {
  const [v, iv, tag, enc] = String(sealed || "").split(".")
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("The stored connection is missing or damaged. Please connect again.")
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"))
  d.setAuthTag(Buffer.from(tag, "base64url"))
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8")
}

export const tokenKeySet = () => (process.env.XD_TOKEN_KEY?.trim().length || 0) >= 32

/** Short signature for public links (post images, unsubscribe). */
export function sign(text: string): string {
  return createHmac("sha256", key()).update(text).digest("base64url").slice(0, 22)
}

export function signed(text: string, sig: string): boolean {
  try {
    const a = Buffer.from(sign(text))
    const b = Buffer.from(String(sig || ""))
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}
