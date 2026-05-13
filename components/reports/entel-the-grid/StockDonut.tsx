import type { EntelReport } from "@/lib/reports/entel-the-grid/types";

const numberFmt = new Intl.NumberFormat("es-CL");

export default function StockDonut({ report }: { report: EntelReport }) {
  const { kpis, meta, stock } = report;
  const conversion = kpis.conversionEstimada; // 0..1
  // outer ring: conversion vs total
  const outerCirc = 2 * Math.PI * 60;
  const outerStroke = outerCirc * conversion;
  // inner ring: stock used
  const innerCirc = 2 * Math.PI * 42;
  const innerStroke = innerCirc * kpis.pctStockUsado;

  const sinCanje = meta.asistentesEstimados - kpis.totalCanjes;

  return (
    <div className="er-card">
      <div className="er-card-title">Stock vs conversión</div>
      <div className="er-card-desc">Relación entre canjes y universo de asistentes</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 18,
          paddingTop: 10,
        }}
      >
        <svg width="150" height="150" viewBox="0 0 150 150">
          <circle cx="75" cy="75" r="60" fill="none" stroke="#E2E8F0" strokeWidth="18" />
          <circle
            cx="75"
            cy="75"
            r="60"
            fill="none"
            stroke="#FF5500"
            strokeWidth="18"
            strokeDasharray={`${outerStroke} ${outerCirc - outerStroke}`}
            strokeDashoffset="0"
            transform="rotate(-90 75 75)"
            strokeLinecap="round"
          />
          <circle cx="75" cy="75" r="42" fill="none" stroke="#E2E8F0" strokeWidth="14" />
          <circle
            cx="75"
            cy="75"
            r="42"
            fill="none"
            stroke="#0033CC"
            strokeWidth="14"
            strokeDasharray={`${innerStroke} ${innerCirc - innerStroke}`}
            strokeDashoffset="0"
            transform="rotate(-90 75 75)"
            strokeLinecap="round"
          />
          <text
            x="75"
            y="69"
            textAnchor="middle"
            fontFamily="var(--font-entel-display), Outfit, sans-serif"
            fontSize="20"
            fontWeight="800"
            fill="#0033CC"
          >
            {(kpis.pctStockUsado * 100).toFixed(0)}%
          </text>
          <text
            x="75"
            y="86"
            textAnchor="middle"
            fontFamily="var(--font-entel-body), DM Sans, sans-serif"
            fontSize="9"
            fill="#94A3B8"
          >
            stock usado
          </text>
        </svg>
        <div style={{ width: "100%" }}>
          <div className="er-legend-item">
            <div className="er-legend-dot" style={{ background: "var(--orange)" }} />
            <div className="er-legend-name">Canjes Entel</div>
            <div className="er-legend-val">
              {numberFmt.format(kpis.totalCanjes)} ·{" "}
              {(conversion * 100).toLocaleString("es-CL", {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
              %
            </div>
          </div>
          <div className="er-legend-item">
            <div className="er-legend-dot" style={{ background: "var(--blue)" }} />
            <div className="er-legend-name">Stock utilizado</div>
            <div className="er-legend-val">
              {numberFmt.format(kpis.totalCanjes)} / {numberFmt.format(stock.ajustado)}
            </div>
          </div>
          <div className="er-legend-item">
            <div className="er-legend-dot" style={{ background: "var(--gray-200)" }} />
            <div className="er-legend-name">Asistentes sin canje</div>
            <div className="er-legend-val">{numberFmt.format(sinCanje)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
