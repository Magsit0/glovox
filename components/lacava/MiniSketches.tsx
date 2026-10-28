import type { LaCavaDiaRow, LaCavaJornadaDiaRow } from "@/lib/queries/lacava";
import type { PuntoTrayectoria } from "@/lib/lacava/proyeccion";
import type { CurvaVariant } from "./CurvasEdicionesChart";
import { LACAVA, lacavaSeriesColor } from "./theme";

/**
 * Bocetos en miniatura de los gráficos del dashboard, dibujados con los MISMOS
 * datos que el gráfico completo (para el selector de pestañas de
 * GraficosCard). SVG puro y determinista: el servidor y el cliente generan el
 * mismo markup, sin desajustes de hidratación.
 *
 * El viewBox se estira al tamaño del contenedor (preserveAspectRatio="none");
 * los trazos usan vector-effect para conservar su grosor al estirarse.
 */

const W = 120;
const H = 40;
const PAD = 3;

type Pt = [number, number];

const r1 = (v: number) => Math.round(v * 10) / 10;

/** Path de una polilínea; `null` corta el trazo (nuevo segmento). */
function path(pts: (Pt | null)[]): string {
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${r1(p[0])} ${r1(p[1])}`;
    pen = true;
  }
  return d;
}

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

const yScale = (max: number) => (v: number) =>
  H - PAD - (v / Math.max(max, 1)) * (H - 2 * PAD);

function Frame({ children }: { children?: React.ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="block h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      <line
        x1={0}
        y1={H - 0.5}
        x2={W}
        y2={H - 0.5}
        stroke={LACAVA.borde}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      {children}
    </svg>
  );
}

function Trazo({
  d,
  color,
  width = 1.75,
  dashed = false,
}: {
  d: string;
  color: string;
  width?: number;
  dashed?: boolean;
}) {
  if (!d) return null;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeDasharray={dashed ? "3 2.5" : undefined}
      vectorEffect="non-scaling-stroke"
    />
  );
}

/**
 * Evolución de venta: barras de venta diaria (agrupadas en ≤36 columnas) y
 * línea del acumulado, con el eje extendido hasta el día del evento — el
 * espacio vacío a la derecha es el camino que falta.
 *
 * Cada columna muestra el PROMEDIO por día YA OCURRIDO: si los días no se
 * reparten parejo (110 días en 36 columnas = columnas de 3 y de 4 días),
 * sumar inventaría picos y bajones que el gráfico real no tiene; y dividir
 * por días que aún no ocurren haría caer la columna en curso.
 */
export function EvolucionSketch({
  dias,
  fechaEvento,
}: {
  dias: LaCavaDiaRow[];
  fechaEvento: string;
}) {
  if (dias.length === 0) return <Frame />;

  const start = dayNumber(dias[0].fecha);
  const ultimo = dayNumber(dias[dias.length - 1].fecha);
  const end = Math.max(ultimo, dayNumber(fechaEvento));
  const span = end - start + 1;
  const columnas = Math.max(1, Math.min(span, 36));

  const columna = (i: number) => Math.min(columnas - 1, Math.floor((i * columnas) / span));
  const diasObservados: number[] = new Array(columnas).fill(0);
  for (let i = 0; i <= ultimo - start; i++) diasObservados[columna(i)] += 1;
  const sumas: number[] = new Array(columnas).fill(0);
  for (const d of dias) sumas[columna(dayNumber(d.fecha) - start)] += d.personas;
  const promedios = sumas.map((s, i) =>
    diasObservados[i] > 0 ? s / diasObservados[i] : 0,
  );
  const maxBarra = Math.max(...promedios, 1);
  const ancho = (W - 2 * PAD) / columnas;

  const maxAcum = Math.max(...dias.map((d) => d.personasAcum), 1);
  const y = yScale(maxAcum);
  const linea = path(
    dias.map((d) => {
      const i = dayNumber(d.fecha) - start;
      return [PAD + ((i + 0.5) / span) * (W - 2 * PAD), y(d.personasAcum)];
    }),
  );

  return (
    <Frame>
      {promedios.map((v, i) => {
        if (v <= 0) return null;
        const h = Math.max(1, (v / maxBarra) * H * 0.55);
        return (
          <rect
            key={i}
            x={r1(PAD + i * ancho + ancho * 0.18)}
            y={r1(H - 1 - h)}
            width={r1(ancho * 0.64)}
            height={r1(h)}
            fill={LACAVA.dorado}
          />
        );
      })}
      <Trazo d={linea} color={LACAVA.verdeMedio} />
    </Frame>
  );
}

/**
 * Plan de venta: acumulado real hasta hoy y, desde ahí, la banda
 * mínimo–meta con la trayectoria al objetivo — el abanico del gráfico.
 */
export function PlanSketch({ puntos }: { puntos: PuntoTrayectoria[] }) {
  const n = puntos.length;
  if (n < 2) return <Frame />;

  let max = 1;
  for (const p of puntos) {
    max = Math.max(max, p.realAcum ?? 0, p.objetivo ?? 0, p.banda?.[1] ?? 0);
  }
  const y = yScale(max);
  const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);

  const real = path(puntos.map((p, i) => (p.realAcum == null ? null : [x(i), y(p.realAcum)])));
  const objetivo = path(
    puntos.map((p, i) => (p.objetivo == null ? null : [x(i), y(p.objetivo)])),
  );

  const conBanda = puntos
    .map((p, i) => ({ banda: p.banda, i }))
    .filter((b): b is { banda: [number, number]; i: number } => b.banda != null);
  const banda =
    conBanda.length > 1
      ? `${path(conBanda.map((b) => [x(b.i), y(b.banda[1])]))}${conBanda
          .slice()
          .reverse()
          .map((b) => `L${r1(x(b.i))} ${r1(y(b.banda[0]))}`)
          .join("")}Z`
      : "";

  return (
    <Frame>
      {banda && <path d={banda} fill={LACAVA.dorado} fillOpacity={0.28} stroke="none" />}
      <Trazo d={objetivo} color={LACAVA.burdeos} width={1.5} dashed />
      <Trazo d={real} color={LACAVA.verdeMedio} />
    </Frame>
  );
}

/**
 * Venta por día: el avance acumulado de cada jornada como fracción de su
 * sold out (o de su propio total si no tiene), y arriba la línea del sold
 * out — la meta común a la que apuntan las tres curvas.
 */
export function VentaPorDiaSketch({
  jornadas,
  series,
}: {
  jornadas: { dia: string; color: string; objetivo?: number }[];
  series: LaCavaJornadaDiaRow[];
}) {
  if (series.length === 0 || jornadas.length === 0) return <Frame />;
  const start = Math.min(...series.map((r) => dayNumber(r.fecha)));
  const end = Math.max(start + 1, ...jornadas.map((j) => dayNumber(j.dia)));
  const x = (dn: number) => PAD + ((dn - start) / (end - start)) * (W - 2 * PAD);
  const y = yScale(1);
  const conObjetivo = jornadas.some((j) => (j.objetivo ?? 0) > 0);

  return (
    <Frame>
      {conObjetivo && <Trazo d={path([[PAD, y(1)], [W - PAD, y(1)]])} color={LACAVA.burdeos} width={1} dashed />}
      {jornadas.map((j) => {
        const filas = series
          .filter((r) => r.diaEvento === j.dia)
          .sort((a, b) => a.fecha.localeCompare(b.fecha));
        const total = filas.reduce((acc, r) => acc + r.personas, 0);
        const base = j.objetivo && j.objetivo > 0 ? j.objetivo : Math.max(1, total);
        let acum = 0;
        const pts = filas.map((r): Pt => {
          acum += r.personas;
          return [x(dayNumber(r.fecha)), y(Math.min(1, acum / base))];
        });
        return <Trazo key={j.dia} d={path(pts)} color={j.color} width={1.5} />;
      })}
    </Frame>
  );
}

/**
 * Curvas por edición: el acumulado de cada edición alineado por días de
 * anticipación (eje invertido, como el gráfico). La edición en venta se
 * dibuja encima y más gruesa.
 */
export function CurvasSketch({ variant }: { variant?: CurvaVariant }) {
  if (!variant || variant.points.length < 2 || variant.series.length === 0) {
    return <Frame />;
  }
  const { points, series, minDias, maxDias } = variant;
  const span = Math.max(1, maxDias - minDias);
  const x = (dias: number) => PAD + ((maxDias - dias) / span) * (W - 2 * PAD);

  let max = 1;
  for (const p of points) {
    for (const s of series) {
      const v = p[s.key];
      if (typeof v === "number") max = Math.max(max, v);
    }
  }
  const y = yScale(max);

  const orden = series
    .map((s, i) => ({ s, color: lacavaSeriesColor(i) }))
    .sort((a, b) => Number(a.s.enVenta) - Number(b.s.enVenta));

  return (
    <Frame>
      {orden.map(({ s, color }) => (
        <Trazo
          key={s.key}
          d={path(
            points.map((p) => {
              const v = p[s.key];
              return typeof v === "number" ? [x(p.dias), y(v)] : null;
            }),
          )}
          color={color}
          width={s.enVenta ? 2.25 : 1.5}
        />
      ))}
    </Frame>
  );
}
