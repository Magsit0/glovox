/**
 * Opciones de plan (escenarios) — lo que pasa EN LA BASE al crear, borrar y
 * elegir una opción. Cada función recibe la transacción en que corre: las
 * server actions (app/inversion-medios/actions.ts) ponen permisos, validación y
 * audit; acá queda solo el cambio de datos, que así se puede probar contra los
 * datos reales dentro de una transacción que se revierte.
 *
 * Todas toman primero el advisory lock del evento: crear, borrar y elegir
 * opciones del MISMO evento no se cruzan.
 */
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { inversionMediosEscenarioDiario, inversionMediosEscenarios } from "@/db/schema";
import { MAX_OPCIONES, siguienteNombreOpcion } from "@/lib/inversion-medios/escenarios";
import { fmtDiaMes } from "@/lib/inversion-medios/holgura";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

type Filas<T> = { rows?: T[] } | T[];
const filasDe = <T>(r: Filas<T>): T[] => (Array.isArray(r) ? r : (r.rows ?? []));

const lockOpciones = (tx: Tx, eventoId: string) =>
  tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`opciones-plan:${eventoId}`}))`);

/**
 * Escritura en las celdas de una opción (upsert, borrar celda o fila, rellenar
 * rango): corre con el lock COMPARTIDO de las opciones del evento y vuelve a
 * verificar que la opción siga existiendo. Elegir y borrar toman el lock
 * exclusivo, así que una edición nunca se cruza con la elección de esa misma
 * opción (sin esto, la que se guardaba en ese instante se perdía en silencio).
 * null = la opción ya no existe (se eligió o se borró).
 */
export async function escribirEnOpcion<T>(
  eventoId: string,
  escenarioId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T | null> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock_shared(hashtext(${`opciones-plan:${eventoId}`}))`);
    const sigue = await tx
      .select({ id: inversionMediosEscenarios.id })
      .from(inversionMediosEscenarios)
      .where(and(eq(inversionMediosEscenarios.id, escenarioId), eq(inversionMediosEscenarios.eventoId, eventoId)));
    if (sigue.length === 0) return null;
    return fn(tx);
  });
}

/** Copia TODO el plan vigente del evento (pasado y futuro) a una opción. Devuelve cuántas celdas. */
async function copiarVigenteA(tx: Tx, escenarioId: string, eventoId: string, userId: string | null): Promise<number> {
  const r = await tx.execute(sql`
    INSERT INTO data.inversion_medios_escenario_diario
      (escenario_id, fecha, plataforma, tipo, monto_usd, nota, created_by, updated_by)
    SELECT ${escenarioId}::uuid, fecha, plataforma, tipo, monto_usd, nota, ${userId}::uuid, ${userId}::uuid
    FROM data.inversion_medios_diario
    WHERE evento_id = ${eventoId}
    RETURNING 1`);
  return filasDe(r).length;
}

/**
 * Crea «Opción B/C/…» como copia del plan vigente completo. null si el evento ya
 * tiene MAX_OPCIONES.
 */
export async function crearOpcionTx(
  tx: Tx,
  eventoId: string,
  userId: string | null,
): Promise<{ id: string; nombre: string; filas: number } | null> {
  await lockOpciones(tx, eventoId);
  const existentes = await tx
    .select({ nombre: inversionMediosEscenarios.nombre })
    .from(inversionMediosEscenarios)
    .where(eq(inversionMediosEscenarios.eventoId, eventoId));
  if (existentes.length >= MAX_OPCIONES) return null;
  const nombre = siguienteNombreOpcion(existentes.map((e) => e.nombre));
  const [op] = await tx
    .insert(inversionMediosEscenarios)
    .values({ eventoId, nombre, createdBy: userId, updatedBy: userId })
    .returning({ id: inversionMediosEscenarios.id });
  const filas = await copiarVigenteA(tx, op.id, eventoId, userId);
  return { id: op.id, nombre, filas };
}

/** Borra una opción y devuelve sus celdas (para el audit), o null si ya no existía. */
export async function borrarOpcionTx(
  tx: Tx,
  opcion: { id: string; eventoId: string },
): Promise<{ fecha: string; plataforma: string; tipo: string; montoUsd: number; nota: string | null }[] | null> {
  await lockOpciones(tx, opcion.eventoId);
  const celdas = await tx
    .select({
      fecha: inversionMediosEscenarioDiario.fecha,
      plataforma: inversionMediosEscenarioDiario.plataforma,
      tipo: inversionMediosEscenarioDiario.tipo,
      montoUsd: inversionMediosEscenarioDiario.montoUsd,
      nota: inversionMediosEscenarioDiario.nota,
    })
    .from(inversionMediosEscenarioDiario)
    .where(eq(inversionMediosEscenarioDiario.escenarioId, opcion.id));
  const borrada = await tx
    .delete(inversionMediosEscenarios)
    .where(eq(inversionMediosEscenarios.id, opcion.id))
    .returning({ id: inversionMediosEscenarios.id });
  return borrada.length > 0 ? celdas : null;
}

export type ResultadoElegir = {
  guardadoComo: string;
  anteriorId: string;
  filasAntes: number;
  usdAntes: number;
  filasDespues: number;
  usdDespues: number;
};

/**
 * Elige una opción como plan VIGENTE desde `hoy`:
 *  1. el vigente COMPLETO queda guardado como opción («Vigente hasta 18-nov»);
 *  2. se borran los días del vigente desde hoy y se ponen los de la opción;
 *  3. la opción elegida se borra (ya es el vigente).
 * Los días anteriores a hoy del vigente no se tocan: son la vara del desvío.
 * null si la opción ya no existe.
 */
export async function elegirOpcionTx(
  tx: Tx,
  opcion: { id: string; eventoId: string },
  userId: string | null,
  hoy: string,
): Promise<ResultadoElegir | null> {
  const { id, eventoId } = opcion;
  await lockOpciones(tx, eventoId);
  const nombres = await tx
    .select({ id: inversionMediosEscenarios.id, nombre: inversionMediosEscenarios.nombre })
    .from(inversionMediosEscenarios)
    .where(eq(inversionMediosEscenarios.eventoId, eventoId));
  if (!nombres.some((n) => n.id === id)) return null;

  const usados = new Set(nombres.map((n) => n.nombre.toLowerCase()));
  const base = `Vigente hasta ${fmtDiaMes(hoy)}`;
  let guardadoComo = base;
  for (let k = 2; usados.has(guardadoComo.toLowerCase()); k++) guardadoComo = `${base} (${k})`;
  const [anterior] = await tx
    .insert(inversionMediosEscenarios)
    .values({ eventoId, nombre: guardadoComo, createdBy: userId, updatedBy: userId })
    .returning({ id: inversionMediosEscenarios.id });
  await copiarVigenteA(tx, anterior.id, eventoId, userId);

  const antes = filasDe<{ monto_usd: number }>(
    await tx.execute(sql`
      DELETE FROM data.inversion_medios_diario
      WHERE evento_id = ${eventoId} AND fecha >= ${hoy}::date
      RETURNING monto_usd`),
  );
  const despues = filasDe<{ monto_usd: number }>(
    await tx.execute(sql`
      INSERT INTO data.inversion_medios_diario
        (evento_id, fecha, plataforma, tipo, monto_usd, nota, created_by, updated_by)
      SELECT ${eventoId}, fecha, plataforma, tipo, monto_usd, nota, ${userId}::uuid, ${userId}::uuid
      FROM data.inversion_medios_escenario_diario
      WHERE escenario_id = ${id}::uuid AND fecha >= ${hoy}::date
      RETURNING monto_usd`),
  );
  await tx.delete(inversionMediosEscenarios).where(eq(inversionMediosEscenarios.id, id));
  const suma = (xs: { monto_usd: number }[]) => xs.reduce((a, x) => a + Number(x.monto_usd), 0);
  return {
    guardadoComo,
    anteriorId: anterior.id,
    filasAntes: antes.length,
    usdAntes: suma(antes),
    filasDespues: despues.length,
    usdDespues: suma(despues),
  };
}
