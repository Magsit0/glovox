"use client";

import { useCallback } from "react";
import { Download } from "lucide-react";

/**
 * Descarga el reporte como PDF vía el diálogo de impresión del navegador
 * (Guardar como PDF). Aprovecha las reglas @media print de globals.css y los
 * atributos data-pdf-* de la página. Mismo patrón probado que
 * components/cierre-negocio/DownloadPdfButton.tsx.
 */
export default function DownloadPdfButton({ filename }: { filename: string }) {
  const handleClick = useCallback(() => {
    const safeName =
      filename.replace(/[\\/:*?"<>|]+/g, "_").trim() || "reporte";
    const prevTitle = document.title;
    document.title = safeName;
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }, [filename]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
      aria-label="Descargar el reporte en PDF"
    >
      <Download className="h-4 w-4" />
      Descargar PDF
    </button>
  );
}
