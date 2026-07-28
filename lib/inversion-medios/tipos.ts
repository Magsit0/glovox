/**
 * Desglose del gasto real de un canal por TIPO DE CAMPAÑA y campaña individual.
 * Módulo CLIENT-SAFE (sin imports de servidor) — la clasificación corre en el
 * cliente para que el toggle Objetivo↔Nombre sea instantáneo (sin refetch).
 *
 * Dos formas de derivar el "tipo":
 *  - "objetivo": normaliza el campo `objective` del mart (OUTCOME_SALES→Ventas…).
 *  - "nombre": parsea el `campaign_name` (capta matices como RMKT).
 * Lo no reconocido cae en un bucket "Otros" — nunca se pierde gasto.
 */

export type ModoTipo = "objetivo" | "nombre";

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

/** Tipo derivado del nombre de campaña (texto libre; capta RMKT). */
export function tipoDeNombre(campaignName: string): string {
  const n = (campaignName || "").toUpperCase();
  if (!n.trim()) return "Otros";
  if (/RMKT|REMARKET/.test(n)) return "Remarketing";
  if (/VENTA/.test(n)) return "Ventas";
  if (/COBERTURA|AWARENESS|\bREACH\b/.test(n)) return "Cobertura";
  if (/TR[AÁ]FICO|TRAFFIC/.test(n)) return "Tráfico";
  if (/P\.?\s?MAX|PMAX|PERFORMANCE\s?MAX/.test(n)) return "P.Max";
  if (/SEARCH|B[UÚ]SQUEDA/.test(n)) return "Search";
  if (/YOUTUBE|\bYT\b/.test(n)) return "YouTube";
  if (/INTERACC|ENGAGE/.test(n)) return "Interacción";
  if (/FORMULARIO|LEADS?/.test(n)) return "Formularios";
  if (/PRE.?REG/.test(n)) return "Pre-registro";
  return "Otros";
}

export function tipoDe(row: DesgloseRow, modo: ModoTipo): string {
  return modo === "objetivo"
    ? tipoDeObjetivo(row.plataforma, row.objective)
    : tipoDeNombre(row.campaignName);
}

// ---------- Jerarquía canal → tipo → campaña ----------

export type CampanaNode = {
  nombre: string;
  dias: number[]; // real por día, alineado a `dias`
  total: number;
};
export type TipoNode = {
  tipo: string;
  dias: number[];
  total: number;
  campanas: CampanaNode[];
};

/**
 * Agrupa las filas crudas en tipos y campañas por plataforma, con series diarias
 * alineadas a `dias`. Devuelve Map<plataforma, TipoNode[]> ordenado por gasto.
 */
export function buildDesglose(
  dias: string[],
  rows: DesgloseRow[],
  modo: ModoTipo,
): Map<string, TipoNode[]> {
  const colDe = new Map(dias.map((f, i) => [f, i]));
  // plataforma → tipo → { dias, campana→dias }
  type Acc = {
    dias: number[];
    total: number;
    campanas: Map<string, { dias: number[]; total: number }>;
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
    const tipo = tipoDe(r, modo);
    if (!porPlat.has(plat)) porPlat.set(plat, new Map());
    const tipos = porPlat.get(plat)!;
    if (!tipos.has(tipo)) tipos.set(tipo, { dias: new Array(dias.length).fill(0), total: 0, campanas: new Map() });
    const acc = tipos.get(tipo)!;
    acc.dias[col] += r.gastoUsd;
    acc.total += r.gastoUsd;
    const camp = r.campaignName || "(sin nombre)";
    if (!acc.campanas.has(camp)) acc.campanas.set(camp, { dias: new Array(dias.length).fill(0), total: 0 });
    const c = acc.campanas.get(camp)!;
    c.dias[col] += r.gastoUsd;
    c.total += r.gastoUsd;
  }

  const out = new Map<string, TipoNode[]>();
  for (const [plat, tipos] of porPlat) {
    const nodes: TipoNode[] = [];
    for (const [tipo, acc] of tipos) {
      const campanas: CampanaNode[] = [...acc.campanas.entries()]
        .map(([nombre, c]) => ({ nombre, dias: c.dias, total: c.total }))
        .sort((a, b) => b.total - a.total);
      nodes.push({ tipo, dias: acc.dias, total: acc.total, campanas });
    }
    nodes.sort((a, b) => b.total - a.total);
    out.set(plat, nodes);
  }
  return out;
}
