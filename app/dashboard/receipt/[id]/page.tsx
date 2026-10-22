import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { currentUser } from "@/lib/dashboard/auth"
import { paymentById } from "@/lib/autopilot/billing"
import { realEmail } from "@/lib/autopilot/account"
import { PRODUCTS, planOf, rupees } from "@/lib/autopilot/products"
import { PrintButton } from "./print-button"

export const metadata: Metadata = { title: "Payment receipt | Xredible", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }) : "—")

export default async function Receipt(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const me = await currentUser()
  const pay = await paymentById(Number(id))
  if (!me || !pay || (me.role !== "admin" && realEmail(pay.email) !== me.email)) notFound()
  const product = PRODUCTS[pay.product]
  const plan = planOf(pay.product, pay.plan)
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900 print:bg-white print:p-0">
      <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold text-[#10203f]">
              <span className="text-[#d4ad4b]">X</span> Xredible
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Run by Abhijit Kaushik (sole proprietor), Indore, Madhya Pradesh, India
              <br />
              accounts@xredible.in · xredible.in
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">Payment receipt</div>
            <div className="text-sm text-slate-500">{pay.invoiceNo}</div>
            <div className="text-sm text-slate-500">{d(pay.at)}</div>
          </div>
        </div>
        <div className="mt-8 text-sm">
          <div className="text-slate-500">Billed to</div>
          <div className="font-medium">{realEmail(pay.email)}</div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 font-medium">Description</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="py-3">
                <div className="font-medium">
                  {product.name} · {plan?.name} ({pay.cycle === "yearly" ? "yearly" : "monthly"})
                </div>
                <div className="text-slate-500">
                  Service period {d(pay.periodStart)} – {d(pay.periodEnd)}
                  {pay.coupon ? ` · coupon ${pay.coupon}` : ""}
                </div>
              </td>
              <td className="py-3 text-right tabular-nums">{rupees(pay.amount)}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-4 text-right font-semibold">Total paid</td>
              <td className="pt-4 text-right text-lg font-semibold tabular-nums">{rupees(pay.amount)}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-8 rounded-lg bg-slate-50 p-4 text-xs leading-relaxed text-slate-500">
          Paid by {pay.method === "razorpay" ? "card / Razorpay" : "UPI"}
          {pay.ref ? ` · reference ${pay.ref}` : ""}. This is a receipt for an online software subscription. The supplier is not registered under GST, so no GST was charged.
        </div>
        <div className="mt-6 flex justify-end print:hidden">
          <PrintButton />
        </div>
      </div>
    </main>
  )
}
