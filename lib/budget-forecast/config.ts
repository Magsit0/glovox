/**
 * Dominio del constructor de presupuesto de evento (v1, modelo documento).
 *
 * Shape del documento (`presupuestos_evento.doc`) + catálogos de configuración.
 * Tipos puros, sin React ni DB. Gemelo de lib/ticketing-pricing/config.ts.
 *
 * Flujo del forecast: asistentes → ingreso (tickets + F&B + marcas/otros) →
 * techo presupuestario (markup sobre costo) → cascada del techo por categoría.
 */
import { DEFAULT_BUDGET_PARAMS } from "./formulas";

// Fuente ÚNICA de moneda/IVA/formato: se reutiliza la de pricing (no duplicar
// para no reintroducir drift). El país deriva estos parámetros.
export {
  fiscalForCountry,
  formatMoney,
  type CountryCode,
  type Fiscal,
} from "@/lib/ticketing-pricing/config";

/**
 * Cómo se interpreta `targetMargin` al derivar el techo presupuestario.
 * - "markup": techo = ingreso / (1 + margen)  → 180M, 20% ⇒ 150M (decisión v1).
 * - "share":  techo = ingreso × (1 − margen)  → 180M, 20% ⇒ 144M (disponible, no en UI v1).
 */
export type MarginMode = "markup" | "share";

/** Claves canónicas de los buckets de costo (7 categorías, decisión del usuario). */
export const CATEGORIA_KEYS = [
  "lineup",
  "produccion",
  "venue",
  "ops",
  "marketing",
  "sueldos",
  "otras",
] as const;

export type CategoriaKey = (typeof CATEGORIA_KEYS)[number];

/**
 * Catálogo por defecto de categorías + su fracción del techo (suma 1.00). Es el
 * FALLBACK cuando no hay histórico; al crear un presupuesto los `pct` se siembran
 * desde eventos comparables (lib/queries/presupuesto.ts) y quedan editables.
 */
export const DEFAULT_CATEGORIAS: { key: CategoriaKey; label: string; pct: number }[] = [
  { key: "lineup", label: "Line up / Artística", pct: 0.3 },
  { key: "produccion", label: "Producción site & técnica", pct: 0.2 },
  { key: "venue", label: "Venue", pct: 0.1 },
  { key: "ops", label: "Operaciones", pct: 0.1 },
  { key: "marketing", label: "Marketing", pct: 0.15 },
  { key: "sueldos", label: "Sueldos", pct: 0.1 },
  { key: "otras", label: "Otras", pct: 0.05 },
];

const LABEL_BY_KEY = new Map(DEFAULT_CATEGORIAS.map((c) => [c.key, c.label]));

export function labelForCategoria(key: string): string {
  return LABEL_BY_KEY.get(key as CategoriaKey) ?? key;
}

/**
 * La clasificación item_categoria → bucket ya NO vive acá: desde el 3-jul-2026
 * la resuelve el lake en `marts.finanzas_gastos.bucket_presupuesto`, alimentada
 * por el seed editable `finanzas.unabase_categoria_map` (data-governance;
 * corregir un mapeo = editar el CSV y recargarlo, sin deploy de la app). Las
 * regex CATEGORIA_RULES que vivían acá fueron materializadas en ese seed.
 */

/** Una categoría del presupuesto con su asignación del techo. */
export type CategoriaPresupuesto = {
  key: string;
  label: string;
  /** Fracción del techo (0..1). Editable; default histórico o DEFAULT_CATEGORIAS. */
  pct: number;
  /** Override absoluto en moneda; si != null manda sobre `pct` para esa fila. */
  montoOverride: number | null;
};

/** Documento completo de un presupuesto (persistido en jsonb). */
export type PresupuestoDoc = {
  eventoId: string; // EventoID de glovox.categoriaEvento (puede ser "")
  asistentes: number | null; // asistentes esperados
  // --- Ingresos proyectados (todo BRUTO, IVA incluido) ---
  ticketPerCapita: number | null; // venta de tickets / asistente (default cierreEventos)
  fbPerCapita: number | null; // PerCapitaFFyBB (default cierreEventos)
  ingresoMarcasOtros: number | null; // "Ingreso por marcas u otros" (manual, default 0)
  // --- Margen → techo ---
  marginMode: MarginMode;
  targetMargin: number; // 0..1 (0.20 = 20%)
  // --- Cascada de costos ---
  categorias: CategoriaPresupuesto[];
};

/** Documento inicial de un presupuesto nuevo (categorías por defecto). */
export function emptyDoc(): PresupuestoDoc {
  return {
    eventoId: "",
    asistentes: null,
    ticketPerCapita: null,
    fbPerCapita: null,
    ingresoMarcasOtros: null,
    marginMode: "markup",
    targetMargin: DEFAULT_BUDGET_PARAMS.targetMargin,
    categorias: DEFAULT_CATEGORIAS.map((c) => ({
      key: c.key,
      label: c.label,
      pct: c.pct,
      montoOverride: null,
    })),
  };
}

/**
 * Normaliza/valida un objeto desconocido (de la DB o del cliente) a un
 * PresupuestoDoc seguro. Defensa para el jsonb sin esquema. Idempotente.
 */
export function coerceDoc(raw: unknown): PresupuestoDoc {
  const base = emptyDoc();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;

  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  // Cantidades y per-cápitas no pueden ser negativas.
  const nonNegOrNull = (v: unknown): number | null => {
    const n = numOrNull(v);
    return n == null ? null : Math.max(0, n);
  };
  const clamp01 = (v: unknown, def: number): number => {
    const n = numOrNull(v);
    if (n == null) return def;
    return Math.min(1, Math.max(0, n));
  };

  // Categorías reconciliadas: dedup por key (case-insensitive, conserva la
  // primera), pct clampeado a [0,1], montoOverride >= 0. Si viene vacío, se
  // reponen las categorías por defecto (docs viejos / basura).
  const seen = new Set<string>();
  const categoriasRaw: CategoriaPresupuesto[] = Array.isArray(d.categorias)
    ? d.categorias
        .map((c) => {
          const o = (c ?? {}) as Record<string, unknown>;
          const key = typeof o.key === "string" ? o.key.trim() : "";
          return {
            key,
            label:
              typeof o.label === "string" && o.label.trim()
                ? o.label
                : labelForCategoria(key),
            pct: clamp01(o.pct, 0),
            montoOverride: nonNegOrNull(o.montoOverride),
          };
        })
        .filter((c) => {
          if (!c.key) return false;
          const k = c.key.toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
    : [];
  const categorias = categoriasRaw.length ? categoriasRaw : base.categorias;

  return {
    eventoId: typeof d.eventoId === "string" ? d.eventoId : "",
    asistentes: nonNegOrNull(d.asistentes),
    ticketPerCapita: nonNegOrNull(d.ticketPerCapita),
    fbPerCapita: nonNegOrNull(d.fbPerCapita),
    ingresoMarcasOtros: nonNegOrNull(d.ingresoMarcasOtros),
    marginMode: d.marginMode === "share" ? "share" : "markup",
    targetMargin: clamp01(d.targetMargin, base.targetMargin),
    categorias,
  };
}
