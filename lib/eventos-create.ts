/**
 * Lógica PURA (sin dependencias de servidor: no db, no googleapis) para el alta
 * de un evento en la hoja `CategoriaEvento`. Se comparte entre el cliente
 * (formulario guiado: inferencia y validación en vivo) y el servidor (server
 * actions: validación autoritativa antes de escribir).
 *
 * Un evento tiene DOS llaves (ver lib/eventos-id.ts):
 * - `ID` (columna A, `1248-CL-TKM`): su identidad. La genera el alta
 *   (correlativo global + país + código de marca de la pestaña «Marcas») y no
 *   cambia nunca: con ella se planifica antes de que exista venta.
 * - `EventoID` (`GLO213`, `660905`): lo entrega la ticketera cuando empieza la
 *   venta. Es OPCIONAL al crear, pero si viene tiene que tener formato válido y
 *   ser único: consolida los orígenes del evento (glovox.tickets,
 *   onfire.soldItems, mesas_vip/marca/medios/producto_ingresos, paid media vía
 *   prefijo de campaña) y un valor repetido o mal escrito rompe esos joins en
 *   silencio.
 */
import { CODIGO_MARCA_RE, EVENTO_ID_TICKETERA_RE } from "@/lib/eventos-id";

/** País del evento: código ISO-2 (columna Pais y segmento del ID), prefijo GL* del EventoID y moneda. */
export const COUNTRY_OPTIONS = [
  { code: "CL", prefix: "GLO", label: "Chile", currency: "CLP" },
  { code: "PE", prefix: "GLP", label: "Perú", currency: "PEN" },
] as const;

export type CountryCode = (typeof COUNTRY_OPTIONS)[number]["code"];

/** Valor centinela del desplegable de venue que representa "sin venue". */
export const VENUE_NONE = "__none__";

/** Valor centinela del desplegable de marca que abre el alta de una marca nueva. */
export const MARCA_NUEVA = "__nueva__";

/** Marca de la pestaña «Marcas» (Código | Marca). */
export interface Marca {
  codigo: string;
  nombre: string;
}

export const MARCA_NOMBRE_MAX = 40;

/** Payload estructurado del alta (lo que produce el formulario guiado). */
export interface NewEventPayload {
  /** ID de la hoja. Lo asigna el SERVIDOR al crear: lo que mande el cliente se ignora. */
  id?: string;
  /** País ISO-2 (CL, PE). */
  pais: string;
  /** Código de marca (3 letras): uno de la pestaña Marcas o uno nuevo. */
  marca: string;
  /** Solo para una marca NUEVA: su nombre legible (se agrega a la pestaña Marcas). */
  marcaNombre?: string;
  /** EventoID de la ticketera, opcional ("" = todavía no lo hay). */
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

function pais(code: string) {
  const c = code.trim().toUpperCase();
  return COUNTRY_OPTIONS.find((o) => o.code === c);
}

/** Moneda inferida del país (CL→CLP, PE→PEN). "" si no mapea. */
export function inferCurrency(paisCode: string): string {
  return pais(paisCode)?.currency ?? "";
}

/** Etiqueta del país. "" si no mapea. */
export function countryLabel(paisCode: string): string {
  return pais(paisCode)?.label ?? "";
}

/** Prefijo GL* del EventoID para el país (CL→GLO, PE→GLP). "" si no mapea. */
export function prefijoEventoId(paisCode: string): string {
  return pais(paisCode)?.prefix ?? "";
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

/**
 * Sugiere el próximo EventoID GL* libre para un prefijo: (máx. número existente
 * + 1), conservando el ancho con ceros a la izquierda (GLO201). Es solo una
 * ayuda: el EventoID real lo entrega la ticketera.
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

/** Set de valores en MAYÚSCULA (sin vacíos), para comparar unicidad sin sesgo de caso. */
export function existingIdSet(ids: string[]): Set<string> {
  return new Set(ids.map((s) => s.trim().toUpperCase()).filter(Boolean));
}

// ---------- Validación (compartida cliente/servidor) ----------

/** Errores por campo; {} = válido. */
export type FieldErrors = Partial<Record<keyof NewEventPayload, string>>;

/**
 * Error del EventoID de la ticketera, o null si sirve. "" es válido (todavía no
 * lo hay). Formato GL*### o Fever numérico; si es GLO/GLP, el prefijo tiene que
 * calzar con el país (`paisCode` opcional: el editor de la grilla no lo valida).
 */
export function errorEventoId(
  eventoIdRaw: string,
  ocupados: Set<string>,
  paisCode?: string,
): string | null {
  const id = eventoIdRaw.trim().toUpperCase();
  if (!id) return null;
  if (!EVENTO_ID_TICKETERA_RE.test(id)) {
    return "Formato inválido: GLO### en Chile, GLP### en Perú o el número de Fever (5 o 6 dígitos).";
  }
  if (ocupados.has(id)) return `Ya hay otro evento con el EventoID ${id}.`;
  if (paisCode) {
    const esperado = prefijoEventoId(paisCode);
    const prefijo = id.slice(0, 3);
    if ((prefijo === "GLO" || prefijo === "GLP") && esperado && prefijo !== esperado) {
      return `Un EventoID ${prefijo} no es de ${countryLabel(paisCode)}: usa ${esperado}###.`;
    }
  }
  return null;
}

/**
 * Valida un alta. `eventoIds` = EventoIDs ya presentes (MAYÚSCULA); `marcas` =
 * códigos de la pestaña Marcas. `marca === MARCA_NUEVA` no llega acá: el
 * formulario manda el código nuevo en `marca` y su nombre en `marcaNombre`.
 * Nota: venue "" es válido (sin venue); la obligatoriedad de *elegir* venue se
 * refuerza en la UI (estado sin selección), no acá.
 */
export function validateNewEvent(
  payload: NewEventPayload,
  eventoIds: Set<string>,
  marcas: Set<string>,
): FieldErrors {
  const errors: FieldErrors = {};

  if (!pais(payload.pais ?? "")) errors.pais = "Elige el país.";

  const marca = (payload.marca ?? "").trim().toUpperCase();
  const nueva = payload.marcaNombre !== undefined;
  if (!marca) {
    errors.marca = nueva ? "Escribe el código de la marca nueva." : "Elige la marca.";
  } else if (!CODIGO_MARCA_RE.test(marca)) {
    errors.marca = "El código de marca son 3 letras (ej. PKN).";
  } else if (nueva && marcas.has(marca)) {
    errors.marca = `El código ${marca} ya existe: elígelo de la lista.`;
  } else if (!nueva && !marcas.has(marca)) {
    errors.marca = `La marca ${marca} no está en la pestaña Marcas.`;
  }
  if (nueva) {
    const nombre = (payload.marcaNombre ?? "").trim();
    if (!nombre) errors.marcaNombre = "Escribe el nombre de la marca.";
    else if (nombre.length > MARCA_NOMBRE_MAX) errors.marcaNombre = `Máximo ${MARCA_NOMBRE_MAX} caracteres.`;
  }

  const eventoIdError = errorEventoId(payload.eventoId ?? "", eventoIds, payload.pais);
  if (eventoIdError) errors.eventoId = eventoIdError;

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

// ---------- Edición de celdas de la grilla (pestaña Eventos) ----------

/** Edición de una celda (misma forma que CellEdit del service, sin importarlo). */
interface EdicionCelda {
  row: number;
  col: number;
  newValue: string;
}

/**
 * Valida las ediciones de la grilla contra la hoja (`values[0]` = encabezados):
 * la columna ID no se edita nunca desde la app, y un EventoID nuevo tiene que
 * tener formato válido y no estar en OTRA fila (contando las demás ediciones
 * del mismo guardado). Vaciar un EventoID se permite. Devuelve el primer error,
 * o null.
 */
export function errorEdicionesEventos(values: string[][], edits: EdicionCelda[]): string | null {
  const header = values[0] ?? [];
  const idCol = findIdHojaCol(header);
  const evCol = findEventoIdCol(header);
  if (idCol >= 0 && edits.some((e) => e.col === idCol)) {
    return "El ID del evento no se edita: lo genera «Nuevo evento» y no cambia nunca.";
  }
  if (evCol < 0) return null;
  const evEdits = edits.filter((e) => e.col === evCol);
  if (evEdits.length === 0) return null;
  // EventoID por fila tal como quedaría tras guardar.
  const final = new Map<number, string>();
  for (let r = 1; r < values.length; r++) final.set(r, (values[r]?.[evCol] ?? "").trim().toUpperCase());
  for (const e of evEdits) final.set(e.row, e.newValue.trim().toUpperCase());
  for (const e of evEdits) {
    const nuevo = e.newValue.trim().toUpperCase();
    if (!nuevo) continue;
    const otras = new Set<string>();
    for (const [r, v] of final) if (r !== e.row && v) otras.add(v);
    const err = errorEventoId(nuevo, otras);
    if (err) return `Fila ${e.row + 1}: ${err}`;
  }
  return null;
}

// ---------- Mapeo payload → fila de la hoja (por nombre de header) ----------

/** Header normalizado (minúsculas) → clave del payload. */
const HEADER_TO_FIELD: Record<string, keyof NewEventPayload> = {
  id: "id",
  eventoid: "eventoId",
  pais: "pais",
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
 * quedan "".
 */
export function buildRowFromPayload(header: string[], payload: NewEventPayload): string[] {
  return header.map((h) => {
    const field = HEADER_TO_FIELD[normHeader(h)];
    return field ? cellValue(payload, field) : "";
  });
}

/** Índice de la columna EventoID en un header (o -1). */
export function findEventoIdCol(header: string[]): number {
  return header.findIndex((h) => normHeader(h) === "eventoid");
}

/** Índice de la columna ID (la identidad del evento, columna A) en un header (o -1). */
export function findIdHojaCol(header: string[]): number {
  return header.findIndex((h) => normHeader(h) === "id");
}
