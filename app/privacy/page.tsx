import type { Metadata } from "next"
import { LegalPage } from "../legal-page"

export const metadata: Metadata = { title: "Privacy Policy | Xredible", alternates: { canonical: "/privacy" } }

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="22 October 2026">
      <p>This explains what Xredible stores when you use the automations at xredible.in/dashboard, why, and the choices you have.</p>
      <h2>What we store</h2>
      <ul>
        <li><b>Account:</b> your name, email, and your password as a one-way hash (we never see the password itself).</li>
        <li><b>Automation settings:</b> what you tell us about your work, audience, topics and tone, and your posting schedule.</li>
        <li><b>Posts:</b> drafts, your edits, approval times, and links to published posts.</li>
        <li><b>Connected accounts:</b> the name of what you connect (LinkedIn profile, Facebook Page and Instagram account, WordPress site, or sending email address) and the access key or password that lets us publish what you approve. These are stored encrypted. LinkedIn keys expire after about 60 days.</li>
        <li><b>Newsletter subscribers:</b> the email addresses and names you add, and who unsubscribed. You own this list; we use it only to send your approved newsletters and never email these people for ourselves.</li>
        <li><b>Billing:</b> your plan, and the UPI reference number or Razorpay subscription ID of your payment. Card and bank details stay with your bank or Razorpay; we never receive them.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To write drafts for you (using Google&rsquo;s Gemini AI service), publish what you approve, and show your dashboard.</li>
        <li>To bill your plan and send service emails (for example, payment or reconnect reminders).</li>
        <li>We don&rsquo;t sell your data or use it for advertising, and we don&rsquo;t read or post anything on your connected accounts beyond what the automation needs.</li>
      </ul>
      <h2>Where it is kept</h2>
      <p>The website runs on Vercel; automation data is kept on our own server. Payment processing is done by Razorpay and AI drafting by Google. Each only receives what it needs for its part.</p>
      <h2>Your choices</h2>
      <ul>
        <li>Disconnect any account at any time from the dashboard; we delete the stored access key or password immediately. You can also remove our access from your LinkedIn or Facebook settings, or revoke the WordPress Application Password.</li>
        <li>Ask us to export or delete your data, or close your account, by contacting us. We delete account data within 30 days, except what we must keep for tax and billing records.</li>
      </ul>
      <h2>Contact</h2>
      <p>
        WhatsApp: <a className="underline" href="https://wa.me/918085949384">+91 80859 49384</a>
      </p>
    </LegalPage>
  )
}
