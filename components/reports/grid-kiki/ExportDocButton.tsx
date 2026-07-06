"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileText, Loader2 } from "lucide-react";
import { exportarGoogleDoc } from "@/app/reportes/grid-kiki-jw/actions";

export default function ExportDocButton() {
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    startTransition(async () => {
      const res = await exportarGoogleDoc();
      if (res.ok) {
        setUrl(res.url);
        window.open(res.url, "_blank", "noopener");
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : url ? (
          <ExternalLink className="h-4 w-4" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        {pending
          ? "Generando documento…"
          : url
            ? "Abrir el documento"
            : "Abrir en Google Docs"}
      </button>
      {error && (
        <p className="max-w-xs text-right font-sans text-xs text-[#ED75A0]">{error}</p>
      )}
    </div>
  );
}
