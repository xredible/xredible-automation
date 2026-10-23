// lib/autopilot/linkedin.ts
//
// Server-only. LinkedIn sign-in (OpenID Connect) to get permission to post for a
// customer, and publishing a text post to their profile.
//   LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET   from the Xredible app at linkedin.com/developers
//   LINKEDIN_API_VERSION                         optional, "YYYYMM" (defaults below)
// Redirect URL to add in the app's Auth tab: https://www.xredible.in/dashboard/linkedin/callback

export const SITE = process.env.XD_SITE_URL || "https://www.xredible.in"
export const REDIRECT = `${SITE}/dashboard/linkedin/callback`
const VERSION = process.env.LINKEDIN_API_VERSION || "202608"

export const linkedinConfigured = () => Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)

export function authorizeUrl(state: string): string {
  const q = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID || "",
    redirect_uri: REDIRECT,
    state,
    scope: "openid profile w_member_social",
  })
  return `https://www.linkedin.com/oauth/v2/authorization?${q}`
}

export async function exchangeCode(code: string): Promise<{ token: string; expiresAt: string; sub: string; name: string }> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT,
      client_id: process.env.LINKEDIN_CLIENT_ID || "",
      client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
    }),
    cache: "no-store",
  })
  const t = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string }
  if (!res.ok || !t.access_token) throw new Error(t.error_description || `LinkedIn refused the sign-in (HTTP ${res.status}).`)
  const me = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` }, cache: "no-store" })
  const u = (await me.json().catch(() => ({}))) as { sub?: string; name?: string }
  if (!me.ok || !u.sub) throw new Error("LinkedIn didn't share your profile. Try connecting again.")
  return { token: t.access_token, expiresAt: new Date(Date.now() + (t.expires_in || 5184000) * 1000).toISOString(), sub: u.sub, name: u.name || "" }
}

/** LinkedIn "little text": these characters must be escaped, except # at the start of a hashtag. */
export function littleText(s: string): string {
  return s.replace(/[\\|{}@[\]()<>*_~]/g, (c) => "\\" + c).replace(/#(?![\p{L}\p{N}_])/gu, "\\#")
}

const restHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  "LinkedIn-Version": VERSION,
  "X-Restli-Protocol-Version": "2.0.0",
})

async function liError(res: Response, what: string): Promise<never> {
  const e = (await res.json().catch(() => ({}))) as { message?: string }
  if (res.status === 401) throw new Error("LinkedIn access expired. Reconnect LinkedIn.")
  throw new Error(`${what}: ${e.message || `LinkedIn answered with HTTP ${res.status}.`}`)
}

/** Uploads an image (PNG/JPEG) or a document (PDF) to LinkedIn and returns its URN. */
export async function liUpload(token: string, sub: string, kind: "images" | "documents", bytes: ArrayBuffer | Uint8Array, contentType: string): Promise<string> {
  const init = await fetch(`https://api.linkedin.com/rest/${kind}?action=initializeUpload`, {
    method: "POST",
    headers: restHeaders(token),
    body: JSON.stringify({ initializeUploadRequest: { owner: `urn:li:person:${sub}` } }),
    cache: "no-store",
  })
  if (!init.ok) await liError(init, kind === "images" ? "Image upload" : "Carousel upload")
  const v = ((await init.json()) as { value?: { uploadUrl?: string; image?: string; document?: string } }).value || {}
  const urn = v.image || v.document
  if (!v.uploadUrl || !urn) throw new Error("LinkedIn didn't give an upload address.")
  const body = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  const put = await fetch(v.uploadUrl, { method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": contentType }, body: body as unknown as BodyInit, cache: "no-store" })
  if (!put.ok) throw new Error(`LinkedIn didn't accept the ${kind === "images" ? "image" : "carousel"} (HTTP ${put.status}).`)
  // Wait until LinkedIn has processed it (documents take a few seconds).
  for (let i = 0; i < 20; i++) {
    const st = await fetch(`https://api.linkedin.com/rest/${kind}/${encodeURIComponent(urn)}`, { headers: restHeaders(token), cache: "no-store" })
    const j = (await st.json().catch(() => ({}))) as { status?: string }
    if (!st.ok || j.status === "AVAILABLE" || !j.status) break
    if (j.status === "PROCESSING_FAILED") throw new Error("LinkedIn couldn't process the file.")
    await new Promise((r) => setTimeout(r, 1500))
  }
  return urn
}

export type LiMedia = { kind: "image"; urn: string; alt: string } | { kind: "images"; urns: string[]; alt: string } | { kind: "document"; urn: string; title: string }

export async function publishPost(token: string, sub: string, text: string, media?: LiMedia): Promise<string> {
  const content =
    !media
      ? undefined
      : media.kind === "image"
        ? { media: { id: media.urn, altText: media.alt.slice(0, 300) } }
        : media.kind === "images"
          ? { multiImage: { images: media.urns.map((id) => ({ id, altText: media.alt.slice(0, 300) })) } }
          : { media: { id: media.urn, title: media.title.slice(0, 200) || "Carousel" } }
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: restHeaders(token),
    body: JSON.stringify({
      author: `urn:li:person:${sub}`,
      commentary: littleText(text),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    cache: "no-store",
  })
  if (res.status === 201) return res.headers.get("x-restli-id") || res.headers.get("x-linkedin-id") || "posted"
  return liError(res, "Post")
}

export const postUrl = (urn: string) => (urn.startsWith("urn:li:") ? `https://www.linkedin.com/feed/update/${urn}/` : "")
