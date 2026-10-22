// lib/autopilot/upi.ts
//
// Server-only. Manual UPI payments until Razorpay KYC is done:
//   XD_UPI_ID     the UPI ID money goes to (e.g. name@okaxis)
//   XD_UPI_NAME   the name shown in the customer's UPI app (e.g. Xredible)
// The customer pays, types the 12-digit UTR, and an admin activates the plan in Customers.

import QRCode from "qrcode"
import { PRODUCTS, type ProductKey } from "./products"

export const upiConfigured = () => Boolean(process.env.XD_UPI_ID?.trim())

export function upiLink(amountPaise: number, note: string): string {
  const q = new URLSearchParams({
    pa: process.env.XD_UPI_ID?.trim() || "",
    pn: process.env.XD_UPI_NAME?.trim() || "Xredible",
    am: (amountPaise / 100).toFixed(2),
    cu: "INR",
    tn: note.slice(0, 50),
  })
  return `upi://pay?${q.toString().replace(/\+/g, "%20")}`
}

export async function upiQr(link: string): Promise<string> {
  return QRCode.toDataURL(link, { margin: 1, width: 220, errorCorrectionLevel: "M" })
}

export const upiId = () => process.env.XD_UPI_ID?.trim() || ""
/** UPI reference (UTR / RRN) is 12 digits. */
export const validUtr = (u: string) => /^\d{12}$/.test(u)

/** The QR + link per plan, shown on a product's page (null until XD_UPI_ID is set). */
export async function upiOptions(product: ProductKey, email: string) {
  if (!upiConfigured()) return null
  const plans = await Promise.all(
    PRODUCTS[product].plans.map(async (p) => {
      const link = upiLink(p.price, `${PRODUCTS[product].name.split(" ")[0]} ${p.name} ${email}`)
      return { key: p.key, link, qr: await upiQr(link) }
    }),
  )
  return { id: upiId(), plans }
}
