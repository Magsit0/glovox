/**
 * Metas del evento — goalTickets (personas) y budgetPm (techo de inversión en
 * medios, USD) — definidas por los editores de `metas-evento` (hasta 2) desde el
 * drill de /inversion-medios (lib/editores-capacidad.ts).
 *
 * Todo nace de la hoja CategoriaEvento, así que el orden es fijo:
 *  1. la celda de ESE evento en la hoja (y nada más: readCeldasEvento ubica la
 *     fila por EventoID y la columna por encabezado, y la escritura aborta si
 *     la celda cambió desde que el editor la leyó);
 *  2. un UPDATE puntual de esa columna en glovox.categoriaEvento, para que los
 *     dashboards lo vean ya sin esperar el sync completo de /admin/eventos;
 *  3. audit_log con el antes y el después.
 * Si (2) falla, la hoja ya quedó bien y el próximo sync completo lo publica.
 *
 * La hoja se lee SOLO al abrir el editor (leerBaseMeta) y al guardar, nunca al
 * renderizar el drill: cada lectura son 3 llamadas a Sheets, y la cuota del
 * service account (60/min) la comparte con /admin/eventos.
 *
 * Los permisos NO viven acá: las server actions validan el grant del panel, que
 * quien llama sea editor (leyendo la base en ese momento) y que el evento siga
 * abierto.
 */
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { updateCampoCategoriaEvento } from "@/lib/bigquery-sync";
import {
  filasDistintas,
  MSG_FILAS_DISTINTAS,
  readCeldasEvento,
  writeNumeroEvento,
} from "@/lib/eventos-sheet-service";
import type { BaseMeta, CampoMeta } from "@/lib/inversion-medios/metas";

/**
 * Valor actual de la hoja para un campo del evento: la base que ve el editor al
 * abrir el input y la que manda de vuelta como `esperado` al guardar.
 */
export async function leerBaseMeta(
  eventoId: string,
  campo: CampoMeta,
): Promise<{ ok: true; base: BaseMeta } | { ok: false; error: string }> {
  const celdas = await readCeldasEvento(eventoId, [campo]);
  if (!celdas) return { ok: false, error: `El evento ${eventoId} no está en la planilla.` };
  const valores = celdas.valores[campo];
  if (filasDistintas(valores)) return { ok: false, error: MSG_FILAS_DISTINTAS };
  return { ok: true, base: valores[0] ?? null };
}

/**
 * Guarda un campo. `esperado` es el valor de la hoja que vio el editor; si la
 * hoja ya no lo tiene, writeNumeroEvento lanza ConflictoHojaError y no escribe.
 *
 * Serializado por (evento, campo) con un advisory lock de Postgres que dura toda
 * la transacción: con dos editores, el segundo espera a que el primero termine
 * hoja + BigQuery, relee y recibe el conflicto, en vez de pisarlo en silencio o
 * dejar BigQuery con el valor perdedor. La transacción no escribe nada en
 * Postgres; solo sostiene el lock. Devuelve si BigQuery quedó al día.
 */
export async function guardarMetaEvento(input: {
  eventoId: string;
  campo: CampoMeta;
  esperado: BaseMeta;
  nuevo: number | null;
  actorId: string | null;
  email: string;
}): Promise<{ bqOk: boolean }> {
  const { eventoId, campo, esperado, nuevo, actorId, email } = input;

  const { celdas, bqFilas } = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`metas-evento:${eventoId}:${campo}`}))`);
    const celdas = await writeNumeroEvento(eventoId, campo, esperado, nuevo);
    let bqFilas: number | null = null;
    try {
      bqFilas = await updateCampoCategoriaEvento(eventoId, campo, nuevo);
    } catch (err) {
      console.error(`[metas-evento] UPDATE en BigQuery falló (${eventoId}.${campo})`, err);
    }
    return { celdas, bqFilas };
  });

  try {
    await db.insert(auditLog).values({
      actorId,
      action: "metas_evento.save",
      payload: { email, eventoId, campo, antes: esperado, despues: nuevo, celdas, bqFilas },
    });
  } catch (err) {
    console.error(`[metas-evento] audit log falló (${eventoId}.${campo})`, err);
  }

  // 0 filas = el evento está en la hoja pero aún no se sincronizó a BQ.
  return { bqOk: bqFilas != null && bqFilas > 0 };
}
