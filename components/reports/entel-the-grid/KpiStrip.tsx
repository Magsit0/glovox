import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

const numberFmt = new Intl.NumberFormat("es-CL");
const percentFmt = (n: number) =>
  `${(n * 100).toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`.replace(".", ",");

export default function KpiStrip({ report }: { report: EntelReport }) {
  const { kpis, meta, stock } = report;
  return (
    <div className="er-kpi-strip">
      <div className="er-kpi-card blue">
        <div className="er-kpi-icon">🥤</div>
        <div className="er-kpi-label">Vasos entregados</div>
        <div className="er-kpi-value blue">{numberFmt.format(kpis.totalCanjes)}</div>
        <div className="er-kpi-sub">
          de {numberFmt.format(stock.ajustado)} en stock · {(kpis.pctStockUsado * 100).toFixed(0)}% utilizado
        </div>
      </div>
      <div className="er-kpi-card sky">
        <div className="er-kpi-icon">👥</div>
        <div className="er-kpi-label">Asistentes estimados</div>
        <div className="er-kpi-value sky">{numberFmt.format(meta.asistentesEstimados)}</div>
        <div className="er-kpi-sub">{meta.venue} · aforo completo</div>
      </div>
      <div className="er-kpi-card orange">
        <div className="er-kpi-icon">📈</div>
        <div className="er-kpi-label">Conversión Entel</div>
        <div className="er-kpi-value orange">{percentFmt(kpis.conversionEstimada)}</div>
        <div className="er-kpi-sub">
          {numberFmt.format(kpis.totalCanjes)} canjes / {numberFmt.format(meta.asistentesEstimados)} asistentes
        </div>
      </div>
      <div className="er-kpi-card success">
        <div className="er-kpi-icon">🎯</div>
        <div className="er-kpi-label">KPI objetivo</div>
        <div className="er-kpi-value success">{(kpis.pctAvanceVsMeta * 100).toFixed(0)}%</div>
        <div className="er-kpi-sub">Meta: {numberFmt.format(stock.metaKpi)} canjes · alcanzada</div>
      </div>
    </div>
  );
}
