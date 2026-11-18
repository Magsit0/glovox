"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { esSuperadminVigente } from "@/lib/access";
import { auth } from "@/lib/auth";
import { EVENTOS_CIERRE } from "@/lib/cierres/eventos";
import { FECHA_ISO_RE } from "@/lib/cierres/hitos";
import { anotarFechaClave, FECHAS_CLAVE_ANOTABLES } from "@/lib/produccion/fechas-clave";
import { withNeonRetry } from "@/lib/neon-retry";

export type ActionResult = { ok: true } | { ok: false; error: string };

const NO_SE_PUDO: ActionResult = { ok: false, error: "No se pudo guardar" };

/**
 * Anota desde la presentación de cierre la fecha real de una fecha clave del
 * evento (p. ej. «Line up confirmado») en su plan de la carta Gantt
 * (glovox-produccion). Solo superadmin vigente; el rechazo es genérico (sin
 * avisos de permisos). El historial queda en audit_log de glovox-data y, en la
 * Gantt, en `creado_por` / `actualizado_por` de la tarea.
 */
export async function anotarFechaClaveAction(
  slug: string,
  fechaClaveId: string,
  fecha: string,
): Promise<ActionResult> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  try {
    if (!email || session?.user?.role !== "superadmin" || !(await esSuperadminVigente(email))) {
      return NO_SE_PUDO;
    }
  } catch {
    return NO_SE_PUDO;
  }
  const evento = EVENTOS_CIERRE.find((e) => e.slug === slug);
  if (!evento?.planGantt || !evento.cierre) return NO_SE_PUDO;
  if (!Object.hasOwn(FECHAS_CLAVE_ANOTABLES, fechaClaveId)) return NO_SE_PUDO;
  if (typeof fecha !== "string" || !FECHA_ISO_RE.test(fecha) || fecha < "2020-01-01" || fecha > evento.fecha) {
    return NO_SE_PUDO;
  }
  try {
    await anotarFechaClave(
      evento.planGantt,
      fechaClaveId as keyof typeof FECHAS_CLAVE_ANOTABLES,
      fecha,
      email,
    );
    await withNeonRetry(() =>
      db.insert(auditLog).values({
        actorId: session?.user?.userId ?? null,
        action: "cierre_fecha_clave_anotar",
        payload: { slug, planGantt: evento.planGantt, fechaClaveId, fecha },
      }),
    );
    revalidatePath(evento.cierre);
    return { ok: true };
  } catch (err) {
    console.error("[cierres] no se pudo anotar la fecha clave", { slug, fechaClaveId, fecha }, err);
    return NO_SE_PUDO;
  }
}
