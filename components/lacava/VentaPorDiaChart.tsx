"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LaCavaJornadaDiaRow } from "@/lib/queries/lacava";
import { LACAVA, lacavaAxisTick, lacavaGridProps } from "./theme";
import ContadorKpi from "./ContadorKpi";
import {
  type Jornada,
  diasEntre,
  fmtDiaLargo,
  fmtDiaSemana,
  fmtFechaCorta,
  pctAvance,
  sumarDias,
} from "./jornadas";

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

/** Barras de venta diaria: neutras, para no competir con los colores de las jornadas. */
const BARRA = { color: LACAVA.tintaSutil, opacidad: 0.5 } as const;
const compacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

/**
 * Tope y marcas redondas del eje (0, 250, 500…), en 4 a 6 tramos parejos:
 * con el tope "crudo" (sold out + margen) el eje terminaba en 898 o 2,3 K.
 */
function ejeAgradable(max: number): { tope: number; marcas: number[] } {
  const base = Math.max(max, 5);
  const crudo = base / 5;
  const magnitud = 10 ** Math.floor(Math.log10(crudo));
  const paso = ([1, 2, 2.5, 5, 10].find((m) => m * magnitud >= crudo) ?? 10) * magnitud;
  const tramos = Math.ceil(base / paso);
  return { tope: tramos * paso, marcas: Array.from({ length: tramos + 1 }, (_, i) => i * paso) };
}

type Fila = {
  fecha: string;
  diario: number | null;
  acumulado: number | null;
  /** Recta desde lo vendido hoy hasta el sold out en el día de la jornada. */
  requerido: number | null;
};

/**
 * Pestaña "Venta por día": la curva de venta de UNA jornada (elegida con el
 * toggle) desde que abrió la venta hasta el día de esa jornada, con su sold
 * out como destino y el ritmo necesario para llegar. Al lado, el resumen de
 * todas las jornadas: entradas, % del sold out y recaudación.
 */
export default function VentaPorDiaChart({
  jornadas,
  series,
  hoy,
  animar = true,
}: {
  jornadas: Jornada[];
  series: LaCavaJornadaDiaRow[];
  /** YYYY-MM-DD de hoy: hasta acá la curva es observable. */
  hoy: string;
  /** false = estático, mientras el gráfico espera fuera de pantalla. */
  animar?: boolean;
}) {
  const [elegido, setElegido] = useState(jornadas[0]?.dia ?? "");
  // Al cambiar de edición la jornada elegida puede no existir: cae a la primera.
  const jornada = jornadas.find((j) => j.dia === elegido) ?? jornadas[0];
  const animacion = animar ? ("auto" as const) : false;

  const { filas, maxAcum } = useMemo(() => {
    if (!jornada) return { filas: [] as Fila[], maxAcum: 0 };
    // El eje parte cuando abrió la venta del evento (cualquier jornada) y
    // termina el día de esta jornada.
    const inicio = series.reduce(
      (min, r) => (r.fecha < min ? r.fecha : min),
      series[0]?.fecha ?? jornada.dia,
    );
    const porFecha = new Map(
      series.filter((r) => r.diaEvento === jornada.dia).map((r) => [r.fecha, r.personas]),
    );
    const filas: Fila[] = [];
    let acum = 0;
    let acumHoy = 0;
    let iHoy = -1;
    for (let k = 0; k <= Math.max(0, diasEntre(inicio, jornada.dia)); k++) {
      const fecha = sumarDias(inicio, k);
      const observado = fecha <= hoy;
      const delDia = porFecha.get(fecha) ?? 0;
      if (observado) {
        acum += delDia;
        acumHoy = acum;
        iHoy = k;
      }
      filas.push({
        fecha,
        diario: observado ? delDia : null,
        acumulado: observado ? acum : null,
        requerido: null,
      });
    }
    // Camino al sold out: recta desde hoy hasta el día de la jornada.
    const objetivo = jornada.objetivo ?? 0;
    const restantes = filas.length - 1 - iHoy;
    if (objetivo > acumHoy && iHoy >= 0 && restantes > 0) {
      for (let k = 0; k <= restantes; k++) {
        filas[iHoy + k].requerido = acumHoy + ((objetivo - acumHoy) * k) / restantes;
      }
    }
    return { filas, maxAcum: acumHoy };
  }, [series, jornada, hoy]);

  if (!jornada) {
    return (
      <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
        Sin ventas registradas para esta edición.
      </p>
    );
  }

  const objetivo = jornada.objetivo ?? 0;
  const faltan = Math.max(0, objetivo - jornada.vendidas);
  const diasRestantes = diasEntre(hoy, jornada.dia);
  const eje = ejeAgradable(Math.max(objetivo, maxAcum) * 1.05);
  const hoyEnEje = filas.some((f) => f.fecha === hoy) && hoy < jornada.dia;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-sans text-sm" style={{ color: LACAVA.tinta }}>
              <span className="font-medium">{fmtDiaLargo(jornada.dia)}</span>
              {" · "}
              {entero.format(jornada.vendidas)}
              {objetivo > 0
                ? ` de ${entero.format(objetivo)} entradas · ${pctAvance(jornada.vendidas / objetivo)}% del sold out`
                : " entradas"}
            </p>
            {objetivo > 0 && (
              <p className="mt-1 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
                {faltan === 0
                  ? "Sold out alcanzado"
                  : diasRestantes > 0
                    ? `Faltan ${entero.format(faltan)} · ${entero.format(Math.ceil(faltan / diasRestantes))} por día hasta el ${fmtFechaCorta(jornada.dia)}`
                    : diasRestantes === 0
                      ? `Faltan ${entero.format(faltan)} para el sold out · la jornada es hoy`
                      : `Faltaron ${entero.format(faltan)} para el sold out`}
              </p>
            )}
          </div>
          <div
            role="group"
            aria-label="Elegir jornada"
            className="flex flex-wrap items-center gap-1 rounded-lg border bg-white p-1"
            style={{ borderColor: LACAVA.borde }}
          >
            {jornadas.map((j) => {
              const on = j.dia === jornada.dia;
              return (
                <button
                  key={j.dia}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setElegido(j.dia)}
                  // En alto contraste (Windows) se ignora el fondo: la opción
                  // activa se marca con borde y subrayado.
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-sans text-sm font-medium transition-colors ${
                    on ? "forced-colors:border-2 forced-colors:underline" : ""
                  }`}
                  style={
                    on
                      ? { backgroundColor: LACAVA.verde, color: LACAVA.marfil }
                      : { color: LACAVA.tintaSuave }
                  }
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: j.color }} />
                  {fmtDiaSemana(j.dia)}
                </button>
              );
            })}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          {/* La key remonta el gráfico al cambiar de jornada: la curva se
              vuelve a trazar desde cero en vez de deformarse hacia la otra. */}
          <ComposedChart
            key={`${jornada.dia}-${animar}`}
            data={filas}
            margin={{ top: 16, right: 16, bottom: 8, left: 8 }}
          >
            {/* Sin yAxisId la grilla toma un eje implícito vacío y solo
                dibuja el borde superior e inferior. */}
            <CartesianGrid {...lacavaGridProps} yAxisId="acumulado" />
            <XAxis
              dataKey="fecha"
              tickLine={false}
              axisLine={{ stroke: LACAVA.borde }}
              tick={lacavaAxisTick}
              tickFormatter={fmtFechaCorta}
              minTickGap={28}
            />
            <YAxis
              yAxisId="acumulado"
              tickLine={false}
              axisLine={false}
              tick={lacavaAxisTick}
              tickFormatter={(v: number) => compacto.format(v)}
              domain={[0, eje.tope]}
              ticks={eje.marcas}
              width={56}
            />
            <YAxis
              yAxisId="diario"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={lacavaAxisTick}
              tickFormatter={(v: number) => compacto.format(v)}
              width={44}
            />
            <Tooltip cursor={{ stroke: LACAVA.borde }} content={<DiaTooltip />} />
            {hoyEnEje && (
              <ReferenceLine
                yAxisId="acumulado"
                x={hoy}
                stroke={LACAVA.tintaSutil}
                strokeDasharray="4 4"
                label={{
                  value: "hoy",
                  position: "insideTopRight",
                  fontFamily: "var(--font-sans)",
                  fontSize: 11,
                  fill: LACAVA.tintaSuave,
                }}
              />
            )}
            {/* Todo lo que es de la jornada va en su color (curva = real,
                segmentado = su sold out); las barras van en neutro: son
                contexto, y en dorado se confundían con la curva del domingo.
                Va después de "hoy" para que su etiqueta quede encima. */}
            {objetivo > 0 && (
              <ReferenceLine
                yAxisId="acumulado"
                y={objetivo}
                stroke={jornada.color}
                strokeWidth={1.5}
                strokeDasharray="6 4"
                label={<EtiquetaSoldOut texto={`Sold out ${entero.format(objetivo)}`} />}
              />
            )}
            <Bar
              yAxisId="diario"
              dataKey="diario"
              name="Vendidas del día"
              fill={BARRA.color}
              fillOpacity={BARRA.opacidad}
              radius={[3, 3, 0, 0]}
              maxBarSize={8}
              isAnimationActive={animacion}
            />
            <Line
              yAxisId="acumulado"
              type="monotone"
              dataKey="acumulado"
              name="Acumulado"
              stroke={jornada.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={animacion}
            />
            {/* El camino al sold out aparece cuando la curva real terminó. */}
            <Line
              yAxisId="acumulado"
              type="linear"
              dataKey="requerido"
              name="Camino al sold out"
              stroke={LACAVA.tintaSutil}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              activeDot={false}
              connectNulls={false}
              isAnimationActive={animacion}
              animationBegin={1200}
              animationDuration={700}
            />
            {objetivo > 0 && (
              <ReferenceDot
                yAxisId="acumulado"
                className="lacava-aparece-al-final"
                x={jornada.dia}
                y={objetivo}
                r={5}
                fill={jornada.color}
                stroke={LACAVA.cremaClara}
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap items-center gap-4">
          <Leyenda
            forma="barra"
            color={BARRA.color}
            opacidad={BARRA.opacidad}
            label="Vendidas del día (eje derecho)"
          />
          <Leyenda forma="linea" color={jornada.color} label="Acumulado de la jornada" />
          {objetivo > 0 && <Leyenda forma="segmentada" color={jornada.color} label="Sold out" />}
          {objetivo > 0 && faltan > 0 && diasRestantes > 0 && (
            <Leyenda
              forma="segmentada"
              color={LACAVA.tintaSutil}
              label="Camino al sold out"
            />
          )}
        </div>
      </div>

      <ResumenPorDia jornadas={jornadas} elegido={jornada.dia} animar={animar} />
    </div>
  );
}

/**
 * Resumen de todas las jornadas: donut de entradas vendidas por día y, por
 * jornada, avance al sold out y recaudación (venta neta).
 */
function ResumenPorDia({
  jornadas,
  elegido,
  animar,
}: {
  jornadas: Jornada[];
  elegido: string;
  animar: boolean;
}) {
  const totalVendidas = jornadas.reduce((acc, j) => acc + j.vendidas, 0);
  const totalVenta = jornadas.reduce((acc, j) => acc + j.venta, 0);
  const conObjetivo = jornadas.filter((j) => (j.objetivo ?? 0) > 0);
  const objetivoTotal = conObjetivo.reduce((acc, j) => acc + (j.objetivo ?? 0), 0);
  // Cada jornada aporta como máximo su capacidad: el exceso de un día no tapa
  // lo que le falta a otro, y el total llega a 100% solo con todo vendido.
  const vendidasTope = conObjetivo.reduce(
    (acc, j) => acc + Math.min(j.vendidas, j.objetivo ?? 0),
    0,
  );
  const reasignadas = jornadas.reduce((acc, j) => acc + j.reasignadas, 0);

  return (
    <aside
      className="flex flex-col gap-4 rounded-lg border p-4"
      style={{ borderColor: LACAVA.borde }}
    >
      <h3 className="font-lacava text-base font-bold" style={{ color: LACAVA.tinta }}>
        Resumen por día
      </h3>

      <div className="relative h-36">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart key={String(animar)}>
            <Pie
              data={jornadas}
              dataKey="vendidas"
              nameKey="dia"
              innerRadius="64%"
              outerRadius="92%"
              stroke="none"
              isAnimationActive={animar ? "auto" : false}
              // Sin la espera default (400 ms): el anillo y la cifra del
              // centro arrancan juntos.
              animationBegin={0}
            >
              {jornadas.map((j) => (
                <Cell key={j.dia} fill={j.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-lacava text-2xl font-bold leading-none"
            style={{ color: LACAVA.tinta }}
          >
            <ContadorKpi valor={totalVendidas} formato="entero" />
          </span>
          <span className="mt-1 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
            entradas
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {jornadas.map((j) => {
          const obj = j.objetivo ?? 0;
          const on = j.dia === elegido;
          return (
            <li
              key={j.dia}
              className="grid grid-cols-[1fr_auto] gap-x-3 rounded-md px-2 py-1.5"
              style={on ? { backgroundColor: LACAVA.crema } : undefined}
            >
              <span
                className={`flex items-center gap-2 font-sans text-sm ${on ? "font-medium" : ""}`}
                style={{ color: LACAVA.tinta }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: j.color }} />
                {fmtDiaSemana(j.dia)}
                {totalVendidas > 0 && (
                  <span className="font-normal" style={{ color: LACAVA.tintaSuave }}>
                    {Math.round((j.vendidas / totalVendidas) * 100)}%
                  </span>
                )}
              </span>
              <span
                className="text-right font-sans text-sm tabular-nums"
                style={{ color: LACAVA.tinta }}
              >
                ${compacto.format(Math.round(j.venta))}
              </span>
              <span
                className="col-span-2 pl-4 font-sans text-xs tabular-nums"
                style={{ color: LACAVA.tintaSuave }}
              >
                {entero.format(j.vendidas)}
                {obj > 0 && ` / ${entero.format(obj)} · ${pctAvance(j.vendidas / obj)}% del sold out`}
                {obj === 0 && " entradas"}
              </span>
            </li>
          );
        })}
      </ul>

      <div
        className="grid grid-cols-[1fr_auto] gap-x-3 border-t px-2 pt-3 font-sans text-sm"
        style={{ borderColor: LACAVA.borde, color: LACAVA.tinta }}
      >
        <span className="font-medium">Total</span>
        <span className="text-right font-medium tabular-nums">
          ${compacto.format(Math.round(totalVenta))}
        </span>
        <span className="col-span-2 text-xs tabular-nums" style={{ color: LACAVA.tintaSuave }}>
          {objetivoTotal > 0
            ? `${entero.format(vendidasTope)} / ${entero.format(objetivoTotal)} · ${pctAvance(vendidasTope / objetivoTotal)}% del sold out`
            : `${entero.format(totalVendidas)} entradas`}
        </span>
      </div>

      {reasignadas > 0 && (
        <p className="font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
          Incluye {entero.format(reasignadas)} entradas compradas antes del cambio de
          fecha, asignadas a su jornada equivalente.
        </p>
      )}
    </aside>
  );
}

/**
 * Etiqueta del sold out: arriba de la línea, junto al punto final (a la
 * izquierda la tapaba la barra del día de apertura). El halo blanco la
 * despeja de la línea de "hoy", que en pantallas angostas la cruza.
 */
function EtiquetaSoldOut({
  viewBox,
  texto,
}: {
  viewBox?: { x?: number; y?: number; width?: number };
  texto: string;
}) {
  if (viewBox?.x == null || viewBox.y == null) return null;
  return (
    <text
      x={viewBox.x + (viewBox.width ?? 0) - 14}
      y={viewBox.y - 8}
      textAnchor="end"
      fontFamily="var(--font-sans)"
      fontSize={11}
      fontWeight={500}
      fill={LACAVA.tintaSuave}
      stroke="#FFFFFF"
      strokeWidth={4}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {texto}
    </text>
  );
}

function Leyenda({
  forma,
  color,
  opacidad = 1,
  label,
}: {
  /** Muestra con la misma forma que la marca del gráfico. */
  forma: "barra" | "linea" | "segmentada";
  color: string;
  opacidad?: number;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1.5 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
      {forma === "barra" ? (
        <span
          className="h-2.5 w-2 rounded-[2px]"
          style={{ backgroundColor: color, opacity: opacidad }}
        />
      ) : (
        <span
          className="w-4"
          style={{ borderTop: `${forma === "linea" ? 2.5 : 1.5}px ${forma === "linea" ? "solid" : "dashed"} ${color}` }}
        />
      )}
      {label}
    </span>
  );
}

type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string;
};

function DiaTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string;
  payload?: TooltipEntry[];
}) {
  if (!active || !payload?.length) return null;
  const valor = (key: string) => {
    const v = payload.find((p) => p.dataKey === key)?.value;
    return typeof v === "number" ? v : null;
  };
  const filas: { label: string; v: number | null }[] = [
    { label: "Vendidas del día", v: valor("diario") },
    { label: "Acumulado", v: valor("acumulado") },
    { label: "Camino al sold out", v: valor("requerido") },
  ].filter((f) => f.v != null);
  if (filas.length === 0) return null;
  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-md"
      style={{ backgroundColor: LACAVA.cremaClara, borderColor: LACAVA.borde }}
    >
      <p className="font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
        {label ? fmtFechaCorta(label) : ""}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {filas.map((f) => (
          <li
            key={f.label}
            className="flex justify-between gap-4 font-sans text-sm"
            style={{ color: LACAVA.tinta }}
          >
            <span>{f.label}</span>
            <span className="tabular-nums">{entero.format(Math.round(f.v ?? 0))}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
