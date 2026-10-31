// lib/autopilot/profiles.ts
//
// Server-only. Extra profiles: a second (third…) LinkedIn profile, Facebook Page + Instagram or
// WordPress site inside one brand, paid as an add-on (see EXTRA_PRODUCTS in products.ts).
//
// The main profile stays where it always was (LinkedIn: XD LI Profiles; the others: their XD Channels
// row). Each extra profile is one more XD Channels row for that tool, marked with settings.slot ≥ 1,
// holding its own sealed login. A post goes to an extra profile when its design says
// { profile: <that row's id> }; without it, it goes to the main profile as before.

import { insert, remove, rows, update } from "./db"
import { open, seal } from "./crypto"
import { profilesAllowed, EXTRA_LABEL, type ProductKey } from "./products"
import { subFor } from "./service"

type Obj = Record<string, unknown>

export type ExtraProfile = {
  id: number
  email: string
  product: ProductKey
  slot: number
  /** What people see: "Jane Doe", "Acme Bakery + @acmebakes", "blog.acme.com". */
  name: string
  /** What it is on the platform ("li:<sub>", "fb:<page id>", "wp:<host>"), so it can't be added twice. */
  key: string
  meta: Obj
  secretEnc: string
  connected: boolean
}

const parse = (v: unknown): Obj => {
  try {
    const o = JSON.parse(String(v || "{}"))
    return o && typeof o === "object" ? (o as Obj) : {}
  } catch {
    return {}
  }
}

/** True for an extra profile's row in XD Channels (code reading the main channel skips these). */
export const isExtraRow = (r: Obj) => Number(parse(r.settings).slot) >= 1

function asExtra(r: Obj): ExtraProfile {
  return {
    id: Number(r.id),
    email: String(r.email || "").toLowerCase(),
    product: String(r.product) as ProductKey,
    slot: Number(parse(r.settings).slot) || 1,
    name: String(r.connName || ""),
    key: String(r.connKey || ""),
    meta: parse(r.meta),
    secretEnc: String(r.secretEnc || ""),
    connected: r.connected === true,
  }
}

export async function extrasFor(email: string, product: ProductKey): Promise<ExtraProfile[]> {
  return (await rows<Obj>("ap_channels", { col: "email", val: email }))
    .filter((r) => String(r.product) === product && isExtraRow(r))
    .map(asExtra)
    .sort((a, b) => a.slot - b.slot || a.id - b.id)
}

/** One of this owner's extra profiles for this tool, or null. */
export async function extraFor(email: string, product: ProductKey, id: unknown): Promise<ExtraProfile | null> {
  const n = Number(id)
  if (!Number.isInteger(n) || n < 1) return null
  return (await extrasFor(email, product)).find((x) => x.id === n) || null
}

export const secretOf = (p: ExtraProfile): Obj => (p.secretEnc ? parse(open(p.secretEnc)) : {})

/** How many profiles the plan allows and how many are connected (main + extras). */
export async function profileRoom(email: string, product: ProductKey): Promise<{ allowed: number; extras: number; room: number }> {
  const [sub, list] = await Promise.all([subFor(email, product), extrasFor(email, product)])
  const allowed = profilesAllowed(sub)
  const extras = list.length
  return { allowed, extras, room: Math.max(0, allowed - 1 - extras) }
}

/**
 * Adds an extra profile (or refreshes its login when the same account is connected again).
 * mainKey: the main profile's key, which can't also be an extra.
 */
export async function addExtra(email: string, product: ProductKey, o: { name: string; key: string; meta: Obj; secret: Obj }, mainKey = ""): Promise<ExtraProfile> {
  const label = EXTRA_LABEL[product]
  if (mainKey && o.key === mainKey) throw new Error(`That ${label.one} is already your main one.`)
  const list = await extrasFor(email, product)
  const same = list.find((x) => x.key === o.key)
  const fields = { connName: o.name.slice(0, 120), connKey: o.key, meta: JSON.stringify(o.meta), secretEnc: seal(JSON.stringify(o.secret)), connected: true }
  if (same) {
    await update("ap_channels", same.id, fields)
    return { ...same, name: fields.connName, meta: o.meta, secretEnc: fields.secretEnc, connected: true }
  }
  const { room } = await profileRoom(email, product)
  if (room < 1) throw new Error(`Your plan has no room for another ${label.one}. Add an extra profile to your plan first (Plan → Change plan).`)
  const slot = Math.max(0, ...list.map((x) => x.slot)) + 1
  return asExtra(await insert<Obj>("ap_channels", { email, product, settings: JSON.stringify({ slot }), ...fields }))
}

export async function removeExtra(email: string, product: ProductKey, id: unknown) {
  const p = await extraFor(email, product, id)
  if (!p) throw new Error("That profile isn't yours.")
  await remove("ap_channels", p.id)
}

/** What the browser gets: never logins. over: connected but no longer covered by the plan. */
export async function viewExtras(email: string, product: ProductKey) {
  const [list, room] = await Promise.all([extrasFor(email, product), profileRoom(email, product)])
  return {
    allowed: room.allowed,
    room: room.room,
    // soon: a LinkedIn login that expires within a week (LinkedIn asks to reconnect every 60 days).
    list: list.map((p, i) => ({ id: p.id, name: p.name, connected: p.connected, over: i + 2 > room.allowed, soon: !!p.meta.expires && Date.parse(String(p.meta.expires)) - Date.now() < 7 * 864e5 })),
  }
}

/** The extra profile a post is set to go to; throws when it's gone or the plan no longer covers it. */
export async function targetFor(email: string, product: ProductKey, id: unknown): Promise<ExtraProfile | null> {
  if (id === undefined || id === null || id === "" || id === 0) return null
  const list = await extrasFor(email, product)
  const i = list.findIndex((x) => x.id === Number(id))
  const label = EXTRA_LABEL[product]
  if (i < 0) throw new Error(`The ${label.one} this post was set to go to has been removed. Pick where it goes, then approve it again.`)
  const { allowed } = await profileRoom(email, product)
  if (i + 2 > allowed) throw new Error(`Your plan no longer includes this extra ${label.one}. Renew the extra profile, or send the post to your main one.`)
  if (!list[i].connected || !list[i].secretEnc) throw new Error(`${list[i].name || `This ${label.one}`} isn't connected. Connect it again.`)
  return list[i]
}

// ---------- Facebook Pages waiting to be picked ----------
// Connecting another Facebook login can bring several Pages; they wait here (sealed) until one is picked.

export async function setPendingPages(email: string, pages: { id: string; name: string; token: string; igId: string; igUser: string }[]) {
  const list = (await rows<Obj>("ap_channels", { col: "email", val: email })).filter((r) => String(r.product) === "meta" && Number(parse(r.settings).slot) === -1)
  for (const r of list) await remove("ap_channels", Number(r.id))
  if (!pages.length) return
  await insert("ap_channels", { email, product: "meta", settings: JSON.stringify({ slot: -1 }), connName: "", connKey: "", meta: JSON.stringify({ choose: pages.map((p) => ({ id: p.id, name: p.name, igUser: p.igUser })) }), secretEnc: seal(JSON.stringify({ pages })), connected: false })
}

export async function pendingPages(email: string): Promise<{ id: number; choose: { id: string; name: string; igUser: string }[]; pages: { id: string; name: string; token: string; igId: string; igUser: string }[] } | null> {
  const r = (await rows<Obj>("ap_channels", { col: "email", val: email })).find((x) => String(x.product) === "meta" && Number(parse(x.settings).slot) === -1)
  if (!r) return null
  const s = parse(open(String(r.secretEnc || "")))
  return { id: Number(r.id), choose: (parse(r.meta).choose as { id: string; name: string; igUser: string }[]) || [], pages: (s.pages as { id: string; name: string; token: string; igId: string; igUser: string }[]) || [] }
}

/** True for rows that are an extra profile or Pages waiting to be picked (not the main channel). */
export const isSideRow = (r: Obj) => Number(parse(r.settings).slot) !== 0 && parse(r.settings).slot !== undefined
