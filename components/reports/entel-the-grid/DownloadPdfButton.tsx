"use client";

import { useCallback, useState } from "react";

/**
 * Descarga el reporte como PDF vía el diálogo de impresión del navegador
 * (Guardar como PDF), con las reglas @media print de report.css. Mismo patrón
 * que components/reports/grid-kiki/DownloadPdfButton.tsx, más la carga previa
 * de las fotos de la galería (vienen con loading="lazy" y, sin esto, las que
 * no se han scrolleado pueden salir en blanco en el PDF).
 */
const IMG_TIMEOUT_MS = 8000;

function waitForImages(root: ParentNode): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  const pending = imgs.map((img) => {
    img.loading = "eager";
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener("load", () => resolve(), { once: true });
      img.addEventListener("error", () => resolve(), { once: true });
    });
  });
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, IMG_TIMEOUT_MS));
  return Promise.race([Promise.all(pending).then(() => undefined), timeout]);
}

export default function DownloadPdfButton({ filename }: { filename: string }) {
  const [preparing, setPreparing] = useState(false);

  const handleClick = useCallback(async () => {
    setPreparing(true);
    try {
      const root = document.querySelector(".entel-report") ?? document;
      await Promise.all([waitForImages(root), document.fonts?.ready]);
    } finally {
      setPreparing(false);
    }

    const safeName = filename.replace(/[\\/:*?"<>|]+/g, "_").trim() || "reporte-entel";
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
      disabled={preparing}
      className="er-nav-pdf"
      aria-label="Descargar el reporte en PDF"
      data-no-print="true"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      {preparing ? (
        "Preparando…"
      ) : (
        <span>
          <span className="er-nav-pdf-long">Descargar en </span>PDF
        </span>
      )}
    </button>
  );
}
