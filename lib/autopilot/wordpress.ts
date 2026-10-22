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
