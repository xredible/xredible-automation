import type { Metadata } from "next"
import { LegalPage } from "../legal-page"

export const metadata: Metadata = { title: "Cancellation & Refund Policy | Xredible", description: "How cancellations and refunds work for Xredible Autopilot subscriptions." }

export default function RefundPolicy() {
  return (
    <LegalPage title="Cancellation & Refund Policy" updated="22 October 2026">
      <p>This policy covers the Autopilot subscriptions sold at xredible.in (LinkedIn Autopilot, Instagram + Facebook Autopilot, Blog Writer for WordPress and Email Marketing (newsletters, sequences and campaigns)).</p>
      <h2>Try before you pay</h2>
      <ul>
        <li>Every automation starts with a free trial of 3 published posts, articles or newsletter issues. No payment is needed to try it, so you can check it suits you before you subscribe.</li>
      </ul>
      <h2>Cancelling</h2>
      <ul>
        <li>You can cancel a plan at any time from your dashboard, or by writing to us at the contact details below.</li>
        <li>After you cancel, your plan keeps working until the end of the month you have already paid for, and you won&rsquo;t be charged again.</li>
        <li>Plans paid by UPI don&rsquo;t renew by themselves; simply don&rsquo;t pay for the next month.</li>
      </ul>
      <h2>Refunds</h2>
      <ul>
        <li>Monthly plans are not refunded for the part of a month already started, because the service (drafting and publishing) begins as soon as the plan is active.</li>
        <li>We give a full refund if you were charged twice for the same month, charged after cancelling, or charged but the plan was never activated.</li>
        <li>We give a full or partial refund if a fault on our side stopped the service from working for a substantial part of the month and we couldn&rsquo;t fix it.</li>
        <li>To ask for a refund, contact us within 7 days of the payment with your account email and the payment reference (UTR or Razorpay payment ID).</li>
        <li>Approved refunds are sent back to the original payment method (card, UPI or bank account) within 5–7 working days. Your bank may take a few more days to show it.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        Email <a className="underline" href="mailto:accounts@xredible.in">accounts@xredible.in</a> or WhatsApp <a className="underline" href="https://wa.me/918085949384">+91 80859 49384</a>. See also our <a className="underline" href="/terms">Terms</a>.
      </p>
    </LegalPage>
  )
}
