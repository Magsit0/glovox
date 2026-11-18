/**
 * Fechas clave de la carta Gantt (glovox-produccion, base aparte con schema
 * `produccion`). Solo lectura, con PRODUCCION_DATABASE_URL. Una fecha clave
 * (`produccion.fechas_clave`, p. ej. `lineup_confirmado`, del área Booking) es
 * a lo más UNA tarea de cada plan; su fecha es el inicio o el fin de esa tarea
 * según `ancla`. El plazo por tipo de evento vive en `plazos_fecha_clave`
 * (`dias` negativo = días antes del evento). Solo servidor.
 */
import { neon } from "@neondatabase/serverless";

export interface FechaClaveEvento {
  /** Fecha ISO (yyyy-mm-dd) de la tarea marcada, o null si el plan no la tiene. */
  fecha: string | null;
  /** Plazo para la categoría, en días antes del evento; null si no está definido. */
  plazoDias: number | null;
}

/**
 * `planId` = ID del plan en glovox-produccion (`tareas.evento_id`, ej. "1238"
 * del plan 1238-CL-PKN); `categoria` = categoría de los plazos (ej. "Piknic").
 * Si la base no responde o falta la variable, devuelve null: la lámina se
 * muestra igual, sin el dato.
 */
export async function getFechaClaveEvento(
  planId: string,
  fechaClaveId: string,
  categoria: string,
): Promise<FechaClaveEvento | null> {
  const url = process.env.PRODUCCION_DATABASE_URL;
  if (!url) return null;
  try {
    const sql = neon(url);
    const [tareas, plazos] = await Promise.all([
      sql`
        select (case fc.ancla when 'fin' then coalesce(t.fecha_fin, t.fecha_inicio) else t.fecha_inicio end)::text as fecha
        from produccion.tareas t
        join produccion.fechas_clave fc on fc.id = t.fecha_clave_id
        where t.evento_id = ${planId} and t.fecha_clave_id = ${fechaClaveId}
        limit 1`,
      sql`
        select dias from produccion.plazos_fecha_clave
        where fecha_clave_id = ${fechaClaveId} and categoria = ${categoria} and referencia_id is null
        limit 1`,
    ]);
    const fecha = (tareas[0]?.fecha as string | null | undefined) ?? null;
    const dias = plazos[0]?.dias as number | undefined;
    return { fecha, plazoDias: dias == null ? null : -dias };
  } catch (err) {
    console.error("[produccion] no se pudo leer la fecha clave", { planId, fechaClaveId }, err);
    return null;
  }
}

/** Fechas clave que una presentación de cierre puede anotar en la Gantt. */
export const FECHAS_CLAVE_ANOTABLES = {
  lineup_confirmado: { nombre: "Line up confirmado", pilar: "Booking" },
} as const;
export type FechaClaveAnotable = keyof typeof FECHAS_CLAVE_ANOTABLES;

/**
 * Anota la fecha real de una fecha clave en el plan: si el plan ya tiene la
 * tarea marcada con esa fecha clave, le cambia la fecha; si no, crea la tarea
 * (de un día, completada, en su pilar, al final) con la marca. Es lo mismo que
 * «Declarar» en glovox-produccion; el índice único tareas_evento_fecha_clave_uq
 * garantiza una por plan. Lanza si la base falla.
 */
export async function anotarFechaClave(
  planId: string,
  fechaClaveId: FechaClaveAnotable,
  fecha: string,
  email: string,
): Promise<void> {
  const url = process.env.PRODUCCION_DATABASE_URL;
  if (!url) throw new Error("Falta PRODUCCION_DATABASE_URL");
  const sql = neon(url);
  const { nombre, pilar } = FECHAS_CLAVE_ANOTABLES[fechaClaveId];
  const actualizadas = await sql`
    update produccion.tareas
    set fecha_inicio = ${fecha}::date, fecha_fin = ${fecha}::date,
        actualizado_por = ${email}, updated_at = now()
    where evento_id = ${planId} and fecha_clave_id = ${fechaClaveId}
    returning id`;
  if (actualizadas.length > 0) return;
  const creadas = await sql`
    insert into produccion.tareas
      (evento_id, pilar_id, nombre, fase, estado, tipo, fecha_inicio, fecha_fin, fecha_clave_id, orden, creado_por)
    select ${planId}, p.id, ${nombre}, 'pre_produccion', 'completada', 'tarea', ${fecha}::date, ${fecha}::date,
           ${fechaClaveId},
           coalesce((select max(t.orden) from produccion.tareas t where t.evento_id = ${planId} and t.pilar_id = p.id), 0) + 1,
           ${email}
    from produccion.pilares p
    where p.nombre = ${pilar} and p.activo
    returning id`;
  if (creadas.length === 0) throw new Error(`No existe el pilar activo «${pilar}» en la Gantt`);
}
