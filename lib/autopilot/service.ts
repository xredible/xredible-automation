// lib/autopilot/service.ts
//
// Server-only business rules for LinkedIn Autopilot: trials, plan limits,
// LinkedIn connection, the post calendar and publishing.

import { insert, rows, update, type Table } from "./db"
import { open, seal } from "./crypto"
import { cleanExtra, limitOf, planOf, PRODUCTS, canPublish, isProduct, type PlanKey, type ProductKey, type Subscription } from "./products"
import { liUpload, publishPost, postUrl, type LiMedia } from "./linkedin"
import { cleanDesign, goalPlanKey, isFormat, LI_MIXES, mixKey, parseDesign, type Design, type Format } from "./formats"
import { carouselPdf, renderCard, safeColor, type Look } from "./render"
import { kitFor } from "./brandkit"
import { templateFor } from "./brand-presets"
import { safeFetch } from "./safe-fetch"
import { hasFreeAccess, makeFree } from "./free"
import { extraFor, secretOf, targetFor } from "./profiles"

export type LiProfile = {
  id: number
  email: string
  about: string
  audience: string
  topics: string
  tone: string
  language: string
  postsPerWeek: number
  postTime: string
  liName: string
  liSub: string
  tokenEnc: string
  tokenExpires: string | null
  connected: boolean
  /** Post designs: format mix the writer aims for, brand colour and name on images. */
  prefs: { mix: string; color: string; brand: string; goals: string; offer: string; cta: string }
}

export type LiPost = {
  id: number
  email: string
  status: "draft" | "approved" | "paused" | "posted" | "failed" | "rejected" | "blocked"
  text: string
  topic: string
  scheduledAt: string | null
  postedAt: string | null
  postUrn: string
  error: string
  format: Format
  design: Design
  createdAt?: string
  updatedAt?: string
}

/** What the browser gets: never the token. */
export type LiProfileView = Omit<LiProfile, "tokenEnc" | "liSub"> & { tokenExpiringSoon: boolean }

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

export function asSub(r: Record<string, unknown>): Subscription {
  return {
    id: num(r.id),
    email: String(r.email || ""),
    product: (isProduct(r.product) ? r.product : "linkedin") as ProductKey,
    plan: (r.plan === "starter" || r.plan === "pro" ? r.plan : "trial") as Subscription["plan"],
    cycle: r.cycle === "yearly" ? "yearly" : "monthly",
    status: (["trial", "pending", "active", "halted", "cancelled"].includes(String(r.status)) ? r.status : "trial") as Subscription["status"],
    postLimit: num(r.postLimit),
    used: num(r.used),
    periodStart: (r.periodStart as string) || null,
    periodEnd: (r.periodEnd as string) || null,
    rzpSubId: String(r.rzpSubId || ""),
    note: String(r.note || ""),
    extra: Math.max(0, Math.floor(num(r.extra))),
  }
}

// ---------- subscriptions ----------

export async function subsFor(email: string): Promise<Subscription[]> {
  return (await rows<Record<string, unknown>>("subs", { col: "email", val: email })).map(asSub)
}

export async function subFor(email: string, product: ProductKey): Promise<Subscription | null> {
  return (await subsFor(email)).find((s) => s.product === product) || null
}

/** Every customer gets one free trial per product (or free Pro, when an admin gave them free access). */
export async function ensureTrial(email: string, product: ProductKey): Promise<Subscription> {
  const [have, free] = await Promise.all([subFor(email, product), hasFreeAccess(email)])
  const sub = have || asSub(await insert<Record<string, unknown>>("subs", { email, product, plan: "trial", status: "trial", postLimit: PRODUCTS[product].trial, used: 0, rzpSubId: "", note: "" }))
  return free ? makeFree(sub) : sub
}

export async function markPending(sub: Subscription, rzpSubId: string, plan: PlanKey) {
  await update("subs", sub.id, { rzpSubId, note: `checkout:${plan}` })
}

/** From Razorpay (checkout success or webhook). */
export async function applySubscription(event: { rzpSubId: string; email?: string; product?: string; plan?: string; extra?: number; status: "active" | "halted" | "cancelled"; start?: number; end?: number; charged?: boolean }) {
  const all = await rows<Record<string, unknown>>("subs", { col: "rzpSubId", val: event.rzpSubId })
  let sub = all.map(asSub)[0]
  if (!sub && event.email && isProduct(event.product)) sub = (await subFor(event.email, event.product)) || (await ensureTrial(event.email, event.product))
  if (!sub) return
  const plan = (event.plan === "starter" || event.plan === "pro" ? event.plan : sub.plan === "trial" ? "starter" : sub.plan) as PlanKey
  const p = planOf(sub.product, plan)
  const periodStart = event.start ? new Date(event.start * 1000).toISOString() : sub.periodStart
  const periodEnd = event.end ? new Date(event.end * 1000).toISOString() : sub.periodEnd
  const patch: Record<string, unknown> = { status: event.status, rzpSubId: event.rzpSubId, note: "" }
  if (event.status === "active") {
    const extra = cleanExtra(sub.product, event.extra ?? sub.extra)
    patch.plan = plan
    patch.extra = extra
    patch.postLimit = p ? limitOf(sub.product, plan, sub.cycle, extra) : sub.postLimit
    patch.periodStart = periodStart
    patch.periodEnd = periodEnd
    // A new billing period (or the first one) starts with a fresh allowance.
    if (sub.status !== "active" || (event.charged && periodStart !== sub.periodStart)) patch.used = 0
  }
  await update("subs", sub.id, patch)
}

// ---------- LinkedIn profile ----------

function asProfile(r: Record<string, unknown>): LiProfile {
  return {
    id: num(r.id),
    email: String(r.email || ""),
    about: String(r.about || ""),
    audience: String(r.audience || ""),
    topics: String(r.topics || ""),
    tone: String(r.tone || ""),
    language: String(r.language || "English"),
    postsPerWeek: num(r.postsPerWeek, 3) || 3,
    postTime: /^\d{2}:\d{2}$/.test(String(r.postTime)) ? String(r.postTime) : "09:05",
    liName: String(r.liName || ""),
    liSub: String(r.liSub || ""),
    tokenEnc: String(r.tokenEnc || ""),
    tokenExpires: (r.tokenExpires as string) || null,
    connected: r.connected === true,
    prefs: asPrefs(r.prefs),
  }
}

function asPrefs(raw: unknown): LiProfile["prefs"] {
  let o: Record<string, unknown> = {}
  try {
    o = JSON.parse(String(raw || "{}")) || {}
  } catch {}
  return { mix: mixKey(LI_MIXES, o.mix), color: safeColor(o.color, "#10203f"), brand: String(o.brand || "").slice(0, 60), goals: goalPlanKey(o.goals), offer: String(o.offer || "").slice(0, 300), cta: String(o.cta || "").slice(0, 120) }
}

export async function profileFor(email: string): Promise<LiProfile | null> {
  const r = (await rows<Record<string, unknown>>("li_profiles", { col: "email", val: email }))[0]
  return r ? asProfile(r) : null
}

export function viewProfile(p: LiProfile | null): LiProfileView | null {
  if (!p) return null
  const { tokenEnc: _t, liSub: _s, ...rest } = p
  void _t
  void _s
  const exp = p.tokenExpires ? Date.parse(p.tokenExpires) : 0
  return { ...rest, connected: p.connected && exp > Date.now(), tokenExpiringSoon: p.connected && exp - Date.now() < 7 * 864e5 }
}

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)

export async function saveProfile(email: string, input: Record<string, unknown>): Promise<LiProfile> {
  const fields = {
    about: clip(input.about, 1200),
    audience: clip(input.audience, 600),
    topics: clip(input.topics, 800),
    tone: clip(input.tone, 300),
    language: ["English", "Hinglish", "Hindi"].includes(String(input.language)) ? String(input.language) : "English",
    postsPerWeek: Math.min(7, Math.max(1, num(input.postsPerWeek, 3))),
    postTime: /^\d{2}:\d{2}$/.test(String(input.postTime)) ? String(input.postTime) : "09:05",
    prefs: JSON.stringify({ mix: mixKey(LI_MIXES, input.mix), color: safeColor(input.color, "#10203f"), brand: clip(input.brand, 60), goals: goalPlanKey(input.goals), offer: clip(input.offer, 300), cta: clip(input.cta, 120) }),
  }
  const have = await profileFor(email)
  if (have) {
    await update("li_profiles", have.id, fields)
    return { ...have, ...fields, prefs: asPrefs(fields.prefs) }
  }
  return asProfile(await insert("li_profiles", { email, ...fields, liName: "", liSub: "", tokenEnc: "", connected: false }))
}

/** After LinkedIn sign-in. One free trial per LinkedIn account, whatever email signs up. */
export async function connectLinkedIn(email: string, li: { token: string; expiresAt: string; sub: string; name: string }) {
  const p = (await profileFor(email)) || (await saveProfile(email, {}))
  await update("li_profiles", p.id, { tokenEnc: seal(li.token), tokenExpires: li.expiresAt, liSub: li.sub, liName: li.name, connected: true })
  const others = (await rows<Record<string, unknown>>("li_profiles", { col: "liSub", val: li.sub })).map(asProfile).filter((x) => x.email !== email)
  if (others.length) {
    const mine = await ensureTrial(email, "linkedin")
    if (mine.status === "trial" && mine.used === 0) {
      for (const o of others) {
        const s = await subFor(o.email, "linkedin")
        if (s && (s.used > 0 || s.status !== "trial")) {
          await update("subs", mine.id, { postLimit: 0, note: "Free trial already used by this LinkedIn account." })
          break
        }
      }
    }
  }
}

export async function disconnectLinkedIn(email: string) {
  const p = await profileFor(email)
  if (p) await update("li_profiles", p.id, { tokenEnc: "", connected: false })
}

// ---------- posts ----------

function asPost(r: Record<string, unknown>): LiPost {
  return {
    id: num(r.id),
    email: String(r.email || ""),
    status: (["draft", "approved", "paused", "posted", "failed", "rejected", "blocked"].includes(String(r.status)) ? r.status : "draft") as LiPost["status"],
    text: String(r.text || ""),
    topic: String(r.topic || ""),
    scheduledAt: (r.scheduledAt as string) || null,
    postedAt: (r.postedAt as string) || null,
    postUrn: String(r.postUrn || ""),
    error: String(r.error || ""),
    format: isFormat(r.format) ? r.format : "text",
    design: parseDesign(r.design),
    createdAt: (r.createdAt as string) || undefined,
    updatedAt: (r.updatedAt as string) || undefined,
  }
}

export async function postsFor(email: string): Promise<LiPost[]> {
  return (await rows<Record<string, unknown>>("li_posts", { col: "email", val: email }))
    .map(asPost)
    .sort((a, b) => String(a.scheduledAt || a.createdAt).localeCompare(String(b.scheduledAt || b.createdAt)))
}

async function ownPost(email: string, id: number): Promise<LiPost> {
  const p = (await rows<Record<string, unknown>>("li_posts", { col: "id", val: id })).map(asPost)[0]
  if (!p || p.email !== email) throw new Error("That post isn't yours.")
  return p
}

const inFuture = (iso: string | null) => (iso && Date.parse(iso) > Date.now() + 5 * 60_000 ? iso : new Date(Date.now() + 15 * 60_000).toISOString())

export async function postAction(email: string, input: Record<string, unknown>) {
  const id = num(input.id)
  const op = String(input.op || "")
  const post = await ownPost(email, id)
  if (post.status === "posted") throw new Error("This post is already live on LinkedIn.")
  if (op === "approve") return update("li_posts", id, { status: "approved", scheduledAt: inFuture(post.scheduledAt), error: "" })
  if (op === "unapprove") return update("li_posts", id, { status: "draft" })
  if (op === "pause") return update("li_posts", id, { status: "paused" })
  if (op === "reject") return update("li_posts", id, { status: "rejected" })
  if (op === "edit") {
    const text = String(input.text ?? "").trim()
    if (text.length < 20) throw new Error("A post needs at least a couple of sentences.")
    if (text.length > 2900) throw new Error("LinkedIn posts can be at most 3,000 characters.")
    const extra = input.design !== undefined ? { design: JSON.stringify(cleanDesign(input.design)) } : {}
    return update("li_posts", id, { text, ...extra })
  }
  if (op === "design") {
    const format = isFormat(input.format) ? input.format : post.format
    const design = input.design !== undefined ? cleanDesign(input.design) : post.design
    return update("li_posts", id, { format, design: JSON.stringify(design) })
  }
  if (op === "reschedule") {
    const when = String(input.when || "")
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) throw new Error("Pick a date and time.")
    const iso = new Date(when + ":00+05:30").toISOString()
    if (Date.parse(iso) < Date.now()) throw new Error("Pick a time in the future.")
    return update("li_posts", id, { scheduledAt: iso })
  }
  if (op === "send-to") {
    // Which LinkedIn profile it goes to: the main one (0) or one of the extra ones.
    const to = Number(input.profile) || 0
    if (to && !(await extraFor(email, "linkedin", to))) throw new Error("Pick one of your connected LinkedIn profiles.")
    const design = { ...post.design }
    if (to) design.profile = to
    else delete design.profile
    return update("li_posts", id, { design: JSON.stringify(design), ...(post.status === "failed" || post.status === "blocked" ? { status: "draft", error: "" } : {}) })
  }
  throw new Error("Unknown change.")
}

/** Called by n8n for each approved post that is due. Checks the plan, posts, counts it. */
export async function publishOne(id: number): Promise<{ ok: boolean; status: string; error?: string; url?: string }> {
  const post = (await rows<Record<string, unknown>>("li_posts", { col: "id", val: id })).map(asPost)[0]
  if (!post) return { ok: false, status: "missing" }
  if (post.status !== "approved") return { ok: true, status: post.status }
  if (post.scheduledAt && Date.parse(post.scheduledAt) > Date.now() + 60_000) return { ok: true, status: "not-due" }
  const sub = await subFor(post.email, "linkedin")
  if (!canPublish(sub)) {
    const why = sub?.note || (sub?.status === "trial" ? "Your 3 free posts are used. Subscribe to keep posting." : "Your subscription isn't active. Renew to keep posting.")
    await update("li_posts", id, { status: "blocked", error: why })
    return { ok: false, status: "blocked", error: why }
  }
  const main = await profileFor(post.email)
  try {
    if (!main) throw new Error("LinkedIn isn't connected. Connect LinkedIn on the Autopilot page.")
    // An extra LinkedIn profile when the post was set to go there; otherwise the main one.
    const extra = await targetFor(post.email, "linkedin", post.design.profile)
    const prof: LiProfile = extra
      ? { ...main, liSub: String(extra.meta.sub || ""), liName: extra.name, tokenEnc: seal(String(secretOf(extra).token || "")), tokenExpires: (extra.meta.expires as string) || null, connected: extra.connected }
      : main
    if (!prof.connected || !prof.tokenEnc || !prof.liSub) throw new Error(extra ? `${extra.name || "This LinkedIn profile"} isn't connected. Connect it again.` : "LinkedIn isn't connected. Connect LinkedIn on the Autopilot page.")
    if (prof.tokenExpires && Date.parse(prof.tokenExpires) < Date.now()) throw new Error(extra ? `LinkedIn access for ${extra.name} expired. Connect it again.` : "LinkedIn access expired. Reconnect LinkedIn.")
    const token = open(prof.tokenEnc)
    const urn = await publishPost(token, prof.liSub, post.text, await liMedia(post, prof, token))
    await update("li_posts", id, { status: "posted", postedAt: new Date().toISOString(), postUrn: urn, error: "" })
    // Count it (re-read so two posts at once don't overwrite each other's count by much).
    const fresh = await subFor(post.email, "linkedin")
    if (fresh) await update("subs", fresh.id, { used: fresh.used + 1 })
    return { ok: true, status: "posted", url: postUrl(urn) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Posting failed."
    await update("li_posts", id, { status: "failed", error: msg.slice(0, 300) })
    return { ok: false, status: "failed", error: msg }
  }
}

/** The look of a LinkedIn post's design: the brand kit and the post's template. */
export async function liLook(post: Pick<LiPost, "id" | "email" | "design">, prof: LiProfile | null): Promise<Look> {
  const kit = await kitFor(post.email, { name: prof?.prefs.brand || prof?.liName || "", color: prof?.prefs.color !== "#10203f" ? prof?.prefs.color : "" })
  // Personal LinkedIn posts carry the person's own name on Playbook designs (an extra profile's own name).
  const extra = post.design.profile ? await extraFor(post.email, "linkedin", post.design.profile) : null
  return { kit, template: templateFor(kit, post.design.template, post.id), author: extra?.name || prof?.liName || undefined }
}

async function photoBytes(url: string): Promise<{ bytes: ArrayBuffer; type: string }> {
  const { res: r, bytes } = await safeFetch(url, { cache: "no-store" }, 15_000_000).catch(() => {
    throw new Error("One of your photos couldn't be loaded. Upload it again.")
  })
  if (!r.ok) throw new Error("One of your photos couldn't be loaded. Upload it again.")
  const type = (r.headers.get("content-type") || "image/jpeg").split(";")[0]
  if (!/^image\/(png|jpe?g|gif|webp)$/.test(type)) throw new Error("One of your photos isn't a picture file. Upload it again.")
  return { bytes, type }
}

/** Uploads what a post needs (designed image, carousel PDF or the customer's photos) before posting. */
async function liMedia(post: LiPost, prof: LiProfile, token: string): Promise<LiMedia | undefined> {
  const d = post.design
  const alt = (d.headline || post.topic || post.text.split("\n")[0] || "").slice(0, 200)
  if (post.format === "image") {
    if (d.photos?.[0]) {
      const p = await photoBytes(d.photos[0])
      return { kind: "image", urn: await liUpload(token, prof.liSub, "images", p.bytes, p.type), alt }
    }
    const png = await renderCard({ kind: "single", title: d.headline || post.topic || post.text.split("\n")[0].slice(0, 90) }, await liLook(post, prof))
    return { kind: "image", urn: await liUpload(token, prof.liSub, "images", png, "image/png"), alt }
  }
  if (post.format === "carousel") {
    if (!d.slides || d.slides.length < 2) throw new Error("This carousel has no slides. Open it and add slides, or switch it to Text.")
    const pdf = await carouselPdf(d.slides, await liLook(post, prof))
    return { kind: "document", urn: await liUpload(token, prof.liSub, "documents", pdf, "application/pdf"), title: d.slides[0].title || post.topic }
  }
  if (post.format === "photo") {
    const photos = d.photos || []
    if (!photos.length) throw new Error("Add your photos to this post first, or switch it to another type.")
    const urns: string[] = []
    for (const url of photos) {
      const p = await photoBytes(url)
      urns.push(await liUpload(token, prof.liSub, "images", p.bytes, p.type))
    }
    return urns.length === 1 ? { kind: "image", urn: urns[0], alt } : { kind: "images", urns, alt }
  }
  return undefined
}

export type { Table }
