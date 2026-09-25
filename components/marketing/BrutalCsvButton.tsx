"use client";

import { Download } from "lucide-react";
import { downloadCsv } from "@/components/proveedor/csv";
import type { CsvTable } from "./csvExports";

type Props = {
  // Función para que la fecha del nombre se tome al hacer clic, no al render.
  filename: string | (() => string);
  // Arma las filas recién al hacer clic: no se recalcula el CSV en cada render.
  build: () => CsvTable;
  label?: string;
  // Qué tabla exporta. Solo para lectores de pantalla: con dos botones en la
  // página, ambos se anunciarían igual ("Descargar CSV").
  context?: string;
  disabled?: boolean;
};

/**
 * "Descargar CSV" con el lenguaje visual del dashboard de Marketing (el mismo
 * de sus filtros: borde grueso, sombra dura, hover amarillo). Reutiliza el
 * helper compartido `downloadCsv` (BOM UTF-8 para que Excel abra los acentos).
 */
export default function BrutalCsvButton({
  filename,
  build,
  label = "Descargar CSV",
  context,
  disabled,
}: Props) {
  function handleClick() {
    const { headers, rows } = build();
    downloadCsv(typeof filename === "function" ? filename() : filename, headers, rows);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap bg-white border-4 border-black rounded-none font-mono-data text-xs px-3 py-1.5 text-black cursor-pointer shadow-[4px_4px_0px_#000] hover:bg-[#FFFF00] focus-visible:bg-[#FFFF00] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
    >
      <Download className="h-3.5 w-3.5" aria-hidden />
      {label}
      {context && <span className="sr-only"> · {context}</span>}
    </button>
  );
}
