/**
 * Generación de CSV del lado del cliente (mismo patrón que el resto del repo:
 * Blob + URL.createObjectURL). Se antepone un BOM UTF-8 para que Excel abra bien
 * los acentos, y cada celda se escapa con comillas dobles.
 */

type Cell = string | number | null | undefined;

function escapeCell(value: Cell): string {
  const text =
    value === null || value === undefined ? "" : String(value);
  // Siempre entre comillas: cubre comas, saltos de línea y comillas internas.
  return `"${text.replace(/"/g, '""')}"`;
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Cell[][],
): void {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) => row.map(escapeCell).join(",")),
  ];
  const csv = `﻿${lines.join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
