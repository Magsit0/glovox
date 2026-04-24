import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const CIERRE = `\`${P}.ticketsAndAABB.cierreEventos\``;

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  return Number(v);
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
};

export async function getCierreEvento(
  eventoId: string
): Promise<CierreEventoRow | null> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      EventoID        AS evento_id,
      TotalAsistentes AS total_asistentes
    FROM ${CIERRE}
    WHERE EventoID = @eventoId
    LIMIT 1
    `,
    { eventoId }
  );
  const r = rows[0];
  if (!r) return null;
  return {
    eventoId: s(r.evento_id),
    totalAsistentes: r.total_asistentes == null ? null : n(r.total_asistentes),
  };
}

export async function getTotalAsistentes(
  eventoId: string
): Promise<number | null> {
  const c = await getCierreEvento(eventoId);
  return c?.totalAsistentes ?? null;
}

export async function getCierreEventos(): Promise<CierreEventoRow[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      EventoID        AS evento_id,
      TotalAsistentes AS total_asistentes
    FROM ${CIERRE}
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    totalAsistentes: r.total_asistentes == null ? null : n(r.total_asistentes),
  }));
}
