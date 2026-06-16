"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";

interface Props {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  label?: string;
}

/**
 * Menú de descarga con dos opciones: Excel (.xlsx, generado en el servidor con
 * exceljs vía /api/proveedor/export-xlsx) y CSV (generado en el cliente, con BOM
 * UTF-8 para que Excel respete los acentos).
 */
export default function DownloadMenu({
  filename,
  sheetName,
  headers,
  rows,
  label = "Descargar",
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<null | "xlsx" | "csv">(null);
  const [error, setError] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isEmpty = rows.length === 0;

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function triggerDownload(blob: Blob, ext: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(`.${ext}`) ? filename : `${filename}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadExcel() {
    setLoading("xlsx");
    setError(false);
    try {
      const res = await fetch("/api/proveedor/export-xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, sheetName, headers, rows }),
      });
      if (!res.ok) throw new Error(String(res.status));
      triggerDownload(await res.blob(), "xlsx");
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setLoading(null);
    }
  }

  function downloadCsv() {
    setLoading("csv");
    setError(false);
    try {
      const esc = (v: unknown) => {
        const str = v == null ? "" : String(v);
        return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
      };
      const lines = [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))];
      const blob = new Blob(["﻿" + lines.join("\r\n")], {
        type: "text/csv;charset=utf-8;",
      });
      triggerDownload(blob, "csv");
      setOpen(false);
    } catch {
      setError(true);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div ref={ref} className="relative flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isEmpty || loading !== null}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {loading ? "Generando…" : label}
        <ChevronDown className="h-4 w-4 text-[#999999]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            onClick={downloadExcel}
            className="flex w-full items-center gap-2 px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:bg-[#FAFAFA]"
          >
            <FileSpreadsheet className="h-4 w-4 text-[#666666]" />
            Descargar Excel
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={downloadCsv}
            className="flex w-full items-center gap-2 border-t border-[#E5E5E5] px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:bg-[#FAFAFA]"
          >
            <FileText className="h-4 w-4 text-[#666666]" />
            Descargar CSV
          </button>
        </div>
      )}

      {error && (
        <span className="font-sans text-xs text-[#ED75A0]">
          No se pudo generar. Inténtalo de nuevo.
        </span>
      )}
    </div>
  );
}
