/**
 * Desglose del gasto real de un canal por TIPO DE CAMPAÑA y campaña individual.
 * Módulo CLIENT-SAFE (sin imports de servidor) — la clasificación corre en el
 * cliente para que expandir un canal sea instantáneo (sin refetch).
 *
 * El tipo sale SIEMPRE del campo `objective` del mart (OUTCOME_SALES→Ventas…).
 * Hubo un segundo modo que parseaba `campaign_name`; se eliminó tras auditar el
 * gasto 2026 (`npm run audit:tipos`): el objetivo clasifica el 100% del gasto y
 * el parseo de nombres dejaba el 21.3% ($26,898) en un bucket "Otros" —
 * incluidas campañas de Ventas de ~$6k cuyo nombre no sigue la convención
 * (`[Piknic Électronik SCL] Cell3 Consolidated [arranged]`). Lo único que
 * aportaba era aislar RMKT, que ahora vive como sub-etiqueta (ver esRemarketing).
 */

/** Fila cruda del mart: gasto real por (fecha, plataforma, objective, campaña). */
export type DesgloseRow = {
  fecha: string; // YYYY-MM-DD
  plataforma: string;
  objective: string;
  campaignName: string;
  gastoUsd: number;
};

// objective raw (enum de la plataforma) → tipo amigable, por plataforma.
// Editable a mano por ahora; un editor en UI/Neon queda para fase siguiente.
const OBJ_MAP: Record<string, Record<string, string>> = {
  meta: {
    OUTCOME_SALES: "Ventas",
    OUTCOME_TRAFFIC: "Tráfico",
    LINK_CLICKS: "Tráfico",
    OUTCOME_AWARENESS: "Cobertura",
    BRAND_AWARENESS: "Cobertura",
    REACH: "Cobertura",
    OUTCOME_ENGAGEMENT: "Interacción",
    POST_ENGAGEMENT: "Interacción",
    OUTCOME_LEADS: "Formularios",
    LEAD_GENERATION: "Formularios",
    OUTCOME_APP_PROMOTION: "App",
  },
  google: {
    PERFORMANCE_MAX: "P.Max",
    SEARCH: "Search",
    DISPLAY: "Display",
    VIDEO: "YouTube",
    DEMAND_GEN: "Demand Gen",
    SHOPPING: "Shopping",
  },
  tiktok: {
    REACH: "Cobertura",
    TRAFFIC: "Tráfico",
    VIDEO_VIEWS: "Video",
    ENGAGEMENT: "Interacción",
    WEB_CONVERSIONS: "Conversiones",
    CONVERSIONS: "Conversiones",
  },
};

/** Tipo derivado del objetivo (enum del mart). Fallback = raw visible / "Otros". */
export function tipoDeObjetivo(plataforma: string, objective: string): string {
  const p = plataforma.toLowerCase();
  const o = (objective || "").trim().toUpperCase();
  if (!o) return "Otros";
  return OBJ_MAP[p]?.[o] ?? o; // muestra el enum crudo si no está mapeado (visible)
}

/**
 * Remarketing NO es un tipo aparte: en la plataforma esas campañas se declaran
 * con el objetivo de su tipo real (una de "Ventas RMKT" es OUTCOME_SALES). Por
 * eso se marca como SUB-ETIQUETA de la campaña y NO se saca de su tipo — así el
 * total de Ventas sigue cerrando contra el presupuesto, que se planifica por
 * tipo completo. En 2026 son $2,890 (2.3%): Ventas $2,540 y Tráfico $350.
 */
const RMKT_RE = /RMKT|REMARKET/i;

export function esRemarketing(campaignName: string): boolean {
  return RMKT_RE.test(campaignName ?? "");
}

// ---------- Jerarquía canal → tipo → campaña ----------

export type CampanaNode = {
  nombre: string;
  dias: number[]; // real por día, alineado a `dias`
  total: number;
  /** El nombre declara remarketing. Sub-etiqueta: NO la saca de su tipo. */
  esRmkt: boolean;
};
export type TipoNode = {
  tipo: string;
  dias: number[];
  total: number;
  /** Parte de `total` que viene de campañas RMKT (subconjunto, no se resta). */
  totalRmkt: number;
  campanas: CampanaNode[];
};

/**
 * Agrupa las filas crudas en tipos y campañas por plataforma, con series diarias
 * alineadas a `dias`. Devuelve Map<plataforma, TipoNode[]> ordenado por gasto.
 */
export function buildDesglose(
  dias: string[],
  rows: DesgloseRow[],
): Map<string, TipoNode[]> {
  const colDe = new Map(dias.map((f, i) => [f, i]));
  // plataforma → tipo → { dias, campana→dias }
  type Acc = {
    dias: number[];
    total: number;
    totalRmkt: number;
    campanas: Map<string, { dias: number[]; total: number; esRmkt: boolean }>;
  };
  const porPlat = new Map<string, Map<string, Acc>>();

  for (const r of rows) {
    const col = colDe.get(r.fecha);
    if (col === undefined || !r.gastoUsd) continue;
    // Bucketea plataformas fuera de meta/google/tiktok (o NULL) en "otras",
    // para que las claves coincidan con la partición de buildDrillGrid (que
    // emite una fila-canal sintética "otras" con el residual) → esa fila queda
    // expandible y su desglose deja de quedar huérfano.
    const raw = r.plataforma.toLowerCase();
    const plat = raw === "meta" || raw === "google" || raw === "tiktok" ? raw : "otras";
    const tipo = tipoDeObjetivo(r.plataforma, r.objective);
    if (!porPlat.has(plat)) porPlat.set(plat, new Map());
    const tipos = porPlat.get(plat)!;
    if (!tipos.has(tipo))
      tipos.set(tipo, { dias: new Array(dias.length).fill(0), total: 0, totalRmkt: 0, campanas: new Map() });
    const acc = tipos.get(tipo)!;
    acc.dias[col] += r.gastoUsd;
    acc.total += r.gastoUsd;
    const camp = r.campaignName || "(sin nombre)";
    const rmkt = esRemarketing(camp);
    if (rmkt) acc.totalRmkt += r.gastoUsd;
    if (!acc.campanas.has(camp))
      acc.campanas.set(camp, { dias: new Array(dias.length).fill(0), total: 0, esRmkt: rmkt });
    const c = acc.campanas.get(camp)!;
    c.dias[col] += r.gastoUsd;
    c.total += r.gastoUsd;
  }

  const out = new Map<string, TipoNode[]>();
  for (const [plat, tipos] of porPlat) {
    const nodes: TipoNode[] = [];
    for (const [tipo, acc] of tipos) {
      const campanas: CampanaNode[] = [...acc.campanas.entries()]
        .map(([nombre, c]) => ({ nombre, dias: c.dias, total: c.total, esRmkt: c.esRmkt }))
        .sort((a, b) => b.total - a.total);
      nodes.push({ tipo, dias: acc.dias, total: acc.total, totalRmkt: acc.totalRmkt, campanas });
    }
    nodes.sort((a, b) => b.total - a.total);
    out.set(plat, nodes);
  }
  return out;
}
