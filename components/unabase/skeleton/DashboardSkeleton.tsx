export default function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-[124px] flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <div className="h-3 w-16 animate-pulse rounded-full bg-[#F0F0F0]" />
            <div className="h-8 w-24 animate-pulse rounded-lg bg-[#F0F0F0]" />
            <div className="mt-auto h-3 w-20 animate-pulse rounded-full bg-[#F0F0F0]" />
          </div>
        ))}
      </div>
      <div className="h-[340px] animate-pulse rounded-lg border border-[#E5E5E5] bg-white" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="h-[260px] animate-pulse rounded-lg border border-[#E5E5E5] bg-white" />
        <div className="h-[260px] animate-pulse rounded-lg border border-[#E5E5E5] bg-white" />
      </div>
    </div>
  );
}
