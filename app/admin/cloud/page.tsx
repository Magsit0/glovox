import { requireSuperadmin } from "@/lib/access";
import { getCloudSpend, type CloudSpend } from "@/lib/queries/cloud";
import { formatMoney, formatMonthLabel } from "@/lib/money";
import CloudSpendCharts from "./_components/CloudSpendCharts";

export const dynamic = "force-dynamic";

export default async function AdminCloudPage() {
  await requireSuperadmin();

  // Sólo el fetch va en el try/catch; el JSX se arma afuera (regla de Next).
  let spend: CloudSpend | null = null;
  let errorMsg: string | null = null;
  try {
    spend = await getCloudSpend();
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "No se pudo leer el gasto de Google Cloud.";
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-[#333333]">Gasto Google Cloud</h1>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Gasto mensual en Google Cloud y lo que va del mes en curso.
        </p>
      </header>

      {errorMsg ? (
        <ErrorCard msg={errorMsg} />
      ) : !spend || spend.monthly.length === 0 ? (
        <EmptyCard />
      ) : (
        <Loaded spend={spend} />
      )}
    </div>
  );
}

function Loaded({ spend }: { spend: CloudSpend }) {
  const { moneda, monthly, currentMonth, currentMonthTotal, prevMonthTotal, totalAllTime } = spend;

  return (
    <div className="flex flex-col gap-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="rounded-xl bg-[#9F99F8] p-8">
          <p className="font-sans text-xs text-white/80">Este mes (parcial)</p>
          <p className="mt-2 font-display text-5xl font-bold leading-none text-white">
            {formatMoney(currentMonthTotal, moneda)}
          </p>
          <p className="mt-4 font-sans text-sm text-white/80">
            {currentMonth ? formatMonthLabel(currentMonth) : "—"} · lo que va del mes
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">Mes anterior</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none text-[#333333]">
            {formatMoney(prevMonthTotal, moneda)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">
            {monthly.length > 1 ? `${formatMonthLabel(monthly[monthly.length - 2].mes)} · completo` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
          <p className="font-sans text-xs text-[#666666]">Total histórico</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none text-[#333333]">
            {formatMoney(totalAllTime, moneda)}
          </p>
          <p className="mt-3 font-sans text-xs text-[#999999]">{monthly.length} meses</p>
        </div>
      </div>

      {/* Charts */}
      <CloudSpendCharts spend={spend} />

      {/* Tabla mensual */}
      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-left">
              <th className="px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                Mes
              </th>
              <th className="px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                Gasto ({moneda})
              </th>
            </tr>
          </thead>
          <tbody>
            {[...monthly].reverse().map((m, i, arr) => (
              <tr
                key={m.mes}
                className={`transition-colors duration-150 hover:bg-[#FAFAFA] ${
                  i < arr.length - 1 ? "border-b border-[#E5E5E5]" : ""
                }`}
              >
                <td className="px-4 py-3 font-sans text-sm text-[#333333]">
                  {formatMonthLabel(m.mes)}
                  {m.mes === currentMonth && (
                    <span className="ml-2 font-sans text-xs text-[#999999]">(en curso)</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                  {formatMoney(m.costo, moneda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ErrorCard({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-6">
      <p className="font-sans text-sm text-[#ED75A0]">Error al leer el gasto: {msg}</p>
    </div>
  );
}

function EmptyCard() {
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white p-8">
      <h2 className="font-display text-lg font-bold text-[#333333]">Aún no hay datos de gasto</h2>
      <p className="mt-2 font-sans text-sm text-[#666666]">
        La vista <code className="font-sans text-[#333333]">marts.gcp_gasto_mensual</code> está viva pero
        vacía. Para poblarla falta:
      </p>
      <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 font-sans text-sm text-[#666666]">
        <li>
          Encender el export de facturación de GCP hacia BigQuery (dataset{" "}
          <code className="font-sans text-[#333333]">billing</code>) — mantiene el dato al día solo.
        </li>
        <li>
          Cargar el histórico: bajar el CSV de Facturación → Informes y correr el backfill{" "}
          <code className="font-sans text-[#333333]">backfills/billing/gcp_gasto_backfill.py</code> en
          data-governance.
        </li>
      </ol>
    </div>
  );
}
