"use client";

import { Fragment, useState, useMemo } from "react";
import type { SalesOriginDayRow } from "@/lib/queries/marketing";
import {
  ORIGIN_CATEGORY_MAP as CATEGORY_MAP,
  categorizeOrigin as categorize,
  columnasDias,
  sumarPorDia,
  sumByOrigin,
  ticketsPorDia,
  type TicketsPorDia,
} from "@/components/marketing/salesOriginCategories";
import {
  buildSalesOriginByDayCsv,
  buildSalesOriginCsv,
  csvFilename,
} from "@/components/marketing/csvExports";
import BrutalCsvButton from "@/components/marketing/BrutalCsvButton";
import { fmtDiaSemana } from "@/lib/marketing/formato";

type Props = {
  // Una fila por origen × día; los totales por origen se suman aquí.
  data: SalesOriginDayRow[];
  eventoId?: string; // solo para el nombre del archivo CSV
};

type Vista = "total" | "dia";

type GroupEntry = {
  type: "group";
  prefix: string;
  label: string;
  tickets: number;
  pct: number;
  porDia: TicketsPorDia;
  children: { origin: string; tickets: number; pct: number; porDia: TicketsPorDia }[];
};

type SingleEntry = {
  type: "single";
  origin: string;
  tickets: number;
  pct: number;
  porDia: TicketsPorDia;
};

type Entry = GroupEntry | SingleEntry;

export default function SalesOriginTable({ data, eventoId }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [vista, setVista] = useState<Vista>("total");

  const totales = useMemo(() => sumByOrigin(data), [data]);
  const totalTickets = totales.reduce((sum, r) => sum + r.tickets, 0);

  const entries: Entry[] = useMemo(() => {
    const porOrigen = ticketsPorDia(data);
    const pctDe = (tickets: number) => (totalTickets > 0 ? Math.round((tickets / totalTickets) * 100) : 0);
    const catMap = new Map<string, typeof totales>();
    const ungrouped: typeof totales = [];

    for (const row of totales) {
      const cat = categorize(row.origin);
      if (cat) {
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push(row);
      } else {
        ungrouped.push(row);
      }
    }

    const all: Entry[] = [];

    for (const [prefix, rows] of catMap) {
      const catTickets = rows.reduce((s, r) => s + r.tickets, 0);
      all.push({
        type: "group",
        prefix,
        label: CATEGORY_MAP[prefix],
        tickets: catTickets,
        pct: pctDe(catTickets),
        porDia: sumarPorDia(rows.map((r) => porOrigen.get(r.origin) ?? new Map())),
        children: rows
          .sort((a, b) => b.tickets - a.tickets)
          .map((r) => ({
            origin: r.origin,
            tickets: r.tickets,
            pct: pctDe(r.tickets),
            porDia: porOrigen.get(r.origin) ?? new Map(),
          })),
      });
    }

    for (const row of ungrouped) {
      all.push({
        type: "single",
        origin: row.origin,
        tickets: row.tickets,
        pct: pctDe(row.tickets),
        porDia: porOrigen.get(row.origin) ?? new Map(),
      });
    }

    all.sort((a, b) => b.tickets - a.tickets);
    return all;
  }, [data, totales, totalTickets]);

  function toggle(prefix: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }

  const porDia = vista === "dia";

  return (
    <div className="space-y-3">
      {/* Fuera del área con scroll para que los controles siempre queden visibles.
          pr-1: la sombra dura del botón no sobresale del borde de la tabla. */}
      <div className="flex flex-wrap items-center justify-between gap-3 pr-1">
        <VistaToggle vista={vista} onChange={setVista} />
        <BrutalCsvButton
          filename={() => csvFilename(porDia ? "origen-venta-por-dia" : "origen-venta", eventoId)}
          build={() => (porDia ? buildSalesOriginByDayCsv(data) : buildSalesOriginCsv(totales))}
          context={porDia ? "Origen de Venta por día" : "Origen de Venta"}
          disabled={data.length === 0}
        />
      </div>
      {porDia ? (
        <MatrizPorDia
          data={data}
          entries={entries}
          expanded={expanded}
          onToggle={toggle}
          totalTickets={totalTickets}
        />
      ) : (
        <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[420px]">
          <table className="w-full">
            <thead>
              {/* Sticky header so column titles stay visible while the body scrolls. */}
              <tr className="bg-black text-white">
                <th className="font-mono-data uppercase text-xs px-4 py-3 text-left sticky top-0 z-10 bg-black">Origen</th>
                <th className="font-mono-data uppercase text-xs px-4 py-3 text-right sticky top-0 z-10 bg-black">Tickets</th>
                <th className="font-mono-data uppercase text-xs px-4 py-3 text-right sticky top-0 z-10 bg-black">%</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, i) =>
                entry.type === "single" ? (
                  <tr
                    key={`single-${entry.origin}-${i}`}
                    className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150"
                  >
                    <td className="font-mono-data text-sm px-4 py-3">{entry.origin || "(directo)"}</td>
                    <td className="font-mono-data text-sm px-4 py-3 text-right">
                      {entry.tickets.toLocaleString("es-CL")}
                    </td>
                    <td className="font-mono-data text-sm px-4 py-3 text-right">{entry.pct}%</td>
                  </tr>
                ) : (
                  <GroupRow
                    key={`group-${entry.prefix}`}
                    group={entry}
                    isExpanded={expanded.has(entry.prefix)}
                    onToggle={() => toggle(entry.prefix)}
                  />
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const VISTAS: { id: Vista; label: string; title: string }[] = [
  { id: "total", label: "Total", title: "Una fila por origen con su total." },
  { id: "dia", label: "Por día", title: "Matriz: una columna por día de venta. Desplázate hacia la derecha para recorrer los días." },
];

/** «Total | Por día», con el mismo lenguaje que el selector del Funnel. Solo cambia la vista: los datos ya están cargados. */
function VistaToggle({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  return (
    <div
      role="group"
      aria-label="Vista de Origen de Venta"
      className="flex w-fit max-w-full border-4 border-black shadow-[4px_4px_0px_#000] bg-white"
    >
      {VISTAS.map((v) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onChange(v.id)}
          aria-pressed={vista === v.id}
          title={v.title}
          className={`font-mono-data text-xs px-3 py-1.5 whitespace-nowrap cursor-pointer transition-colors duration-150 ${
            vista === v.id ? "bg-black text-white" : "bg-white text-black hover:bg-[#FFFF00]"
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

function GroupRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: GroupEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b-2 border-black cursor-pointer hover:bg-[#FFFF00] transition-colors duration-150"
      >
        <td className="font-mono-data text-sm px-4 py-3 font-bold">
          <span className="mr-2">{isExpanded ? "▼" : "▶"}</span>
          {group.label}
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">
          {group.tickets.toLocaleString("es-CL")}
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{group.pct}%</td>
      </tr>
      {isExpanded &&
        group.children.map((child, i) => (
          <tr
            key={`${group.prefix}-child-${child.origin}-${i}`}
            className="border-b border-black/30 bg-black/5 transition-colors duration-150"
          >
            <td className="font-mono-data text-xs px-4 py-2 pl-10 text-black/60">{child.origin}</td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">
              {child.tickets.toLocaleString("es-CL")}
            </td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">{child.pct}%</td>
          </tr>
        ))}
    </>
  );
}

// Matriz por día. Origen y Total quedan fijos a la izquierda (sticky) mientras
// los días se recorren hacia la derecha; la fila Total queda fija abajo. La
// tabla va con bordes por celda (border-separate): con border-collapse los
// bordes de las celdas fijas se quedan atrás al desplazar.
// En celular solo Origen queda fijo (y más angosto): con Total también fijo no
// quedaba ancho para ver ningún día.
const COL_ORIGEN = "w-[120px] min-w-[120px] max-w-[120px] sm:w-[240px] sm:min-w-[240px] sm:max-w-[240px]";
const LEFT_TOTAL = "sm:left-[240px]";
const COL_TOTAL = "w-[96px] min-w-[96px]";
// Fondo opaco de las filas hijas (= negro al 5% sobre blanco): las celdas fijas
// no pueden ser translúcidas o se verían los días pasando por debajo.
const BG_HIJO = "bg-[#F2F2F2]";

const fmtCelda = (v: number | undefined) => (v ? v.toLocaleString("es-CL") : "");

function MatrizPorDia({
  data,
  entries,
  expanded,
  onToggle,
  totalTickets,
}: {
  data: SalesOriginDayRow[];
  entries: Entry[];
  expanded: Set<string>;
  onToggle: (prefix: string) => void;
  totalTickets: number;
}) {
  const dias = useMemo(() => columnasDias(data), [data]);
  const totalPorDia = useMemo(() => sumarPorDia(entries.map((e) => e.porDia)), [entries]);

  return (
    <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[420px]">
      <table className="border-separate border-spacing-0">
        <thead>
          <tr>
            <th
              className={`font-mono-data uppercase text-xs px-4 py-3 text-left sticky top-0 left-0 z-30 bg-black text-white ${COL_ORIGEN}`}
            >
              Origen
            </th>
            <th
              className={`font-mono-data uppercase text-xs px-4 py-3 text-right sticky top-0 ${LEFT_TOTAL} z-20 sm:z-30 bg-black text-white border-r-2 border-white ${COL_TOTAL}`}
            >
              Total
            </th>
            {dias.map((d) => {
              const [semana, ...fecha] = d ? fmtDiaSemana(d).split(" ") : ["", "Sin fecha"];
              return (
                <th
                  key={d ?? "sin-fecha"}
                  className="font-mono-data text-xs px-3 py-2 text-right sticky top-0 z-20 bg-black text-white min-w-[68px] whitespace-nowrap"
                >
                  <span className="block text-[10px] uppercase opacity-70">{semana}</span>
                  {fecha.join(" ")}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, i) =>
            entry.type === "single" ? (
              <FilaMatriz
                key={`single-${entry.origin}-${i}`}
                label={entry.origin || "(directo)"}
                tickets={entry.tickets}
                porDia={entry.porDia}
                dias={dias}
              />
            ) : (
              <Fragment key={`group-${entry.prefix}`}>
                <FilaMatriz
                  label={entry.label}
                  tickets={entry.tickets}
                  porDia={entry.porDia}
                  dias={dias}
                  grupo={{ abierto: expanded.has(entry.prefix), onToggle: () => onToggle(entry.prefix) }}
                />
                {expanded.has(entry.prefix) &&
                  entry.children.map((child, j) => (
                    <FilaMatriz
                      key={`${entry.prefix}-child-${child.origin}-${j}`}
                      label={child.origin}
                      tickets={child.tickets}
                      porDia={child.porDia}
                      dias={dias}
                      hijo
                    />
                  ))}
              </Fragment>
            )
          )}
        </tbody>
        <tfoot>
          <tr>
            <td
              className={`font-mono-data uppercase text-xs font-bold px-4 py-3 sticky bottom-0 left-0 z-30 bg-black text-white ${COL_ORIGEN}`}
            >
              Total
            </td>
            <td
              className={`font-mono-data text-sm font-bold px-4 py-3 text-right sticky bottom-0 ${LEFT_TOTAL} z-20 sm:z-30 bg-black text-white border-r-2 border-white ${COL_TOTAL}`}
            >
              {totalTickets.toLocaleString("es-CL")}
            </td>
            {dias.map((d) => (
              <td
                key={d ?? "sin-fecha"}
                className="font-mono-data text-sm font-bold px-3 py-3 text-right sticky bottom-0 z-20 bg-black text-white"
              >
                {fmtCelda(totalPorDia.get(d))}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FilaMatriz({
  label,
  tickets,
  porDia,
  dias,
  grupo,
  hijo = false,
}: {
  label: string;
  tickets: number;
  porDia: TicketsPorDia;
  dias: (string | null)[];
  grupo?: { abierto: boolean; onToggle: () => void };
  hijo?: boolean;
}) {
  // Fondo por celda (no por fila): las celdas fijas necesitan uno opaco propio,
  // y el hover amarillo tiene que pintarlas también.
  const fondo = hijo ? BG_HIJO : "bg-white group-hover:bg-[#FFFF00]";
  const borde = hijo ? "border-b border-black/30" : "border-b-2 border-black";
  const texto = hijo ? "text-xs py-2 text-black/60" : `text-sm py-3${grupo ? " font-bold" : ""}`;
  return (
    <tr
      onClick={grupo?.onToggle}
      className={`group transition-colors duration-150${grupo ? " cursor-pointer" : ""}`}
    >
      <td
        title={label}
        className={`font-mono-data px-4 ${texto} ${borde} ${fondo} sticky left-0 z-10 truncate ${COL_ORIGEN}${hijo ? " pl-10" : ""}`}
      >
        {grupo && <span className="mr-2">{grupo.abierto ? "▼" : "▶"}</span>}
        {label}
      </td>
      <td
        className={`font-mono-data px-4 text-right ${texto} ${borde} ${fondo} sm:sticky ${LEFT_TOTAL} sm:z-10 border-r-2 border-r-black ${COL_TOTAL}`}
      >
        {tickets.toLocaleString("es-CL")}
      </td>
      {dias.map((d) => (
        <td key={d ?? "sin-fecha"} className={`font-mono-data px-3 text-right ${texto} ${borde} ${fondo}`}>
          {fmtCelda(porDia.get(d))}
        </td>
      ))}
    </tr>
  );
}
