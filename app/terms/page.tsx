import type { Metadata } from "next"
import { LegalPage } from "../legal-page"

export const metadata: Metadata = { title: "Terms of Service | Xredible", alternates: { canonical: "/terms" } }

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="22 October 2026">
      <p>These terms cover the Xredible automations you sign up for at xredible.in/dashboard, such as LinkedIn Autopilot, Instagram + Facebook Autopilot, Blog Writer for WordPress and Email Newsletter Autopilot. By creating an account you agree to them.</p>
      <h2>Your account</h2>
      <ul>
        <li>Give accurate details and keep your password private. You are responsible for activity on your account.</li>
        <li>One free trial per person and per connected account (social profile, Facebook Page, website or sending email address). Creating extra accounts to get more free trials is not allowed.</li>
      </ul>
      <h2>How the automations work</h2>
      <ul>
        <li>We draft content with AI based on the profile you give us. Drafts can contain mistakes, so you review them.</li>
        <li>Nothing is published until you approve it. You are responsible for everything you approve, including that it is accurate and follows the rules of the platform it is posted on (for example LinkedIn&rsquo;s User Agreement or Meta&rsquo;s Terms).</li>
        <li>For newsletters, you send from your own email account and you confirm every subscriber you add agreed to receive your emails. Every email includes your address and an unsubscribe link, and people who unsubscribe are never emailed again.</li>
        <li>We post only to accounts you connect and only what you approve. You can disconnect at any time.</li>
        <li>Platforms sometimes change or limit their services. If a platform refuses or delays a post, we will show the reason; we can&rsquo;t guarantee reach, likes or leads.</li>
      </ul>
      <h2>Free trials, plans and billing</h2>
      <ul>
        <li>Each automation starts with a free trial (3 published posts, articles or newsletter issues). After that, publishing pauses until you subscribe.</li>
        <li>Plans are billed monthly in Indian rupees, by UPI or through Razorpay, starting on the day your payment is confirmed. Prices include any applicable taxes unless stated otherwise.</li>
        <li>Each plan includes a number of published posts, articles or issues per month (and, for newsletters, a maximum number of subscribers). Unused posts don&rsquo;t carry over. Yearly plans cost 10 months&rsquo; price and include the whole year&rsquo;s posts up front.</li>
        <li>Coupon codes and referral rewards (one free month for you and the friend you invite, once they subscribe) can&rsquo;t be exchanged for cash and may be withdrawn if they are misused.</li>
        <li>You can cancel any time from your dashboard; your plan keeps working until the end of the month you&rsquo;ve paid for. We don&rsquo;t refund partial months, except where the law requires it or a fault on our side stopped the service.</li>
        <li>If a payment fails, publishing pauses until it goes through.</li>
      </ul>
      <h2>Acceptable use</h2>
      <p>Don&rsquo;t use the automations for spam, misleading or illegal content, harassment, or anything that breaks a platform&rsquo;s rules. We may suspend accounts that do.</p>
      <h2>Changes and ending the service</h2>
      <p>We may update these terms or our prices; we&rsquo;ll tell you by email or in the dashboard before changes affect a plan you pay for. You can close your account at any time by contacting us.</p>
      <h2>Liability</h2>
      <p>The service is provided as is. To the extent the law allows, our total liability to you is limited to the amount you paid us in the 3 months before the claim.</p>
      <h2>Law</h2>
      <p>These terms are governed by the laws of India.</p>
      <h2>Contact</h2>
      <p>
        WhatsApp: <a className="underline" href="https://wa.me/918085949384">+91 80859 49384</a>
      </p>
    </LegalPage>
  )
}
