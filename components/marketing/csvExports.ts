// Filas CSV de las tablas del dashboard de Marketing. Funciones puras (sin
// React ni DOM) para poder verificarlas contra datos reales; los componentes
// solo las llaman al hacer clic en "Descargar CSV".
//
// Criterios comunes:
// - Detalle PLANO (una fila por registro), incluidas las filas que en pantalla
//   quedan plegadas dentro de un grupo, en el mismo orden que la tabla.
// - Las columnas sumables van como enteros (Tickets, Sesiones, Eventos,
//   Rebotes, Vistas): cualquier tabla dinámica reproduce los totales y las
//   tasas ponderadas de la pantalla (p. ej. Rebote de un canal = Σ Rebotes /
//   Σ Sesiones), sin depender de decimales ni del idioma de la planilla.
// - Los "%" van con 4 decimales: con menos, las fuentes chicas quedan en 0 y
//   al sumar por canal/grupo el total no cuadra con la tabla.

import type { SalesOriginRow, UtmTrafficRow } from "@/lib/queries/marketing";
import {
  agruparCanales,
  type CanalRealRow,
  type ConjuntoMetaRow,
  type ContenidoRow,
  type FuenteCanal,
  type Moneda,
} from "@/lib/marketing/atribucion";
import { ORIGIN_CATEGORY_MAP, categorizeOrigin } from "./salesOriginCategories";

export type CsvCell = string | number;
export type CsvTable = { headers: string[]; rows: CsvCell[][] };

const round = (v: number, decimals: number) => {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
};
const share = (part: number, total: number) =>
  total > 0 ? round((part / total) * 100, 4) : 0;

/**
 * Celda de texto segura para Excel/Sheets:
 * - IDs largos (los anuncios de Meta tienen 18 dígitos) o con cero inicial: la
 *   planilla los convierte a número y pierde los últimos dígitos
 *   (1.20249E+17). `="…"` los deja como texto exacto; es seguro porque solo se
 *   aplica a strings compuestos únicamente por dígitos.
 * - "-", "+", "-10": no son fórmulas, se exportan tal cual (el dato real trae
 *   utm_content "-").
 * - Todo lo demás que empiece con = + - @ (o tab/salto de línea, o espacios
 *   antes de esos caracteres) se prefija con ' para que no se ejecute como
 *   fórmula (CSV injection): Referido y los UTM vienen de URLs que cualquiera
 *   puede armar.
 */
function textCell(v: string): string {
  if (/^\d{12,}$/.test(v) || /^0\d+$/.test(v)) return `="${v}"`;
  if (/^[+-]?(\d+(\.\d+)?)?$/.test(v)) return v;
  return /^[=+\-@\t\r\n]/.test(v) || /^[=+\-@]/.test(v.trimStart()) ? `'${v}` : v;
}

const originLabel = (origin: string) => origin || "(directo)";

/**
 * "Origen de Venta": una fila por origen. "Grupo" es la fila de primer nivel
 * de la tabla: la categoría (p. ej. "Paid Media Meta") o, para los orígenes
 * sueltos, el mismo origen; así una tabla dinámica por Grupo da exactamente las
 * filas que se ven en pantalla.
 */
export function buildSalesOriginCsv(data: SalesOriginRow[]): CsvTable {
  const total = data.reduce((s, r) => s + r.tickets, 0);

  // Mismo armado que SalesOriginTable: categorías en orden de aparición y
  // después los orígenes sueltos; sort estable por total desc (empates en el
  // mismo orden que la tabla) y, dentro de cada grupo, por tickets desc.
  const catMap = new Map<string, SalesOriginRow[]>();
  const singles: SalesOriginRow[] = [];
  for (const r of data) {
    const prefix = categorizeOrigin(r.origin);
    if (prefix) {
      if (!catMap.has(prefix)) catMap.set(prefix, []);
      catMap.get(prefix)!.push(r);
    } else {
      singles.push(r);
    }
  }
  const blocks = [
    ...[...catMap].map(([prefix, rows]) => ({
      label: ORIGIN_CATEGORY_MAP[prefix],
      rows: [...rows].sort((a, b) => b.tickets - a.tickets),
    })),
    ...singles.map((r) => ({ label: originLabel(r.origin), rows: [r] })),
  ]
    .map((b) => ({ ...b, total: b.rows.reduce((s, r) => s + r.tickets, 0) }))
    .sort((a, b) => b.total - a.total);

  const rows = blocks.flatMap((b) =>
    b.rows.map((r): CsvCell[] => [
      textCell(b.label),
      textCell(originLabel(r.origin)),
      r.tickets,
      share(r.tickets, total),
    ]),
  );
  return { headers: ["Grupo", "Origen", "Tickets", "% tickets"], rows };
}

/**
 * "Desglose de tráfico": una fila por canal × source × medium × content × term.
 * Eventos y Rebotes son conteos (Eventos/sesión × Sesiones y Rebote × Sesiones)
 * para que Σ Eventos / Σ Sesiones y Σ Rebotes / Σ Sesiones den los valores
 * ponderados que la tabla muestra en la fila de cada canal. No se exportan
 * usuarios: la vista suma usuarios diarios, que no son únicos.
 */
export function buildUtmTrafficCsv(data: UtmTrafficRow[]): CsvTable {
  const totalSessions = data.reduce((s, r) => s + r.sessions, 0);

  // Mismo orden que UtmTrafficTable: canales en orden de aparición, sort
  // estable por sesiones totales desc y, dentro de cada canal, por sesiones.
  const canalMap = new Map<string, UtmTrafficRow[]>();
  for (const r of data) {
    if (!canalMap.has(r.canal)) canalMap.set(r.canal, []);
    canalMap.get(r.canal)!.push(r);
  }
  const blocks = [...canalMap.values()]
    .map((rows) => ({
      rows: [...rows].sort((a, b) => b.sessions - a.sessions),
      total: rows.reduce((s, r) => s + r.sessions, 0),
    }))
    .sort((a, b) => b.total - a.total);

  const rows = blocks.flatMap((b) =>
    b.rows.map((r): CsvCell[] => {
      // Sin sesiones las tasas no existen (la query devuelve NULL → 0): se
      // dejan vacías para no mostrar un "0% de rebote" que parece perfecto.
      const hasSessions = r.sessions > 0;
      return [
        textCell(r.canal),
        textCell(r.source),
        textCell(r.medium),
        textCell(r.content),
        textCell(r.term),
        r.sessions,
        Math.round(r.engPerSession * r.sessions),
        Math.round(r.bounceRate * r.sessions),
        r.pageViews,
        share(r.sessions, totalSessions),
        hasSessions ? round(r.engPerSession, 2) : "",
        hasSessions ? round(r.bounceRate * 100, 2) : "",
      ];
    }),
  );
  return {
    headers: [
      "Canal",
      "Source",
      "Medium",
      "Content",
      "Term",
      "Sesiones",
      "Eventos",
      "Rebotes",
      "Vistas de página",
      "% sesiones",
      "Eventos/sesión",
      "Rebote (%)",
    ],
    rows,
  };
}

const FUENTE_LABEL: Record<FuenteCanal, string> = {
  ga4: "GA4",
  referido: "Referido",
  sin_dato: "Sin dato",
};
const FUENTE_ORDEN: Record<FuenteCanal, number> = { ga4: 0, referido: 1, sin_dato: 2 };

/**
 * "Origen real de la venta": una fila por canal × fuente (GA4 / Referido /
 * Sin dato), con los canales en el mismo orden que la tabla (agruparCanales:
 * órdenes desc, "Sin origen conocido" al final). Una tabla dinámica por Canal
 * reproduce las filas de la pantalla; "% órdenes" es sobre las órdenes medidas.
 * La venta va en la moneda del evento (CLP, o PEN en Fever Lima), nombrada en el encabezado.
 */
export function buildOrigenRealCsv(rows: CanalRealRow[], medibles: number, moneda: Moneda): CsvTable {
  const orden = new Map(agruparCanales(rows, medibles).map((g, i) => [g.canal, i]));
  const sorted = [...rows].sort(
    (a, b) =>
      (orden.get(a.canal) ?? 0) - (orden.get(b.canal) ?? 0) ||
      FUENTE_ORDEN[a.fuente] - FUENTE_ORDEN[b.fuente] ||
      b.ordenes - a.ordenes,
  );
  return {
    headers: ["Canal", "Fuente", "Órdenes", "Personas", `Venta (${moneda})`, "% órdenes"],
    rows: sorted.map((r): CsvCell[] => [
      textCell(r.canal),
      FUENTE_LABEL[r.fuente] ?? textCell(String(r.fuente)),
      r.ordenes,
      r.personas,
      Math.round(r.venta),
      share(r.ordenes, medibles),
    ]),
  };
}

/**
 * "Qué contenido vende": la lista COMPLETA (la tabla muestra el top), una fila
 * por canal × source × medium × content × term de la tabla UTM, en el mismo
 * orden (órdenes desc, luego sesiones). Conv. (%) = Órdenes GA4 ÷ Sesiones con
 * 2 decimales; vacía cuando no hubo sesiones. Venta en la moneda del evento.
 */
export function buildContenidosCsv(rows: ContenidoRow[], moneda: Moneda): CsvTable {
  return {
    headers: ["Canal", "Source", "Medium", "Content", "Term", "Sesiones", "Órdenes GA4", `Venta (${moneda})`, "Conv. (%)"],
    rows: rows.map((r): CsvCell[] => [
      textCell(r.canal),
      textCell(r.source),
      textCell(r.medium),
      textCell(r.content),
      textCell(r.term),
      r.sesiones,
      r.ordenes,
      Math.round(r.venta),
      r.sesiones > 0 ? round((r.ordenes / r.sesiones) * 100, 2) : "",
    ]),
  };
}

/**
 * "Rendimiento por conjunto (Meta)": una fila por adset, en el orden de la
 * tabla. El ID va como texto exacto (18 dígitos). Los CPA quedan vacíos
 * cuando no hay gasto o no hay compras (la tabla muestra "—").
 */
export function buildConjuntosCsv(rows: ConjuntoMetaRow[]): CsvTable {
  const cpaCell = (gasto: number, compras: number): CsvCell =>
    gasto > 0 && compras > 0 ? round(gasto / compras, 2) : "";
  return {
    headers: [
      "Campaña",
      "Conjunto",
      "ID conjunto",
      "Objetivo",
      "Gasto (USD)",
      "Pixel",
      "Órdenes GA4",
      "CPA pixel (USD)",
      "CPA GA4 (USD)",
    ],
    rows: rows.map((r): CsvCell[] => [
      textCell(r.campana),
      textCell(r.conjunto),
      textCell(r.adsetId),
      textCell(r.objetivo),
      round(r.gastoUsd, 2),
      r.pixel,
      r.ordenesGa4,
      cpaCell(r.gastoUsd, r.pixel),
      cpaCell(r.gastoUsd, r.ordenesGa4),
    ]),
  };
}

/** "<base>-<eventoId>-<AAAA-MM-DD>" con la fecha local del navegador. */
export function csvFilename(base: string, eventoId?: string): string {
  const d = new Date();
  const today = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
  return [base, eventoId, today].filter(Boolean).join("-");
}
