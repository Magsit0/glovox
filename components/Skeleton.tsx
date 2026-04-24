export default function Skeleton({ height = 320 }: { height?: number }) {
  return <div className="animate-pulse rounded-lg bg-zinc-800" style={{ height }} />;
}
