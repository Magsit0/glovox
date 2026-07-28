/**
 * Lógica PURA (sin dependencias de servidor: no db, no googleapis) para el alta
 * de un evento en la hoja `CategoriaEvento`. Se comparte entre el cliente
 * (formulario guiado / atajo inline: inferencia y validación en vivo) y el
 * servidor (server actions: validación autoritativa antes de escribir).
 *
 * El `EventoID` es la LLAVE que consolida todos los orígenes del evento
 * (glovox.tickets, onfire.soldItems, mesas_vip/marca/medios/producto_ingresos,
 * paidMedia.ads_performance vía prefijo de campaña). Un ID malformado, duplicado
 * o con prefijo de país equivocado rompe esos joins en silencio — por eso el
 * alta valida formato + unicidad como bloqueo duro.
 */

/** País → prefijo de EventoID + moneda. El prefijo (3 letras) deriva el país. */
export const COUNTRY_OPTIONS = [
  { prefix: "GLO", label: "Chile", currency: "CLP" },
  { prefix: "GLP", label: "Perú", currency: "PEN" },
] as const;

export type CountryPrefix = (typeof COUNTRY_OPTIONS)[number]["prefix"];

/** Patrón de un EventoID válido: prefijo GLO/GLP + dígitos (ej. GLO201). */
export const EVENTO_ID_RE = /^GL[OP]\d+$/i;

/** Valor centinela del desplegable de venue que representa "sin venue". */
export const VENUE_NONE = "__none__";

/** Payload estructurado del alta (lo que produce el formulario guiado). */
export interface NewEventPayload {
  /** EventoID completo, ej. "GLO201". */
  eventoId: string;
  nombreGlovox: string;
  categoriaEvento: string;
  categoriaEvento2?: string;
  categoriaEvento3?: string;
  /** Fecha del evento, formato YYYY-MM-DD. */
  fecha: string;
  /** Nombre del venue estandarizado; "" = sin venue (válido). */
  venue: string;
  /** Inferidos (se re-derivan en el servidor, no se confía en el cliente). */
  currency?: string;
  temporada?: string;
  goalTickets?: string;
  budgetPm?: string;
  cuentaIg?: string;
  propertyGa4?: string;
  unabaseId?: string;
  isCanceled?: boolean;
}

// ---------- Inferencia ----------

function prefixOf(eventoId: string): string {
  return eventoId.trim().slice(0, 3).toUpperCase();
}

/** Moneda inferida del prefijo del EventoID (GLO→CLP, GLP→PEN). "" si no mapea. */
export function inferCurrency(eventoId: string): string {
  const p = prefixOf(eventoId);
  return COUNTRY_OPTIONS.find((c) => c.prefix === p)?.currency ?? "";
}

/** Etiqueta de país del prefijo del EventoID. "" si no mapea. */
export function countryLabel(eventoId: string): string {
  const p = prefixOf(eventoId);
  return COUNTRY_OPTIONS.find((c) => c.prefix === p)?.label ?? "";
}

/**
 * Temporada inferida de la Fecha. La temporada es el año-comercial que corre del
 * 1-jul al 30-jun, en formato `AA-AA`: p.ej. del 1-jul-2026 al 30-jun-2027 →
 * "26-27". Julio o después → AAactual-AAsiguiente; enero–junio → AAanterior-AAactual.
 * "" si la fecha no está en formato YYYY-MM-DD.
 */
export function inferTemporada(fecha: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) return "";
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return "";
  const startYear = month >= 7 ? year : year - 1;
  const yy = (n: number) => String(((n % 100) + 100) % 100).padStart(2, "0");
  return `${yy(startYear)}-${yy(startYear + 1)}`;
}

/** Marca (display): CategoriaEvento sin el sufijo " N-N" (ej. "Kiki 1-2" → "Kiki"). */
export function deriveMarca(categoriaEvento: string): string {
  return categoriaEvento.replace(/\s*\d+-\d+$/, "").trim();
}

/**
 * Sugiere el próximo EventoID libre para un prefijo: (máx. número existente + 1),
 * conservando el ancho con ceros a la izquierda (convención de 3 dígitos: GLO201).
 */
export function suggestNextEventoId(existingIds: string[], prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`, "i");
  let max = 0;
  let width = 3;
  for (const id of existingIds) {
    const mm = re.exec(id.trim());
    if (mm) {
      max = Math.max(max, Number(mm[1]));
      width = Math.max(width, mm[1].length);
    }
  }
  return prefix + String(max + 1).padStart(width, "0");
}

/** Set de EventoIDs existentes en MAYÚSCULA, para comparar unicidad sin sesgo de caso. */
export function existingIdSet(ids: string[]): Set<string> {
  return new Set(ids.map((s) => s.trim().toUpperCase()).filter(Boolean));
}

// ---------- Validación (compartida cliente/servidor) ----------

/** Campos de texto obligatorios (además del EventoID). */
export const REQUIRED_TEXT_FIELDS = [
  "nombreGlovox",
  "categoriaEvento",
  "fecha",
] as const;

/** Errores por campo; {} = válido. */
export type FieldErrors = Partial<Record<keyof NewEventPayload, string>>;

/**
 * Valida un alta. `existing` es el set de EventoIDs ya presentes (MAYÚSCULA).
 * Nota: venue "" es válido (sin venue); la obligatoriedad de *elegir* venue se
 * refuerza en la UI (estado sin selección), no acá.
 */
export function validateNewEvent(
  payload: NewEventPayload,
  existing: Set<string>,
): FieldErrors {
  const errors: FieldErrors = {};
  const id = payload.eventoId?.trim() ?? "";

  if (!id) {
    errors.eventoId = "El EventoID es obligatorio.";
  } else if (!EVENTO_ID_RE.test(id)) {
    errors.eventoId = "Formato inválido. Debe ser GLO### (Chile) o GLP### (Perú).";
  } else if (existing.has(id.toUpperCase())) {
    errors.eventoId = "Ya existe un evento con ese ID.";
  }

  if (!payload.nombreGlovox?.trim()) errors.nombreGlovox = "Obligatorio.";
  if (!payload.categoriaEvento?.trim()) errors.categoriaEvento = "Obligatorio.";

  const fecha = payload.fecha?.trim() ?? "";
  if (!fecha) {
    errors.fecha = "Obligatoria.";
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    errors.fecha = "Fecha inválida.";
  }

  return errors;
}

// ---------- Mapeo payload → fila de la hoja (por nombre de header) ----------

/** Header normalizado (minúsculas) → clave del payload. */
const HEADER_TO_FIELD: Record<string, keyof NewEventPayload> = {
  eventoid: "eventoId",
  nombreglovox: "nombreGlovox",
  categoriaevento: "categoriaEvento",
  categoriaevento2: "categoriaEvento2",
  categoriaevento3: "categoriaEvento3",
  fecha: "fecha",
  venue: "venue",
  currency: "currency",
  temporada: "temporada",
  goaltickets: "goalTickets",
  budgetpm: "budgetPm",
  iscanceled: "isCanceled",
  cuentaig: "cuentaIg",
  property_ga4: "propertyGa4",
  unabaseid: "unabaseId",
};

const normHeader = (s: string) => s.trim().toLowerCase();

function cellValue(payload: NewEventPayload, field: keyof NewEventPayload): string {
  if (field === "isCanceled") return payload.isCanceled ? "true" : "false";
  const v = payload[field];
  return v == null ? "" : String(v);
}

/**
 * Arma la fila (ancho = header.length) mapeando cada columna por NOMBRE, no por
 * posición: robusto al orden de columnas de la hoja. Las columnas desconocidas
 * quedan "". Devuelve también el índice de la columna EventoID (o -1).
 */
export function buildRowFromPayload(
  header: string[],
  payload: NewEventPayload,
): { row: string[]; eventoIdCol: number } {
  let eventoIdCol = -1;
  const row = header.map((h, c) => {
    const field = HEADER_TO_FIELD[normHeader(h)];
    if (field === "eventoId") eventoIdCol = c;
    return field ? cellValue(payload, field) : "";
  });
  return { row, eventoIdCol };
}

/** Índice de la columna EventoID en un header (o -1). */
export function findEventoIdCol(header: string[]): number {
  return header.findIndex((h) => normHeader(h) === "eventoid");
}

/**
 * Inverso de buildRowFromPayload: reconstruye el payload desde una fila
 * posicional (mapeando por nombre de header). Lo usa el atajo inline para pasar
 * por la misma validación de la llave en el servidor.
 */
export function rowToPayload(header: string[], values: string[]): NewEventPayload {
  const idx: Partial<Record<keyof NewEventPayload, number>> = {};
  header.forEach((h, c) => {
    const field = HEADER_TO_FIELD[normHeader(h)];
    if (field && idx[field] == null) idx[field] = c;
  });
  const get = (field: keyof NewEventPayload): string => {
    const c = idx[field];
    return c == null ? "" : String(values[c] ?? "");
  };
  return {
    eventoId: get("eventoId"),
    nombreGlovox: get("nombreGlovox"),
    categoriaEvento: get("categoriaEvento"),
    categoriaEvento2: get("categoriaEvento2"),
    categoriaEvento3: get("categoriaEvento3"),
    fecha: get("fecha"),
    venue: get("venue"),
    goalTickets: get("goalTickets"),
    budgetPm: get("budgetPm"),
    cuentaIg: get("cuentaIg"),
    propertyGa4: get("propertyGa4"),
    unabaseId: get("unabaseId"),
  };
}
