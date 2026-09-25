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
