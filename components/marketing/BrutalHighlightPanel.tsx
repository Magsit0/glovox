type BrutalHighlightPanelProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function BrutalHighlightPanel({
  title,
  children,
  className = "col-span-1",
}: BrutalHighlightPanelProps) {
  return (
    <div
      className={`bg-[#FFFF00] border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-6 ${className}`}
    >
      <span className="inline-block bg-black text-[#FFFF00] font-mono-data uppercase text-xs px-2 py-1 mb-3">
        {title}
      </span>
      {children}
    </div>
  );
}
