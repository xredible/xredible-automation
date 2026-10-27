// lib/autopilot/wordpress.ts
//
// Server-only. A customer's WordPress site, reached with an Application Password
// (WordPress → Users → Profile → Application Passwords). Needs HTTPS and the REST API.

export function cleanSite(input: string): string {
  let s = String(input || "").trim()
  if (!/^https?:\/\//i.test(s)) s = "https://" + s
  const m = /^(https?:\/\/[^/?#]+)(\/[^?#]*)?/i.exec(s)
  if (!m) throw new Error("Enter your site address, like https://example.com")
  if (!/^https:/i.test(m[1])) throw new Error("Your site needs https:// for a safe connection.")
  return (m[1] + (m[2] || "")).replace(/\/+$/, "").toLowerCase()
}

const auth = (user: string, pass: string) => "Basic " + Buffer.from(`${user}:${pass.replace(/\s+/g, "")}`).toString("base64")

async function wp<T>(site: string, path: string, user: string, pass: string, init?: RequestInit): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${site}/wp-json${path}`, {
      ...init,
      headers: { Authorization: auth(user, pass), "Content-Type": "application/json", "User-Agent": "XredibleAutopilot/1.0", ...(init?.headers || {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new Error("Couldn't reach your site. Check the address and that the site is online.")
  }
  const j = (await r.json().catch(() => null)) as (T & { message?: string; code?: string }) | null
  if (r.status === 401 || r.status === 403) throw new Error("WordPress didn't accept the username and application password. Check both (the password is the 24-character one from Application Passwords, not your login password).")
  if (r.status === 404) throw new Error("The WordPress REST API isn't reachable on this site (wp-json). A security plugin may be blocking it.")
  if (!r.ok || !j) throw new Error(j?.message?.replace(/<[^>]+>/g, "") || `Your site answered ${r.status}.`)
  return j
}

export async function wpVerify(site: string, user: string, pass: string): Promise<{ name: string; canPublish: boolean }> {
  const me = await wp<{ name?: string; capabilities?: Record<string, boolean> }>(site, "/wp/v2/users/me?context=edit", user, pass)
  return { name: me.name || user, canPublish: !!me.capabilities?.publish_posts }
}

export async function wpPublish(
  site: string,
  user: string,
  pass: string,
  post: { title: string; html: string; excerpt: string; status: "publish" | "draft" },
): Promise<{ id: number; link: string }> {
  const r = await wp<{ id: number; link: string }>(site, "/wp/v2/posts", user, pass, {
    method: "POST",
    body: JSON.stringify({ title: post.title, content: post.html, excerpt: post.excerpt, status: post.status }),
  })
  return { id: r.id, link: r.link }
}

/** Uploads a file to the site's Media Library. */
export async function wpUploadMedia(site: string, user: string, pass: string, file: { name: string; type: string; bytes: Uint8Array; title?: string }): Promise<{ id: number; url: string }> {
  let r: Response
  try {
    r = await fetch(`${site}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: { Authorization: auth(user, pass), "Content-Type": file.type, "Content-Disposition": `attachment; filename="${file.name.replace(/"/g, "")}"`, "User-Agent": "XredibleAutopilot/1.0" },
      body: Buffer.from(file.bytes),
      cache: "no-store",
      signal: AbortSignal.timeout(45_000),
    })
  } catch {
    throw new Error("Couldn't reach your site to upload the file.")
  }
  const j = (await r.json().catch(() => null)) as { id?: number; source_url?: string; message?: string } | null
  if (r.status === 401 || r.status === 403) throw new Error("WordPress didn't let this login upload files. The user needs the Author role or higher.")
  if (!r.ok || !j?.id) throw new Error(j?.message?.replace(/<[^>]+>/g, "") || `Your site answered ${r.status} to the upload.`)
  if (file.title) await wp(site, `/wp/v2/media/${j.id}`, user, pass, { method: "POST", body: JSON.stringify({ title: file.title }) }).catch(() => null)
  return { id: j.id, url: String(j.source_url || "") }
}

export async function wpDeleteMedia(site: string, user: string, pass: string, id: number): Promise<void> {
  await wp(site, `/wp/v2/media/${id}?force=true`, user, pass, { method: "DELETE" })
}

/** A post found from its public link (by slug), with its raw content for editing. */
export async function wpPostByLink(site: string, user: string, pass: string, link: string): Promise<{ id: number; raw: string; link: string } | null> {
  const slug = decodeURIComponent(String(link).replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() || "")
  if (!slug) return null
  const list = await wp<{ id: number; link: string; content?: { raw?: string } }[]>(site, `/wp/v2/posts?slug=${encodeURIComponent(slug)}&context=edit&status=publish,draft,future,pending,private`, user, pass)
  const p = list[0]
  return p ? { id: p.id, raw: p.content?.raw || "", link: p.link } : null
}

export async function wpUpdatePost(site: string, user: string, pass: string, id: number, content: string): Promise<{ link: string }> {
  const r = await wp<{ link: string }>(site, `/wp/v2/posts/${id}`, user, pass, { method: "POST", body: JSON.stringify({ content }) })
  return { link: r.link }
}
