"use client";

import { Download } from "lucide-react";
import { downloadCsv } from "@/components/proveedor/csv";

interface Props {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  label?: string;
  disabled?: boolean;
}

/** Botón secundario que descarga `rows` como CSV. Se deshabilita si no hay datos. */
export default function CsvButton({
  filename,
  headers,
  rows,
  label = "Descargar CSV",
  disabled,
}: Props) {
  const isEmpty = rows.length === 0;
  return (
    <button
      type="button"
      onClick={() => downloadCsv(filename, headers, rows)}
      disabled={disabled || isEmpty}
      className="inline-flex items-center gap-2 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download className="h-4 w-4" />
      {label}
    </button>
  );
}
