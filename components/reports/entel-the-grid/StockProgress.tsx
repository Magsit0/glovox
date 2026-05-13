const ROWS = [
  { label: "17:00 — Inicio activación", pct: 10, fill: "linear-gradient(90deg,#0055E5,#3375FF)" },
  { label: "17:30 — Flujo moderado", pct: 30, fill: "linear-gradient(90deg,#0055E5,#3375FF)" },
  { label: "18:30 — Flujo creciente", pct: 50, fill: "linear-gradient(90deg,#0055E5,#00AAEE)" },
  {
    label: "19:00 — Peak de demanda 🔥",
    pct: 90,
    fill: "linear-gradient(90deg,#FF5500,#FF8844)",
    color: "var(--orange)" as const,
  },
  {
    label: "21:15 — Cierre exitoso de activación",
    pct: 100,
    fill: "linear-gradient(90deg,#0033CC,#3375FF)",
    color: "var(--blue)" as const,
  },
];

export default function StockProgress() {
  return (
    <div className="er-card">
      <div className="er-card-title">Stock acumulado en el tiempo</div>
      <div className="er-card-desc">Evolución del porcentaje de stock consumido hora a hora</div>
      <div style={{ marginTop: 10 }}>
        {ROWS.map((r) => (
          <div className="er-progress-row" key={r.label}>
            <div className="er-progress-head">
              <span className="er-progress-name">{r.label}</span>
              <span className="er-progress-pct" style={r.color ? { color: r.color } : undefined}>
                {r.pct}%
              </span>
            </div>
            <div className="er-progress-track">
              <div className="er-progress-fill" style={{ width: `${r.pct}%`, background: r.fill }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
