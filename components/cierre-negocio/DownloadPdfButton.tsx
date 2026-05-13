"use client";

import { useCallback } from "react";

interface Props {
  filename: string;
}

export default function DownloadPdfButton({ filename }: Props) {
  const handleClick = useCallback(() => {
    const safeName = filename.replace(/[\\/:*?"<>|]+/g, "_").trim() || "cierre-negocio";
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
      data-no-print="true"
      className="inline-flex items-center gap-2 self-start rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-xs font-medium text-[#333333] transition-colors hover:border-[#333333] hover:bg-[#FAFAFA]"
      aria-label="Descargar cierre en PDF"
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
      Descargar PDF
    </button>
  );
}
