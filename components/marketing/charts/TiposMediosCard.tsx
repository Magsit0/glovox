"use client";

import { useMemo, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CruceTipoMedioRow, VentaPorClaveRow } from "@/lib/queries/marketing";
import BrutalCsvButton from "@/components/marketing/BrutalCsvButton";
import {
  buildCruceCsv,
  buildMediosPagoCsv,
  buildTiposTicketCsv,
  csvFilename,
} from "@/components/marketing/csvExports";
import { fmtClpCompact } from "@/lib/marketing/formato";
import {
  ETIQUETA_EJE,
  armarCruce,
  type FilasCruce,
  type MatrizCruce,
  type MedidaCruce,
} from "@/lib/marketing/cruceTiposMedios";
import { PIE_COLORS } from "./pieColors";

type Vista = "tipos" | "medios" | "cruce";

const VISTAS: { id: Vista; label: string }[] = [
  { id: "tipos", label: "Tipos de ticket" },
  { id: "medios", label: "Medios de pago" },
  { id: "cruce", label: "Cruce" },
];

/** Cuántas porciones llevan color propio; el resto va junto en "Otros". */
const TOP = 7;
const COLOR_OTROS = "#FFFFFF";

const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const pct = (parte: number, total: number) => (total > 0 ? `${((parte / total) * 100).toFixed(1)}%` : "—");

type Porcion = { nombre: string; valor: number; color: string };

/**
 * "Tipos de ticket y medios de pago": la card de /lacava llevada a todos los
 * eventos, con el look de esta página. Tres vistas:
 *  - Tipos de ticket: torta (7 principales + "Otros") y tabla, en personas
 *    (como el KPI "Personas").
 *  - Medios de pago: lo mismo en venta neta (como "Venta Tickets").
 *  - Cruce: matriz tipo de ticket × medio de pago, con filas y columnas
 *    intercambiables y la medida a elección; sombreado según el valor.
 * Las tres salen de las mismas filas (getTiposYMedios), así siempre suman igual.
 */
export default function TiposMediosCard({
  tipos,
  medios,
  cruce,
  eventoId,
}: {
  tipos: VentaPorClaveRow[];
  medios: VentaPorClaveRow[];
  cruce: CruceTipoMedioRow[];
  eventoId: string;
}) {
  const [vista, setVista] = useState<Vista>("tipos");
  // Vista "Cruce": vive aquí para que el CSV descargue lo que se ve.
  const [filasSon, setFilasSon] = useState<FilasCruce>("tipos");
  const [medida, setMedida] = useState<MedidaCruce>("personas");
  const matriz = useMemo(() => armarCruce(cruce, filasSon, medida), [cruce, filasSon, medida]);

  const columnasSon: FilasCruce = filasSon === "tipos" ? "medios" : "tipos";
  const ayuda =
    vista === "tipos"
      ? "Personas por tipo de ticket (solo venta; sin cortesías ni devoluciones)."
      : vista === "medios"
        ? "Venta neta por medio de pago (sin cargo por servicio; sin cortesías ni devoluciones)."
        : `${medida === "personas" ? "Personas" : "Venta neta"} por ${ETIQUETA_EJE[filasSon].toLowerCase()} (filas) y ${ETIQUETA_EJE[columnasSon].toLowerCase()} (columnas). Más amarillo = más alto.`;

  const csv = {
    tipos: {
      nombre: "tipos-de-ticket",
      contexto: "Tipos de ticket",
      build: () => buildTiposTicketCsv(tipos),
    },
    medios: {
      nombre: "medios-de-pago",
      contexto: "Medios de pago",
      build: () => buildMediosPagoCsv(medios),
    },
    cruce: {
      nombre: `cruce-${filasSon === "tipos" ? "tipo-por-medio" : "medio-por-tipo"}-${medida}`,
      contexto: "Cruce tipo de ticket × medio de pago",
      build: () => buildCruceCsv(matriz, filasSon, medida),
    },
  }[vista];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pr-1">
        <Segmentos
          etiqueta="Vista de tipos de ticket y medios de pago"
          opciones={VISTAS}
          valor={vista}
          onChange={setVista}
        />
        <BrutalCsvButton
          filename={() => csvFilename(csv.nombre, eventoId)}
          build={csv.build}
          context={csv.contexto}
          disabled={cruce.length === 0}
        />
      </div>
      <p className="font-mono-data text-xs text-black/60">{ayuda}</p>

      {cruce.length === 0 ? (
        <p className="font-mono-data text-sm text-black/50">Sin ventas para este evento.</p>
      ) : vista === "cruce" ? (
        <VistaCruce
          matriz={matriz}
          filasSon={filasSon}
          medida={medida}
          onInvertir={() => setFilasSon(columnasSon)}
          onMedida={setMedida}
        />
      ) : (
        <VistaTorta key={vista} filas={vista === "tipos" ? tipos : medios} esTipos={vista === "tipos"} />
      )}
    </div>
  );
}

// ---------- Tipos / Medios: torta + tabla ----------

function VistaTorta({ filas, esTipos }: { filas: VentaPorClaveRow[]; esTipos: boolean }) {
  const valor = (r: VentaPorClaveRow) => (esTipos ? r.personas : r.venta);
  const total = filas.reduce((acc, r) => acc + valor(r), 0);

  const porciones: Porcion[] = filas
    .slice(0, TOP)
    .map((r, i) => ({ nombre: r.clave, valor: valor(r), color: PIE_COLORS[i % PIE_COLORS.length] }));
  const resto = filas.slice(TOP);
  if (resto.length > 0) {
    porciones.push({
      nombre: `Otros (${resto.length})`,
      valor: resto.reduce((acc, r) => acc + valor(r), 0),
      color: COLOR_OTROS,
    });
  }
  const visibles = porciones.filter((p) => p.valor > 0);
  const fmtValor = (v: number) => (esTipos ? `${entero.format(v)} personas` : clp.format(v));

  return (
    // The table needs more room than the donut: 2/5 vs 3/5 from lg up.
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-6 lg:items-start">
      <div className="space-y-4">
        <div className="relative h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visibles}
                dataKey="valor"
                nameKey="nombre"
                innerRadius="58%"
                outerRadius="92%"
                stroke="#000"
                strokeWidth={2}
              >
                {visibles.map((p) => (
                  <Cell key={p.nombre} fill={p.color} />
                ))}
              </Pie>
              <Tooltip content={<TooltipPorcion total={total} fmt={fmtValor} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl leading-none text-black">
              {esTipos ? entero.format(total) : fmtClpCompact(total)}
            </span>
            <span className="mt-1 font-mono-data text-xs uppercase text-black/60">
              {esTipos ? "personas" : "venta neta"}
            </span>
          </div>
        </div>
        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
          {visibles.map((p) => (
            <li key={p.nombre} className="flex items-center gap-1.5 font-mono-data text-xs text-black">
              <span className="h-3 w-3 shrink-0 border-2 border-black" style={{ backgroundColor: p.color }} />
              <span className="max-w-[220px] truncate" title={p.nombre}>
                {p.nombre}
              </span>
              <span className="text-black/60">· {pct(p.valor, total)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[420px]">
        <table className="w-full">
          <thead>
            <tr className="bg-black text-white">
              <Th align="left">{esTipos ? "Tipo de ticket" : "Medio de pago"}</Th>
              <Th>Tickets</Th>
              {esTipos && <Th>Personas</Th>}
              {esTipos && <Th title="% de las personas">%</Th>}
              <Th>Venta neta</Th>
              {!esTipos && <Th title="% de la venta neta">%</Th>}
              <Th title="Venta neta por ticket">Prom./ticket</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((r) => (
              <tr
                key={r.clave}
                className="border-b-2 border-black last:border-b-0 hover:bg-[#FFFF00] transition-colors duration-150"
              >
                <Td align="left">{r.clave}</Td>
                <Td>{entero.format(r.tickets)}</Td>
                {esTipos && <Td>{entero.format(r.personas)}</Td>}
                {esTipos && <Td>{pct(r.personas, total)}</Td>}
                <Td>{clp.format(r.venta)}</Td>
                {!esTipos && <Td>{pct(r.venta, total)}</Td>}
                <Td>{r.tickets > 0 ? clp.format(r.venta / r.tickets) : "—"}</Td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <TotalFila filas={filas} esTipos={esTipos} />
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function TotalFila({ filas, esTipos }: { filas: VentaPorClaveRow[]; esTipos: boolean }) {
  const tickets = filas.reduce((acc, r) => acc + r.tickets, 0);
  const personas = filas.reduce((acc, r) => acc + r.personas, 0);
  const venta = filas.reduce((acc, r) => acc + r.venta, 0);
  return (
    <tr className="bg-black text-white">
      <Td align="left" bold>
        Total
      </Td>
      <Td bold>{entero.format(tickets)}</Td>
      {esTipos && <Td bold>{entero.format(personas)}</Td>}
      {esTipos && <Td bold>100%</Td>}
      <Td bold>{clp.format(venta)}</Td>
      {!esTipos && <Td bold>100%</Td>}
      <Td bold>{tickets > 0 ? clp.format(venta / tickets) : "—"}</Td>
    </tr>
  );
}

// ---------- Cruce: matriz tipo × medio ----------

// First (row label) and Total columns stay put while the matrix scrolls
// sideways; Total is sticky only from sm up so a phone still has room for data.
const COL_ETIQUETA = "w-[140px] min-w-[140px] max-w-[140px] sm:w-[220px] sm:min-w-[220px] sm:max-w-[220px]";
const LEFT_TOTAL = "sm:left-[220px]";
const COL_TOTAL = "w-[104px] min-w-[104px]";

function VistaCruce({
  matriz,
  filasSon,
  medida,
  onInvertir,
  onMedida,
}: {
  matriz: MatrizCruce;
  filasSon: FilasCruce;
  medida: MedidaCruce;
  onInvertir: () => void;
  onMedida: (m: MedidaCruce) => void;
}) {
  const columnasSon: FilasCruce = filasSon === "tipos" ? "medios" : "tipos";
  // Compact money keeps the columns narrow; the tooltip has the exact amount.
  const fmt = (v: number) => (medida === "personas" ? entero.format(v) : fmtClpCompact(v));
  const fmtExacto = (v: number) => (medida === "personas" ? `${entero.format(v)} personas` : clp.format(v));
  // Yellow by size; sqrt so the small cells still read against the big ones.
  const fondo = (v: number) =>
    v > 0 && matriz.max > 0 ? `rgba(255, 255, 0, ${(0.15 + 0.85 * Math.sqrt(v / matriz.max)).toFixed(3)})` : undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Segmentos
          etiqueta="Medida del cruce"
          opciones={[
            { id: "personas" as const, label: "Personas" },
            { id: "venta" as const, label: "Venta neta" },
          ]}
          valor={medida}
          onChange={onMedida}
          chico
        />
        <button
          type="button"
          onClick={onInvertir}
          className="font-mono-data text-xs px-3 py-1 border-2 border-black bg-white text-black cursor-pointer transition-colors duration-150 hover:bg-[#FFFF00]"
        >
          ⇄ Invertir filas y columnas
        </button>
        <span className="font-mono-data text-xs text-black/60">
          Filas: {ETIQUETA_EJE[filasSon]} · Columnas: {ETIQUETA_EJE[columnasSon]}
        </span>
      </div>

      <div className="border-4 border-black rounded-none w-full overflow-auto max-h-[480px]">
        <table className="border-separate border-spacing-0">
          <thead>
            <tr>
              <th
                className={`font-mono-data uppercase text-xs px-3 py-3 text-left align-bottom sticky top-0 left-0 z-30 bg-black text-white border-r-2 border-white ${COL_ETIQUETA}`}
              >
                {ETIQUETA_EJE[filasSon]}
              </th>
              <th
                className={`font-mono-data uppercase text-xs px-3 py-3 text-right align-bottom sticky top-0 ${LEFT_TOTAL} z-20 sm:z-30 bg-black text-white border-r-2 border-white ${COL_TOTAL}`}
              >
                Total
              </th>
              {matriz.columnas.map((c) => (
                <th
                  key={c.clave}
                  title={c.clave}
                  className="font-mono-data text-[10px] uppercase leading-tight px-3 py-3 text-right align-bottom sticky top-0 z-20 bg-black text-white min-w-[96px] max-w-[140px] break-words"
                >
                  {c.clave}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matriz.filas.map((f) => (
              <tr key={f.clave}>
                <td
                  title={f.clave}
                  className={`font-mono-data text-xs px-3 py-2 sticky left-0 z-10 bg-white border-b-2 border-r-2 border-black ${COL_ETIQUETA}`}
                >
                  <span className="line-clamp-2">{f.clave}</span>
                </td>
                <td
                  className={`font-mono-data text-sm font-bold px-3 py-2 text-right tabular-nums whitespace-nowrap bg-white border-b-2 border-r-2 border-black sm:sticky ${LEFT_TOTAL} sm:z-10 ${COL_TOTAL}`}
                >
                  {fmt(f.total)}
                </td>
                {matriz.columnas.map((c) => {
                  const v = f.celdas.get(c.clave) ?? 0;
                  return (
                    <td
                      key={c.clave}
                      title={
                        v > 0
                          ? `${f.clave} · ${c.clave}: ${fmtExacto(v)} (${pct(v, f.total)} de la fila)`
                          : undefined
                      }
                      className="font-mono-data text-sm px-3 py-2 text-right tabular-nums whitespace-nowrap border-b-2 border-black/15"
                      style={{ backgroundColor: fondo(v) }}
                    >
                      {v > 0 ? fmt(v) : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td
                className={`font-mono-data uppercase text-xs font-bold px-3 py-3 sticky bottom-0 left-0 z-30 bg-black text-white border-r-2 border-white ${COL_ETIQUETA}`}
              >
                Total
              </td>
              <td
                className={`font-mono-data text-sm font-bold px-3 py-3 text-right tabular-nums whitespace-nowrap sticky bottom-0 ${LEFT_TOTAL} z-20 sm:z-30 bg-black text-white border-r-2 border-white ${COL_TOTAL}`}
              >
                {fmt(matriz.total)}
              </td>
              {matriz.columnas.map((c) => (
                <td
                  key={c.clave}
                  className="font-mono-data text-sm font-bold px-3 py-3 text-right tabular-nums whitespace-nowrap sticky bottom-0 z-20 bg-black text-white"
                >
                  {fmt(c.total)}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ---------- Piezas compartidas ----------

function Segmentos<T extends string>({
  etiqueta,
  opciones,
  valor,
  onChange,
  chico,
}: {
  etiqueta: string;
  opciones: { id: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  chico?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={etiqueta}
      className={`flex w-fit max-w-full bg-white border-black ${
        chico ? "border-2" : "border-4 shadow-[4px_4px_0px_#000]"
      }`}
    >
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={valor === o.id}
          className={`font-mono-data text-xs px-3 whitespace-nowrap cursor-pointer transition-colors duration-150 ${
            chico ? "py-1" : "py-1.5"
          } ${valor === o.id ? "bg-black text-white" : "bg-white text-black hover:bg-[#FFFF00]"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Th({
  children,
  align = "right",
  title,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  title?: string;
}) {
  return (
    <th
      title={title}
      className={`font-mono-data uppercase text-xs px-3 py-3 sticky top-0 z-10 bg-black whitespace-nowrap ${
        align === "left" ? "text-left min-w-[160px]" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "right",
  bold,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  bold?: boolean;
}) {
  return (
    <td
      className={`font-mono-data text-sm px-3 py-2.5 ${align === "left" ? "text-left" : "text-right tabular-nums whitespace-nowrap"} ${
        bold ? "font-bold" : ""
      }`}
    >
      {children}
    </td>
  );
}

function TooltipPorcion({
  active,
  payload,
  total,
  fmt,
}: {
  active?: boolean;
  payload?: { payload: Porcion }[];
  total: number;
  fmt: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border-4 border-black px-3 py-2 font-mono-data text-xs text-black">
      <p className="font-bold">{p.nombre}</p>
      <p>
        {fmt(p.valor)} · {pct(p.valor, total)}
      </p>
    </div>
  );
}
