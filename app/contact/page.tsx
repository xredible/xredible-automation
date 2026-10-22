import type { Metadata } from "next"
import { LegalPage } from "../legal-page"

export const metadata: Metadata = { title: "Contact Us | Xredible", description: "Contact Xredible for help with your automations, billing or refunds." }

export default function Contact() {
  return (
    <LegalPage title="Contact Us" updated="22 October 2026">
      <p>We&rsquo;re happy to help with your automations, your plan, payments or refunds.</p>
      <ul>
        <li>
          <b>Email:</b> <a className="underline" href="mailto:accounts@xredible.in">accounts@xredible.in</a>
        </li>
        <li>
          <b>WhatsApp / phone:</b> <a className="underline" href="https://wa.me/918085949384">+91 80859 49384</a>
        </li>
        <li>
          <b>Hours:</b> Monday to Saturday, 10 am to 7 pm IST. We reply within one working day.
        </li>
        <li>
          <b>Business:</b> Xredible, run by Abhijit Kaushik (sole proprietor), Indore, Madhya Pradesh, India
        </li>
      </ul>
      <p>
        For billing questions, please include your account email and the payment reference (UTR or Razorpay payment ID). See also our <a className="underline" href="/terms">Terms</a>, <a className="underline" href="/privacy">Privacy Policy</a>, <a className="underline" href="/refund-policy">Cancellation &amp; Refund Policy</a> and <a className="underline" href="/shipping-policy">Delivery Policy</a>.
      </p>
    </LegalPage>
  )
}
