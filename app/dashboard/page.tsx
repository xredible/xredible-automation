import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { currentUser, isConfigured, listUsers, toPublic } from "@/lib/dashboard/auth"
import { SetupForm, SignInForm } from "@/components/dashboard/sign-in"
import { DashboardApp } from "@/components/dashboard/app"

// Private page: never indexed, never cached for the public.
export const metadata: Metadata = {
  title: "Client Dashboard | Xredible",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  manifest: "/dashboard.webmanifest",
  appleWebApp: { capable: true, title: "Xredible", statusBarStyle: "black-translucent" },
  icons: { icon: "/dashboard/xredible.svg", apple: "/dashboard/xredible-180.png" },
  // Stop Chrome from auto-translating Hindi text: it rewrites the page behind React and crashes it.
  other: { google: "notranslate" },
}

export const viewport: Viewport = { themeColor: "#10203f" }

export const dynamic = "force-dynamic"

const inter = Inter({ subsets: ["latin"], variable: "--font-dash", display: "swap" })

async function Screen() {
  if (!isConfigured()) return <SignInForm configured={false} />
  const me = await currentUser()
  if (me) {
    const pub = toPublic(me)
    return <DashboardApp allowed={pub.businesses} me={{ name: pub.name, email: pub.email, role: pub.role }} />
  }
  const { users, error } = await listUsers()
  if (users && users.length === 0) return <SetupForm />
  return <SignInForm configured warning={users ? null : error} />
}

export default async function DashboardPage() {
  return (
    <div className={`${inter.variable} notranslate`} translate="no">
      <Screen />
    </div>
  )
}
