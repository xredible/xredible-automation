export default function Loading() {
  return (
    <div className="dash-root min-h-[100dvh] bg-[#f3f5f9]">
      <div className="bg-[#10203f] px-4 pb-5 pt-6 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="h-5 w-48 animate-pulse rounded bg-white/20" />
          <div className="mt-2 h-3 w-64 animate-pulse rounded bg-white/10" />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="text-sm text-slate-500">Gathering the latest numbers from every platform… this can take up to 20 seconds.</div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-white" />
          ))}
        </div>
      </div>
    </div>
  )
}
