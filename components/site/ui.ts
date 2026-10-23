// Shared class names and contact number for the public website. A plain module (not "use client"),
// so server pages like Contact, Android and the policy pages can read these values directly.

export const WHATSAPP = "918085949384"

// Brand palette: navy background, gold for actions and highlights, the logo's blue and teal as small accents.
export const ui = {
  page: "min-h-screen bg-[#0b1530] text-white antialiased",
  band: "border-y border-white/10 bg-white/[0.03]",
  wrap: "mx-auto max-w-7xl px-5 sm:px-6",
  card: "rounded-3xl border border-white/10 bg-white/5",
  tile: "rounded-2xl border border-white/10 bg-[#0f1f42]",
  h1: "text-4xl font-black leading-[1.08] tracking-tight sm:text-5xl lg:text-7xl",
  h2: "text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl",
  lead: "text-lg leading-relaxed text-slate-300",
  muted: "text-slate-400",
  gold: "text-[#d4ad4b]",
  goldSoft: "text-[#e9cf86]",
  gradient: "bg-gradient-to-r from-[#d4ad4b] via-[#f0d68a] to-[#d4ad4b] bg-clip-text text-transparent",
  pill: "inline-flex items-center gap-2 rounded-full border border-[#d4ad4b]/30 bg-[#d4ad4b]/10 px-4 py-2 text-sm text-[#f0d68a]",
  btn: "inline-flex items-center justify-center rounded-2xl bg-[#d4ad4b] px-7 py-3.5 font-semibold text-[#0b1530] shadow-2xl shadow-[#d4ad4b]/20 transition hover:bg-[#e2c063]",
  btnGhost: "inline-flex items-center justify-center rounded-2xl border border-white/20 px-7 py-3.5 font-semibold transition hover:border-[#d4ad4b]/50 hover:bg-white/5",
  input: "w-full rounded-2xl border border-white/10 bg-[#0a1430] px-5 py-3.5 text-white placeholder:text-slate-500 outline-none transition focus:border-[#d4ad4b]/60",
  glow: "pointer-events-none absolute inset-0 bg-gradient-to-br from-[#d4ad4b]/15 via-[#6f93f0]/10 to-[#35c2a7]/10",
}
