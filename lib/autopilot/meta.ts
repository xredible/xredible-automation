// lib/autopilot/meta.ts
//
// Server-only. Facebook Login for a customer's Facebook Page (and the Instagram
// professional account linked to it), and publishing an image post to both.
//   META_APP_ID, META_APP_SECRET   from the Xredible app at developers.facebook.com
//   META_GRAPH_VERSION             optional, e.g. "v24.0"
// Valid OAuth redirect URI to add in the app: https://www.xredible.in/dashboard/meta/callback
//
// Until Meta approves the app (App Review + Business Verification), only people
// added under App roles (Admins / Testers) can connect.

import { SITE } from "./linkedin"

export const META_REDIRECT = `${SITE}/dashboard/meta/callback`
const V = process.env.META_GRAPH_VERSION || "v24.0"
const G = `https://graph.facebook.com/${V}`

export const metaConfigured = () => Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)

const SCOPES = ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "instagram_basic", "instagram_content_publish", "business_management"]

export function metaAuthorizeUrl(state: string): string {
  const q = new URLSearchParams({ client_id: process.env.META_APP_ID || "", redirect_uri: META_REDIRECT, state, scope: SCOPES.join(","), response_type: "code" })
  return `https://www.facebook.com/${V}/dialog/oauth?${q}`
}

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(path.startsWith("http") ? path : G + path, { ...init, cache: "no-store" })
  const j = (await r.json().catch(() => ({}))) as T & { error?: { message?: string; error_user_msg?: string } }
  if (!r.ok || j.error) throw new Error(j.error?.error_user_msg || j.error?.message || `Facebook answered ${r.status}.`)
  return j
}

export type MetaPage = { id: string; name: string; token: string; igId: string; igUser: string }

/** Code → long-lived user token → the Pages they manage (Page tokens from a long-lived user token don't expire). */
export async function metaExchange(code: string): Promise<MetaPage[]> {
  const id = process.env.META_APP_ID || ""
  const secret = process.env.META_APP_SECRET || ""
  const short = await graph<{ access_token: string }>(`/oauth/access_token?${new URLSearchParams({ client_id: id, client_secret: secret, redirect_uri: META_REDIRECT, code })}`)
  const long = await graph<{ access_token: string }>(`/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: id, client_secret: secret, fb_exchange_token: short.access_token })}`)
  const pages = await graph<{ data: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } }[] }>(
    `/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100", access_token: long.access_token })}`,
  )
  return (pages.data || []).map((p) => ({ id: p.id, name: p.name, token: p.access_token, igId: p.instagram_business_account?.id || "", igUser: p.instagram_business_account?.username || "" }))
}

const form = (o: Record<string, string>) => ({ method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(o) })

/** Posts one image with its caption. Returns links to what went out. */
export async function metaPublish(
  page: { id: string; token: string; igId: string },
  targets: "both" | "instagram" | "facebook",
  caption: string,
  imageUrl: string,
): Promise<{ fb?: string; ig?: string }> {
  const out: { fb?: string; ig?: string } = {}
  const errors: string[] = []
  if (targets !== "facebook") {
    try {
      if (!page.igId) throw new Error("No Instagram professional account is linked to this Facebook Page.")
      const c = await graph<{ id: string }>(`/${page.igId}/media`, form({ image_url: imageUrl, caption: caption.slice(0, 2200), access_token: page.token }))
      // Instagram fetches the image first; wait until the container is ready.
      for (let i = 0; i < 10; i++) {
        const st = await graph<{ status_code?: string }>(`/${c.id}?fields=status_code&access_token=${encodeURIComponent(page.token)}`)
        if (st.status_code === "FINISHED" || !st.status_code) break
        if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new Error("Instagram couldn't use the image.")
        await new Promise((r) => setTimeout(r, 2000))
      }
      const pub = await graph<{ id: string }>(`/${page.igId}/media_publish`, form({ creation_id: c.id, access_token: page.token }))
      const link = await graph<{ permalink?: string }>(`/${pub.id}?fields=permalink&access_token=${encodeURIComponent(page.token)}`).catch(() => ({ permalink: "" }))
      out.ig = link.permalink || `https://www.instagram.com/`
    } catch (e) {
      errors.push(`Instagram: ${e instanceof Error ? e.message : "failed"}`)
    }
  }
  if (targets !== "instagram") {
    try {
      const r = await graph<{ id: string; post_id?: string }>(`/${page.id}/photos`, form({ url: imageUrl, message: caption, access_token: page.token }))
      out.fb = `https://www.facebook.com/${r.post_id || r.id}`
    } catch (e) {
      errors.push(`Facebook: ${e instanceof Error ? e.message : "failed"}`)
    }
  }
  if (!out.fb && !out.ig) throw new Error(errors.join(" · ") || "Nothing was posted.")
  if (errors.length) (out as Record<string, string>).warning = errors.join(" · ")
  return out
}
