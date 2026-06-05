/**
 * Formatters del dashboard PROVEEDOR. Todo es CLP — se respeta el locale chileno
 * acordado en la guía de estilo: CLP "$12.345", fechas "22 abr 2026".
 */

export {
  formatCurrency,
  compactCurrency,
  formatNumber,
} from "@/lib/unabase/formatting";

/** "2026-05" → "may 2026". Tolera valores vacíos o inesperados. */
export function monthLabel(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) return mes || "Sin fecha";
  const [year, month] = mes.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(d.getTime())) return mes;
  return d.toLocaleDateString("es-CL", { month: "short", year: "numeric" });
}

/** "2026-05" → "may '26" (eje compacto). */
export function monthLabelShort(mes: string): string {
  if (!/^\d{4}-\d{2}$/.test(mes)) return mes || "";
  const [year, month] = mes.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(d.getTime())) return mes;
  const m = d.toLocaleDateString("es-CL", { month: "short" });
  return `${m} '${year.slice(2)}`;
}

/** "2026-05-07" → "07 may 2026". */
export function dateLabel(iso: string): string {
  if (!iso) return "Sin fecha";
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
