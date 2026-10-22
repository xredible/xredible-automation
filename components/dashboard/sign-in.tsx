"use client"

import { useActionState, useEffect, useState, type ReactNode } from "react"
import { requestReset, resetPassword, setupFirstAdmin, signIn, signUp, type FormState } from "@/app/dashboard/actions"

const input =
  "mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-[#10203f] focus:ring-2 focus:ring-[#e7c766]"
const label = "mt-4 block text-sm font-medium text-slate-700"

function Shell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#10203f] px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <img src="/dashboard/xredible.svg" alt="" width={56} height={56} className="mb-5 h-14 w-14 rounded-xl" />
        <h1 className="text-[1.375rem] font-semibold leading-tight text-[#10203f]">{title}</h1>
        <div className="mt-1 text-sm text-slate-500">{sub}</div>
        {children}
      </div>
    </div>
  )
}

function Problem({ text }: { text: string | null | undefined }) {
  return text ? (
    <div role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {text}
    </div>
  ) : null
}

const button =
  "mt-5 w-full rounded-lg bg-[#10203f] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1b3160] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e7c766] disabled:opacity-60"

export function SignInForm({ configured, warning, startWithSignUp }: { configured: boolean; warning?: string | null; startWithSignUp?: boolean }) {
  const [mode, setMode] = useState<"in" | "up" | "forgot">(startWithSignUp ? "up" : "in")
  if (configured && mode === "up") return <SignUpForm onSignIn={() => setMode("in")} />
  if (configured && mode === "forgot") return <ForgotForm onSignIn={() => setMode("in")} />
  return <SignInOnly configured={configured} warning={warning} onSignUp={() => setMode("up")} onForgot={() => setMode("forgot")} />
}

function ForgotForm({ onSignIn }: { onSignIn: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestReset, { error: null })
  return (
    <Shell title="Reset your password" sub="We'll email you a link to choose a new one.">
      <form action={action}>
        <label htmlFor="fp-email" className={label}>
          Email
        </label>
        <input id="fp-email" name="email" type="email" autoComplete="username" required autoFocus className={input} />
        <Problem text={state.error} />
        {state.ok ? <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{state.ok}</div> : null}
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Sending…" : "Send reset link"}
        </button>
        <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <button type="button" onClick={onSignIn} className="font-semibold text-[#10203f] underline underline-offset-2">
            Back to sign in
          </button>
          <span className="block pt-2 text-xs text-slate-500">
            No email arriving? <a href="https://wa.me/918085949384" className="underline">Message us on WhatsApp</a>.
          </span>
        </div>
      </form>
    </Shell>
  )
}

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPassword, { error: null })
  return (
    <Shell title="Choose a new password" sub="You'll be signed in right after.">
      <form action={action}>
        <input type="hidden" name="t" value={token} />
        <label htmlFor="rp-password" className={label}>
          New password
        </label>
        <input id="rp-password" name="password" type="password" autoComplete="new-password" minLength={10} required autoFocus className={input} />
        <div className="mt-1 text-xs text-slate-500">At least 10 characters.</div>
        <Problem text={state.error} />
        <button type="submit" disabled={pending || !token} className={button}>
          {pending ? "Saving…" : "Save and sign in"}
        </button>
        <div className="mt-4 text-sm">
          <a href="/dashboard" className="text-slate-600 underline">
            Back to sign in
          </a>
        </div>
      </form>
    </Shell>
  )
}

function SignInOnly({ configured, warning, onSignUp, onForgot }: { configured: boolean; warning?: string | null; onSignUp: () => void; onForgot: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, { error: null })
  return (
    <Shell title="Xredible Dashboard" sub="Sign in to your automations">
      {configured ? (
        <form action={action}>
          <label htmlFor="email" className={label}>
            Email
          </label>
          <input id="email" name="email" type="email" autoComplete="username" required autoFocus className={input} />
          <label htmlFor="password" className={label}>
            Password
          </label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className={input} />
          <Problem text={state.error || warning} />
          <button type="submit" disabled={pending} className={button}>
            {pending ? "Signing in…" : "Sign in"}
          </button>
          <div className="mt-4 text-xs leading-relaxed text-slate-500">
            You stay signed in on this device for 60 days.{" "}
            <button type="button" onClick={onForgot} className="underline">
              Forgot your password?
            </button>
          </div>
          <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
            New here?{" "}
            <button type="button" onClick={onSignUp} className="font-semibold text-[#10203f] underline underline-offset-2">
              Create a free account
            </button>{" "}
            and try any automation with 3 free posts.
          </div>
        </form>
      ) : (
        <div className="mt-6 rounded-lg bg-amber-50 px-3 py-3 text-sm leading-relaxed text-amber-900">
          Add <code className="font-mono text-[0.8rem]">XD_N8N_SECRET</code> in Vercel → Settings → Environment Variables (the same value as the n8n credential
          &ldquo;XD Dashboard secret&rdquo;), then redeploy.
        </div>
      )}
    </Shell>
  )
}

export function SetupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(setupFirstAdmin, { error: null })
  return (
    <Shell title="Set up the dashboard" sub="Create the first admin account. This screen only appears once.">
      <form action={action}>
        <label htmlFor="setupKey" className={label}>
          Setup key
        </label>
        <input id="setupKey" name="setupKey" type="password" autoComplete="off" required className={input} />
        <div className="mt-1 text-xs text-slate-500">The value you saved as XD_N8N_SECRET on Vercel.</div>
        <label htmlFor="name" className={label}>
          Your name
        </label>
        <input id="name" name="name" type="text" autoComplete="name" required className={input} />
        <label htmlFor="email" className={label}>
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="username" required className={input} />
        <label htmlFor="password" className={label}>
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className={input} />
        <div className="mt-1 text-xs text-slate-500">At least 10 characters.</div>
        <Problem text={state.error} />
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Creating…" : "Create admin account"}
        </button>
      </form>
    </Shell>
  )
}

function SignUpForm({ onSignIn }: { onSignIn: () => void }) {
  const [state, action, pending] = useActionState<FormState, FormData>(signUp, { error: null })
  // Invite links look like /dashboard?signup&ref=ABC1234
  const [ref, setRef] = useState("")
  useEffect(() => setRef(new URLSearchParams(window.location.search).get("ref") || ""), [])
  return (
    <Shell title="Create your account" sub="Every automation starts with 3 free posts. No card needed.">
      <form action={action}>
        <label htmlFor="su-name" className={label}>
          Your name
        </label>
        <input id="su-name" name="name" type="text" autoComplete="name" required autoFocus className={input} />
        <label htmlFor="su-email" className={label}>
          Email
        </label>
        <input id="su-email" name="email" type="email" autoComplete="username" required className={input} />
        <label htmlFor="su-password" className={label}>
          Password
        </label>
        <input id="su-password" name="password" type="password" autoComplete="new-password" minLength={10} required className={input} />
        <div className="mt-1 text-xs text-slate-500">At least 10 characters.</div>
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <input type="hidden" name="ref" value={ref} />
        {ref ? <div className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">You were invited by a friend: you both get a free month when you subscribe.</div> : null}
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-600">
          <input type="checkbox" name="terms" required className="mt-1" />
          <span>
            I agree to the{" "}
            <a href="/terms" target="_blank" className="underline">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" target="_blank" className="underline">
              Privacy Policy
            </a>
            .
          </span>
        </label>
        <Problem text={state.error} />
        <button type="submit" disabled={pending} className={button}>
          {pending ? "Creating…" : "Create account"}
        </button>
        <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
          Already have an account?{" "}
          <button type="button" onClick={onSignIn} className="font-semibold text-[#10203f] underline underline-offset-2">
            Sign in
          </button>
        </div>
      </form>
    </Shell>
  )
}
