"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type OnepagerListadoTableRow = {
  eventoId: string;
  nombre: string;
  categoriaEvento: string;
  categoriaEvento2: string;
  fechaEvento: string;
  ventaTickets: number;
  ticketsComprados: number;
  ventaFfBb: number;
  ventaMarcas: number;
  asistentes: number | null;
};

type CategoriaAgg = {
  categoria: string;
  eventos: number;
  ventaTickets: number;
  ticketsComprados: number;
  ventaFfBb: number;
  ventaMarcas: number;
  asistentes: number;
  asistentesKnown: boolean;
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  // Vienen como "YYYY-MM-DD". Formato simple "DD-MM-YYYY" para legibilidad.
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

const ALL = "__all__";
const SIN_CATEGORIA = "(Sin categoría)";
const SIN_GRUPO = "(Sin grupo)";

type Mode = "eventos" | "categorias";

export default function OnepagerListadoTable({
  rows,
}: {
  rows: OnepagerListadoTableRow[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("eventos");
  const [categoria, setCategoria] = useState<string>(ALL);
  const [grupo, setGrupo] = useState<string>(ALL);

  const categorias = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.categoriaEvento) set.add(r.categoriaEvento);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [rows]);

  const grupos = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.categoriaEvento2) set.add(r.categoriaEvento2);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-CL"));
  }, [rows]);

  const filtered = useMemo(
    () =>
      categoria === ALL
        ? rows
        : rows.filter((r) => r.categoriaEvento === categoria),
    [rows, categoria],
  );

  // En modo "comparar categorías": el chip seleccionado es un CategoriaEvento2
  // (grupo amplio). El agregado por categoría se calcula sobre los eventos
  // que caen en ese grupo. Con grupo=ALL incluimos todo el dataset.
  const rowsForAgg = useMemo(
    () =>
      grupo === ALL
        ? rows
        : rows.filter((r) => (r.categoriaEvento2 || SIN_GRUPO) === grupo),
    [rows, grupo],
  );

  const aggByCategoria = useMemo<CategoriaAgg[]>(() => {
    const map = new Map<string, CategoriaAgg>();
    for (const r of rowsForAgg) {
      const key = r.categoriaEvento || SIN_CATEGORIA;
      let agg = map.get(key);
      if (!agg) {
        agg = {
          categoria: key,
          eventos: 0,
          ventaTickets: 0,
          ticketsComprados: 0,
          ventaFfBb: 0,
          ventaMarcas: 0,
          asistentes: 0,
          asistentesKnown: false,
        };
        map.set(key, agg);
      }
      agg.eventos += 1;
      agg.ventaTickets += r.ventaTickets;
      agg.ticketsComprados += r.ticketsComprados;
      agg.ventaFfBb += r.ventaFfBb;
      agg.ventaMarcas += r.ventaMarcas;
      if (r.asistentes != null) {
        agg.asistentes += r.asistentes;
        agg.asistentesKnown = true;
      }
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.ventaTickets +
        b.ventaFfBb +
        b.ventaMarcas -
        (a.ventaTickets + a.ventaFfBb + a.ventaMarcas),
    );
  }, [rowsForAgg]);

  if (rows.length === 0) {
    return (
      <p className="font-mono-data text-sm text-black/50">Sin eventos.</p>
    );
  }

  function go(eventoId: string) {
    router.push(`/onepager?event=${encodeURIComponent(eventoId)}`);
  }

  const totalTickets = filtered.reduce((a, r) => a + r.ventaTickets, 0);
  const totalCompr = filtered.reduce((a, r) => a + r.ticketsComprados, 0);
  const totalFfBb = filtered.reduce((a, r) => a + r.ventaFfBb, 0);
  const totalMarcas = filtered.reduce((a, r) => a + r.ventaMarcas, 0);
  const totalAsist = filtered.reduce((a, r) => a + (r.asistentes ?? 0), 0);

  const aggTotalTickets = aggByCategoria.reduce((a, r) => a + r.ventaTickets, 0);
  const aggTotalCompr = aggByCategoria.reduce(
    (a, r) => a + r.ticketsComprados,
    0,
  );
  const aggTotalFfBb = aggByCategoria.reduce((a, r) => a + r.ventaFfBb, 0);
  const aggTotalMarcas = aggByCategoria.reduce((a, r) => a + r.ventaMarcas, 0);
  const aggTotalAsist = aggByCategoria.reduce((a, r) => a + r.asistentes, 0);
  const aggTotalEventos = aggByCategoria.reduce((a, r) => a + r.eventos, 0);

  const compareActive = mode === "categorias";

  return (
    <div className="space-y-4">
      {/* Header con toggle de modo + filtros de categoría (sólo en modo eventos) */}
      <div className="flex flex-wrap items-center gap-2">
        {mode === "eventos" ? (
          <>
            <span className="font-mono-data uppercase text-[10px] text-black/70 mr-1">
              Categoría
            </span>
            <button
              type="button"
              onClick={() => setCategoria(ALL)}
              className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                categoria === ALL
                  ? "bg-black text-[#FFFF00]"
                  : "bg-white text-black hover:bg-[#FFFF00]"
              }`}
            >
              Todas
            </button>
            {categorias.map((c) => {
              const active = categoria === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                    active
                      ? "bg-black text-[#FFFF00]"
                      : "bg-white text-black hover:bg-[#FFFF00]"
                  }`}
                >
                  {c}
                </button>
              );
            })}
            <span className="font-mono-data uppercase text-[10px] text-black/70">
              {filtered.length} de {rows.length} evento
              {rows.length === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <>
            <span className="font-mono-data uppercase text-[10px] text-black/70 mr-1">
              Grupo
            </span>
            <button
              type="button"
              onClick={() => setGrupo(ALL)}
              className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                grupo === ALL
                  ? "bg-black text-[#FFFF00]"
                  : "bg-white text-black hover:bg-[#FFFF00]"
              }`}
            >
              Todos
            </button>
            {grupos.map((g) => {
              const active = grupo === g;
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGrupo(g)}
                  className={`font-mono-data uppercase text-xs leading-none px-3 py-2 border-2 border-black rounded-none cursor-pointer transition-colors duration-150 ${
                    active
                      ? "bg-black text-[#FFFF00]"
                      : "bg-white text-black hover:bg-[#FFFF00]"
                  }`}
                >
                  {g}
                </button>
              );
            })}
            <span className="font-mono-data uppercase text-[10px] text-black/70">
              {aggByCategoria.length} categoría
              {aggByCategoria.length === 1 ? "" : "s"} · {rowsForAgg.length} evento
              {rowsForAgg.length === 1 ? "" : "s"}
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => setMode(compareActive ? "eventos" : "categorias")}
          aria-pressed={compareActive}
          className={`ml-auto font-display uppercase text-xs leading-none px-4 py-2 border-4 border-black shadow-[4px_4px_0px_#000] cursor-pointer transition-colors duration-150 ${
            compareActive
              ? "bg-black text-[#FFFF00] hover:bg-[#FFFF00] hover:text-black"
              : "bg-white text-black hover:bg-[#FFFF00]"
          }`}
        >
          {compareActive ? "Ver eventos" : "Comparar categorías"}
        </button>
      </div>

      {mode === "eventos" ? (
        <div className="border-4 border-black bg-white overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black text-white">
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                  Evento
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                  Fecha
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Tickets
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Comprados
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  FF&BB
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Marcas
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Total
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Asistentes
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const total = r.ventaTickets + r.ventaFfBb + r.ventaMarcas;
                return (
                  <tr
                    key={r.eventoId}
                    role="link"
                    tabIndex={0}
                    aria-label={`Ver detalle de ${r.nombre || r.eventoId}`}
                    onClick={() => go(r.eventoId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        go(r.eventoId);
                      }
                    }}
                    className="border-b-2 border-black hover:bg-[#FFFF00] focus:bg-[#FFFF00] focus:outline-none cursor-pointer transition-colors duration-150"
                  >
                    <td className="font-mono-data text-sm px-3 py-2 font-bold border-r-2 border-black">
                      {r.nombre || r.eventoId}
                    </td>
                    <td className="font-mono-data text-xs px-3 py-2 border-r-2 border-black tabular-nums">
                      {fmtFecha(r.fechaEvento)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {fmtClp(r.ventaTickets)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {r.ticketsComprados.toLocaleString("es-CL")}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {fmtClp(r.ventaFfBb)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {fmtClp(r.ventaMarcas)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(total)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">
                      {r.asistentes != null
                        ? r.asistentes.toLocaleString("es-CL")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#FFFF00]">
                <td className="font-mono-data text-sm px-3 py-2 font-bold uppercase border-r-2 border-black">
                  Total ({filtered.length} evento{filtered.length === 1 ? "" : "s"})
                </td>
                <td className="font-mono-data text-xs px-3 py-2 border-r-2 border-black" />
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(totalTickets)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {totalCompr.toLocaleString("es-CL")}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(totalFfBb)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(totalMarcas)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(totalTickets + totalFfBb + totalMarcas)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold tabular-nums">
                  {totalAsist.toLocaleString("es-CL")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border-4 border-black bg-white overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-black text-white">
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
                  Categoría
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Eventos
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Tickets
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Comprados
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  FF&BB
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Marcas
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Total
                </th>
                <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
                  Asistentes
                </th>
              </tr>
            </thead>
            <tbody>
              {aggByCategoria.map((r) => {
                const total = r.ventaTickets + r.ventaFfBb + r.ventaMarcas;
                return (
                  <tr
                    key={r.categoria}
                    className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150"
                  >
                    <td className="font-mono-data text-sm px-3 py-2 font-bold border-r-2 border-black">
                      {r.categoria}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {r.eventos.toLocaleString("es-CL")}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {fmtClp(r.ventaTickets)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {r.ticketsComprados.toLocaleString("es-CL")}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {fmtClp(r.ventaFfBb)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                      {fmtClp(r.ventaMarcas)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                      {fmtClp(total)}
                    </td>
                    <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">
                      {r.asistentesKnown
                        ? r.asistentes.toLocaleString("es-CL")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-[#FFFF00]">
                <td className="font-mono-data text-sm px-3 py-2 font-bold uppercase border-r-2 border-black">
                  Total ({aggByCategoria.length} categoría
                  {aggByCategoria.length === 1 ? "" : "s"})
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {aggTotalEventos.toLocaleString("es-CL")}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(aggTotalTickets)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {aggTotalCompr.toLocaleString("es-CL")}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(aggTotalFfBb)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(aggTotalMarcas)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
                  {fmtClp(aggTotalTickets + aggTotalFfBb + aggTotalMarcas)}
                </td>
                <td className="font-mono-data text-sm px-3 py-2 text-right font-bold tabular-nums">
                  {aggTotalAsist.toLocaleString("es-CL")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
