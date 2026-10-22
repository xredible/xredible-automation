// lib/dashboard/gateway.ts
//
// Server-only. Every dashboard request to n8n goes through one webhook, the
// "XD-G Xredible - Dashboard Gateway" workflow, protected by one secret:
//   XD_N8N_SECRET    same value as the n8n credential "XD Dashboard secret" (header X-XD-Secret)
//   XD_N8N_GATEWAY   optional, defaults to https://n8n.xredible.in/webhook/xd-gw
// n8n then adds each business's own secret, so this site never holds them.

export const GATEWAY = process.env.XD_N8N_GATEWAY || "https://n8n.xredible.in/webhook/xd-gw"

export function gatewaySecret(): string | null {
  return process.env.XD_N8N_SECRET?.trim() || null
}

export type GatewayResult = { status: number; body: unknown }

export async function gateway(payload: Record<string, unknown>, timeoutMs = 58_000): Promise<GatewayResult> {
  const secret = gatewaySecret()
  if (!secret) return { status: 500, body: { ok: false, error: "XD_N8N_SECRET is not set on Vercel." } }
  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { "X-XD-Secret": secret, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (res.status === 404) return { status: 502, body: { ok: false, error: "The n8n dashboard gateway (XD-G) is not published." } }
    if (res.status === 401 || res.status === 403) return { status: 502, body: { ok: false, error: "n8n refused the dashboard secret. Make XD_N8N_SECRET on Vercel match the n8n credential \"XD Dashboard secret\", then redeploy." } }
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      body = { ok: false, error: `n8n answered with HTTP ${res.status} and no data.` }
    }
    return { status: res.ok ? 200 : res.status >= 500 ? 502 : res.status, body }
  } catch {
    return { status: 504, body: { ok: false, error: "Could not reach n8n on the Raspberry Pi. It may be busy, restarting or offline." } }
  }
}
