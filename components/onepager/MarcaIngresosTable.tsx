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
      <p className="font-mono-data text-sm text-black/50">
        Sin ingresos registrados.
      </p>
    );
  }

  const totalNeto = rows.reduce((a, r) => a + r.montoNeto, 0);
  const totalBruto = rows.reduce((a, r) => a + r.montoBruto, 0);

  return (
    <div className="border-4 border-black bg-white overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-black text-white">
            <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
              Cliente
            </th>
            <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-left">
              RUT
            </th>
            <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
              Neto
            </th>
            <th className="font-mono-data uppercase text-[11px] px-3 py-2 text-right">
              Bruto
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150"
            >
              <td className="font-mono-data text-sm px-3 py-2 font-bold border-r-2 border-black">
                {r.cliente}
              </td>
              <td className="font-mono-data text-sm px-3 py-2 border-r-2 border-black">
                {formatRut(r.rutCliente)}
              </td>
              <td className="font-mono-data text-sm px-3 py-2 text-right border-r-2 border-black tabular-nums">
                {fmtClp(r.montoNeto)}
              </td>
              <td className="font-mono-data text-sm px-3 py-2 text-right tabular-nums">
                {fmtClp(r.montoBruto)}
              </td>
            </tr>
          ))}
          <tr className="bg-[#FFFF00]">
            <td className="font-mono-data text-sm px-3 py-2 font-bold uppercase border-r-2 border-black">
              Total
            </td>
            <td className="font-mono-data text-sm px-3 py-2 border-r-2 border-black" />
            <td className="font-mono-data text-sm px-3 py-2 text-right font-bold border-r-2 border-black tabular-nums">
              {fmtClp(totalNeto)}
            </td>
            <td className="font-mono-data text-sm px-3 py-2 text-right font-bold tabular-nums">
              {fmtClp(totalBruto)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
