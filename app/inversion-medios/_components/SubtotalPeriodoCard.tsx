import { fmtDiaCorto, fmtUsd } from "./format";

const DESTAQUE = {
  actual: {
    box: "border-[#9F99F8] shadow-sm ring-1 ring-[#9F99F8]",
    chip: "bg-[var(--purple-tint)] text-[var(--plan)]",
    label: "Semana actual",
  },
  siguiente: {
    box: "border-[var(--week-near-line)] ring-1 ring-[var(--week-near-line)]",
    chip: "bg-[var(--week-near-tint)] text-[var(--week-near-ink)]",
    label: "Próxima semana",
  },
  subsiguiente: {
    box: "border-[var(--week-far-line)]",
    chip: "bg-[var(--week-far-tint)] text-[var(--week-far-ink)]",
    label: "En 2 semanas",
  },
} as const;

export default function SubtotalPeriodoCard({
  w,
  destacada,
  periodo = "Semana",
}: {
  periodo?: "Semana" | "Rango";
  w: {
    inicio: string;
    fin: string;
    plan: number;
    planTrans: number;
    real: number;
    inicioVista: string;
    finVista: string;
    futura: boolean;
    parcial: boolean;
  };
  /** Destaque en intensidad decreciente: actual (100) → siguiente (50) →
   *  subsiguiente (25). Tintes del morado de marca, no opacidades. */
  destacada: "actual" | "siguiente" | "subsiguiente" | null;
}) {
  // El semáforo compara real contra el plan TRANSCURRIDO (días ≤ real-al), no
  // contra el plan de toda la semana: así una semana futura con plan sembrado
  // pero sin gasto no se pinta verde "cumplida", sino gris "programada".
  const pct = w.planTrans > 0 ? (w.real / w.planTrans) * 100 : w.real > 0 ? 999 : 0;
  const tono = w.futura
    ? { dot: "var(--divider)", txt: "text-[var(--ink-subtle)]" }
    : pct > 100
      ? { dot: "#ED75A0", txt: "text-[#ED75A0]" }
      : pct >= 85
        ? { dot: "#F6C544", txt: "text-[var(--amber-ink)]" }
        : { dot: "#B1D750", txt: "text-[var(--green-ink)]" };
  const estado = w.futura
    ? "programado — aún sin gasto"
    : w.planTrans > 0
      ? `${Math.round(pct)}% del plan${w.parcial ? " a la fecha" : ""}`
      : w.real > 0
        ? "gasto sin plan"
        : "sin plan";
  // Intensidad del destaque: 100 (actual) / 50 (siguiente) / 25 (subsiguiente).
  const nivel = destacada && DESTAQUE[destacada];
  return (
    <div
      className={`rounded-lg border bg-[var(--surface)] p-4 ${nivel ? nivel.box : "border-[var(--divider)]"}`}
    >
      <p className="flex flex-wrap items-center gap-1.5 font-sans text-xs text-[var(--ink-muted)]">
        <span>
          {periodo} del {fmtDiaCorto(w.inicioVista)} al {fmtDiaCorto(w.finVista)}
        </span>
        {nivel && (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${nivel.chip}`}>
            {nivel.label}
          </span>
        )}
        {w.parcial && !w.futura && (
          <span className="ml-1 text-[var(--ink-subtle)]" title="El período tiene cobertura parcial o el gasto real aún está incompleto">
            (parcial)
          </span>
        )}
      </p>
      <p className="mt-1.5 font-sans text-sm tabular-nums text-[var(--ink)]">
        <span className="font-display text-lg font-bold">{fmtUsd(w.plan, 0)}</span>
        <span className="text-[var(--ink-subtle)]"> plan</span>
        <span className="mx-1.5 text-[var(--ink-subtle)]">·</span>
        <span className="font-display text-lg font-bold">{fmtUsd(w.real, 0)}</span>
        <span className="text-[var(--ink-subtle)]"> real</span>
      </p>
      <p className={`mt-2 inline-flex items-center gap-1.5 font-sans text-xs ${tono.txt}`}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tono.dot }} />
        {estado}
      </p>
    </div>
  );
}

