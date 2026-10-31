// /dashboard/me/account — the signed-in person's account (not tied to one tool).
// GET               → { name, email, verified, prefs, brands, referral, payments, mail }
// GET ?export=1     → everything we store about them, as a JSON download
// POST { op: "resend-verify" } | { op: "prefs", digest } | { op: "delete", password }
//      { op: "brand-add", name } | { op: "brand-select", n } | { op: "brand-rename", n, name }

import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { errText, json, signedIn } from "@/lib/autopilot/guard"
import { addNotice, EMAILS, isVerified, mailConfigured, noticesFor, removeNotice, send, verifyUrl } from "@/lib/autopilot/account"
import { addBrand, brandsOf, currentBrand, renameBrand, selectBrand, viewingAs } from "@/lib/autopilot/brands"
import { activeAnnouncements, announcements } from "@/lib/autopilot/admin"
import { subsFor } from "@/lib/autopilot/service"
import { paymentsFor, receiptUrl, referralInfo } from "@/lib/autopilot/billing"
import { remove, rows, type Table } from "@/lib/autopilot/db"
import { COOKIE, deleteUser, findUser, verifyPassword } from "@/lib/dashboard/auth"
import { cancelSubscription, razorpayConfigured } from "@/lib/autopilot/razorpay"
import { extraText, PRODUCTS, planOf, rupees } from "@/lib/autopilot/products"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// Data tables keyed by the owner's email (brand key), and the column that holds it.
const OWNED: [Table, string][] = [
  ["subs", "email"],
  ["li_profiles", "email"],
  ["li_posts", "email"],
  ["ap_channels", "email"],
  ["ap_items", "email"],
  ["ap_contacts", "owner"],
  ["ap_events", "owner"],
]
const SECRET_COLS = ["tokenEnc", "secretEnc", "passHash"]

async function state(email: string, name: string, role = "customer") {
  const [as, ann, allSubs] = await Promise.all([viewingAs(email), announcements(), brandsOf(email).then((bs) => Promise.all(bs.map((b) => subsFor(b.key)))).then((x) => x.flat())])
  const paid = allSubs.some((s) => s.status === "active" && s.plan !== "trial")
  const [notes, brands, referral, payments] = await Promise.all([noticesFor(email), currentBrand(email, name ? `${name.split(" ")[0]}'s brand` : undefined), referralInfo(email), Promise.all((await brandsOf(email)).map((b) => paymentsFor(b.key))).then((x) => x.flat())])
  return {
    ok: true,
    name,
    email,
    // Admins and team members were added by an admin, so their email needs no confirming.
    verified: role !== "customer" || isVerified(notes),
    prefs: { digest: !notes.some((n) => n.kind === "optout" && n.key === "digest") },
    brands,
    referral,
    payments: payments
      .sort((a, b) => b.id - a.id)
      .map((p) => ({ id: p.id, invoiceNo: p.invoiceNo, at: p.at, what: `${PRODUCTS[p.product].name} ${planOf(p.product, p.plan)?.name || ""} (${p.cycle})${p.extra ? ` ${extraText(p.product, p.extra)}` : ""}`, brand: brands.list.find((b) => b.key === p.email)?.name || "", amount: rupees(p.amount), method: p.method === "razorpay" ? "Card / Razorpay" : "UPI", url: receiptUrl(p.id) })),
    mail: mailConfigured(),
    viewingAs: as,
    announcements: activeAnnouncements(ann, await noticesFor(email), paid).map((a) => ({ id: a.id, title: a.title, message: a.message })),
  }
}

export async function GET(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  try {
    if (new URL(request.url).searchParams.get("export") === "1") {
      const keys = (await brandsOf(me.email)).map((b) => b.key)
      const out: Record<string, unknown[]> = {}
      for (const [table, col] of OWNED) {
        const all = (await Promise.all(keys.map((k) => rows<Record<string, unknown>>(table, { col, val: k })))).flat()
        out[table] = all.map((r) => Object.fromEntries(Object.entries(r).filter(([k]) => !SECRET_COLS.includes(k))))
      }
      out.payments = (await Promise.all(keys.map((k) => paymentsFor(k)))).flat()
      const body = JSON.stringify({ exportedAt: new Date().toISOString(), account: { email: me.email, name: me.name }, ...out }, null, 2)
      return new NextResponse(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="xredible-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } })
    }
    return json(await state(me.email, me.name, me.role))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 502)
  }
}

export async function POST(request: Request) {
  const me = await signedIn(request)
  if (me instanceof NextResponse) return me
  let b: Record<string, unknown> = {}
  try {
    b = (await request.json()) as Record<string, unknown>
  } catch {}
  try {
    const op = String(b.op || "")
    if (op === "resend-verify") {
      if (!mailConfigured()) return json({ ok: false, error: "Email sending is being switched on. Please try again later." }, 503)
      const sent = await send(me.email, EMAILS.verify(me.name, verifyUrl(me.email)))
      if (!sent) return json({ ok: false, error: "The email didn't send. Try again in a minute." }, 502)
      return json({ ...(await state(me.email, me.name, me.role)), sent: true })
    }
    if (op === "prefs") {
      const notes = await noticesFor(me.email)
      const off = notes.find((n) => n.kind === "optout" && n.key === "digest")
      if (b.digest === true && off) await removeNotice(off.id)
      if (b.digest === false && !off) await addNotice(me.email, "optout", "digest")
    } else if (op === "announce-dismiss") {
      await addNotice(me.email, "announce-seen", String(Number(b.id)))
    } else if (op === "brand-add") {
      const brand = await addBrand(me.email, String(b.name || ""))
      await selectBrand(me.email, brand.n)
    } else if (op === "brand-select") {
      await selectBrand(me.email, Number(b.n))
    } else if (op === "brand-rename") {
      await renameBrand(me.email, Number(b.n), String(b.name || ""))
    } else if (op === "delete") {
      if (me.role === "admin") return json({ ok: false, error: "Admin accounts can't be deleted here." }, 400)
      const fresh = await findUser(me.email, true)
      if (!fresh || !(await verifyPassword(String(b.password || ""), fresh.passHash))) return json({ ok: false, error: "That password isn't right." }, 400)
      const keys = (await brandsOf(me.email)).map((x) => x.key)
      for (const k of keys) {
        for (const [table, col] of OWNED) {
          const list = await rows<Record<string, unknown>>(table, { col, val: k })
          for (const r of list) {
            if (table === "subs" && r.rzpSubId && r.status === "active" && razorpayConfigured()) await cancelSubscription(String(r.rzpSubId)).catch(() => {})
            await remove(table, Number(r.id))
          }
        }
      }
      for (const n of await noticesFor(me.email)) await removeNotice(n.id)
      await deleteUser(me.email)
      ;(await cookies()).delete({ name: COOKIE, path: "/dashboard" })
      return json({ ok: true, deleted: true })
    } else return json({ ok: false, error: "Unknown request." }, 400)
    return json(await state(me.email, me.name, me.role))
  } catch (e) {
    return json({ ok: false, error: errText(e) }, 400)
  }
}
