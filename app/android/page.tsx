import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Android app | Xredible Autopilot",
  description: "Get Xredible Autopilot on your Android phone: approve posts, see results and get ideas on the go.",
}

const STEPS = [
  ["Download", "Tap the button above on your Android phone. The file is small (under 1 MB)."],
  ["Allow the install", "Android asks once to allow installs from your browser. Tap Settings → turn on “Allow from this source” → go back."],
  ["Install and open", "Tap Install, then Open. Sign in with your Xredible email and password."],
] as const

export default function AndroidApp() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm text-slate-500 hover:underline">
        ← Xredible
      </Link>
      <div className="mt-6 flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app/icon-192.png" alt="" width={64} height={64} className="rounded-2xl" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Xredible Autopilot for Android</h1>
          <p className="text-sm text-slate-600">Approve posts, see results and get ideas from your phone.</p>
        </div>
      </div>
      <a href="/app/xredible-autopilot.apk" download className="mt-6 inline-flex items-center justify-center rounded-xl bg-[#10203f] px-5 py-3 text-base font-semibold text-white hover:opacity-90">
        Download for Android
      </a>
      <p className="mt-2 text-xs text-slate-500">Android 6 or newer. Coming soon to Google Play.</p>
      <ol className="mt-8 space-y-4">
        {STEPS.map(([t, d], i) => (
          <li key={t} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold">{i + 1}</span>
            <div>
              <div className="font-semibold">{t}</div>
              <div className="text-sm text-slate-600">{d}</div>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-slate-600">
        The app opens your dashboard, so everything you can do there works here too. Plans are bought and changed on the website, not in the app. Prefer the website?{" "}
        <Link href="/dashboard" className="text-[#24438a] hover:underline">
          Open the dashboard
        </Link>
        .
      </p>
    </main>
  )
}
