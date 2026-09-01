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
  categoriaEvento2: string;
};

export async function getCierreEvento(
  eventoId: string
): Promise<CierreEventoRow | null> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      EventoID         AS evento_id,
      TotalPersonasAsistentes  AS total_asistentes,
      CategoriaEvento2 AS categoria_evento_2
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
    categoriaEvento2: s(r.categoria_evento_2),
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
      EventoID         AS evento_id,
      TotalPersonasAsistentes  AS total_asistentes,
      CategoriaEvento2 AS categoria_evento_2
    FROM ${CIERRE}
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    totalAsistentes: r.total_asistentes == null ? null : n(r.total_asistentes),
    categoriaEvento2: s(r.categoria_evento_2),
  }));
}
