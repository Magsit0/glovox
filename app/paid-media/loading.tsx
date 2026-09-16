export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-7 w-7 rounded-full bg-[var(--grid)]" />
        <div className="h-3 w-24 rounded bg-[var(--grid)]" />
        <div className="h-8 w-64 rounded bg-[var(--grid)]" />
        <div className="h-4 w-96 max-w-full rounded bg-[var(--grid)]" />
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-10 w-32 rounded-lg bg-[var(--grid)]" />
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6"
          >
            <div className="h-3 w-20 rounded bg-[var(--grid)]" />
            <div className="h-9 w-28 rounded bg-[var(--grid)]" />
            <div className="h-3 w-32 rounded bg-[var(--grid)]" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
        <div className="h-5 w-40 rounded bg-[var(--grid)]" />
        <div className="mt-6 h-80 w-full rounded bg-[var(--grid)]" />
      </div>

      {/* Tables */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6">
          <div className="h-5 w-40 rounded bg-[var(--grid)]" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((__, j) => (
              <div key={j} className="h-6 w-full rounded bg-[var(--grid)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
