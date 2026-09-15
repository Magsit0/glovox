"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { LaCavaTipoRow } from "@/lib/queries/lacava";
import { CLASE_COLORS, CLASE_LABELS, LACAVA, lacavaSeriesColor } from "./theme";

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
// "vie 6 nov" — el día de la semana importa: La Cava vende por jornada.
// Fechas YYYY-MM-DD parseadas como UTC: formatear en UTC evita el corrimiento
// de un día en zonas horarias negativas (Chile).
const diaFmt = new Intl.DateTimeFormat("es-CL", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function fmtDia(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return diaFmt.format(new Date(Date.UTC(y, m - 1, d)));
}

/**
 * Tickets por día del evento: donut con las personas emitidas para cada
 * jornada (cada ticket vale para un día específico) y tabla por día × tipo ×
 * clase. Los devueltos ya vienen excluidos de la query.
 */
export default function TiposTicketCard({ tipos }: { tipos: LaCavaTipoRow[] }) {
  const totalPersonas = tipos.reduce((acc, t) => acc + t.personas, 0);

  // Personas por día del evento, en orden cronológico. El color de cada día se
  // fija por índice y se reutiliza en donut, leyenda y tabla.
  const porDia = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tipos) map.set(t.diaEvento, (map.get(t.diaEvento) ?? 0) + t.personas);
    return [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([dia, personas], i) => ({
        dia,
        label: fmtDia(dia),
        personas,
        color: lacavaSeriesColor(i),
      }));
  }, [tipos]);
  const colorByDia = new Map(porDia.map((d) => [d.dia, d.color]));

  const filas = useMemo(
    () =>
      [...tipos].sort(
        (a, b) => a.diaEvento.localeCompare(b.diaEvento) || b.personas - a.personas,
      ),
    [tipos],
  );

  if (tipos.length === 0) {
    return (
      <p className="font-sans text-sm" style={{ color: LACAVA.tintaSutil }}>
        Sin tickets emitidos para esta edición.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={porDia}
              dataKey="personas"
              nameKey="label"
              innerRadius="62%"
              outerRadius="90%"
              stroke="none"
              isAnimationActive={false}
            >
              {porDia.map((d) => (
                <Cell key={d.dia} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip total={totalPersonas} />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-lacava text-3xl font-bold leading-none"
            style={{ color: LACAVA.tinta }}
          >
            {entero.format(totalPersonas)}
          </span>
          <span className="mt-1 font-sans text-xs" style={{ color: LACAVA.tintaSuave }}>
            personas emitidas
          </span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4">
        {porDia.map((d) => (
          <span
            key={d.dia}
            className="flex items-center gap-1.5 font-sans text-xs"
            style={{ color: LACAVA.tintaSuave }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.label} · {entero.format(d.personas)}
            {totalPersonas > 0 &&
              ` (${Math.round((d.personas / totalPersonas) * 100)}%)`}
          </span>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: LACAVA.borde }}>
        <table className="w-full border-collapse">
          <thead style={{ backgroundColor: LACAVA.crema }}>
            <tr className="border-b" style={{ borderColor: LACAVA.borde }}>
              <Th align="left">Día</Th>
              <Th align="left">Tipo</Th>
              <Th align="left">Clase</Th>
              <Th align="right">Personas</Th>
              <Th align="right">Venta neta</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((t) => (
              <tr
                key={`${t.diaEvento}-${t.tipoTicket}-${t.clase}`}
                className="border-b last:border-b-0"
                style={{ borderColor: LACAVA.borde }}
              >
                <Td align="left">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colorByDia.get(t.diaEvento) ?? LACAVA.tintaSutil }}
                    />
                    {fmtDia(t.diaEvento)}
                  </span>
                </Td>
                <Td align="left">{t.tipoTicket}</Td>
                <Td align="left">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full border bg-white px-2.5 py-0.5 font-sans text-xs font-medium"
                    style={{ borderColor: LACAVA.borde, color: LACAVA.tinta }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: CLASE_COLORS[t.clase] ?? LACAVA.tintaSutil }}
                    />
                    {CLASE_LABELS[t.clase] ?? t.clase}
                  </span>
                </Td>
                <Td align="right">{entero.format(t.personas)}</Td>
                <Td align="right">{t.venta > 0 ? clp.format(t.venta) : "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <th
      className={`px-4 py-3 font-sans text-xs font-medium ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: LACAVA.tintaSuave }}
    >
      {children}
    </th>
  );
}

function Td({ align, children }: { align: "left" | "right"; children: React.ReactNode }) {
  return (
    <td
      className={`px-4 py-3 font-sans text-sm tabular-nums ${align === "right" ? "text-right" : "text-left"}`}
      style={{ color: LACAVA.tinta }}
    >
      {children}
    </td>
  );
}

function DonutTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name?: string | number; value?: number | string }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const value = typeof p.value === "number" ? p.value : Number(p.value);
  return (
    <div
      className="rounded-lg border px-3 py-2 font-sans text-sm shadow-md"
      style={{
        backgroundColor: LACAVA.cremaClara,
        borderColor: LACAVA.borde,
        color: LACAVA.tinta,
      }}
    >
      {String(p.name)} · {entero.format(value)} personas
      {total > 0 && ` (${Math.round((value / total) * 100)}%)`}
    </div>
  );
}
