export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      {/* Header skeleton */}
      <div className="flex flex-col gap-3">
        <div className="h-7 w-7 rounded-full bg-[#F0F0F0]" />
        <div className="h-3 w-24 rounded bg-[#F0F0F0]" />
        <div className="h-8 w-64 rounded bg-[#F0F0F0]" />
        <div className="h-4 w-96 max-w-full rounded bg-[#F0F0F0]" />
      </div>

      {/* Filters skeleton */}
      <div className="flex flex-wrap gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-10 w-32 rounded-lg bg-[#F0F0F0]" />
        ))}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <div className="h-3 w-20 rounded bg-[#F0F0F0]" />
            <div className="h-9 w-28 rounded bg-[#F0F0F0]" />
            <div className="h-3 w-32 rounded bg-[#F0F0F0]" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div className="h-5 w-40 rounded bg-[#F0F0F0]" />
        <div className="mt-6 h-80 w-full rounded bg-[#F0F0F0]" />
      </div>

      {/* Tables */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <div className="h-5 w-40 rounded bg-[#F0F0F0]" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((__, j) => (
              <div key={j} className="h-6 w-full rounded bg-[#F0F0F0]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
