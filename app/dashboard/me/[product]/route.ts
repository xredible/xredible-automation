// /dashboard/me/meta | blog | newsletter — the signed-in customer's other Autopilot tools.
// GET  → { sub, channel, items, contacts?, ready }
// POST { op: "settings", ...fields } | { op: "connect", ... } (WordPress / email) | { op: "page", pageId } (Facebook Page)
//      { op: "disconnect" } | { op: "generate", count } | { op: "contacts-add", text } | { op: "contact-remove", id }
//      { op: "approve"|"unapprove"|"reject"|"edit"|"reschedule"|"test", id, … }

import { NextResponse } from "next/server"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { ensureTrial } from "@/lib/autopilot/service"
import { requestToolDrafts } from "@/lib/autopilot/db"
import { tokenKeySet } from "@/lib/autopilot/crypto"
import { razorpayConfigured, razorpayKeyId } from "@/lib/autopilot/razorpay"
import { upiOptions } from "@/lib/autopilot/upi"
import { metaConfigured } from "@/lib/autopilot/meta"
import { contactCap } from "@/lib/autopilot/products"
import {
  addContacts,
  channelFor,
  connectSmtp,
  connectWordPress,
  contactsFor,
  disconnect,
  isTool,
  itemAction,
  itemById,
  metaImages,
  itemsFor,
  pickPage,
  removeContact,
  saveSettings,
  viewChannel,
  type ToolKey,
} from "@/lib/autopilot/tools"
import { ownerKey } from "@/lib/autopilot/brands"
import { makeHeadline, makeSlides, rememberVoice, rewrite, voiceOf } from "@/lib/autopilot/ai"
import { isFormat } from "@/lib/autopilot/formats"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

async function state(email: string, product: ToolKey) {
  const [sub, channel, items, upi, contacts] = await Promise.all([
    ensureTrial(email, product),
    channelFor(email, product),
    itemsFor(email, product),
    upiOptions(product, email),
    product === "newsletter" ? contactsFor(email) : Promise.resolve(null),
  ])
  return {
    ok: true,
    sub,
    channel: viewChannel(channel),
    items: product === "meta" ? items.map((it) => ({ ...it, previews: it.format === "photo" && !it.design.photos?.length ? [] : metaImages(it) })) : items,
    contacts: contacts
      ? {
          total: contacts.length,
          subscribed: contacts.filter((c) => c.status === "subscribed").length,
          cap: contactCap(sub),
          recent: contacts.slice(-50).reverse().map((c) => ({ id: c.id, email: c.email, name: c.name, status: c.status })),
        }
      : null,
    ready: { connect: tokenKeySet() && (product !== "meta" || metaConfigured()), payments: razorpayConfigured(), razorpayKey: razorpayKeyId(), upi },
  }
}

type Ctx = { params: Promise<{ product: string }> }

export async function GET(request: Request, ctx: Ctx) {
  const { product } = await ctx.params
  if (!isTool(product)) return json({ ok: false, error: "Unknown tool." }, 404)
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  try {
    return json(await state(owner, product))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}

export async function POST(request: Request, ctx: Ctx) {
  const { product } = await ctx.params
  if (!isTool(product)) return json({ ok: false, error: "Unknown tool." }, 404)
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  const owner = await ownerKey(me.email)
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    let extra: Record<string, unknown> = {}
    if (op === "settings") {
      const before = await channelFor(owner, product)
      const saved = await saveSettings(owner, product, b)
      const items = await itemsFor(owner, product)
      // First time "About" is filled in and the account is already connected: write the first drafts.
      if (!before?.settings.about && saved.settings.about && saved.connected && !items.some((i) => i.status === "draft" || i.status === "approved")) await requestToolDrafts(owner, product, 3).catch(() => {})
    } else if (op === "connect" && product !== "meta") {
      if (!tokenKeySet()) throw new Error("Connecting is being switched on. Please try again soon.")
      if (product === "blog") await connectWordPress(owner, b)
      else await connectSmtp(owner, b)
      const ch = await channelFor(owner, product)
      const items = await itemsFor(owner, product)
      if (ch?.settings.about && !items.length) await requestToolDrafts(owner, product, 3).catch(() => {})
    } else if (op === "page" && product === "meta") {
      await pickPage(owner, String(b.pageId || ""))
      const ch = await channelFor(owner, product)
      const items = await itemsFor(owner, product)
      if (ch?.settings.about && !items.length) await requestToolDrafts(owner, product, 3).catch(() => {})
    } else if (op === "disconnect") {
      await disconnect(owner, product)
    } else if (op === "generate") {
      const ch = await channelFor(owner, product)
      if (!ch?.settings.about) return json({ ok: false, error: "Fill in 'About' first so the drafts fit you." }, 400)
      if (!ch.connected) return json({ ok: false, error: "Connect your account first." }, 400)
      const drafts = async () => (await itemsFor(owner, product)).filter((x) => x.status === "draft").length
      const before = await drafts()
      await requestToolDrafts(owner, product, Math.min(5, Math.max(1, Number(b.count) || 3)))
      if ((await drafts()) <= before) {
        const sub = await ensureTrial(owner, product)
        const full = sub.used >= sub.postLimit
        return json({ ...(await state(owner, product)), ok: false, error: full ? "You've used this month's posts on your plan. Upgrade or wait for next month to get new drafts." : "No new drafts this time: either your queue is already full, or the AI writer is busy. Approve or discard a draft, or try again in a few minutes." })
      }
    } else if (op === "contacts-add" && product === "newsletter") {
      extra = { added: await addContacts(owner, String(b.text || "")) }
    } else if (op === "contact-remove" && product === "newsletter") {
      await removeContact(owner, Number(b.id))
    } else if (op === "format" && product === "meta") {
      // Switch a draft's type; writes the carousel slides it needs.
      const it = await itemById(Number(b.id))
      if (!it || it.email !== owner || it.product !== product) throw new Error("That item isn't yours.")
      if (!isFormat(b.format) || b.format === "text") throw new Error("Pick a post type.")
      const design = { ...it.design }
      if (b.format === "carousel" && !(design.slides && design.slides.length >= 2)) design.slides = await makeSlides(`${it.title}\n\n${it.text}`)
      if (b.format === "image" && !it.title) design.headline = await makeHeadline(it.text)
      await itemAction(owner, product, { op: "design", id: it.id, format: b.format, design })
    } else if (op === "rewrite") {
      // A suggestion only: the dashboard shows it in the editor and nothing changes until they save.
      const it = await itemById(Number(b.id))
      if (!it || it.email !== owner || it.product !== product) throw new Error("That item isn't yours.")
      const KIND = { meta: "Instagram and Facebook caption (the title is the short text shown on the image)", blog: "blog article (markdown)", newsletter: "email newsletter (the title is the subject line)" } as const
      const out = await rewrite({
        kind: KIND[product],
        text: String(b.text || it.text),
        title: String(b.title ?? it.title),
        how: String(b.how || ""),
        custom: String(b.custom || ""),
        samples: await voiceOf(owner, product),
        limit: product === "meta" ? 2200 : product === "blog" ? 60000 : 30000,
        markdown: product !== "meta",
      })
      return json({ ok: true, rewrite: out })
    } else {
      await itemAction(owner, product, b)
      if (op === "test") extra = { tested: true }
      if (op === "edit") await rememberVoice(owner, product, String(b.text || "")).catch(() => {})
    }
    return json({ ...(await state(owner, product)), ...extra })
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}
