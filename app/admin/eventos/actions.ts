"use server";

import { revalidatePath } from "next/cache";
import { sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { esSuperadminVigente } from "@/lib/access";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import {
  addColumn,
  appendMarca,
  appendRow,
  readMarcas,
  readSheetGrid,
  saveCells,
  COLUMN_TYPES,
  type CellEdit,
  type ColumnType,
  type SheetTarget,
} from "@/lib/eventos-sheet-service";
import {
  buildRowFromPayload,
  errorEdicionesEventos,
  normalizarEdicionesEventos,
  existingIdSet,
  findEventoIdCol,
  findIdHojaCol,
  inferCurrency,
  inferTemporada,
  validateNewEvent,
  type NewEventPayload,
} from "@/lib/eventos-create";
import { ID_HOJA_RE, siguienteIdHoja } from "@/lib/eventos-id";
import { runSync } from "@/lib/bigquery-sync";

/**
 * Lee header + IDs + EventoIDs existentes de la pestaña Eventos con una lectura
 * FRESCA (para generar el ID y validar unicidad sin sesgo de carrera).
 */
async function readEventosKeys(): Promise<{ header: string[]; ids: string[]; eventoIds: Set<string> }> {
  const grid = await readSheetGrid("eventos");
  const header = grid.values[0] ?? [];
  const col = (c: number) => (c >= 0 ? grid.values.slice(1).map((r) => (r[c] ?? "").trim().toUpperCase()) : []);
  return {
    header,
    ids: col(findIdHojaCol(header)),
    eventoIds: existingIdSet(col(findEventoIdCol(header))),
  };
}

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

interface ActorCtx {
  email: string;
  userId: string | null;
}

/**
 * Gate por ROL dentro de cada action (defensa en profundidad: las server actions
 * son POSTs invocables aunque el proxy proteja la navegación). Lanza Error
 * en vez de redirect() para devolver un ActionResult limpio.
 */
async function requireEventosAccess(): Promise<ActorCtx> {
  const session = await auth();
  const email = session?.user?.email ?? "";
  if (!email) throw new Error("No autorizado");
  // Rol fresco de la base, no solo el de la sesión (ver esSuperadminVigente).
  if (
    (session?.user?.role ?? "user") !== "superadmin" ||
    !(await esSuperadminVigente(email))
  ) {
    throw new Error("Solo un superadmin puede editar la hoja de estandarización");
  }
  return { email, userId: session?.user?.userId ?? null };
}

function parseTarget(t: unknown): SheetTarget {
  if (t === "eventos" || t === "venues") return t;
  throw new Error("Pestaña inválida");
}

function fail(err: unknown): ActionResult<never> {
  return { ok: false, error: err instanceof Error ? err.message : "Error inesperado" };
}

export async function saveCellsAction(
  target: string,
  edits: CellEdit[],
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  if (!Array.isArray(edits) || edits.length === 0) {
    return { ok: false, error: "No hay cambios para guardar" };
  }
  try {
    const t = parseTarget(target);
    // Eventos: el ID no se toca desde la app y un EventoID nuevo tiene que ser
    // válido y no estar en otra fila. Se valida contra una lectura FRESCA y se
    // guarda normalizado (sin espacios, en mayúscula), que es como cruza.
    let aGuardar = edits;
    if (t === "eventos") {
      const { values } = await readSheetGrid("eventos");
      aGuardar = normalizarEdicionesEventos(values[0] ?? [], edits);
      const err = errorEdicionesEventos(values, aGuardar);
      if (err) return { ok: false, error: err };
    }
    await saveCells(t, ctx.userId, ctx.email, aGuardar);
    revalidatePath("/admin/eventos");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function appendRowAction(
  target: string,
  values: string[],
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  if (!Array.isArray(values)) {
    return { ok: false, error: "Fila inválida" };
  }
  let t: SheetTarget;
  try {
    t = parseTarget(target);
  } catch (err) {
    return fail(err);
  }
  // Un evento nace SOLO por el alta guiada: es la que genera su ID (correlativo
  // + país + marca). Una fila tipeada a mano no tendría cómo garantizarlo.
  if (t === "eventos") {
    return { ok: false, error: "Para crear un evento usa «Nuevo evento»: así su ID se genera solo." };
  }
  try {
    await appendRow(t, ctx.userId, ctx.email, values);
    revalidatePath("/admin/eventos");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Alta guiada de un evento nuevo en la pestaña Eventos. Genera el `ID` (columna
 * A: correlativo global + país + código de marca, ver lib/eventos-id.ts), agrega
 * la marca a la pestaña Marcas si es nueva y escribe la fila. Valida en el
 * servidor con lecturas FRESCAS (unicidad del EventoID, que es opcional, y de la
 * marca) y re-infiere los campos bloqueados (currency del país, Temporada de la
 * Fecha): no se confía en lo que mandó el cliente, tampoco en su `id`.
 *
 * Concurrencia: dos altas simultáneas leerían el mismo máximo y tomarían el
 * mismo correlativo. Un advisory lock de Postgres serializa leer → escribir, y
 * tras escribir se relee la columna ID: si el ID quedó dos veces (alguien lo
 * tipeó a mano en la hoja entremedio), se avisa en vez de seguir en silencio.
 */
export async function createEventAction(
  payload: NewEventPayload,
): Promise<ActionResult<{ id: string }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Datos inválidos" };
  }
  const nuevaMarca = typeof payload.marcaNombre === "string";
  const clean: NewEventPayload = {
    ...payload,
    pais: String(payload.pais ?? "").trim().toUpperCase(),
    marca: String(payload.marca ?? "").trim().toUpperCase(),
    marcaNombre: nuevaMarca ? String(payload.marcaNombre).trim() : undefined,
    eventoId: String(payload.eventoId ?? "").trim().toUpperCase(),
    currency: inferCurrency(String(payload.pais ?? "")),
    temporada: inferTemporada(String(payload.fecha ?? "")),
    isCanceled: false,
  };

  try {
    const res = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('eventos-alta'))`);
      const [{ header, ids, eventoIds }, marcas] = await Promise.all([readEventosKeys(), readMarcas()]);
      if (findIdHojaCol(header) < 0) return { ok: false as const, error: "La hoja no tiene la columna ID" };

      const errors = validateNewEvent(clean, eventoIds, new Set(marcas.map((m) => m.codigo)));
      const first = Object.values(errors)[0];
      if (first) return { ok: false as const, error: first };

      const id = siguienteIdHoja(ids, clean.pais, clean.marca);
      if (!ID_HOJA_RE.test(id)) return { ok: false as const, error: `No se pudo generar el ID (${id})` };
      if (nuevaMarca) {
        await appendMarca(ctx.userId, ctx.email, { codigo: clean.marca, nombre: clean.marcaNombre ?? "" });
      }
      await appendRow("eventos", ctx.userId, ctx.email, buildRowFromPayload(header, { ...clean, id }));

      const despues = await readEventosKeys();
      const veces = despues.ids.filter((x) => x === id).length;
      return { ok: true as const, id, repetido: veces !== 1 };
    });
    if (!res.ok) return res;

    // Auditoría específica del alta (best-effort; el append ya loguea su traza).
    try {
      await db.insert(auditLog).values({
        actorId: ctx.userId,
        action: "eventos.create",
        payload: {
          email: ctx.email,
          id: res.id,
          eventoId: clean.eventoId || null,
          marca: clean.marca,
          ...(nuevaMarca ? { marcaNueva: clean.marcaNombre } : {}),
        },
      });
    } catch {
      /* noop */
    }

    revalidatePath("/admin/eventos");
    if (res.repetido) {
      return {
        ok: false,
        error: `El evento se creó con el ID ${res.id}, pero ese ID quedó repetido en la hoja (alguien lo escribió a mano). Corrige la otra fila en Google Sheets.`,
      };
    }
    return { ok: true, data: { id: res.id } };
  } catch (err) {
    return fail(err);
  }
}

export async function appendColumnAction(
  target: string,
  name: string,
  tipo: string = "STRING",
): Promise<ActionResult> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  if (typeof name !== "string" || !name.trim()) {
    return { ok: false, error: "El nombre de la columna es obligatorio" };
  }
  const bqType = (COLUMN_TYPES as readonly string[]).includes(tipo)
    ? (tipo as ColumnType)
    : "STRING";
  try {
    await addColumn(parseTarget(target), ctx.userId, ctx.email, name, bqType);
    revalidatePath("/admin/eventos");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

/**
 * Sincroniza el Sheet → BigQuery corriendo el CREATE OR REPLACE de
 * glovox.categoriaEvento. A demanda (botón en /admin/eventos), con el SA escritor
 * (`bqaccess@`) aislado en lib/bigquery-sync.ts.
 */
export async function syncBigQueryAction(
  target: string,
): Promise<ActionResult<{ rows: number }>> {
  let ctx: ActorCtx;
  try {
    ctx = await requireEventosAccess();
  } catch (err) {
    return fail(err);
  }
  let t: SheetTarget;
  try {
    t = parseTarget(target);
  } catch (err) {
    return fail(err);
  }
  try {
    const res = await runSync(t);
    // Auditoría best-effort: no debe tumbar el resultado del sync.
    try {
      await db.insert(auditLog).values({
        actorId: ctx.userId,
        action: `${t}.sync_bq`,
        payload: { email: ctx.email, rows: res.rows },
      });
    } catch {
      /* noop */
    }
    return { ok: true, data: res };
  } catch (err) {
    return fail(err);
  }
}
