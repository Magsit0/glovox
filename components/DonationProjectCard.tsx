"use client";

import type { DonationProject } from "@/lib/queries/donations";
import { Download } from "lucide-react";

const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function fmt(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso : dateFmt.format(d);
}

function downloadCsv(project: DonationProject) {
  const header = [
    "Fecha",
    "ID Pago",
    "Monto Bruto (CLP)",
    "Comisión MP (CLP)",
    "Monto Neto (CLP)",
    "Acumulado Neto (CLP)",
    "Asignado Jardín Bosko",
  ].join(",");

  const body = project.payments.map((r) =>
    [
      r.date,
      r.id,
      r.gross,
      r.fee,
      r.net,
      r.runningNet,
      r.allocated ? "Sí" : "No",
    ].join(",")
  );

  const csv = [header, ...body].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `jardin_bosko_donaciones_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DonationProjectCard({ project }: { project: DonationProject }) {
  const progress = Math.min(project.allocatedNet / project.targetNet, 1);

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="font-display font-bold text-xl text-[#333333]">{project.name}</h3>
          <p className="font-sans text-sm text-[#666666] mt-1">
            Objetivo: {clp.format(project.targetNet)} neto · Bruto necesario:{" "}
            {clp.format(project.grossNeeded)}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans text-xs font-medium text-[#333333] bg-white border border-[#E5E5E5]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#9F99F8]" />
          {project.allocatedCount} pagos asignados
        </span>
      </div>

      {/* KPI chips */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        {[
          { label: "Objetivo neto", value: project.targetNet },
          { label: "Asignado neto", value: project.allocatedNet },
          { label: "Asignado bruto", value: project.allocatedGross },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#FAFAFA] rounded-lg px-4 py-3">
            <p className="font-sans text-xs text-[#666666]">{label}</p>
            <p className="font-display font-bold text-2xl text-[#333333] mt-1 leading-none tabular-nums">
              {clp.format(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-sans text-xs text-[#666666]">Progreso hacia objetivo</span>
          <span className="font-sans text-xs font-medium text-[#333333] tabular-nums">
            {(progress * 100).toFixed(1)}%
          </span>
        </div>
        <div className="h-2 bg-[#F0F0F0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#9F99F8] rounded-full transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>

      {/* Download button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => downloadCsv(project)}
          className="inline-flex items-center gap-2 bg-white border border-[#E5E5E5] rounded-lg px-4 py-2 font-sans font-medium text-sm text-[#333333] hover:bg-[#FAFAFA] focus:outline-none focus:ring-2 focus:ring-[#9F99F8] transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#666666]" />
          Descargar CSV
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-auto max-h-[480px]">
        <table className="w-full min-w-[700px] text-left">
          <thead>
            <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5] sticky top-0 z-10">
              {["Fecha", "ID", "Bruto (CLP)", "Comisión (CLP)", "Neto (CLP)", "Neto Acumulado (CLP)", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="font-sans text-xs font-medium text-[#666666] px-4 py-3 uppercase tracking-wide text-left last:text-right"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {project.payments.map((row, i) => {
              const isFirstUnallocated =
                !row.allocated && (i === 0 || project.payments[i - 1].allocated);
              return (
                <tr
                  key={row.id}
                  className={[
                    "border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors duration-150",
                    isFirstUnallocated ? "border-t-2 border-t-[#9F99F8]" : "",
                  ].join(" ")}
                >
                  <td className="font-sans text-sm text-[#333333] px-4 py-3">{fmt(row.date)}</td>
                  <td className="font-sans text-sm text-[#666666] px-4 py-3 tabular-nums">{row.id}</td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 tabular-nums text-right">
                    {clp.format(row.gross)}
                  </td>
                  <td className="font-sans text-sm text-[#666666] px-4 py-3 tabular-nums text-right">
                    {clp.format(row.fee)}
                  </td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 tabular-nums text-right">
                    {clp.format(row.net)}
                  </td>
                  <td className="font-sans text-sm text-[#333333] px-4 py-3 tabular-nums text-right">
                    {clp.format(row.runningNet)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.allocated && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-sans text-xs font-medium text-[#333333] bg-white border border-[#E5E5E5]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B1D750]" />
                        Asignado
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
