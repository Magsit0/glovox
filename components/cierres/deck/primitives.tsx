/**
 * Piezas de las presentaciones de cierre (/cierres/*). Sin estado: se renderizan
 * en el servidor dentro de <Deck>. Todo el tamaño va en la escala de Tailwind,
 * que deck.css re-declara proporcional al marco 16:9 (ver la cabecera de ese
 * archivo): no usar px arbitrarios aquí. El layout de escritorio va con
 * `deck:` (escritorio o impresión), no con `lg:`.
 *
 * Colores según docs/STYLE_DASHBOARD.md: neutros por token (var(--ink)…), los 6
 * acentos de marca como literales.
 */

type Children = { children?: React.ReactNode };

/* ───────────────────────────── Lámina ───────────────────────────── */

export function Slide({
  id,
  n,
  total,
  label,
  detail,
  className = "",
  children,
}: Children & {
  id: string;
  /** Número de lámina (1-based) y total, para el folio. */
  n: number;
  total: number;
  /** Antetítulo: etiqueta (en píldora) + detalle opcional. */
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <section
      id={id}
      data-slide
      aria-label={`Lámina ${n} de ${total}`}
      className="ck-slide flex justify-center px-4 py-3 deck:h-full deck:snap-start deck:items-center deck:p-0"
    >
      <div
        className={`ck-frame relative flex w-full flex-col gap-4 overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] px-6 pt-6 pb-8 deck:px-14 deck:pt-11 deck:pb-9 ${className}`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <Pill tone="info">{label}</Pill>
            {detail && (
              <span className="text-xs text-[var(--ink-muted)]">{detail}</span>
            )}
          </div>
          <span className="shrink-0 text-xs tabular-nums text-[var(--ink-subtle)]">
            {n} / {total}
          </span>
        </div>
        {children}
      </div>
    </section>
  );
}

export function SlideTitle({ children }: Children) {
  return (
    <h2 className="font-display text-3xl font-bold leading-tight tracking-tight text-balance text-[var(--ink)]">
      {children}
    </h2>
  );
}

export function SubTitle({ children }: Children) {
  return (
    <h3 className="font-display text-lg font-bold leading-tight tracking-tight text-[var(--ink)]">
      {children}
    </h3>
  );
}

/** Nota al pie de la lámina (fuentes y reglas). Se empuja al fondo del marco. */
export function Source({ children }: Children) {
  return (
    <p className="mt-auto max-w-[110ch] text-xs leading-relaxed text-[var(--ink-subtle)]">
      {children}
    </p>
  );
}

/** Párrafo de apoyo bajo una tabla. Las negritas suben a tinta. */
export function Note({ children }: Children) {
  return (
    <p className="text-xs leading-relaxed text-[var(--ink-muted)] [&_b]:font-semibold [&_b]:text-[var(--ink)]">
      {children}
    </p>
  );
}

/* ───────────────────────────── Cifras ───────────────────────────── */

export function Kpi({
  value,
  caption,
  valueClass = "text-[var(--ink)]",
}: {
  value: React.ReactNode;
  caption: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className={`font-display text-4xl font-bold leading-none tracking-tight ${valueClass}`}
      >
        {value}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-[var(--ink-muted)]">{caption}</p>
    </div>
  );
}

/* ───────────────────────────── Estado ───────────────────────────── */

export type Tone = "error" | "pending" | "warning" | "success" | "info" | "neutral";

const DOT: Record<Tone, string> = {
  error: "bg-[#ED75A0]",
  pending: "bg-[#F6C544]",
  warning: "bg-[#EF8C34]",
  success: "bg-[#B1D750]",
  info: "bg-[#9F99F8]",
  neutral: "bg-[var(--ink-subtle)]",
};

export function Dot({ tone }: { tone: Tone }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[tone]}`}
    />
  );
}

/** Píldora de estado del manual: fondo superficie, hairline y punto de color. */
export function Pill({ tone, children }: Children & { tone: Tone }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--divider)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink)]">
      <Dot tone={tone} />
      {children}
    </span>
  );
}

/**
 * Cifra con lectura de estado (delta inline del manual): punto verde = mejor,
 * rosa = peor, sin punto y en gris = igual o sin juicio.
 */
export function Delta({
  tone,
  children,
}: Children & { tone: "good" | "bad" | "eq" }) {
  if (tone === "eq") {
    return <span className="text-[var(--ink-muted)]">{children}</span>;
  }
  return (
    <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-[var(--ink)]">
      <Dot tone={tone === "good" ? "success" : "error"} />
      {children}
    </span>
  );
}

/* ───────────────────────────── Tablas ───────────────────────────── */

/**
 * Tabla de lámina: hairline + cabecera en surface-alt (manual). En pantallas
 * chicas se desplaza en horizontal en vez de comprimir columnas.
 */
export function Table({
  children,
  className = "",
}: Children & { className?: string }) {
  return (
    <div className="relative overflow-x-auto rounded-lg border border-[var(--divider)]">
      <table
        className={`w-full min-w-[640px] border-collapse text-left tabular-nums text-[var(--ink)] deck:min-w-0 ${className}`}
      >
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  right,
  className = "",
}: Children & { right?: boolean; className?: string }) {
  return (
    <th
      scope="col"
      className={`border-b border-[var(--divider)] bg-[var(--surface-alt)] px-2 py-1.5 text-xs font-medium text-[var(--ink-muted)] first:pl-3 last:pr-3 ${right ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  right,
  className = "",
}: Children & { right?: boolean; className?: string }) {
  return (
    <td
      className={`border-b border-[var(--divider)] px-2 py-1.5 align-middle first:pl-3 last:pr-3 [tr:last-child_&]:border-b-0 ${right ? "text-right" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

/** Línea secundaria dentro de una celda (área responsable, cantidades…). */
export function CellSub({ children }: Children) {
  return (
    <span className="block text-xs font-normal text-[var(--ink-muted)]">
      {children}
    </span>
  );
}

/* ───────────────────────────── Barras ───────────────────────────── */

/**
 * Días de anticipación sobre una escala 0…max, con la marca del plazo
 * propuesto (línea en tinta). Sin dato → "—" y sin relleno.
 */
export function DaysBar({
  value,
  max,
  mark,
}: {
  value: number | null;
  max: number;
  mark: number;
}) {
  const pct = value == null ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div aria-hidden="true" className="relative h-2 flex-1 rounded-sm bg-[var(--divider)]">
        {value != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-sm bg-[#9F99F8]"
            style={{ width: `${pct}%` }}
          />
        )}
        <div
          className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-[var(--ink)]"
          style={{ left: `${(mark / max) * 100}%` }}
        />
      </div>
      <span className="min-w-6 text-right font-semibold tabular-nums">
        {value ?? "—"}
      </span>
    </div>
  );
}

/**
 * Avance de OC contra presupuesto: el carril es el presupuesto (100%) y el
 * relleno lo emitido. Pasado de presupuesto → rosa (alerta del manual).
 */
export function SpendBar({ pct }: { pct: number | null }) {
  const over = pct != null && pct > 100;
  return (
    <div aria-hidden="true" className="relative h-2 rounded-sm bg-[var(--divider)]">
      {pct != null && pct > 0 && (
        <div
          className={`absolute inset-y-0 left-0 rounded-sm ${over ? "bg-[#ED75A0]" : "bg-[#9F99F8]"}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      )}
    </div>
  );
}
