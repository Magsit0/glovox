import type { MarcaIngresoRow } from "@/lib/queries/marca";
import { formatRut } from "@/lib/utils/rut";

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

export default function MarcaIngresosTable({
  rows,
}: {
  rows: MarcaIngresoRow[];
}) {
  if (rows.length === 0) {
    return (
      <p className="font-sans text-sm text-[#999999]">
        Sin ingresos registrados.
      </p>
    );
  }

  const totalNeto = rows.reduce((a, r) => a + r.montoNeto, 0);
  const totalBruto = rows.reduce((a, r) => a + r.montoBruto, 0);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
            <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
              Cliente
            </th>
            <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-left">
              RUT
            </th>
            <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
              Neto
            </th>
            <th className="font-sans text-xs font-medium uppercase tracking-wide text-[#666666] px-4 py-3 text-right">
              Bruto
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150"
            >
              <td className="font-sans text-sm text-[#333333] px-4 py-3 font-medium">
                {r.cliente}
              </td>
              <td className="font-sans text-sm text-[#333333] px-4 py-3">
                {formatRut(r.rutCliente)}
              </td>
              <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                {fmtClp(r.montoNeto)}
              </td>
              <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right tabular-nums">
                {fmtClp(r.montoBruto)}
              </td>
            </tr>
          ))}
          <tr className="border-t border-[#E5E5E5] bg-[#FAFAFA]">
            <td className="font-sans text-sm text-[#333333] px-4 py-3 font-semibold">
              Total
            </td>
            <td className="font-sans text-sm text-[#333333] px-4 py-3" />
            <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-semibold tabular-nums">
              {fmtClp(totalNeto)}
            </td>
            <td className="font-sans text-sm text-[#333333] px-4 py-3 text-right font-semibold tabular-nums">
              {fmtClp(totalBruto)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
