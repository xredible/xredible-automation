import type { Metadata } from "next"
import { LegalPage } from "../legal-page"

export const metadata: Metadata = { title: "Delivery Policy | Xredible", description: "How Xredible's online services are delivered." }

export default function ShippingPolicy() {
  return (
    <LegalPage title="Shipping & Delivery Policy" updated="22 October 2026">
      <p>Xredible sells online software services only. Nothing physical is shipped.</p>
      <h2>How the service is delivered</h2>
      <ul>
        <li>Everything is delivered online at <a className="underline" href="/dashboard">xredible.in/dashboard</a>, in the account you sign up with.</li>
        <li>Card and Razorpay payments activate your plan immediately after the payment succeeds.</li>
        <li>UPI payments made to our UPI ID are checked by hand and activated within 24 hours, usually within a few hours.</li>
        <li>Drafts appear in your dashboard within minutes of connecting your account, and approved posts, articles and newsletters are published on the schedule you choose.</li>
        <li>A confirmation of your plan and its renewal date is shown in your dashboard.</li>
      </ul>
      <h2>If something doesn&rsquo;t arrive</h2>
      <p>
        If your plan isn&rsquo;t active within 24 hours of paying, contact us at <a className="underline" href="mailto:accounts@xredible.in">accounts@xredible.in</a> or on WhatsApp <a className="underline" href="https://wa.me/918085949384">+91 80859 49384</a> with your payment reference. See our <a className="underline" href="/refund-policy">Cancellation &amp; Refund Policy</a> for refunds.
      </p>
    </LegalPage>
  )
}
