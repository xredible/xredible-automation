import type { Metadata } from "next"
import { DemoClient } from "./demo-client"

export const metadata: Metadata = {
  title: "See Xredible Autopilot in action | Book a free demo",
  description: "See a sample week of posts and designs Xredible writes for businesses like yours, then book a free 15-minute live demo.",
  alternates: { canonical: "https://www.xredible.in/demo" },
  openGraph: {
    title: "See Xredible Autopilot in action",
    description: "Your social media written and posted for you. You just approve. Book a free 15-minute demo.",
    url: "https://www.xredible.in/demo",
    siteName: "Xredible",
    images: [{ url: "https://www.xredible.in/api/autopilot/demo?b=coach&v=cover", width: 1080, height: 1350 }],
  },
}

export default function DemoPage() {
  return <DemoClient />
}
