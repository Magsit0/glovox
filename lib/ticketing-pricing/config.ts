/**
 * Dominio del constructor de planes de pricing (MVP).
 *
 * Shape del documento (`ticketing_planes.doc`) + opciones de configuración que
 * el usuario elige al armar un plan. Tipos puros, sin React ni DB.
 */
import { DEFAULT_PARAMS } from "./formulas";

/** Etapas de venta disponibles para elegir (orden de despliegue). */
export const STAGE_OPTIONS = [
  "Pre-registro",
  "Early bird",
  "Preventa",
  "Preventa 1",
  "Preventa 2",
  "Preventa 3",
  "Venta general",
] as const;

/** Tipos de producto por defecto al crear un plan (editables). */
export const DEFAULT_TIPOS = ["Early entry", "General", "VIP"] as const;

/** Código de país del plan (espeja el countryEnum de la DB). */
export type CountryCode = "CL" | "PE";

/** Parámetros fiscales/monetarios derivados del país (no se persisten). */
export type Fiscal = {
  currency: "CLP" | "PEN";
  locale: string;
  ivaPct: number;
};

/**
 * Moneda + IVA según el país. CL = CLP / 19%, PE = PEN / 18%. Única fuente:
 * se deriva del país del plan, no se guarda en el doc (evita drift).
 */
export function fiscalForCountry(country: CountryCode): Fiscal {
  return country === "PE"
    ? { currency: "PEN", locale: "es-PE", ivaPct: 0.18 }
    : { currency: "CLP", locale: "es-CL", ivaPct: 0.19 };
}

/** Formatea un monto en la moneda del país (sin decimales). */
export function formatMoney(value: number, fiscal: Fiscal): string {
  return new Intl.NumberFormat(fiscal.locale, {
    style: "currency",
    currency: fiscal.currency,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

/** Un sponsor del evento con su % de descuento sobre el precio (0..1). */
export type Sponsor = {
  nombre: string;
  pct: number;
  /** Stock de tickets disponibles con ese descuento; null = sin límite. */
  cupo: number | null;
};

/** Una celda de la grilla: el cruce tipo de producto × etapa de venta. */
export type Celda = {
  tipo: string;
  etapa: string;
  precio: number | null;
  stock: number | null;
};

/**
 * Config por tipo de producto, independiente de la etapa: cuántos tickets se
 * planea vender de ese tipo y cuántas cortesías se entregan. null = sin definir.
 */
export type TipoConfig = {
  tipo: string;
  aVender: number | null;
  cortesias: number | null;
};

/** Documento completo de un plan (persistido en jsonb). */
export type PlanDoc = {
  cpsPct: number; // cargo por servicio (0..1)
  rebatePct: number; // rebate sobre el CPS (0..1)
  venueCapacidad: number | null; // capacidad total del venue
  ventaEsperada: number | null; // venta esperada (objetivo, en la moneda del país)
  etapas: string[];
  tiposProducto: string[];
  tiposConfig: TipoConfig[]; // por tipo: a vender + cortesías (alineado a tiposProducto)
  sponsors: Sponsor[];
  celdas: Celda[];
};

/** Documento inicial de un plan nuevo (etapas vacías, tipos por defecto). */
export function emptyDoc(): PlanDoc {
  return {
    cpsPct: DEFAULT_PARAMS.cpsPct,
    rebatePct: DEFAULT_PARAMS.rebatePct,
    venueCapacidad: null,
    ventaEsperada: null,
    etapas: [],
    tiposProducto: [...DEFAULT_TIPOS],
    tiposConfig: DEFAULT_TIPOS.map((tipo) => ({ tipo, aVender: null, cortesias: null })),
    sponsors: [],
    celdas: [],
  };
}

/**
 * Normaliza/valida un objeto desconocido (de la DB o del cliente) a un PlanDoc
 * seguro, descartando basura. Defensa para el jsonb sin esquema en la columna.
 */
export function coerceDoc(raw: unknown): PlanDoc {
  const base = emptyDoc();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Record<string, unknown>;

  const num = (v: unknown, def: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : def;
  const numOrNull = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;
  // Cantidades (capacidad, venta, a vender, cortesías, cupo, stock) no pueden
  // ser negativas: clampeamos a >= 0.
  const nonNegOrNull = (v: unknown): number | null => {
    const n = numOrNull(v);
    return n == null ? null : Math.max(0, n);
  };
  const strArr = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  const sponsors: Sponsor[] = Array.isArray(d.sponsors)
    ? d.sponsors
        .map((s) => {
          const o = (s ?? {}) as Record<string, unknown>;
          return {
            nombre: typeof o.nombre === "string" ? o.nombre : "",
            pct: num(o.pct, 0),
            cupo: nonNegOrNull(o.cupo),
          };
        })
        .filter((s) => s.nombre.trim().length > 0)
    : [];

  const etapas = strArr(d.etapas);

  // tiposProducto: trim + dedup case-insensitive (conserva la primera aparición)
  // para no romper la alineación 1:1 con tiposConfig ni colisionar claves de celda.
  const seenTipo = new Set<string>();
  const tiposRaw = strArr(d.tiposProducto)
    .map((t) => t.trim())
    .filter((t) => {
      if (!t) return false;
      const k = t.toLowerCase();
      if (seenTipo.has(k)) return false;
      seenTipo.add(k);
      return true;
    });
  const tiposProducto = tiposRaw.length ? tiposRaw : base.tiposProducto;

  // Celdas reconciliadas contra tipos y etapas válidos: una celda con un tipo o
  // etapa que ya no existe quedaría huérfana (invisible en la grilla pero
  // inflando totales). La descartamos.
  const tipoSet = new Set(tiposProducto);
  const etapaSet = new Set(etapas);
  const celdas: Celda[] = Array.isArray(d.celdas)
    ? d.celdas
        .map((c) => {
          const o = (c ?? {}) as Record<string, unknown>;
          return {
            tipo: typeof o.tipo === "string" ? o.tipo : "",
            etapa: typeof o.etapa === "string" ? o.etapa : "",
            precio: numOrNull(o.precio),
            stock: nonNegOrNull(o.stock),
          };
        })
        .filter((c) => c.tipo && c.etapa && tipoSet.has(c.tipo) && etapaSet.has(c.etapa))
    : [];

  // tiposConfig SIEMPRE alineado a tiposProducto: una entrada por tipo, en el
  // mismo orden; se descartan configs de tipos que ya no existen y se rellenan
  // con null los tipos sin config (planes viejos pre-feature incluidos).
  const rawConfig = new Map<string, { aVender: number | null; cortesias: number | null }>();
  if (Array.isArray(d.tiposConfig)) {
    for (const c of d.tiposConfig) {
      const o = (c ?? {}) as Record<string, unknown>;
      if (typeof o.tipo === "string") {
        rawConfig.set(o.tipo, { aVender: nonNegOrNull(o.aVender), cortesias: nonNegOrNull(o.cortesias) });
      }
    }
  }
  const tiposConfig: TipoConfig[] = tiposProducto.map((tipo) => ({
    tipo,
    aVender: rawConfig.get(tipo)?.aVender ?? null,
    cortesias: rawConfig.get(tipo)?.cortesias ?? null,
  }));

  return {
    cpsPct: num(d.cpsPct, base.cpsPct),
    rebatePct: num(d.rebatePct, base.rebatePct),
    venueCapacidad: nonNegOrNull(d.venueCapacidad),
    ventaEsperada: nonNegOrNull(d.ventaEsperada),
    etapas,
    tiposProducto,
    tiposConfig,
    sponsors,
    celdas,
  };
}
