"use client";

import CsvButton from "@/components/proveedor/CsvButton";
import ExcelButton from "@/components/proveedor/ExcelButton";

interface Props {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
  /** Nombre de la hoja en el Excel (default "Datos"). */
  sheetName?: string;
  csvLabel?: string;
  excelLabel?: string;
}

/** Par de botones de descarga: CSV (cliente) + Excel (.xlsx en el servidor). */
export default function DownloadButtons({
  filename,
  headers,
  rows,
  sheetName,
  csvLabel,
  excelLabel,
}: Props) {
  return (
    <div className="flex shrink-0 items-start gap-2">
      <CsvButton filename={filename} headers={headers} rows={rows} label={csvLabel} />
      <ExcelButton
        filename={filename}
        sheetName={sheetName}
        headers={headers}
        rows={rows}
        label={excelLabel}
      />
    </div>
  );
}
