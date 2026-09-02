"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { downloadCsv } from "@/components/proveedor/csv";
import type { OnepagerFacturaRow } from "@/lib/queries/onepagerCostos";
import BrutalChartPanel from "./BrutalChartPanel";
import MultiFilter from "./MultiFilter";

type Props = {
  eventoId: string;
  facturas: OnepagerFacturaRow[];
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

function tipoLabel(f: OnepagerFacturaRow): string {
  return f.tipoDocumentoAbrev || f.tipoDocumento || "—";
}

function negocioKey(f: OnepagerFacturaRow): string {
  return `${f.negocioId} · ${f.referenciaNegocio || "Sin referencia"}`;
}

const TH =
  "bg-[#FAFAFA] font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3";
const TD = "font-sans text-sm px-4 py-3";
const MAX_CHIPS = 3;

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
 * Pestaña "Facturación" del one-pager: documentos de venta (facturas) emitidos
 * en Unabase para los negocios del evento (marts.finanzas_ventas). Montos ya
 * atribuibles al negocio; sin anulados ni notas de crédito/débito.
 */
export default function FacturasTab({ eventoId, facturas }: Props) {
  const [clientes, setClientes] = useState<Set<string>>(new Set());
  const [tipos, setTipos] = useState<Set<string>>(new Set());
  const [negociosSel, setNegociosSel] = useState<Set<string>>(new Set());

  const clientesOpts = useMemo(
    () => uniqueSorted(facturas.map((f) => f.cliente)),
    [facturas],
  );
  const tiposOpts = useMemo(
    () => uniqueSorted(facturas.map(tipoLabel)),
    [facturas],
  );
  const negociosOpts = useMemo(
    () => uniqueSorted(facturas.map(negocioKey)),
    [facturas],
  );
  const negociosCount = negociosOpts.length;

  const filtered = useMemo(
    () =>
      facturas.filter(
        (f) =>
          inSet(clientes, f.cliente) &&
          inSet(tipos, tipoLabel(f)) &&
          inSet(negociosSel, negocioKey(f)),
      ),
    [facturas, clientes, tipos, negociosSel],
  );

  const multiNegocio = negociosCount > 1;
  const hasActiveFilter = clientes.size > 0 || tipos.size > 0 || negociosSel.size > 0;

  if (facturas.length === 0) {
    return (
      <BrutalChartPanel title="Facturación">
        <p className="font-sans text-sm text-[#999999]">
          Sin facturas registradas en Unabase para este evento (no hay negocio
          vigente con documentos de venta asociados al EventoID).
        </p>
      </BrutalChartPanel>
    );
  }

  const sum = (rows: OnepagerFacturaRow[], k: "ventaNeta" | "ventaIva" | "ventaBruta") =>
    rows.reduce((a, f) => a + f[k], 0);
  const allNeto = sum(facturas, "ventaNeta");
  const allIva = sum(facturas, "ventaIva");
  const allBruto = sum(facturas, "ventaBruta");
  const totalNeto = sum(filtered, "ventaNeta");
  const totalIva = sum(filtered, "ventaIva");
  const totalBruto = sum(filtered, "ventaBruta");
  const stopgapShared = multiNegocio && facturas.some((f) => f.flagStopgap);

  function handleDownload() {
    downloadCsv(
      `facturas-${eventoId}`,
      [
        "Fecha emisión",
        "Fecha pago",
        "Folio",
        "Tipo",
        "Cliente",
        "RUT",
        "Negocio",
        "Ítems",
        "Neto",
        "IVA",
        "Total",
        "Estado",
      ],
      filtered.map((f) => [
        f.fechaEmision,
        f.fechaPago,
        f.folio,
        tipoLabel(f),
        f.cliente,
        f.clienteRut,
        f.referenciaNegocio,
        f.itemsDescripciones.join(" | "),
        Math.round(f.ventaNeta),
        Math.round(f.ventaIva),
        Math.round(f.ventaBruta),
        f.estado,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      <BrutalChartPanel title="Facturación — Resumen">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Tile
            label="Venta neta facturada"
            value={fmtClp(allNeto)}
            hint="Sin IVA · afecto + exento"
          />
          <Tile label="IVA" value={fmtClp(allIva)} hint="Débito fiscal de la parte afecta" />
          <Tile
            label="Total facturado"
            value={fmtClp(allBruto)}
            hint="Con IVA (monto del documento)"
          />
          <Tile
            label="Documentos"
            value={facturas.length.toLocaleString("es-CL")}
            hint={`${negociosCount} negocio${negociosCount === 1 ? "" : "s"} en Unabase`}
          />
        </div>
        {stopgapShared && (
          <p className="font-sans text-xs text-[#999999] mt-4">
            Las facturas compartidas entre negocios se atribuyen completas al
            negocio primario: Unabase no entrega el desglose por línea desde
            junio 2026.
          </p>
        )}
      </BrutalChartPanel>

      <BrutalChartPanel title="Facturación — Documentos de venta">
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <MultiFilter
              label="Cliente"
              selected={clientes}
              onChange={setClientes}
              options={clientesOpts}
              searchPlaceholder="Buscar cliente…"
            />
            <MultiFilter
              label="Tipo de documento"
              selected={tipos}
              onChange={setTipos}
              options={tiposOpts}
              searchPlaceholder="Buscar tipo…"
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
                  setClientes(new Set());
                  setTipos(new Set());
                  setNegociosSel(new Set());
                }}
                className="rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] transition-colors duration-150 cursor-pointer"
              >
                Limpiar filtros
              </button>
            )}
            <span className="font-sans text-xs text-[#666666]">
              {hasActiveFilter
                ? `${filtered.length.toLocaleString("es-CL")} de ${facturas.length.toLocaleString("es-CL")} documentos`
                : `${facturas.length.toLocaleString("es-CL")} documento${facturas.length === 1 ? "" : "s"}`}
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
              <table className="w-full min-w-[960px] border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    <th className={`${TH} text-left`}>Fecha</th>
                    <th className={`${TH} text-left`}>Folio</th>
                    <th className={`${TH} text-left`}>Tipo</th>
                    <th className={`${TH} text-left`}>Cliente</th>
                    {multiNegocio && <th className={`${TH} text-left`}>Negocio</th>}
                    <th className={`${TH} text-left`}>Ítems</th>
                    <th className={`${TH} text-right`}>Neto</th>
                    <th className={`${TH} text-right`}>IVA</th>
                    <th className={`${TH} text-right`}>Total</th>
                    <th className={`${TH} text-left`}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f, i) => {
                    const chips = f.itemsDescripciones.slice(0, MAX_CHIPS);
                    const extra = f.itemsDescripciones.length - chips.length;
                    return (
                      <tr
                        key={`${f.documentoId}::${f.negocioId}::${i}`}
                        className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
                      >
                        <td className={`${TD} text-[#666666] tabular-nums whitespace-nowrap`}>
                          {fmtFecha(f.fechaEmision)}
                        </td>
                        <td className={`${TD} text-[#333333] font-medium`}>{f.folio || "—"}</td>
                        <td className={`${TD} text-[#666666]`} title={f.tipoDocumento}>
                          {tipoLabel(f)}
                        </td>
                        <td className={`${TD} text-[#333333]`}>
                          <span
                            className="block max-w-[240px] truncate"
                            title={[f.cliente, f.clienteRut].filter(Boolean).join(" · ")}
                          >
                            {f.cliente || "Sin cliente"}
                          </span>
                        </td>
                        {multiNegocio && (
                          <td className={`${TD} text-[#666666]`}>
                            <span
                              className="block max-w-[160px] truncate"
                              title={f.referenciaNegocio}
                            >
                              {f.negocioId}
                            </span>
                          </td>
                        )}
                        <td className={TD}>
                          {chips.length > 0 ? (
                            <span
                              className="flex flex-wrap gap-1"
                              title={f.itemsDescripciones.join(" · ")}
                            >
                              {chips.map((d, j) => (
                                <span
                                  key={`${d}-${j}`}
                                  className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 font-sans text-xs text-[#666666] max-w-[200px] truncate"
                                >
                                  {d}
                                </span>
                              ))}
                              {extra > 0 && (
                                <span className="inline-flex items-center rounded-full bg-[#F0EFFE] px-2 py-0.5 font-sans text-xs text-[#9F99F8]">
                                  +{extra}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[#999999]">—</span>
                          )}
                        </td>
                        <td className={`${TD} text-[#333333] text-right tabular-nums`}>
                          {fmtClp(f.ventaNeta)}
                        </td>
                        <td className={`${TD} text-[#666666] text-right tabular-nums`}>
                          {fmtClp(f.ventaIva)}
                        </td>
                        <td className={`${TD} text-[#333333] text-right tabular-nums`}>
                          {fmtClp(f.ventaBruta)}
                        </td>
                        <td className={`${TD} text-[#666666] whitespace-nowrap`}>
                          {f.estado || "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA] sticky bottom-0">
                    <td
                      colSpan={multiNegocio ? 6 : 5}
                      className={`${TD} text-[#333333] font-semibold bg-[#FAFAFA]`}
                    >
                      Total{hasActiveFilter ? " filtrado" : ""} ({filtered.length} doc
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
