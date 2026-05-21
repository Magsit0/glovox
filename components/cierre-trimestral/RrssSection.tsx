import type { RrssRow, RrssKpis } from "@/lib/queries/cierreTrimestral";
import { formatNumber } from "@/lib/unabase/formatting";
import RrssNetworkSelector from "./RrssNetworkSelector";
import RrssFollowersChart from "./RrssFollowersChart";

interface Props {
  rows: RrssRow[];
  kpis: RrssKpis;
  networkOptions: string[];
  selectedNetwork: string;
  trimestreId: string;
  trimestreLabel: string;
}

function labelFor(v: string): string {
  return v.charAt(0).toUpperCase() + v.slice(1);
}

function formatGrowth(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}`;
}

function formatDecimal(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(value)}`;
}

interface KpiCardProps {
  label: string;
  value: string;
  caption?: string;
  accent?: "neutral" | "positive" | "negative";
}

function KpiCard({ label, value, caption, accent = "neutral" }: KpiCardProps) {
  const dotColor =
    accent === "positive" ? "bg-[#B1D750]" : accent === "negative" ? "bg-[#ED75A0]" : null;
  return (
    <article className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        {dotColor && <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />}
        <p className="font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
          {value}
        </p>
      </div>
      {caption && (
        <p className="mt-3 truncate font-sans text-xs text-[#666666]">{caption}</p>
      )}
    </article>
  );
}

export default function RrssSection({
  rows,
  kpis,
  networkOptions,
  selectedNetwork,
  trimestreId,
  trimestreLabel,
}: Props) {
  const networkLabel = labelFor(selectedNetwork);
  const growthAccent: "positive" | "negative" | "neutral" =
    kpis.growth === null ? "neutral" : kpis.growth >= 0 ? "positive" : "negative";

  return (
    <section id="rrss" className="flex flex-col gap-6 scroll-mt-8">
      <div className="flex flex-col gap-2">
        <p className="font-sans text-xs uppercase tracking-wide text-[#666666]">
          Redes sociales · {trimestreLabel}
        </p>
        <h2 className="font-display text-2xl font-bold tracking-tight text-[#333333]">
          Evolución de followers — {networkLabel}
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-sans text-xs text-[#666666]">Red social</p>
        <RrssNetworkSelector
          options={networkOptions}
          selected={selectedNetwork}
          trimestreId={trimestreId}
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-8">
          <p className="font-display text-lg font-bold text-[#333333]">
            Sin datos de {networkLabel}
          </p>
          <p className="mt-2 font-sans text-sm text-[#666666]">
            No hay registros de followers para este trimestre.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Followers iniciales"
              value={kpis.initialFollowers !== null ? formatNumber(kpis.initialFollowers) : "—"}
            />
            <KpiCard
              label="Followers finales"
              value={kpis.finalFollowers !== null ? formatNumber(kpis.finalFollowers) : "—"}
            />
            <KpiCard
              label="Crecimiento trimestre"
              value={formatGrowth(kpis.growth)}
              accent={growthAccent}
            />
            <KpiCard
              label="Promedio diario"
              value={formatDecimal(kpis.avgDailyGrowth)}
              caption="followers / día"
            />
          </div>

          <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
            <h3 className="font-display text-lg font-bold text-[#333333]">
              Evolución diaria de followers
            </h3>
            <p className="mt-1 font-sans text-xs text-[#666666]">
              Total de followers de {networkLabel} por día en {trimestreLabel}.
            </p>
            <div className="mt-6">
              <RrssFollowersChart data={rows} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
