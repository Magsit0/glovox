type BrutalChartPanelProps = {
  title: string;
  children: React.ReactNode;
  className?: string;
};

// Panel/card estándar Glovox (bg blanco, borde hairline, rounded-lg). El
// nombre "Brutal…" es histórico; el estilo ya sigue docs/STYLE_DASHBOARD.md.
export default function BrutalChartPanel({
  title,
  children,
  className = "",
}: BrutalChartPanelProps) {
  return (
    <div
      className={`bg-white border border-[#E5E5E5] rounded-lg p-6 ${className}`}
    >
      <h3 className="font-display font-bold text-lg text-[#333333] mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}
