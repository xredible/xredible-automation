import type { Metadata } from "next"
import { PricingClient } from "./pricing-client"

export const metadata: Metadata = {
  title: "Pricing | Xredible Autopilot",
  description: "AI that writes and publishes your LinkedIn, Instagram, Facebook, blog and email content. 3 free posts on every tool, then monthly plans from ₹999. Yearly plans get 2 months free.",
  alternates: { canonical: "https://www.xredible.in/pricing" },
}

export default function Pricing() {
  return <PricingClient />
}
