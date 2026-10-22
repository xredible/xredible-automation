// lib/autopilot/brands.ts
//
// Server-only. One sign-in can run several brands (agencies, or someone with two businesses).
// Each brand is a separate set of automations, plans and free trials. Brand 1 uses the
// person's email as its key; brand N uses "email::N". The chosen brand is kept in a cookie.

import { cookies } from "next/headers"
import { addNotice, noticesFor, realEmail, removeNotice } from "./account"

export const BRAND_COOKIE = "xd_brand"
export const MAX_BRANDS = 10

export type Brand = { n: number; name: string; key: string }

export async function brandsOf(email: string, firstName = "Main brand"): Promise<Brand[]> {
  const me = realEmail(email)
  const extra = (await noticesFor(me))
    .filter((x) => x.kind === "brand")
    .map((x) => ({ n: Number(x.key), name: x.value || `Brand ${x.key}`, key: `${me}::${x.key}` }))
    .filter((b) => b.n >= 2)
    .sort((a, b) => a.n - b.n)
  const main = (await noticesFor(me)).find((x) => x.kind === "brand-name")?.value || firstName
  return [{ n: 1, name: main, key: me }, ...extra]
}

/** The data key for the signed-in person's current brand. */
export async function ownerKey(email: string): Promise<string> {
  const n = Number((await cookies()).get(BRAND_COOKIE)?.value || 1)
  if (!Number.isInteger(n) || n < 2) return email
  const list = await brandsOf(email)
  return list.find((b) => b.n === n)?.key || email
}

export async function currentBrand(email: string, firstName?: string): Promise<{ list: Brand[]; current: Brand }> {
  const list = await brandsOf(email, firstName)
  const n = Number((await cookies()).get(BRAND_COOKIE)?.value || 1)
  return { list, current: list.find((b) => b.n === n) || list[0] }
}

export async function addBrand(email: string, name: string): Promise<Brand> {
  const list = await brandsOf(email)
  if (list.length >= MAX_BRANDS) throw new Error(`You can have up to ${MAX_BRANDS} brands.`)
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new Error("Give the brand a name.")
  const n = Math.max(...list.map((b) => b.n)) + 1
  await addNotice(realEmail(email), "brand", String(n), clean)
  return { n, name: clean, key: `${realEmail(email)}::${n}` }
}

export async function renameBrand(email: string, n: number, name: string) {
  const me = realEmail(email)
  const clean = name.trim().slice(0, 60)
  if (!clean) throw new Error("Give the brand a name.")
  const notes = await noticesFor(me)
  const old = n === 1 ? notes.find((x) => x.kind === "brand-name") : notes.find((x) => x.kind === "brand" && Number(x.key) === n)
  if (n !== 1 && !old) throw new Error("Brand not found.")
  if (old) await removeNotice(old.id)
  await addNotice(me, n === 1 ? "brand-name" : "brand", n === 1 ? "" : String(n), clean)
}

export async function selectBrand(email: string, n: number) {
  const list = await brandsOf(email)
  const b = list.find((x) => x.n === n) || list[0]
  ;(await cookies()).set(BRAND_COOKIE, String(b.n), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 })
  return b
}
