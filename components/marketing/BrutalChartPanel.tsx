type BrutalChartPanelProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

export default function BrutalChartPanel({
  title,
  children,
  className = "col-span-3",
}: BrutalChartPanelProps) {
  return (
    <div
      className={`bg-white border-4 border-black shadow-[4px_4px_0px_#000] rounded-none p-6 ${className}`}
    >
      <h3 className="font-display uppercase text-2xl leading-none text-black mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
