// lib/autopilot/tools.ts
//
// Server-only business rules for the other Autopilot tools:
//   meta        Instagram + Facebook Autopilot
//   blog        Blog Writer for WordPress
//   newsletter  Email Newsletter Autopilot
// Settings and sealed access live in XD Channels, drafts in XD Items, subscribers in XD Contacts.
// Trials, plans and payments are shared with LinkedIn Autopilot (service.ts).

import { insert, insertMany, remove, rows, update } from "./db"
import { open, seal, sign } from "./crypto"
import { canPublish, contactCap, PRODUCTS, type ProductKey, type Subscription } from "./products"
import { ensureTrial, subFor } from "./service"
import { SITE } from "./linkedin"
import { metaPublish, type MetaPage } from "./meta"
import { cleanSite, wpPublish, wpVerify } from "./wordpress"
import { buildIssue, smtpVerify, transport, type Smtp } from "./mail"
import { mdToHtml } from "./markdown"
import { cleanDesign, isFormat, META_MIXES, mixKey, parseDesign, type Design, type Format } from "./formats"

export type ToolKey = Exclude<ProductKey, "linkedin">
export const TOOL_KEYS: ToolKey[] = ["meta", "blog", "newsletter"]
export const isTool = (v: unknown): v is ToolKey => typeof v === "string" && (TOOL_KEYS as string[]).includes(v)

type Obj = Record<string, unknown>

export type Channel = {
  id: number
  email: string
  product: ToolKey
  settings: Obj
  connName: string
  connKey: string
  meta: Obj
  secretEnc: string
  connected: boolean
}

export type Item = {
  id: number
  email: string
  product: ToolKey
  status: "draft" | "approved" | "paused" | "posted" | "failed" | "rejected" | "blocked"
  title: string
  summary: string
  text: string
  topic: string
  image: string
  scheduledAt: string | null
  postedAt: string | null
  ref: string
  progress: number
  error: string
  format: Format
  design: Design
  createdAt?: string
  updatedAt?: string
}

export type Contact = { id: number; owner: string; email: string; name: string; status: "subscribed" | "unsubscribed"; unsubAt: string | null }

const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
const parse = (v: unknown): Obj => {
  try {
    const o = JSON.parse(String(v || "{}"))
    return o && typeof o === "object" ? (o as Obj) : {}
  } catch {
    return {}
  }
}
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n)
const lc = (v: unknown) => String(v || "").trim().toLowerCase()

// ---------- channels ----------

function asChannel(r: Obj): Channel {
  return {
    id: num(r.id),
    email: lc(r.email),
    product: (isTool(r.product) ? r.product : "meta") as ToolKey,
    settings: parse(r.settings),
    connName: String(r.connName || ""),
    connKey: String(r.connKey || ""),
    meta: parse(r.meta),
    secretEnc: String(r.secretEnc || ""),
    connected: r.connected === true,
  }
}

export async function channelFor(email: string, product: ToolKey): Promise<Channel | null> {
  const all = (await rows<Obj>("ap_channels", { col: "email", val: email })).map(asChannel)
  return all.find((c) => c.product === product) || null
}

/** What the browser gets: never secrets or the trial key. */
export function viewChannel(c: Channel | null) {
  if (!c) return null
  const meta = { ...c.meta }
  if (Array.isArray(meta.choose)) meta.choose = (meta.choose as Obj[]).map((p) => ({ id: p.id, name: p.name, igUser: p.igUser }))
  return { settings: c.settings, connName: c.connName, connected: c.connected, meta }
}

const LANGS = ["English", "Hinglish", "Hindi"]
const PER_WEEK: Record<ToolKey, [number, number, number]> = { meta: [1, 7, 3], blog: [1, 7, 2], newsletter: [1, 3, 1] }

function cleanSettings(product: ToolKey, i: Obj): Obj {
  const [lo, hi, d] = PER_WEEK[product]
  const base: Obj = {
    about: clip(i.about, 1500),
    audience: clip(i.audience, 600),
    topics: clip(i.topics, 1000),
    tone: clip(i.tone, 300),
    language: LANGS.includes(String(i.language)) ? String(i.language) : "English",
    perWeek: Math.min(hi, Math.max(lo, num(i.perWeek, d) || d)),
    time: /^\d{2}:\d{2}$/.test(String(i.time)) ? String(i.time) : product === "newsletter" ? "08:05" : "10:05",
  }
  const color = /^#[0-9a-f]{6}$/i.test(String(i.color)) ? String(i.color) : "#24438a"
  if (product === "meta") return { ...base, brand: clip(i.brand, 60), color, mix: mixKey(META_MIXES, i.mix), targets: ["both", "instagram", "facebook"].includes(String(i.targets)) ? i.targets : "both" }
  if (product === "blog") return { ...base, words: [800, 1200, 1800].includes(num(i.words)) ? num(i.words) : 1200, publishMode: i.publishMode === "draft" ? "draft" : "publish", cta: clip(i.cta, 300) }
  return { ...base, name: clip(i.name, 80), fromName: clip(i.fromName, 80), address: clip(i.address, 300), notes: clip(i.notes, 1000), color }
}

async function ensureChannel(email: string, product: ToolKey): Promise<Channel> {
  const have = await channelFor(email, product)
  if (have) return have
  return asChannel(await insert<Obj>("ap_channels", { email, product, settings: "{}", connName: "", connKey: "", meta: "{}", secretEnc: "", connected: false }))
}

export async function saveSettings(email: string, product: ToolKey, input: Obj): Promise<Channel> {
  const c = await ensureChannel(email, product)
  const settings = cleanSettings(product, input)
  if (product === "newsletter" && !String(settings.address)) throw new Error("Add your business address. The law requires it at the bottom of every newsletter.")
  await update("ap_channels", c.id, { settings: JSON.stringify(settings) })
  return { ...c, settings }
}

/** One free trial per Page / site / sending address, whatever email signs up. */
async function guardTrial(email: string, product: ToolKey, connKey: string, what: string) {
  const others = (await rows<Obj>("ap_channels", { col: "connKey", val: connKey })).map(asChannel).filter((x) => x.product === product && x.email !== email)
  if (!others.length) return
  const mine = await ensureTrial(email, product)
  if (mine.status !== "trial" || mine.used > 0) return
  for (const o of others) {
    const s = await subFor(o.email, product)
    if (s && (s.used > 0 || s.status !== "trial")) {
      await update("subs", mine.id, { postLimit: 0, note: `The free trial was already used for this ${what}.` })
      return
    }
  }
}

async function setConnection(email: string, product: ToolKey, o: { connName: string; connKey: string; meta: Obj; secret: Obj; connected: boolean }) {
  const c = await ensureChannel(email, product)
  await update("ap_channels", c.id, { connName: o.connName, connKey: o.connKey, meta: JSON.stringify(o.meta), secretEnc: seal(JSON.stringify(o.secret)), connected: o.connected })
}

export async function disconnect(email: string, product: ToolKey) {
  const c = await channelFor(email, product)
  if (c) await update("ap_channels", c.id, { secretEnc: "", connected: false, meta: "{}" })
}

// Instagram + Facebook

export async function connectMeta(email: string, pages: MetaPage[]) {
  if (!pages.length) throw new Error("No Facebook Pages came back. Make sure you picked your Page when Facebook asked.")
  if (pages.length === 1) return choosePage(email, pages[0])
  await setConnection(email, "meta", {
    connName: "",
    connKey: "",
    meta: { choose: pages.map((p) => ({ id: p.id, name: p.name, igUser: p.igUser })) },
    secret: { pages: pages.map((p) => ({ id: p.id, name: p.name, token: p.token, igId: p.igId, igUser: p.igUser })) },
    connected: false,
  })
}

async function choosePage(email: string, p: MetaPage) {
  await setConnection(email, "meta", {
    connName: p.igUser ? `${p.name} + @${p.igUser}` : p.name,
    connKey: `fb:${p.id}`,
    meta: { pageId: p.id, pageName: p.name, igId: p.igId, igUser: p.igUser },
    secret: { token: p.token },
    connected: true,
  })
  await guardTrial(email, "meta", `fb:${p.id}`, "Facebook Page")
}

export async function pickPage(email: string, pageId: string) {
  const c = await channelFor(email, "meta")
  if (!c?.secretEnc) throw new Error("Connect Facebook again.")
  const s = parse(open(c.secretEnc))
  const p = ((s.pages as MetaPage[]) || []).find((x) => x.id === pageId)
  if (!p) throw new Error("Pick one of your Pages.")
  await choosePage(email, p)
}

// WordPress

export async function connectWordPress(email: string, input: Obj) {
  const site = cleanSite(String(input.site || ""))
  const user = clip(input.user, 100)
  const pass = String(input.pass || "").trim()
  if (!user || pass.replace(/\s/g, "").length < 16) throw new Error("Enter your WordPress username and the Application Password.")
  const v = await wpVerify(site, user, pass)
  if (!v.canPublish) throw new Error("That WordPress user can't publish posts. Use an Author, Editor or Administrator account.")
  const host = site.replace(/^https?:\/\//, "")
  await setConnection(email, "blog", { connName: host, connKey: `wp:${host}`, meta: { site, user }, secret: { pass }, connected: true })
  await guardTrial(email, "blog", `wp:${host}`, "website")
}

// Newsletter (customer's own SMTP)

export async function connectSmtp(email: string, input: Obj) {
  const port = num(input.port, 465)
  const smtp: Smtp = {
    host: clip(input.host, 120).toLowerCase(),
    port,
    secure: port === 465,
    user: clip(input.user, 160),
    pass: String(input.pass || ""),
    from: lc(input.from || input.user),
    fromName: clip(input.fromName, 80),
  }
  if (!smtp.host || !smtp.user || !smtp.pass) throw new Error("Fill in the SMTP server, username and password.")
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(smtp.from)) throw new Error("Enter the email address newsletters come from.")
  if (![465, 587, 25, 2525].includes(port)) throw new Error("Use port 465 (SSL) or 587.")
  await smtpVerify(smtp)
  await setConnection(email, "newsletter", {
    connName: smtp.from,
    connKey: `mail:${smtp.from}`,
    meta: { host: smtp.host, port: smtp.port, user: smtp.user, from: smtp.from },
    secret: { pass: smtp.pass },
    connected: true,
  })
  await guardTrial(email, "newsletter", `mail:${smtp.from}`, "email address")
}

function smtpOf(c: Channel): Smtp {
  const m = c.meta
  const s = parse(open(c.secretEnc))
  return { host: String(m.host), port: num(m.port, 465), secure: num(m.port, 465) === 465, user: String(m.user), pass: String(s.pass || ""), from: String(m.from), fromName: String(c.settings.fromName || "") }
}

// ---------- contacts ----------

function asContact(r: Obj): Contact {
  return { id: num(r.id), owner: lc(r.owner), email: lc(r.email), name: String(r.name || ""), status: r.status === "unsubscribed" ? "unsubscribed" : "subscribed", unsubAt: (r.unsubAt as string) || null }
}

export async function contactsFor(owner: string): Promise<Contact[]> {
  return (await rows<Obj>("ap_contacts", { col: "owner", val: owner })).map(asContact).sort((a, b) => a.id - b.id)
}

export const MAX_CONTACTS = 5000

/** Paste or CSV: one per line, "email" or "email, name" or "name <email>". */
export async function addContacts(owner: string, raw: string): Promise<{ added: number; skipped: number; total: number }> {
  const have = await contactsFor(owner)
  const seen = new Set(have.map((c) => c.email))
  const fresh: Obj[] = []
  let skipped = 0
  for (const line of String(raw || "").split(/\r?\n/).slice(0, 20000)) {
    const m = /([^\s<>,;"']+@[^\s<>,;"']+\.[a-z]{2,})/i.exec(line)
    if (!m) {
      if (line.trim()) skipped++
      continue
    }
    const email = m[1].toLowerCase()
    if (seen.has(email) || email === owner) {
      skipped++
      continue
    }
    const name = line.replace(m[0], "").replace(/[<>,;"']/g, " ").replace(/\s+/g, " ").trim().slice(0, 80)
    seen.add(email)
    fresh.push({ owner, email, name, status: "subscribed", unsubAt: null })
  }
  const room = Math.max(0, MAX_CONTACTS - have.length)
  if (fresh.length > room) skipped += fresh.length - room
  const added = await insertMany("ap_contacts", fresh.slice(0, room))
  return { added, skipped, total: have.length + added }
}

export async function removeContact(owner: string, id: number) {
  const c = (await rows<Obj>("ap_contacts", { col: "id", val: id })).map(asContact)[0]
  if (!c || c.owner !== owner) throw new Error("Not found.")
  await remove("ap_contacts", id)
}

export const unsubUrl = (id: number) => `${SITE}/u?c=${id}&s=${sign(`u:${id}`)}`

/** Open pixel and click links for one subscriber of one issue (signed, so they can't be forged). */
export const openUrl = (item: number, contact: number) => `${SITE}/api/autopilot/m/o?i=${item}&c=${contact}&s=${sign(`mo:${item}:${contact}`)}`
export const clickUrl = (item: number, contact: number, url: string) => `${SITE}/api/autopilot/m/c?i=${item}&c=${contact}&u=${encodeURIComponent(url)}&s=${sign(`mc:${item}:${contact}:${url}`)}`

/** Counts an open or a click (best effort; never blocks the reader). */
export async function recordMail(type: "open" | "click", item: number, contact: number, url = "") {
  const it = await itemById(item)
  if (!it || it.product !== "newsletter") return
  await insert("ap_events", { owner: it.email, item, contact, type, url: url.slice(0, 500), at: new Date().toISOString() })
}

/** Adds the open pixel and wraps every link (except unsubscribe) in a click-tracking link. */
function track(html: string, item: number, contact: number): string {
  const unsub = unsubUrl(contact)
  return html
    .replace(/href="(https?:\/\/[^"]+)"/g, (m, raw: string) => {
      const url = raw.replace(/&amp;/g, "&")
      return url === unsub || url.startsWith(`${SITE}/u?`) ? m : `href="${clickUrl(item, contact, url).replace(/&/g, "&amp;")}"`
    })
    .replace("</body>", `<img src="${openUrl(item, contact).replace(/&/g, "&amp;")}" width="1" height="1" alt="" style="display:block;border:0;width:1px;height:1px">\n</body>`)
}

export async function unsubscribe(id: number): Promise<Contact | null> {
  const c = (await rows<Obj>("ap_contacts", { col: "id", val: id })).map(asContact)[0]
  if (!c) return null
  if (c.status !== "unsubscribed") await update("ap_contacts", id, { status: "unsubscribed", unsubAt: new Date().toISOString() })
  return c
}

// ---------- items ----------

function asItem(r: Obj): Item {
  return {
    id: num(r.id),
    email: lc(r.email),
    product: (isTool(r.product) ? r.product : "meta") as ToolKey,
    status: (["draft", "approved", "paused", "posted", "failed", "rejected", "blocked"].includes(String(r.status)) ? r.status : "draft") as Item["status"],
    title: String(r.title || ""),
    summary: String(r.summary || ""),
    text: String(r.text || ""),
    topic: String(r.topic || ""),
    image: String(r.image || ""),
    scheduledAt: (r.scheduledAt as string) || null,
    postedAt: (r.postedAt as string) || null,
    ref: String(r.ref || ""),
    progress: num(r.progress),
    error: String(r.error || ""),
    format: isFormat(r.format) ? r.format : r.product === "meta" ? "image" : "text",
    design: parseDesign(r.design),
    createdAt: (r.createdAt as string) || undefined,
    updatedAt: (r.updatedAt as string) || undefined,
  }
}

/** Public, signed address of a post design: slide n of a carousel, or the single image (n = 0). */
export const cardUrl = (id: number, n = 0, v = "") => `${SITE}/api/autopilot/card/${id}?s=${sign(`card:${id}`)}${n ? `&n=${n}` : ""}${v ? `&v=${encodeURIComponent(v)}` : ""}`
export const liCardUrl = (id: number, n = 0, v = "") => `${SITE}/api/autopilot/card/${id}?k=li&s=${sign(`cardli:${id}`)}${n ? `&n=${n}` : ""}${v ? `&v=${encodeURIComponent(v)}` : ""}`

/** The images a Meta post sends, in order. */
export function metaImages(it: Item): string[] {
  const v = it.updatedAt || ""
  if (it.format === "carousel" && it.design.slides && it.design.slides.length >= 2) return it.design.slides.map((_, n) => cardUrl(it.id, n, v))
  if (it.format === "photo" && it.design.photos?.length) return it.design.photos
  return [/^https:\/\//.test(it.image) ? it.image : it.design.photos?.[0] || cardUrl(it.id, 0, v)]
}

export async function itemsFor(email: string, product: ToolKey) {
  return (await rows<Obj>("ap_items", { col: "email", val: email }))
    .map(asItem)
    .filter((i) => i.product === product && i.status !== "rejected")
    .sort((a, b) => String(a.scheduledAt || a.createdAt).localeCompare(String(b.scheduledAt || b.createdAt)))
    .map((i) => ({ ...i, preview: product === "meta" ? (/^https:\/\//.test(i.image) ? i.image : cardUrl(i.id)) : "" }))
}

export async function itemById(id: number): Promise<Item | null> {
  return (await rows<Obj>("ap_items", { col: "id", val: id })).map(asItem)[0] || null
}

const inFuture = (iso: string | null) => (iso && Date.parse(iso) > Date.now() + 5 * 60_000 ? iso : new Date(Date.now() + 15 * 60_000).toISOString())
const LIMITS: Record<ToolKey, { title: number; text: number }> = { meta: { title: 90, text: 2200 }, blog: { title: 120, text: 60000 }, newsletter: { title: 120, text: 30000 } }

export async function itemAction(email: string, product: ToolKey, input: Obj) {
  const id = num(input.id)
  const op = String(input.op || "")
  const it = await itemById(id)
  if (!it || it.email !== email || it.product !== product) throw new Error("That item isn't yours.")
  if (it.status === "posted") throw new Error("This is already published.")
  if (it.progress > 0 && !(op === "approve" && it.status === "failed")) throw new Error("This newsletter is already being sent.")
  if (op === "approve") return update("ap_items", id, { status: "approved", scheduledAt: inFuture(it.scheduledAt), error: "" })
  if (op === "unapprove") return update("ap_items", id, { status: "draft" })
  if (op === "pause") return update("ap_items", id, { status: "paused" })
  if (op === "reject") return update("ap_items", id, { status: "rejected" })
  if (op === "edit") {
    const L = LIMITS[product]
    const title = String(input.title ?? it.title).trim()
    const text = String(input.text ?? it.text).trim()
    const summary = String(input.summary ?? it.summary).trim().slice(0, 300)
    const image = String(input.image ?? it.image).trim()
    if (!title) throw new Error(product === "meta" ? "Add the words for the image." : product === "blog" ? "Add a title." : "Add a subject line.")
    if (title.length > L.title) throw new Error(`Keep the ${product === "newsletter" ? "subject" : product === "meta" ? "image text" : "title"} under ${L.title} characters.`)
    if (text.length < 20) throw new Error("The text is too short.")
    if (text.length > L.text) throw new Error(`Keep it under ${L.text.toLocaleString("en-IN")} characters.`)
    if (image && !/^https:\/\/\S+$/i.test(image)) throw new Error("The image link must start with https://")
    const extra = input.design !== undefined ? { design: JSON.stringify(cleanDesign(input.design)) } : {}
    return update("ap_items", id, { title, text, summary, image, ...extra })
  }
  if (op === "design" && product === "meta") {
    const format = isFormat(input.format) && input.format !== "text" ? input.format : it.format
    const design = input.design !== undefined ? cleanDesign(input.design) : it.design
    const title = format === "carousel" && design.slides?.[0]?.title ? design.slides[0].title.slice(0, 90) : it.title
    return update("ap_items", id, { format, design: JSON.stringify(design), title })
  }
  if (op === "reschedule") {
    const when = String(input.when || "")
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(when)) throw new Error("Pick a date and time.")
    const iso = new Date(when + ":00+05:30").toISOString()
    if (Date.parse(iso) < Date.now()) throw new Error("Pick a time in the future.")
    return update("ap_items", id, { scheduledAt: iso })
  }
  if (op === "test" && product === "newsletter") return sendTest(email, it)
  throw new Error("Unknown change.")
}

// ---------- publishing (called by n8n for each approved item that is due) ----------

type Result = { ok: boolean; status: string; error?: string; url?: string; sent?: number }

async function block(it: Item, sub: Subscription | null, unit: string): Promise<Result> {
  const why =
    sub?.note && !sub.note.startsWith("upi:") && !sub.note.startsWith("checkout:")
      ? sub.note
      : sub?.status === "trial"
        ? `Your ${PRODUCTS[it.product].trial} free ${unit} are used. Subscribe to keep going.`
        : "Your subscription isn't active. Renew to keep going."
  await update("ap_items", it.id, { status: "blocked", error: why })
  return { ok: false, status: "blocked", error: why }
}

async function countOne(email: string, product: ToolKey) {
  const fresh = await subFor(email, product)
  if (fresh) await update("subs", fresh.id, { used: fresh.used + 1 })
}

async function fail(it: Item, e: unknown): Promise<Result> {
  const msg = (e instanceof Error ? e.message : "Publishing failed.").slice(0, 300)
  await update("ap_items", it.id, { status: "failed", error: msg })
  return { ok: false, status: "failed", error: msg }
}

export async function publishItem(id: number): Promise<Result> {
  const it = await itemById(id)
  if (!it) return { ok: false, status: "missing" }
  if (it.status !== "approved") return { ok: true, status: it.status }
  if (it.scheduledAt && Date.parse(it.scheduledAt) > Date.now() + 60_000) return { ok: true, status: "not-due" }
  if (it.product === "newsletter") return sendIssue(it)
  const sub = await subFor(it.email, it.product)
  if (!canPublish(sub)) return block(it, sub, PRODUCTS[it.product].unit)
  const c = await channelFor(it.email, it.product)
  try {
    if (!c || !c.connected || !c.secretEnc) throw new Error(it.product === "meta" ? "Facebook / Instagram isn't connected." : "Your WordPress site isn't connected.")
    const secret = parse(open(c.secretEnc))
    let url = ""
    if (it.product === "meta") {
      if (it.format === "photo" && !it.design.photos?.length) throw new Error("Add your photos to this post first, or switch it to another type.")
      const img = metaImages(it)
      const targets = (c.settings.targets as "both" | "instagram" | "facebook") || "both"
      const r = await metaPublish({ id: String(c.meta.pageId), igId: String(c.meta.igId || ""), token: String(secret.token) }, c.meta.igId ? targets : "facebook", it.text, img)
      url = r.ig || r.fb || ""
      await update("ap_items", id, { status: "posted", postedAt: new Date().toISOString(), ref: [r.ig, r.fb].filter(Boolean).join(" "), error: (r as Obj).warning ? String((r as Obj).warning).slice(0, 300) : "" })
    } else {
      const cta = String(c.settings.cta || "").trim()
      const html = mdToHtml(it.text + (cta ? `\n\n${cta}` : ""))
      const r = await wpPublish(String(c.meta.site), String(c.meta.user), String(secret.pass), { title: it.title, html, excerpt: it.summary, status: c.settings.publishMode === "draft" ? "draft" : "publish" })
      url = r.link
      await update("ap_items", id, { status: "posted", postedAt: new Date().toISOString(), ref: r.link, error: "" })
    }
    await countOne(it.email, it.product)
    return { ok: true, status: "posted", url }
  } catch (e) {
    return fail(it, e)
  }
}

async function sendTest(email: string, it: Item) {
  const c = await channelFor(email, "newsletter")
  if (!c?.connected) throw new Error("Connect your email first.")
  const smtp = smtpOf(c)
  const t = transport(smtp)
  try {
    const { html, text } = buildIssue({ title: it.title, preheader: it.summary, md: it.text, newsletter: String(c.settings.name || smtp.fromName || "Newsletter"), address: String(c.settings.address || ""), unsubUrl: `${SITE}/u`, toName: "", color: String(c.settings.color || "") })
    await t.sendMail({ from: { name: smtp.fromName || String(c.settings.name || ""), address: smtp.from }, to: email, subject: `[Test] ${it.title}`, html, text })
  } catch (e) {
    throw new Error("The test email didn't send: " + (e instanceof Error ? e.message : "").slice(0, 160))
  } finally {
    t.close()
  }
}

async function sendIssue(it: Item): Promise<Result> {
  const sub = await subFor(it.email, "newsletter")
  const started = it.progress > 0 || it.ref.startsWith("sent:")
  if (!started && !canPublish(sub)) return block(it, sub, "issues")
  const c = await channelFor(it.email, "newsletter")
  if (!c || !c.connected || !c.secretEnc) return fail(it, new Error("Your email account isn't connected."))
  const cap = contactCap(sub)
  let sent = Number(it.ref.replace(/^sent:/, "")) || 0
  if (!started) await countOne(it.email, "newsletter")
  const all = (await contactsFor(it.email)).filter((x) => x.status === "subscribed")
  const queue = all.filter((x) => x.id > it.progress).slice(0, Math.max(0, cap - sent))
  if (!all.length) return fail(it, new Error("You have no subscribers yet. Add them in the Subscribers box."))
  const smtp = smtpOf(c)
  const t = transport(smtp)
  const deadline = Date.now() + 230_000
  let last = it.progress
  let failures = 0
  const name = String(c.settings.name || smtp.fromName || "Newsletter")
  try {
    for (const ct of queue) {
      if (Date.now() > deadline) break
      const u = unsubUrl(ct.id)
      const built = buildIssue({ title: it.title, preheader: it.summary, md: it.text, newsletter: name, address: String(c.settings.address || ""), unsubUrl: u, toName: ct.name, color: String(c.settings.color || "") })
      const html = track(built.html, it.id, ct.id)
      const text = built.text
      try {
        await t.sendMail({
          from: { name: smtp.fromName || name, address: smtp.from },
          to: ct.name ? { name: ct.name, address: ct.email } : ct.email,
          subject: it.title,
          html,
          text,
          headers: { "List-Unsubscribe": `<${u}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
        })
        sent++
      } catch (e) {
        failures++
        const m = e instanceof Error ? e.message : ""
        // The account itself stopped working (password changed, daily limit hit): stop and say so.
        if (/auth|535|534|limit|quota|rate|421|454|550 5\.4\.5/i.test(m)) {
          await update("ap_items", it.id, { progress: last, ref: `sent:${sent}` })
          return fail(it, new Error(`Sending stopped after ${sent} emails: ${m.slice(0, 160)}. Approve it again to send to the rest.`))
        }
      }
      last = ct.id
      if ((sent + failures) % 20 === 0) await update("ap_items", it.id, { progress: last, ref: `sent:${sent}` })
    }
  } finally {
    t.close()
  }
  const remaining = all.filter((x) => x.id > last).length
  const capped = sent >= cap
  if (remaining && !capped) {
    await update("ap_items", it.id, { progress: last, ref: `sent:${sent}` })
    return { ok: true, status: "sending", sent }
  }
  const note = capped && remaining ? `Sent to ${sent} subscribers, the most your plan allows. Upgrade to reach all ${all.length}.` : failures ? `${failures} addresses didn't accept it.` : ""
  await update("ap_items", it.id, { status: "posted", postedAt: new Date().toISOString(), progress: last, ref: `sent:${sent}`, error: note })
  return { ok: true, status: "posted", sent }
}
