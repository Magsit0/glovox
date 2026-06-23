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
  "Registrados",
  "Early bird",
  "Preventa",
  "Preventa 1",
  "Preventa 2",
  "Preventa 3",
  "Venta general",
  "Venta final",
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

/**
 * Una celda de la grilla 3D: el cruce tipo de producto × etapa × sponsor.
 * - `sponsor === ""` → celda BASE (venta general / sin sponsor, k=0). `precio` es
 *   el precio base p_ij; `stock` = cantidad sin descuento.
 * - `sponsor !== ""` → celda de sponsor. `precio` se ignora (`null`): el precio
 *   final se deriva del base × (1 − pct_sponsor) vía `derivePrecioVariante`.
 *   `stock` = cantidad asignada a ese sponsor (acotada por su `cupo`).
 */
export type Celda = {
  tipo: string;
  etapa: string;
  sponsor: string;
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
  /** Tope fijo de asientos del tipo (zonas no intercambiables). null = sin tope propio. */
  capacidad: number | null;
};

/**
 * Config por etapa de venta: fecha de inicio de esa etapa (YYYY-MM-DD; "" = sin
 * definir). El día del evento es el cierre de la última etapa.
 */
export type EtapaConfig = {
  etapa: string;
  fechaInicio: string;
};

/** Documento completo de un plan (persistido en jsonb). */
export type PlanDoc = {
  cpsPct: number; // cargo por servicio (0..1)
  rebatePct: number; // rebate sobre el CPS (0..1)
  eventoId: string; // EventoID real ligado (para curvas tickets/PM/RRSS del informe)
  venueCapacidad: number | null; // capacidad total del venue
  ventaEsperada: number | null; // venta esperada (objetivo, en la moneda del país)
  etapas: string[];
  etapasConfig: EtapaConfig[]; // por etapa: fecha de inicio (alineado a etapas)
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
    eventoId: "",
    venueCapacidad: null,
    ventaEsperada: null,
    etapas: [],
    etapasConfig: [],
    tiposProducto: [...DEFAULT_TIPOS],
    tiposConfig: DEFAULT_TIPOS.map((tipo) => ({
      tipo,
      aVender: null,
      cortesias: null,
      capacidad: null,
    })),
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

  // Celdas reconciliadas contra tipos, etapas y sponsors válidos. Una celda con
  // un tipo/etapa/sponsor que ya no existe quedaría huérfana (invisible en la
  // grilla pero inflando totales). La descartamos.
  //
  // Back-compat 2D→3D: una celda vieja sin `sponsor` se lee como BASE
  // (`sponsor=""`, venta general) → un doc 2D queda idéntico, con todo el stock
  // en el sponsor general. El precio solo se conserva en la base (en celdas de
  // sponsor el precio es derivado → null), lo que hace a coerceDoc idempotente.
  const tipoSet = new Set(tiposProducto);
  const etapaSet = new Set(etapas);
  const sponsorSet = new Set(sponsors.map((s) => s.nombre));
  const seenCelda = new Set<string>();
  const celdas: Celda[] = Array.isArray(d.celdas)
    ? d.celdas
        .map((c) => {
          const o = (c ?? {}) as Record<string, unknown>;
          const sponsor = typeof o.sponsor === "string" ? o.sponsor : "";
          const esBase = sponsor === "";
          return {
            tipo: typeof o.tipo === "string" ? o.tipo : "",
            etapa: typeof o.etapa === "string" ? o.etapa : "",
            sponsor,
            precio: esBase ? numOrNull(o.precio) : null,
            stock: nonNegOrNull(o.stock),
          };
        })
        .filter((c) => {
          if (!c.tipo || !c.etapa) return false;
          if (!tipoSet.has(c.tipo) || !etapaSet.has(c.etapa)) return false;
          if (c.sponsor !== "" && !sponsorSet.has(c.sponsor)) return false;
          const k = `${c.tipo}␟${c.etapa}␟${c.sponsor}`;
          if (seenCelda.has(k)) return false;
          seenCelda.add(k);
          return true;
        })
    : [];

  // tiposConfig SIEMPRE alineado a tiposProducto: una entrada por tipo, en el
  // mismo orden; se descartan configs de tipos que ya no existen y se rellenan
  // con null los tipos sin config (planes viejos pre-feature incluidos).
  const rawConfig = new Map<
    string,
    { aVender: number | null; cortesias: number | null; capacidad: number | null }
  >();
  if (Array.isArray(d.tiposConfig)) {
    for (const c of d.tiposConfig) {
      const o = (c ?? {}) as Record<string, unknown>;
      if (typeof o.tipo === "string") {
        rawConfig.set(o.tipo, {
          aVender: nonNegOrNull(o.aVender),
          cortesias: nonNegOrNull(o.cortesias),
          capacidad: nonNegOrNull(o.capacidad),
        });
      }
    }
  }
  const tiposConfig: TipoConfig[] = tiposProducto.map((tipo) => ({
    tipo,
    aVender: rawConfig.get(tipo)?.aVender ?? null,
    cortesias: rawConfig.get(tipo)?.cortesias ?? null,
    capacidad: rawConfig.get(tipo)?.capacidad ?? null,
  }));

  // etapasConfig SIEMPRE alineado a etapas: una entrada por etapa, con su fecha
  // de inicio (planes viejos sin fechas quedan con "").
  const rawEtapaCfg = new Map<string, string>();
  if (Array.isArray(d.etapasConfig)) {
    for (const c of d.etapasConfig) {
      const o = (c ?? {}) as Record<string, unknown>;
      if (typeof o.etapa === "string") {
        rawEtapaCfg.set(o.etapa, typeof o.fechaInicio === "string" ? o.fechaInicio : "");
      }
    }
  }
  const etapasConfig: EtapaConfig[] = etapas.map((etapa) => ({
    etapa,
    fechaInicio: rawEtapaCfg.get(etapa) ?? "",
  }));

  return {
    cpsPct: num(d.cpsPct, base.cpsPct),
    rebatePct: num(d.rebatePct, base.rebatePct),
    eventoId: typeof d.eventoId === "string" ? d.eventoId : "",
    venueCapacidad: nonNegOrNull(d.venueCapacidad),
    ventaEsperada: nonNegOrNull(d.ventaEsperada),
    etapas,
    etapasConfig,
    tiposProducto,
    tiposConfig,
    sponsors,
    celdas,
  };
}
