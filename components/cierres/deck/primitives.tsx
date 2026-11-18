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

import chroma from "chroma-js";
import { UsersRound } from "lucide-react";

type Children = { children?: React.ReactNode };

/* ───────────────────────────── Lámina ───────────────────────────── */

/** Valor de `areas` para las láminas que tocan a todas las áreas. */
export const TODAS_LAS_AREAS = "Todas las áreas";

export function Slide({
  id,
  n,
  total,
  label,
  detail,
  areas,
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
  /** Áreas a las que se refiere la lámina (arriba a la derecha). */
  areas?: readonly string[];
  className?: string;
}) {
  const todas = areas?.length === 1 && areas[0] === TODAS_LAS_AREAS;
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
          <div className="flex shrink-0 items-center gap-4">
            {areas && areas.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                <UsersRound aria-hidden="true" className="h-3.5 w-3.5" />
                {!todas && <span>{areas.length > 1 ? "Áreas:" : "Área:"}</span>}
                <span className="font-semibold text-[var(--ink)]">{areas.join(" · ")}</span>
              </span>
            )}
            <span className="text-xs tabular-nums text-[var(--ink-subtle)]">
              {n} / {total}
            </span>
          </div>
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
    <div className="relative shrink-0 overflow-x-auto rounded-lg border border-[var(--divider)]">
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

/**
 * Texto con cada «N días antes» en negrita: la anticipación es lo primero que se
 * busca en la columna «Qué pasó» de los puntos de control.
 */
export function ConDiasAntes({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\d+ días? (?:antes|después))/).map((parte, i) =>
        i % 2 === 1 ? (
          <b key={i} className="font-semibold">
            {parte}
          </b>
        ) : (
          parte
        ),
      )}
    </>
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
  marks = [],
}: {
  value: number | null;
  max: number;
  mark: number;
  /** Umbrales secundarios (rayas grises), además del plazo principal. */
  marks?: readonly number[];
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
        {marks.map((m) => (
          <div
            key={m}
            className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-[var(--ink-subtle)]"
            style={{ left: `${(m / max) * 100}%` }}
          />
        ))}
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

/* ───────────────────────── Mapa de calor de tramos ───────────────────────── */

/** Escala de una etapa: de un tinte casi blanco de su color al acento lleno. */
const calor = (color: string) => chroma.scale([chroma.mix("#FFFFFF", color, 0.12, "lab"), color]).mode("lab");

/**
 * Entradas por tramo de compra, un evento por fila: cada tramo es una columna
 * del mismo ancho (de lo más temprano, a la izquierda, al día del evento, a la
 * derecha), con su color de acento. La intensidad sube con la cantidad, sobre
 * la misma escala en todas las celdas, así que se compara tramo con tramo entre
 * eventos.
 */
export function TramosCalor<K extends string>({
  tramos,
  filas,
}: {
  /** `color`: uno de los acentos de marca (hex), distinto por tramo. */
  tramos: readonly { key: K; label: string; color: string }[];
  filas: readonly { evento: string; tramos: Record<K, number>; total: string; actual?: boolean }[];
}) {
  const max = Math.max(1, ...filas.flatMap((f) => tramos.map((t) => f.tramos[t.key])));
  const fmt = new Intl.NumberFormat("es-CL");
  const cols = `calc(var(--spacing)*18) repeat(${tramos.length}, minmax(0, 1fr)) calc(var(--spacing)*14)`;
  return (
    <div className="flex flex-col gap-1" role="table" aria-label="Entradas pagadas por tramo de compra">
      <div role="row" className="grid items-end gap-1 pb-1 text-xs text-[var(--ink-muted)]" style={{ gridTemplateColumns: cols }}>
        <span role="columnheader" />
        {tramos.map((t) => (
          <span key={t.key} role="columnheader" className="flex items-end justify-center gap-1.5 px-1 text-center leading-tight">
            <span aria-hidden="true" className="mb-0.5 inline-block h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
        <span role="columnheader" className="text-right">
          Total
        </span>
      </div>
      {filas.map((f) => (
        <div key={f.evento} role="row" className="grid items-center gap-1" style={{ gridTemplateColumns: cols }}>
          <span role="rowheader" className={`text-sm text-[var(--ink)] ${f.actual ? "font-semibold" : ""}`}>
            {f.evento}
          </span>
          {tramos.map((t) => {
            const v = f.tramos[t.key];
            return (
              <span
                key={t.key}
                role="cell"
                className="flex h-9 items-center justify-center rounded-md text-sm font-semibold tabular-nums text-[var(--ink)]"
                style={{ backgroundColor: calor(t.color)(v / max).hex() }}
              >
                {fmt.format(v)}
              </span>
            );
          })}
          <span role="cell" className="text-right text-sm font-semibold tabular-nums text-[var(--ink)]">
            {f.total}
          </span>
        </div>
      ))}
      <p className="pt-1 text-xs text-[var(--ink-subtle)]">Más intenso = más entradas, en la misma escala para todas las celdas.</p>
    </div>
  );
}

/* ───────────────────────── Línea de tiempo de plazos ───────────────────────── */

export interface HitoPlazo {
  hito: string;
  area: string;
  /** Plazo propuesto, en días antes del evento (con `niveles`, el mínimo). */
  plazo: number;
  /**
   * Umbrales graduados (días antes), del más exigente al mínimo; ej. ideal 60,
   * bueno 45, mínimo 30. Sin esto el hito tiene un solo plazo.
   */
  niveles?: readonly { dias: number; label: string }[];
  /** Mediana de los eventos anteriores (días antes) y cómo se escribe. */
  mediana: number;
  medianaTexto: string;
  /** Este evento (días antes). */
  actual: number;
  /** Evento anterior, para comparar en el texto de la derecha. */
  anterior: { nombre: string; dias: number };
}

/** Posición en % sobre un eje que va de D−max (0%) al día del evento (100%). */
const posicion = (dias: number, max: number) =>
  Math.min(100, Math.max(0, ((max - dias) / max) * 100));

/** Etiqueta centrada en x, pegada al borde si queda muy cerca de un extremo. */
function alinear(x: number): React.CSSProperties {
  if (x < 12) return { left: `${x}%` };
  if (x > 88) return { right: `${100 - x}%` };
  return { left: `${x}%`, transform: "translateX(-50%)" };
}

/** Estado de un hito contra su plazo (o contra sus umbrales graduados). */
function estadoHito(h: HitoPlazo): { tone: Tone; texto: string; atrasoDesde: number | null } {
  if (h.niveles && h.niveles.length > 0) {
    const alcanzado = h.niveles.find((n) => h.actual >= n.dias);
    const minimo = h.niveles[h.niveles.length - 1];
    if (!alcanzado) {
      return { tone: "error", texto: `bajo el ${minimo.label} (${minimo.dias})`, atrasoDesde: minimo.dias };
    }
    const esMinimo = alcanzado === minimo;
    return {
      tone: esMinimo ? "pending" : "success",
      texto: esMinimo ? `cumple el ${alcanzado.label} (${alcanzado.dias})` : `nivel ${alcanzado.label} (${alcanzado.dias})`,
      atrasoDesde: null,
    };
  }
  const atraso = h.plazo - h.actual;
  return atraso > 0
    ? { tone: "error", texto: `${atraso} días tarde`, atrasoDesde: h.plazo }
    : { tone: "success", texto: "a tiempo", atrasoDesde: null };
}

/**
 * Un hito por fila sobre un eje de tiempo común (de D−max al día del evento,
 * de izquierda a derecha). En cada fila: el plazo (raya en tinta; si el hito
 * tiene umbrales graduados, una raya por umbral, la del mínimo en tinta), lo
 * normal en los eventos anteriores (punto gris, la mediana) y este evento
 * (punto morado). Si el evento quedó después del plazo mínimo, el tramo entre
 * ambos se pinta rosa: es el atraso. A la derecha, el resumen en palabras.
 */
export function PlazosTimeline({
  hitos,
  max = 90,
  evento,
  normal = { leyenda: "Lo normal (mediana de los Piknic, incluido este)", etiqueta: "Lo normal" },
}: {
  hitos: HitoPlazo[];
  max?: number;
  /** Nombre corto del evento para la leyenda, ej. "Piknic 4". */
  evento: string;
  /** Cómo se llama el punto gris: en la leyenda y junto al punto. */
  normal?: { leyenda: string; etiqueta: string };
}) {
  const ejes = [90, 60, 30, 0].filter((d) => d <= max);
  return (
    <div className="flex flex-col">
      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-3 text-xs text-[var(--ink-muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-[#9F99F8]" />
          {evento}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-[var(--ink-subtle)]" />
          {normal.leyenda}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 bg-[var(--ink)]" />
          Plazo (el mínimo, si hay más de uno)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-1 w-4 rounded-full bg-[#ED75A0]" />
          Atraso contra el plazo
        </span>
      </div>

      {hitos.map((h) => {
        const xMediana = posicion(h.mediana, max);
        const xActual = posicion(h.actual, max);
        const estado = estadoHito(h);
        const marcas = h.niveles?.length
          ? h.niveles.map((n, i, arr) => ({ dias: n.dias, label: `${n.label} · ${n.dias}`, principal: i === arr.length - 1 }))
          : [{ dias: h.plazo, label: `Plazo: ${h.plazo} días antes`, principal: true }];
        const plazoTexto = h.niveles?.length
          ? `${h.niveles.map((n) => `${n.label} ${n.dias}`).join(", ")} días antes`
          : `plazo ${h.plazo} días antes`;
        return (
          <div
            key={h.hito}
            className="grid grid-cols-1 items-center gap-x-6 gap-y-2 border-t border-[var(--divider)] py-6 deck:grid-cols-[calc(var(--spacing)*44)_minmax(0,1fr)_calc(var(--spacing)*52)]"
          >
            <div>
              <p className="text-base font-semibold text-[var(--ink)]">{h.hito}</p>
              <p className="text-xs text-[var(--ink-muted)]">{h.area}</p>
            </div>

            {/* Eje: plazos arriba, lo normal abajo; este evento es el punto morado. */}
            <div
              className="relative h-[calc(var(--spacing)*20)]"
              role="img"
              aria-label={`${h.hito}: ${plazoTexto}; ${normal.etiqueta.toLowerCase()} ${h.medianaTexto}; ${evento} ${h.actual} días antes (${estado.texto}).`}
            >
              {ejes.map((d) => (
                <div
                  key={d}
                  aria-hidden="true"
                  className="absolute inset-y-[calc(var(--spacing)*5)] w-px bg-[var(--grid)]"
                  style={{ left: `${posicion(d, max)}%` }}
                />
              ))}
              <div aria-hidden="true" className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-[var(--divider)]" />
              {estado.atrasoDesde != null && (
                <div
                  aria-hidden="true"
                  className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-[#ED75A0]"
                  style={{
                    left: `${posicion(estado.atrasoDesde, max)}%`,
                    width: `${xActual - posicion(estado.atrasoDesde, max)}%`,
                  }}
                />
              )}
              {/* Plazos */}
              {marcas.map((m) => {
                const x = posicion(m.dias, max);
                return (
                  <span key={m.dias} aria-hidden="true">
                    <span
                      className={`absolute top-[calc(var(--spacing)*5)] bottom-[calc(var(--spacing)*5)] w-0.5 -translate-x-1/2 rounded-full ${m.principal ? "bg-[var(--ink)]" : "bg-[var(--ink-subtle)]"}`}
                      style={{ left: `${x}%` }}
                    />
                    <span
                      className={`absolute top-0 whitespace-nowrap text-xs ${m.principal ? "font-semibold text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}
                      style={alinear(x)}
                    >
                      {h.niveles?.length && !m.principal ? (
                        <>
                          <span className="deck:hidden">{m.dias}</span>
                          <span className="hidden deck:inline">{m.label}</span>
                        </>
                      ) : (
                        m.label
                      )}
                    </span>
                  </span>
                );
              })}
              {/* Lo normal */}
              <div
                aria-hidden="true"
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-[var(--ink-subtle)]"
                style={{ left: `${xMediana}%` }}
              />
              <span
                aria-hidden="true"
                className="absolute bottom-0 whitespace-nowrap text-xs text-[var(--ink-subtle)]"
                style={alinear(xMediana)}
              >
                {normal.etiqueta}: {h.medianaTexto} días
              </span>
              {/* Este evento */}
              <div
                aria-hidden="true"
                className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-[#9F99F8]"
                style={{ left: `${xActual}%` }}
              />
            </div>

            <div>
              <p className="font-display text-2xl font-bold leading-none tracking-tight text-[var(--ink)]">
                {h.actual} días antes
              </p>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--ink)]">
                <Dot tone={estado.tone} />
                {estado.texto}
              </p>
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                {h.anterior.nombre}: {h.anterior.dias} días antes
              </p>
            </div>
          </div>
        );
      })}

      {/* Eje común */}
      <div className="hidden grid-cols-[calc(var(--spacing)*44)_minmax(0,1fr)_calc(var(--spacing)*52)] gap-x-6 border-t border-[var(--divider)] pt-1.5 deck:grid">
        <span />
        <div className="relative h-4 text-xs text-[var(--ink-subtle)]">
          {ejes.map((d) => (
            <span key={d} className="absolute whitespace-nowrap" style={alinear(posicion(d, max))}>
              {d === 0 ? "día del evento" : `${d} días antes`}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

/* ───────────────────────────── Notas por área ───────────────────────────── */

export interface AreaConNotas {
  area: string;
  /** Aclaración junto al nombre (ej. "no estuvo en la reunión"). */
  nota?: string;
  notas: { texto: string; tag?: { label: string; tone: Tone } }[];
}

/** Columna de un área: nombre + viñetas, cada una con su estado opcional. */
export function AreaNotas({ area, nota, notas }: AreaConNotas) {
  return (
    <section className="flex min-w-0 flex-col gap-2 border-t border-[var(--ink)] pt-2">
      <h3 className="font-display text-base font-bold leading-tight text-[var(--ink)]">
        {area}
        {nota && (
          <span className="ml-1.5 font-sans text-xs font-normal text-[var(--ink-subtle)]">
            · {nota}
          </span>
        )}
      </h3>
      <ul className="flex flex-col gap-3">
        {notas.map((n) => (
          <li key={n.texto} className="flex flex-col items-start gap-1 text-sm leading-snug text-[var(--ink)]">
            {n.tag && <Pill tone={n.tag.tone}>{n.tag.label}</Pill>}
            <span>{n.texto}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
