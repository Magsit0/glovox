/**
 * Optimizador de ingresos de ticketing (función pura) — MODELO TECHO.
 *
 * El modelo más simple posible: el precio y la demanda son DATOS, no se
 * optimizan. Precio = p0 (histórico, o el que edites); demanda = D0 (histórico,
 * o el que edites). El modelo SOLO decide cuánto vender por celda 3D
 * (tipo × etapa × sponsor) para maximizar el ingreso dentro de la capacidad y
 * los cupos. El resultado es el "techo": el máximo que podrías vender. La
 * demanda NO reacciona al precio (esa complejidad se suma después).
 *
 *   max  Σ q_ijk · p_ijk
 *   s.a. q_ij(general)        ≤ demanda_ij
 *        Σ_ij q_ijk(sponsor)  ≤ cupo_k
 *        Σ_jk q_ijk           ≤ Cap_i − cortesías_i      (por tipo)
 *        Σ_ijk q_ijk          ≤ T − Σ cortesías          (total)
 *
 * Se resuelve con un reparto greedy por valor unitario: se sirve primero la
 * celda/lane de mayor precio hasta agotar la capacidad. Es exacto para este LP.
 */
import {
  computeTotals,
  derivePrecioVariante,
  filasDesdeCeldas3D,
  ingresoNeto,
  parseEtapaFromNombre,
  type Etapa,
} from "./formulas";
import { type PlanDoc } from "./config";

/** Sentinela del canal de venta general (k=0, sin sponsor, descuento 0). */
export const GENERAL_SPONSOR = "";

/** Ancla histórica de una celda: precio y demanda de referencia. */
export interface DemandAnchor {
  p0: number;
  d0: number;
}

export interface OptimizerSponsorLane {
  nombre: string;
  /** Descuento 0..1 sobre el precio. */
  disc: number;
  /** Cupo (tickets con descuento). null/0 = no se ofrece. */
  cupo: number | null;
}

export interface OptimizerCell {
  tipo: string;
  etapa: string;
  /** Precio de venta (p0 histórico o el override del usuario). 0 = sin precio. */
  precio: number;
  /** Demanda esperada (D0 histórico o el override). 0 = sin demanda. */
  demanda: number;
  /** true si no hay ancla histórica ni override (no participa). */
  sinHistorico: boolean;
  /** Sponsors ofrecidos en esta celda (además del canal general). */
  sponsors: OptimizerSponsorLane[];
}

export interface OptimizerTipoCap {
  tipo: string;
  capacidad: number | null;
  cortesias: number;
}

export interface OptimizerInput {
  cells: OptimizerCell[];
  tipoCaps: OptimizerTipoCap[];
  capacidadTotal: number | null;
  cpsPct: number;
  rebatePct: number;
  ivaPct: number;
  /** Ingreso bruto del plan actual (para la comparación). null = sin baseline. */
  ingresoActualBruto?: number | null;
}

export type BindingReason =
  | "demanda"
  | "capTotal"
  | "capTipo"
  | "cupoSponsor"
  | "sinPrecio"
  | "passthrough";

export interface OptimizerLaneResult {
  sponsor: string;
  precio: number;
  stock: number;
  ingresoBruto: number;
}

export interface OptimizerCellResult {
  tipo: string;
  etapa: string;
  /** Precio base de la celda (p0 / override); el sponsor deriva de acá. */
  precioBase: number;
  lanes: OptimizerLaneResult[];
  sinHistorico: boolean;
  reasons: BindingReason[];
}

export interface OptimizerResult {
  cells: OptimizerCellResult[];
  sponsors: { nombre: string; disc: number; cupo: number | null; asignado: number }[];
  totals: {
    ticketsVendidos: number;
    cortesias: number;
    aforoUsado: number;
    ingresoBruto: number;
    rebate: number;
    ingresoTotal: number;
    ingresoNeto: number;
  };
  capacidadTotal: number | null;
  comparacion: { ingresoBrutoActual: number; deltaBruto: number; deltaPct: number } | null;
  status: "optimal" | "infeasible" | "degraded";
  warnings: string[];
}

/**
 * Mapea una etapa del plan (STAGE_OPTIONS) a la canónica del eje BQ. Reusa
 * `parseEtapaFromNombre` y añade los casos del catálogo del plan.
 */
export function mapPlanStageToCanonical(planStage: string): Etapa {
  const s = planStage.trim().toLowerCase();
  if (s === "pre-registro" || s === "registrados") return "EARLY_BIRD";
  if (s === "venta general") return "GENERAL";
  if (s === "venta final") return "FINAL";
  return parseEtapaFromNombre(planStage);
}

/**
 * Colapsa un nombre de tipo de ticket a un bucket comparable (VIP vs GENERAL),
 * para que el ancla histórica de un "ON STAGE" calce con un "VIP" del plan.
 */
export function bucketTipo(tipoTicket: string): "VIP" | "GENERAL" {
  const c = (tipoTicket ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  if (/VIP|BACKSTAGE|HOSPITALITY|MESA|ON STAGE|PALCO|PRIME|CLUB|PLATINUM|GOLD/.test(c)) {
    return "VIP";
  }
  return "GENERAL";
}

/**
 * Reparte las cantidades (techo): vende el máximo posible por celda respetando
 * demanda, capacidad por tipo, capacidad total y cupos de sponsor. Greedy por
 * valor unitario (mayor precio primero).
 */
export function optimizeRevenue(input: OptimizerInput): OptimizerResult {
  const warnings: string[] = [];
  let status: OptimizerResult["status"] = "optimal";

  const totalCortesias = input.tipoCaps.reduce((a, t) => a + t.cortesias, 0);
  let remTotal = (input.capacidadTotal ?? Number.POSITIVE_INFINITY) - totalCortesias;
  const remTipo = new Map<string, number>();
  for (const t of input.tipoCaps) {
    const cap = t.capacidad == null ? Number.POSITIVE_INFINITY : t.capacidad;
    remTipo.set(t.tipo, cap - t.cortesias);
  }
  const remSponsor = new Map<string, number>();
  for (const c of input.cells) {
    for (const sp of c.sponsors) {
      if (!remSponsor.has(sp.nombre)) {
        remSponsor.set(sp.nombre, sp.cupo == null ? Number.POSITIVE_INFINITY : sp.cupo);
      }
    }
  }

  if (input.cells.some((c) => c.sinHistorico)) status = "degraded";
  if (remTotal < 0 || [...remTipo.values()].some((v) => v < 0)) {
    status = "infeasible";
    warnings.push("Las cortesías superan la capacidad disponible: no hay aforo para vender.");
  }

  type WCell = OptimizerCell & { reasons: Set<BindingReason> };
  const cells: WCell[] = input.cells.map((c) => ({ ...c, reasons: new Set<BindingReason>() }));

  type Lane = { cell: WCell; sponsor: string; precio: number; demanda: number; q: number };
  const lanes: Lane[] = [];
  for (const c of cells) {
    if (c.sinHistorico) c.reasons.add("passthrough");
    if (c.precio <= 0) c.reasons.add("sinPrecio");
    lanes.push({ cell: c, sponsor: GENERAL_SPONSOR, precio: c.precio, demanda: c.demanda, q: 0 });
    for (const sp of c.sponsors) {
      lanes.push({
        cell: c,
        sponsor: sp.nombre,
        precio: derivePrecioVariante(c.precio, sp.disc),
        demanda: sp.cupo ?? 0,
        q: 0,
      });
    }
  }
  // Mayor valor unitario primero: el canal general a precio lleno gana al sponsor con descuento.
  lanes.sort((a, b) => b.precio - a.precio);

  if (status !== "infeasible") {
    for (const lane of lanes) {
      if (lane.precio <= 0 || lane.demanda <= 0) continue;
      const tipo = lane.cell.tipo;
      const sponsorRem = lane.sponsor
        ? (remSponsor.get(lane.sponsor) ?? 0)
        : Number.POSITIVE_INFINITY;
      const cap = Math.min(
        lane.demanda,
        remTotal,
        remTipo.get(tipo) ?? Number.POSITIVE_INFINITY,
        sponsorRem,
      );
      const q = Number.isFinite(cap) ? Math.max(0, Math.floor(cap)) : 0;
      lane.q = q;
      remTotal -= q;
      remTipo.set(tipo, (remTipo.get(tipo) ?? Number.POSITIVE_INFINITY) - q);
      if (lane.sponsor) remSponsor.set(lane.sponsor, sponsorRem - q);
      // Motivo del corte (para la UI).
      if (q < lane.demanda) {
        if (lane.sponsor && q >= sponsorRem) lane.cell.reasons.add("cupoSponsor");
        else lane.cell.reasons.add(remTotal <= 0 ? "capTotal" : "capTipo");
      } else {
        lane.cell.reasons.add(lane.sponsor ? "cupoSponsor" : "demanda");
      }
    }
  }

  // Ensamblar resultado por celda + totales.
  const laneByCell = new Map<WCell, Lane[]>();
  for (const lane of lanes) {
    const arr = laneByCell.get(lane.cell) ?? [];
    arr.push(lane);
    laneByCell.set(lane.cell, arr);
  }

  let ingresoBruto = 0;
  let ticketsVendidos = 0;
  const sponsorAsignado = new Map<string, number>();
  const cellResults: OptimizerCellResult[] = cells.map((c) => {
    const ls = (laneByCell.get(c) ?? []).slice().sort((a, b) => {
      if (a.sponsor === GENERAL_SPONSOR) return -1;
      if (b.sponsor === GENERAL_SPONSOR) return 1;
      return a.sponsor.localeCompare(b.sponsor);
    });
    const laneResults: OptimizerLaneResult[] = ls.map((lane) => {
      const ing = lane.precio * lane.q;
      ingresoBruto += ing;
      ticketsVendidos += lane.q;
      if (lane.sponsor) {
        sponsorAsignado.set(lane.sponsor, (sponsorAsignado.get(lane.sponsor) ?? 0) + lane.q);
      }
      return { sponsor: lane.sponsor, precio: lane.precio, stock: lane.q, ingresoBruto: ing };
    });
    return {
      tipo: c.tipo,
      etapa: c.etapa,
      precioBase: c.precio,
      lanes: laneResults,
      sinHistorico: c.sinHistorico,
      reasons: [...c.reasons],
    };
  });

  const rebate = ingresoBruto * input.cpsPct * input.rebatePct;
  const sponsors = [...new Set(input.cells.flatMap((c) => c.sponsors.map((s) => s.nombre)))].map(
    (nombre) => {
      const lane = input.cells.flatMap((c) => c.sponsors).find((s) => s.nombre === nombre);
      return {
        nombre,
        disc: lane?.disc ?? 0,
        cupo: lane?.cupo ?? null,
        asignado: sponsorAsignado.get(nombre) ?? 0,
      };
    },
  );

  const comparacion =
    input.ingresoActualBruto != null && input.ingresoActualBruto > 0
      ? {
          ingresoBrutoActual: input.ingresoActualBruto,
          deltaBruto: ingresoBruto - input.ingresoActualBruto,
          deltaPct: (ingresoBruto - input.ingresoActualBruto) / input.ingresoActualBruto,
        }
      : null;

  return {
    cells: cellResults,
    sponsors,
    totals: {
      ticketsVendidos,
      cortesias: totalCortesias,
      aforoUsado: ticketsVendidos + totalCortesias,
      ingresoBruto,
      rebate,
      ingresoTotal: ingresoBruto + rebate,
      ingresoNeto: ingresoNeto(ingresoBruto, input.ivaPct),
    },
    capacidadTotal: input.capacidadTotal,
    comparacion,
    status,
    warnings,
  };
}

export interface BuildOptimizerOptions {
  /** Ancla histórica por clave `${bucketTipo(tipo)}|${etapaNorm}`. */
  anchorByKey: Map<string, DemandAnchor>;
  capacidadTotal: number | null;
  ivaPct: number;
  /** Overrides del usuario por celda `${tipo}|${etapa}`. */
  priceByCell?: Map<string, number>;
  demandByCell?: Map<string, number>;
}

/**
 * Construye el `OptimizerInput` desde un `PlanDoc` + las anclas históricas.
 * Precio = override ?? p0; demanda = override ?? D0. La demanda del bucket se
 * reparte entre los tipos del plan que lo comparten (anti-doble-conteo).
 */
export function buildOptimizerInput(doc: PlanDoc, opts: BuildOptimizerOptions): OptimizerInput {
  const baseCelda = new Map<string, { precio: number | null; stock: number | null }>();
  for (const c of doc.celdas) {
    if (c.sponsor === GENERAL_SPONSOR) {
      baseCelda.set(`${c.tipo}|${c.etapa}`, { precio: c.precio, stock: c.stock });
    }
  }
  const sponsorLanes: OptimizerSponsorLane[] = doc.sponsors.map((s) => ({
    nombre: s.nombre,
    disc: s.pct,
    cupo: s.cupo,
  }));
  const bucketCount = new Map<string, number>();
  for (const tipo of doc.tiposProducto) {
    const bk = bucketTipo(tipo);
    bucketCount.set(bk, (bucketCount.get(bk) ?? 0) + 1);
  }

  const cells: OptimizerCell[] = [];
  for (const tipo of doc.tiposProducto) {
    for (const etapa of doc.etapas) {
      const key = `${tipo}|${etapa}`;
      const etapaNorm = mapPlanStageToCanonical(etapa);
      const rawAnchor = opts.anchorByKey.get(`${bucketTipo(tipo)}|${etapaNorm}`) ?? null;
      const compartido = bucketCount.get(bucketTipo(tipo)) ?? 1;
      const anchorP0 = rawAnchor?.p0 ?? 0;
      const anchorD0 = rawAnchor ? rawAnchor.d0 / compartido : 0;

      const precioOv = opts.priceByCell?.get(key);
      const demandaOv = opts.demandByCell?.get(key);
      const tieneOverride = precioOv != null || demandaOv != null;
      const precio = precioOv ?? anchorP0;
      const demanda = demandaOv ?? anchorD0;
      const sinHistorico = !rawAnchor && !tieneOverride;
      const sponsors = precio > 0 && demanda > 0 ? sponsorLanes : [];

      cells.push({ tipo, etapa, precio, demanda, sinHistorico, sponsors });
    }
  }

  const tipoCaps: OptimizerTipoCap[] = doc.tiposConfig.map((t) => ({
    tipo: t.tipo,
    capacidad: t.capacidad,
    cortesias: t.cortesias ?? 0,
  }));

  const precioBaseDe = (tipo: string, etapa: string) =>
    baseCelda.get(`${tipo}|${etapa}`)?.precio ?? null;
  const ingresoActualBruto = computeTotals(
    filasDesdeCeldas3D(doc.celdas, doc.sponsors, precioBaseDe),
    { cpsPct: doc.cpsPct, rebatePct: doc.rebatePct },
  ).ingresos;

  return {
    cells,
    tipoCaps,
    capacidadTotal: opts.capacidadTotal,
    cpsPct: doc.cpsPct,
    rebatePct: doc.rebatePct,
    ivaPct: opts.ivaPct,
    ingresoActualBruto,
  };
}
