export default function Loading() {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      <div className="flex flex-col gap-2">
        <div className="h-6 w-7 rounded-full bg-[#F0F0F0]" />
        <div className="h-3 w-24 rounded bg-[#F0F0F0]" />
        <div className="h-9 w-72 rounded bg-[#F0F0F0]" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="h-3 w-16 rounded bg-[#F0F0F0]" />
        <div className="h-10 w-full max-w-xl rounded-lg bg-[#F0F0F0]" />
      </div>

      <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div className="h-5 w-1/3 rounded bg-[#F0F0F0]" />
        <div className="mt-3 h-3 w-1/4 rounded bg-[#F0F0F0]" />
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[#E5E5E5] bg-white p-6">
            <div className="h-3 w-24 rounded bg-[#F0F0F0]" />
            <div className="mt-3 h-9 w-32 rounded bg-[#F0F0F0]" />
            <div className="mt-3 h-3 w-20 rounded bg-[#F0F0F0]" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div className="h-5 w-1/3 rounded bg-[#F0F0F0]" />
        <div className="mt-6 h-64 w-full rounded bg-[#F0F0F0]" />
      </div>
    </div>
  );
}
