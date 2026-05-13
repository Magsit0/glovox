import type { EntelReport } from "@/lib/reports/entel-the-grid/types";
import manifest from "@/public/reports/entel-the-grid/manifest.json";

const numberFmt = new Intl.NumberFormat("es-CL");
const percentFmt = (n: number) =>
  `${(n * 100).toLocaleString("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`.replace(".", ",");

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const CalIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const UsersIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
  </svg>
);
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

export default function Hero({ report }: { report: EntelReport }) {
  const { meta, kpis } = report;
  return (
    <section className="er-hero" id="hero">
      <div className="er-hero-grid" />
      <div className="er-hero-accent-1" />
      <div className="er-hero-accent-2" />
      <div className="er-hero-photos">
        {manifest.hero.slice(0, 2).map((src, i) => (
          <div key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" />
          </div>
        ))}
        <div className="span2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={manifest.hero[2]} alt="" />
        </div>
        {manifest.hero.slice(3, 5).map((src, i) => (
          <div key={i}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" />
          </div>
        ))}
      </div>
      <div className="er-hero-overlay" />
      <div className="er-hero-logo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={manifest.logo} alt="Entel" />
      </div>
      <div className="er-hero-content">
        <div className="er-hero-eyebrow">
          <div className="er-hero-eyebrow-line" />
          <div className="er-hero-eyebrow-text">
            Informe de Activación · The Grid · Kiki
          </div>
        </div>
        <div className="er-hero-title">
          <div>
            <span className="tw">Activación</span> <span className="to">Entel</span>
          </div>
          <div>
            <span className="tw">The Grid — Kiki</span>
          </div>
        </div>
        <div className="er-hero-meta-row">
          <div className="er-hero-meta-item">
            <PinIcon /> {meta.venue}, Santiago
          </div>
          <div className="er-hero-meta-item">
            <CalIcon /> {meta.fechaLarga}
          </div>
          <div className="er-hero-meta-item">
            <UsersIcon /> ~{numberFmt.format(meta.asistentesEstimados)} asistentes estimados
          </div>
          <div className="er-hero-meta-item">
            <ClockIcon /> Responsable: {meta.responsable} · Supervisor: {meta.supervisor}
          </div>
        </div>
        <div className="er-hero-kpis" id="kpis">
          <div className="er-hero-kpi">
            <div className="er-hk-label">Vasos entregados</div>
            <div className="er-hk-value er-hk-o">{numberFmt.format(kpis.totalCanjes)}</div>
            <div className="er-hk-sub">100% del stock distribuido</div>
          </div>
          <div className="er-hero-kpi">
            <div className="er-hk-label">Asistentes estimados</div>
            <div className="er-hk-value er-hk-s">{numberFmt.format(meta.asistentesEstimados)}</div>
            <div className="er-hk-sub">{meta.venue} · aforo completo</div>
          </div>
          <div className="er-hero-kpi">
            <div className="er-hk-label">Conversión Entel</div>
            <div className="er-hk-value er-hk-o">{percentFmt(kpis.conversionEstimada)}</div>
            <div className="er-hk-sub">
              {numberFmt.format(kpis.totalCanjes)} canjes / {numberFmt.format(meta.asistentesEstimados)} asistentes
            </div>
          </div>
          <div className="er-hero-kpi">
            <div className="er-hk-label">KPI alcanzado</div>
            <div className="er-hk-value er-hk-g">{(kpis.pctAvanceVsMeta * 100).toFixed(0)}%</div>
            <div className="er-hk-sub">Meta: {numberFmt.format(report.stock.metaKpi)} canjes · completada</div>
          </div>
        </div>
      </div>
    </section>
  );
}
