import type { Metadata } from "next"
import { ResetForm } from "@/components/dashboard/sign-in"

export const metadata: Metadata = { title: "Choose a new password | Xredible", robots: { index: false, follow: false } }

export default async function ResetPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await props.searchParams
  return <ResetForm token={typeof q.t === "string" ? q.t : ""} />
}
