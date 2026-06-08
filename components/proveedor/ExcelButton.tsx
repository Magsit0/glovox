"use client";

import { useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";

interface Props {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  label?: string;
  disabled?: boolean;
}

/**
 * Descarga un .xlsx real generado en el servidor (`/api/proveedor/export-xlsx`
 * con exceljs). Mantenemos exceljs fuera del bundle del cliente.
 */
export default function ExcelButton({
  filename,
  sheetName,
  headers,
  rows,
  label = "Descargar Excel",
  disabled,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const isEmpty = rows.length === 0;

  async function handleClick() {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/proveedor/export-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, sheetName, headers, rows }),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || isEmpty || loading}
        className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        {loading ? "Generando…" : label}
      </button>
      {error && (
        <span className="font-sans text-xs text-[#ED75A0]">
          No se pudo generar el Excel. Inténtalo de nuevo.
        </span>
      )}
    </div>
  );
}
