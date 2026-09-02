"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/components/proveedor/csv";
import type {
  OnepagerCostosEvento,
  OnepagerGastoRow,
} from "@/lib/queries/onepagerCostos";
import BrutalChartPanel from "./BrutalChartPanel";
import MultiFilter from "./MultiFilter";

type Props = {
  eventoId: string;
  costos: OnepagerCostosEvento;
};

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

function fmtFecha(iso: string): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return Array.from(new Set(values))
    .filter((v) => v.length > 0)
    .sort((a, b) => a.localeCompare(b, "es-CL"));
}

function inSet(set: Set<string>, value: string): boolean {
  return set.size === 0 || set.has(value);
}

// Etiqueta de negocio para el filtro (el id evita colisiones de referencia).
function negocioKey(g: OnepagerGastoRow): string {
  return `${g.negocioId} · ${g.referenciaNegocio || "Sin referencia"}`;
}

const TH =
  "bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3";
const TD = "font-sans text-sm px-4 py-3";

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="border border-[#E5E5E5] rounded-lg p-4 min-w-0">
      <p className="font-sans text-xs text-[#666666] truncate">{label}</p>
      <p
        className="font-display font-bold text-xl leading-none text-[#333333] mt-2 truncate tracking-tight"
        title={value}
      >
        {value}
      </p>
      {hint && (
        <p className="font-sans text-xs text-[#999999] mt-2 truncate" title={hint}>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * Pestaña "Costos" del one-pager: gasto documentado en Unabase para los
 * negocios del evento (marts.finanzas_gastos vía lib/queries/onepagerCostos).
 * Todas las cifras principales son NETAS (sin IVA); el bruto se muestra al lado.
 */
export default function CostosTab({ eventoId, costos }: Props) {
  const { resumen, negocios, porCategoria, gastos } = costos;
  const [proveedores, setProveedores] = useState<Set<string>>(new Set());
  const [categorias, setCategorias] = useState<Set<string>>(new Set());
  const [negociosSel, setNegociosSel] = useState<Set<string>>(new Set());

  const proveedoresOpts = useMemo(
    () => uniqueSorted(gastos.map((g) => g.proveedor)),
    [gastos],
  );
  const categoriasOpts = useMemo(
    () => uniqueSorted(gastos.map((g) => g.categoriaOficial)),
    [gastos],
  );
  const negociosOpts = useMemo(
    () => uniqueSorted(gastos.map(negocioKey)),
    [gastos],
  );

  const filtered = useMemo(
    () =>
      gastos.filter(
        (g) =>
          inSet(proveedores, g.proveedor) &&
          inSet(categorias, g.categoriaOficial) &&
          inSet(negociosSel, negocioKey(g)),
      ),
    [gastos, proveedores, categorias, negociosSel],
  );

  const multiNegocio = negocios.length > 1;
  const hasActiveFilter =
    proveedores.size > 0 || categorias.size > 0 || negociosSel.size > 0;

  if (gastos.length === 0) {
    return (
      <BrutalChartPanel title="Costos">
        <p className="font-sans text-sm text-[#999999]">
          Sin costos documentados en Unabase para este evento (no hay negocio
          vigente con gastos asociados al EventoID).
        </p>
      </BrutalChartPanel>
    );
  }

  const totalNeto = filtered.reduce((a, g) => a + g.gastoNeto, 0);
  const totalIva = filtered.reduce((a, g) => a + g.gastoIva, 0);
  const totalBruto = filtered.reduce((a, g) => a + g.gastoBruto, 0);
  const maxCategoria = porCategoria.reduce(
    (m, c) => (c.gastoNeto > m ? c.gastoNeto : m),
    0,
  );

  function handleDownload() {
    downloadCsv(
      `costos-${eventoId}`,
      [
        "Fecha",
        "Folio",
        "Nº doc",
        "Proveedor",
        "RUT",
        "Negocio",
        "Categoría oficial",
        "Subcategoría",
        "Ítem",
        "Descripción",
        "Neto",
        "IVA",
        "Bruto",
        "Estado",
        "Pagado",
      ],
      filtered.map((g) => [
        g.fecha,
        g.folio,
        g.nroDoc,
        g.proveedor,
        g.proveedorRut,
        g.referenciaNegocio,
        g.categoriaOficial,
        g.subcategoriaOficial,
        g.itemNombre,
        g.descripcion,
        Math.round(g.gastoNeto),
        Math.round(g.gastoIva),
        Math.round(g.gastoBruto),
        g.estado,
        g.pagoRealizado == null ? "" : g.pagoRealizado ? "Sí" : "No",
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <BrutalChartPanel title="Costos — Resumen">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tile
            label="Costo neto"
            value={fmtClp(resumen.gastoNeto)}
            hint="Sin IVA · base de todas las cifras de costo"
          />
          <Tile
            label="IVA y otros impuestos"
            value={fmtClp(resumen.gastoIva + resumen.gastoOtrosImpuestos)}
            hint="Incluido en el bruto"
          />
          <Tile
            label="Costo bruto"
            value={fmtClp(resumen.gastoBruto)}
            hint="Desembolso total con impuestos"
          />
          <Tile
            label="Líneas de gasto"
            value={resumen.lineas.toLocaleString("es-CL")}
            hint={`${negocios.length} negocio${negocios.length === 1 ? "" : "s"} en Unabase`}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs text-[#666666]">
            Negocio{multiNegocio ? "s" : ""} Unabase
          </span>
          {negocios.map((ng) => (
            <span
              key={ng.negocioId}
              title={`${ng.referencia} · ${ng.areaNegocio} · ${ng.estado} · ${fmtClp(ng.gastoNeto)} neto`}
              className="inline-flex items-center gap-1.5 max-w-full rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]"
            >
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F99F8]" />
              <span className="truncate">
                {ng.negocioId} · {ng.referencia || "Sin referencia"}
              </span>
              {multiNegocio && (
                <span className="shrink-0 text-[#666666] tabular-nums">
                  {fmtClp(ng.gastoNeto)}
                </span>
              )}
            </span>
          ))}
        </div>
      </BrutalChartPanel>

      <BrutalChartPanel title="Costos — Por categoría">
        <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                <th className={`${TH} text-left`}>Categoría oficial</th>
                <th className={`${TH} text-left w-[28%]`}>
                  <span className="sr-only">Participación</span>
                </th>
                <th className={`${TH} text-right`}>Neto</th>
                <th className={`${TH} text-right`}>Bruto</th>
                <th className={`${TH} text-right`}>% del neto</th>
                <th className={`${TH} text-right`}>Líneas</th>
              </tr>
            </thead>
            <tbody>
              {porCategoria.map((c) => {
                const pct =
                  resumen.gastoNeto > 0 ? (c.gastoNeto / resumen.gastoNeto) * 100 : 0;
                const w =
                  maxCategoria > 0
                    ? Math.max(0, Math.min(100, (c.gastoNeto / maxCategoria) * 100))
                    : 0;
                return (
                  <tr
                    key={c.categoria}
                    className="border-b border-[#E5E5E5] last:border-b-0 hover:bg-[#FAFAFA] transition-colors duration-150"
                  >
                    <td className={`${TD} text-[#333333] font-medium`}>{c.categoria}</td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full rounded-full bg-[#F0F0F0] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#9F99F8]"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                    </td>
                    <td className={`${TD} text-[#333333] text-right tabular-nums`}>
                      {fmtClp(c.gastoNeto)}
                    </td>
                    <td className={`${TD} text-[#666666] text-right tabular-nums`}>
                      {fmtClp(c.gastoBruto)}
                    </td>
                    <td className={`${TD} text-[#666666] text-right tabular-nums`}>
                      {pct.toFixed(1)}%
                    </td>
                    <td className={`${TD} text-[#666666] text-right tabular-nums`}>
                      {c.lineas.toLocaleString("es-CL")}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
                <td className={`${TD} text-[#333333] font-semibold`}>
                  Total ({porCategoria.length} categoría
                  {porCategoria.length === 1 ? "" : "s"})
                </td>
                <td className="px-4 py-3" />
                <td className={`${TD} text-[#333333] text-right font-semibold tabular-nums`}>
                  {fmtClp(resumen.gastoNeto)}
                </td>
                <td className={`${TD} text-[#333333] text-right font-semibold tabular-nums`}>
                  {fmtClp(resumen.gastoBruto)}
                </td>
                <td className={`${TD} text-[#666666] text-right tabular-nums`}>100%</td>
                <td className={`${TD} text-[#333333] text-right font-semibold tabular-nums`}>
                  {resumen.lineas.toLocaleString("es-CL")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </BrutalChartPanel>

      <BrutalChartPanel title="Costos — Documentos de gasto">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <MultiFilter
              label="Proveedor"
              selected={proveedores}
              onChange={setProveedores}
              options={proveedoresOpts}
              searchPlaceholder="Buscar proveedor…"
            />
            <MultiFilter
              label="Categoría"
              selected={categorias}
              onChange={setCategorias}
              options={categoriasOpts}
              searchPlaceholder="Buscar categoría…"
            />
            {multiNegocio && (
              <MultiFilter
                label="Negocio"
                selected={negociosSel}
                onChange={setNegociosSel}
                options={negociosOpts}
                searchPlaceholder="Buscar negocio…"
              />
            )}
            {hasActiveFilter && (
              <button
                type="button"
                onClick={() => {
                  setProveedores(new Set());
                  setCategorias(new Set());
                  setNegociosSel(new Set());
                }}
                className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
            <span className="font-sans text-xs text-[#666666]">
              {hasActiveFilter
                ? `${filtered.length.toLocaleString("es-CL")} de ${gastos.length.toLocaleString("es-CL")} líneas`
                : `${gastos.length.toLocaleString("es-CL")} línea${gastos.length === 1 ? "" : "s"}`}
            </span>
            <button
              type="button"
              onClick={handleDownload}
              disabled={filtered.length === 0}
              className="ml-auto inline-flex items-center gap-2 rounded-lg px-4 py-2 font-sans font-medium text-sm bg-[#9F99F8] text-white hover:bg-[#8780F0] cursor-pointer transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4" />
              Descargar CSV
            </button>
          </div>

          {filtered.length === 0 ? (
            <p className="font-sans text-sm text-[#999999]">
              Sin documentos para la combinación de filtros seleccionada.
            </p>
          ) : (
            <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-auto max-h-[60vh]">
              <table className="w-full min-w-[1040px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    <th className={`${TH} text-left`}>Fecha</th>
                    <th className={`${TH} text-left`}>Folio</th>
                    <th className={`${TH} text-left`}>Nº doc</th>
                    <th className={`${TH} text-left`}>Proveedor</th>
                    {multiNegocio && <th className={`${TH} text-left`}>Negocio</th>}
                    <th className={`${TH} text-left`}>Categoría</th>
                    <th className={`${TH} text-left`}>Ítem</th>
                    <th className={`${TH} text-right`}>Neto</th>
                    <th className={`${TH} text-right`}>IVA</th>
                    <th className={`${TH} text-right`}>Bruto</th>
                    <th className={`${TH} text-left`}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((g, i) => (
                    <tr
                      key={`${g.gastoId}::${i}`}
                      className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                    >
                      <td className={`${TD} text-[#666666] tabular-nums whitespace-nowrap`}>
                        {fmtFecha(g.fecha)}
                      </td>
                      <td className={`${TD} text-[#333333] font-medium`}>{g.folio || "—"}</td>
                      <td className={`${TD} text-[#666666]`}>{g.nroDoc || "—"}</td>
                      <td className={`${TD} text-[#333333]`}>
                        <span className="block max-w-[220px] truncate" title={g.proveedor}>
                          {g.proveedor || "Sin proveedor"}
                        </span>
                      </td>
                      {multiNegocio && (
                        <td className={`${TD} text-[#666666]`}>
                          <span
                            className="block max-w-[160px] truncate"
                            title={g.referenciaNegocio}
                          >
                            {g.negocioId}
                          </span>
                        </td>
                      )}
                      <td className={`${TD}`}>
                        <span
                          className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-sans text-xs text-[#666666] whitespace-nowrap"
                          title={g.categoriaRaw ? `Original: ${g.categoriaRaw}` : undefined}
                        >
                          {g.categoriaOficial}
                        </span>
                      </td>
                      <td className={`${TD} text-[#666666]`}>
                        <span
                          className="block max-w-[220px] truncate"
                          title={[g.itemNombre, g.descripcion].filter(Boolean).join(" — ")}
                        >
                          {g.itemNombre || g.descripcion || "—"}
                        </span>
                      </td>
                      <td className={`${TD} text-[#333333] text-right tabular-nums`}>
                        {fmtClp(g.gastoNeto)}
                      </td>
                      <td className={`${TD} text-[#666666] text-right tabular-nums`}>
                        {fmtClp(g.gastoIva)}
                      </td>
                      <td className={`${TD} text-[#333333] text-right tabular-nums`}>
                        {fmtClp(g.gastoBruto)}
                      </td>
                      <td className={`${TD} text-[#666666] whitespace-nowrap`}>
                        {g.estado || "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA] sticky bottom-0">
                    <td
                      colSpan={multiNegocio ? 7 : 6}
                      className={`${TD} text-[#333333] font-semibold bg-[#FAFAFA]`}
                    >
                      Total{hasActiveFilter ? " filtrado" : ""} ({filtered.length} línea
                      {filtered.length === 1 ? "" : "s"})
                    </td>
                    <td className={`${TD} text-[#333333] text-right font-semibold tabular-nums bg-[#FAFAFA]`}>
                      {fmtClp(totalNeto)}
                    </td>
                    <td className={`${TD} text-[#666666] text-right font-semibold tabular-nums bg-[#FAFAFA]`}>
                      {fmtClp(totalIva)}
                    </td>
                    <td className={`${TD} text-[#333333] text-right font-semibold tabular-nums bg-[#FAFAFA]`}>
                      {fmtClp(totalBruto)}
                    </td>
                    <td className="bg-[#FAFAFA]" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </BrutalChartPanel>
    </div>
  );
}
