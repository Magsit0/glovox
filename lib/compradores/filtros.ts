/**
 * Filtros, columnas del export y formato del dashboard COMPRADORES
 * (`/marketing/compradores`).
 *
 * Módulo CLIENT-SAFE: sin BigQuery ni `node:stream`. Lo importan la página
 * (server), la API del CSV y el componente cliente de filtros, así los tres
 * leen y escriben la URL exactamente igual. Las queries viven en
 * `lib/queries/compradores.ts`.
 */

export type CompradoresTipo = "todos" | "ventas" | "cortesias";
export type CompradoresContacto = "todos" | "email" | "telefono";
export type CompradoresModo = "persona" | "ticket";
/** De quién son los datos de contacto: el asistente nominado en el ticket o
 *  quien hizo la compra (para audiencias de Meta). */
export type CompradoresDatos = "nominados" | "compradores";

export type CompradoresFilters = {
  /** EventoIDs seleccionados. Vacío = todos los eventos (sin filtro). */
  eventos: string[];
  /** `categoriaEvento.CategoriaEvento` seleccionadas. Vacío = sin filtro. */
  categorias: string[];
  tipo: CompradoresTipo;
  contacto: CompradoresContacto;
  /** "persona" = una fila por contacto único (email; si no hay, teléfono).
   *  "ticket" = una fila por ticket emitido. */
  modo: CompradoresModo;
  /** "compradores" (default) = Nombres / Email / Telefono de quien compró la orden.
   *  "nominados" = NombreNominado / EmailNominado / TelefonoNominado. */
  datos: CompradoresDatos;
};

export type CompradoresEventOption = {
  eventoId: string;
  nombre: string;
  categoria: string;
  /** ISO yyyy-mm-dd; "" si no hay fecha ni en catálogo ni en tickets. */
  fecha: string;
  tickets: number;
};

/** Sentinela en la URL: `event=all` = el usuario eligió explícitamente todos. */
export const EVENT_ALL = "all";

export const DEFAULT_FILTERS: Omit<CompradoresFilters, "eventos" | "categorias"> = {
  tipo: "todos",
  contacto: "todos",
  modo: "persona",
  datos: "compradores",
};

type RawParams = Record<string, string | string[] | undefined>;

function toList(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).map((x) => x.trim()).filter(Boolean);
}

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Parsea los searchParams (de la página o de la API) a filtros. Los valores
 * desconocidos caen al default. `eventosExplicitos` es false si la URL no
 * trae `event` ni `cat`: la página elige entonces el evento por defecto; la
 * API trata ese caso como "todos los eventos".
 */
export function parseCompradoresParams(sp: RawParams): {
  filters: CompradoresFilters;
  eventosExplicitos: boolean;
} {
  const rawEventos = toList(sp.event);
  const categorias = Array.from(new Set(toList(sp.cat)));
  const eventosExplicitos = rawEventos.length > 0 || categorias.length > 0;
  const eventos = Array.from(
    new Set(rawEventos.filter((e) => e !== EVENT_ALL).map((e) => e.toUpperCase())),
  );
  const tipo = first(sp.tipo);
  const contacto = first(sp.contacto);
  const modo = first(sp.modo);
  const datos = first(sp.datos);
  return {
    eventosExplicitos,
    filters: {
      eventos,
      categorias,
      tipo: tipo === "ventas" || tipo === "cortesias" ? tipo : "todos",
      contacto: contacto === "email" || contacto === "telefono" ? contacto : "todos",
      modo: modo === "ticket" ? "ticket" : "persona",
      // Default = compradores; `datos=nominados` lo cambia. Un link viejo con
      // `datos=compradores` sigue funcionando igual.
      datos: datos === "nominados" ? "nominados" : "compradores",
    },
  };
}

/** Serializa filtros a query string (la misma forma que lee `parseCompradoresParams`). */
export function filtersToSearchParams(f: CompradoresFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.eventos.length === 0) p.append("event", EVENT_ALL);
  else for (const e of f.eventos) p.append("event", e);
  for (const c of f.categorias) p.append("cat", c);
  if (f.tipo !== DEFAULT_FILTERS.tipo) p.set("tipo", f.tipo);
  if (f.contacto !== DEFAULT_FILTERS.contacto) p.set("contacto", f.contacto);
  if (f.modo !== DEFAULT_FILTERS.modo) p.set("modo", f.modo);
  if (f.datos !== DEFAULT_FILTERS.datos) p.set("datos", f.datos);
  return p;
}

// ---------- Clase de ticket ----------

export type Clase = "VENTA" | "PASE TEMPORADA" | "CORTESIA" | "MESA VIP";

export const CLASES_VENTA: readonly Clase[] = ["VENTA", "PASE TEMPORADA"];
export const CLASES_CORTESIA: readonly Clase[] = ["CORTESIA", "MESA VIP"];

export const CLASE_LABEL: Record<Clase, string> = {
  VENTA: "Venta",
  "PASE TEMPORADA": "Pase temporada",
  CORTESIA: "Cortesía",
  "MESA VIP": "Mesa VIP",
};

/** Color de acento por clase (manual de marca). */
export const CLASE_COLOR: Record<Clase, string> = {
  VENTA: "#9F99F8",
  "PASE TEMPORADA": "#87DACD",
  CORTESIA: "#ED75A0",
  "MESA VIP": "#F6C544",
};

export function grupoDeClase(clase: string): "Ventas" | "Cortesías" {
  return (CLASES_CORTESIA as readonly string[]).includes(clase) ? "Cortesías" : "Ventas";
}

export function claseLabel(clase: string): string {
  return CLASE_LABEL[clase as Clase] ?? clase;
}

export function claseColor(clase: string): string {
  return CLASE_COLOR[clase as Clase] ?? "#999999";
}

// ---------- Columnas del export ----------

export type ExportColumn = {
  /** Clave de la fila que devuelve el SQL de export. */
  key: string;
  /** Encabezado del CSV y de la tabla de vista previa. */
  header: string;
  align?: "left" | "right";
  /** Transformación de display (CSV y tabla). */
  format?: "bool" | "clase" | "grupo" | "int";
};

const COLS_PERSONA: ExportColumn[] = [
  { key: "nombre_contacto", header: "Nombre {quien}" },
  { key: "email_contacto", header: "Email {quien}" },
  { key: "telefono_contacto", header: "Teléfono {quien}" },
  { key: "tickets", header: "Tickets", align: "right", format: "int" },
  { key: "personas", header: "Personas", align: "right", format: "int" },
  { key: "eventos", header: "Eventos", align: "right", format: "int" },
  { key: "eventos_lista", header: "Eventos (IDs)" },
  { key: "ultimo_evento", header: "Último evento" },
  { key: "ultima_fecha_evento", header: "Fecha último evento" },
  { key: "ultima_compra", header: "Última compra" },
  { key: "grupo", header: "Grupo", format: "grupo" },
  { key: "clase", header: "Tipo", format: "clase" },
  { key: "asistio", header: "Asistió alguna vez", format: "bool" },
];

const COLS_TICKET: ExportColumn[] = [
  { key: "nombre_contacto", header: "Nombre {quien}" },
  { key: "email_contacto", header: "Email {quien}" },
  { key: "telefono_contacto", header: "Teléfono {quien}" },
  { key: "evento_id", header: "Evento ID" },
  { key: "evento_nombre", header: "Evento" },
  { key: "fecha_evento", header: "Fecha evento" },
  { key: "grupo", header: "Grupo", format: "grupo" },
  { key: "clase", header: "Tipo", format: "clase" },
  { key: "tipo_ticket", header: "Tipo de ticket" },
  { key: "categoria_ticket", header: "Categoría ticket" },
  { key: "fecha_compra", header: "Fecha de compra" },
  { key: "personas", header: "Personas", align: "right", format: "int" },
  { key: "asistio", header: "Asistió", format: "bool" },
  { key: "ticketera", header: "Ticketera" },
  { key: "orden", header: "Orden" },
  { key: "nombre_otro", header: "Nombre {otro}" },
  { key: "email_otro", header: "Email {otro}" },
];

/** Rótulo de la fuente de datos ("nominado" / "comprador"). */
export function quienLabel(datos: CompradoresDatos): string {
  return datos === "compradores" ? "comprador" : "nominado";
}

/**
 * Columnas del CSV. Las claves son genéricas (`*_contacto` = la fuente
 * elegida, `*_otro` = la otra, solo en el modo por ticket); los encabezados
 * dicen de quién es cada dato.
 */
export function exportColumns(
  modo: CompradoresModo,
  datos: CompradoresDatos = "compradores",
): ExportColumn[] {
  const quien = quienLabel(datos);
  const otro = quienLabel(datos === "compradores" ? "nominados" : "compradores");
  return (modo === "ticket" ? COLS_TICKET : COLS_PERSONA).map((c) => ({
    ...c,
    header: c.header.replace("{quien}", quien).replace("{otro}", otro),
  }));
}

export type ExportRow = Record<string, string | number | boolean | null>;

function asString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

/** Valor de una celda listo para mostrar (tabla) o escribir (CSV). */
export function formatCell(col: ExportColumn, raw: unknown): string {
  if (raw == null) return "";
  switch (col.format) {
    case "bool":
      return raw === true || raw === "true" ? "Sí" : "No";
    case "clase":
      return claseLabel(asString(raw));
    case "grupo":
      return grupoDeClase(asString(raw));
    case "int": {
      const num = Number(asString(raw));
      return Number.isFinite(num) ? String(num) : "";
    }
    default:
      return asString(raw);
  }
}

/** Nombre de archivo del CSV según filtros (sin caracteres raros). */
export function csvFilename(filters: CompradoresFilters): string {
  const parts = ["compradores"];
  if (filters.eventos.length === 1) parts.push(filters.eventos[0]);
  else if (filters.eventos.length > 1) parts.push(`${filters.eventos.length}-eventos`);
  else if (filters.categorias.length > 0) parts.push("categoria");
  else parts.push("todos");
  parts.push(filters.datos === "compradores" ? "datos-comprador" : "datos-nominado");
  if (filters.tipo !== "todos") parts.push(filters.tipo);
  if (filters.contacto !== "todos") parts.push(`con-${filters.contacto}`);
  parts.push(filters.modo === "ticket" ? "por-ticket" : "por-persona");
  return parts.join("-").replace(/[^\w.\-]+/g, "_") + ".csv";
}
