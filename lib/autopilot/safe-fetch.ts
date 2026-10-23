// lib/autopilot/safe-fetch.ts
//
// Server-only. Fetches a URL a customer gave us (their website, logo or photo) without letting it
// point the server at itself or a private network: https only, every hop's host must resolve to
// public addresses, at most 4 redirects (each re-checked), and a size cap.

import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_HOPS = 4

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number)
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19))
  )
}

function privateV6(ip: string): boolean {
  const x = ip.toLowerCase()
  if (x === "::" || x === "::1") return true
  const mapped = x.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return privateV4(mapped[1])
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x)
}

export const isPrivateIp = (ip: string) => (isIP(ip) === 6 ? privateV6(ip) : isIP(ip) === 4 ? privateV4(ip) : true)

async function checkHost(u: URL) {
  if (u.protocol !== "https:") throw new Error("Only https:// links can be used.")
  if (u.username || u.password) throw new Error("That link can't be used.")
  if (u.port && u.port !== "443") throw new Error("That link can't be used.")
  const host = u.hostname.replace(/^\[|\]$/g, "")
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true }).catch(() => [])
  if (!addrs.length) throw new Error("That address couldn't be found.")
  if (addrs.some((a) => isPrivateIp(a.address))) throw new Error("That address can't be read.")
}

/** Like fetch(), for URLs that came from a customer. Throws a plain-English error when refused. */
export async function safeFetch(url: string, init: RequestInit = {}, maxBytes = 8_000_000): Promise<{ res: Response; bytes: ArrayBuffer }> {
  let u: URL
  try {
    u = new URL(url)
  } catch {
    throw new Error("That link isn't valid.")
  }
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    await checkHost(u)
    const res = await fetch(u, { ...init, redirect: "manual", signal: init.signal ?? AbortSignal.timeout(10_000) })
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      u = new URL(res.headers.get("location")!, u)
      continue
    }
    const len = Number(res.headers.get("content-length") || 0)
    if (len > maxBytes) throw new Error("That file is too large.")
    // Read with a cap, in case the server didn't send a length.
    const reader = res.body?.getReader()
    const parts: Uint8Array[] = []
    let total = 0
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > maxBytes) {
          await reader.cancel().catch(() => {})
          throw new Error("That file is too large.")
        }
        parts.push(value)
      }
    }
    const out = new Uint8Array(total)
    let o = 0
    for (const p of parts) {
      out.set(p, o)
      o += p.byteLength
    }
    return { res, bytes: out.buffer }
  }
  throw new Error("That link redirects too many times.")
}

/** Text version with its own cap (HTML pages, stylesheets). */
export async function safeText(url: string, maxChars: number, init: RequestInit = {}): Promise<string> {
  const { bytes } = await safeFetch(url, init, maxChars * 4)
  return new TextDecoder().decode(bytes).slice(0, maxChars)
}
