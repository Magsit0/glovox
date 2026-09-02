import { cache } from "react";
import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const CIERRE = `\`${P}.ticketsAndAABB.cierreEventos\``;

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  return Number(v);
}

function nOrNull(v: unknown): number | null {
  return v == null ? null : n(v);
}

function s(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

export type CierreEventoRow = {
  eventoId: string;
  totalAsistentes: number | null;
  categoriaEvento2: string;
  /** Venta de tickets a valor cara, bruto (IVA incl.), sin cargo por servicio. */
  totalVentaTickets: number | null;
  /** Cargo por servicio COMPLETO cobrado al cliente (bruto). Base del rebate:
   *  solo el % imputado en `rebate_config` es ingreso Glovox (ver
   *  lib/constants/rebate.ts) — mismo criterio que /cierre-negocio. */
  totalCargoServicio: number | null;
  /** Venta FF&BB bruta (IVA incl.). */
  totalVentaFfbb: number | null;
};

function toRow(r: Record<string, unknown>): CierreEventoRow {
  return {
    eventoId: s(r.evento_id),
    totalAsistentes: nOrNull(r.total_asistentes),
    categoriaEvento2: s(r.categoria_evento_2),
    totalVentaTickets: nOrNull(r.total_venta_tickets),
    totalCargoServicio: nOrNull(r.total_cargo_servicio),
    totalVentaFfbb: nOrNull(r.total_venta_ffbb),
  };
}

const SELECT = `
    SELECT
      EventoID                  AS evento_id,
      TotalPersonasAsistentes   AS total_asistentes,
      CategoriaEvento2          AS categoria_evento_2,
      SAFE_CAST(TotalVentaTICKETS  AS FLOAT64) AS total_venta_tickets,
      SAFE_CAST(TotalCargoServicio AS FLOAT64) AS total_cargo_servicio,
      SAFE_CAST(TotalVentaFFBB     AS FLOAT64) AS total_venta_ffbb
    FROM ${CIERRE}
`;

/**
 * Fila de cierreEventos de un evento. `cache()`: en /onepager varias secciones
 * del mismo render la piden (resumen, ingresos por fuente) → 1 sola query.
 */
export const getCierreEvento = cache(async function getCierreEvento(
  eventoId: string
): Promise<CierreEventoRow | null> {
  const rows = await query<Record<string, unknown>>(
    `${SELECT}
    WHERE EventoID = @eventoId
    LIMIT 1
    `,
    { eventoId }
  );
  const r = rows[0];
  return r ? toRow(r) : null;
});

export async function getTotalAsistentes(
  eventoId: string
): Promise<number | null> {
  const c = await getCierreEvento(eventoId);
  return c?.totalAsistentes ?? null;
}

export async function getCierreEventos(): Promise<CierreEventoRow[]> {
  const rows = await query<Record<string, unknown>>(SELECT);
  return rows.map(toRow);
}
