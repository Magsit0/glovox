import { ArrowRight, FileSearch } from "lucide-react";
import type { DocDetalleRow } from "@/lib/queries/proveedor";
import { formatCurrency, dateLabel } from "@/components/proveedor/format";

/**
 * Panel de un documento buscado por Nº DOC. Muestra la cabecera (proveedor
 * declarado → efectivo cuando hubo reatribución) y una fila por línea de gasto.
 * Presentacional; los datos vienen de `getDocumentoDetalle`.
 */
export default function DocDetalle({
  nroDoc,
  rows,
}: {
  nroDoc: string;
  rows: DocDetalleRow[];
}) {
  if (rows.length === 0) {
    return (
      <section className="flex flex-col items-center gap-2 rounded-lg border border-[#E5E5E5] bg-white px-6 py-12 text-center">
        <FileSearch className="h-6 w-6 text-[#999999]" />
        <p className="font-sans text-sm text-[#999999]">
          No se encontró ningún gasto con el Nº DOC{" "}
          <span className="font-medium text-[#333333]">{nroDoc}</span>.
        </p>
        <p className="font-sans text-xs text-[#999999]">
          El número es el folio del documento tributario (Nº DOC), no el folio de
          la OC. Puede que ese gasto aún no tenga documento registrado.
        </p>
      </section>
    );
  }

  const totalNeto = rows.reduce((acc, r) => acc + r.neto, 0);
  const totalBruto = rows.reduce((acc, r) => acc + r.bruto, 0);
  const negocios = [...new Set(rows.map((r) => r.negocioId))];
  const declarados = [...new Set(rows.map((r) => r.proveedorDeclarado).filter(Boolean))];
  const efectivos = [...new Set(rows.map((r) => r.proveedorEfectivo).filter(Boolean))];
  const algunoReatribuido = rows.some((r) => r.reatribuido);
  const algunoExcluido = rows.some((r) => !r.incluido);
  const first = rows[0];

  return (
    <section className="flex flex-col gap-4">
      {/* Cabecera del documento */}
      <div className="flex flex-col gap-4 rounded-lg border border-[#E5E5E5] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="font-sans text-xs text-[#666666]">Documento</p>
            <h2 className="font-display text-2xl font-bold leading-none text-[#333333]">
              Nº DOC {nroDoc}
            </h2>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              {first.tipoDoc || "Documento"} · {rows.length}{" "}
              {rows.length === 1 ? "línea" : "líneas"} ·{" "}
              {negocios.length === 1
                ? `negocio ${first.negocioId}`
                : `${negocios.length} negocios`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <p className="font-display text-2xl font-bold leading-none text-[#333333] tabular-nums">
              {formatCurrency(totalNeto)}
            </p>
            <p className="font-sans text-xs text-[#666666]">
              neto · {formatCurrency(totalBruto)} bruto
            </p>
          </div>
        </div>

        {/* Estado + fecha + evento */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill estado={first.estado} />
          <Chip>{dateLabel(first.fecha)}</Chip>
          {first.eventoId && <Chip>{first.eventoId}</Chip>}
          {first.negocioNombre && (
            <span className="font-sans text-sm text-[#666666]">
              {first.negocioNombre}
            </span>
          )}
        </div>

        {/* Proveedor: declarado → efectivo (el punto de la verificación) */}
        <div className="rounded-lg bg-[#FAFAFA] px-4 py-3">
          {algunoReatribuido ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-sans text-xs text-[#666666]">
                Proveedor declarado
              </span>
              <span className="font-sans text-sm text-[#333333] line-through decoration-[#999999]">
                {declarados.join(", ")}
              </span>
              <ArrowRight className="h-4 w-4 text-[#9F99F8]" />
              <span className="font-sans text-xs text-[#666666]">real</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-sm font-medium text-[#333333]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
                {efectivos.join(", ")}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-sans text-xs text-[#666666]">Proveedor</span>
              <span className="font-sans text-sm font-medium text-[#333333]">
                {efectivos.join(", ")}
              </span>
              {first.rutEfectivo && (
                <span className="font-sans text-sm text-[#666666]">
                  · RUT {first.rutEfectivo}
                </span>
              )}
            </div>
          )}
        </div>

        {algunoExcluido && (
          <p className="font-sans text-xs text-[#EF8C34]">
            ⚠ Algunas líneas están marcadas como excluidas de los totales del
            dashboard (gasto interno o excluido manualmente).
          </p>
        )}
      </div>

      {/* Líneas del documento */}
      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                <Th>Negocio</Th>
                <Th>Categoría</Th>
                <Th>Ítem</Th>
                <Th>Proveedor efectivo</Th>
                <Th right>Neto</Th>
                <Th right>Bruto</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.gastoId}-${i}`}
                  className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-0 hover:bg-[#FAFAFA]"
                >
                  <Td>
                    <span className="text-[#333333]">{r.negocioId}</span>
                  </Td>
                  <Td>{r.categoria || "—"}</Td>
                  <Td>{r.itemNombre || "—"}</Td>
                  <Td>
                    <span className="inline-flex items-center gap-1.5">
                      {r.reatribuido && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#9F99F8]"
                          title="Reatribuido desde el proveedor declarado"
                        />
                      )}
                      {r.proveedorEfectivo || "—"}
                    </span>
                  </Td>
                  <Td right>{formatCurrency(r.neto)}</Td>
                  <Td right>{formatCurrency(r.bruto)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-4 py-3 font-sans text-xs font-medium text-[#666666] ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <td
      className={`px-4 py-3 font-sans text-sm text-[#333333] ${right ? "text-right tabular-nums" : "text-left"}`}
    >
      {children}
    </td>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs text-[#666666]">
      {children}
    </span>
  );
}

function StatusPill({ estado }: { estado: string }) {
  const e = estado.toUpperCase();
  const dot =
    e === "PAGADA" || e === "CERRADA" || e === "PAGADO"
      ? "bg-[#B1D750]"
      : e === "EMITIDA"
        ? "bg-[#F6C544]"
        : e === "ANULADA"
          ? "bg-[#ED75A0]"
          : "bg-[#999999]";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {estado || "—"}
    </span>
  );
}
