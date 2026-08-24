/**
 * Facturación Cardda — módulo CLIENT-SAFE (sin imports de servidor). Pivotea el
 * consumo mensual (mart cardda_consumo_mensual, por mes×canal) a una fila por
 * período con los 4 canales + total, y le mezcla el fee de Cardda. Lo usan la
 * query (server) para tipos y el componente (cliente) para armar la tabla.
 *
 * Si acá entra un import de `@/lib/bigquery` o `@/db`, el bundle del cliente se
 * rompe con "Can't resolve child_process". Solo `import type` de esos módulos.
 */

import type { CarddaConsumoRow, CarddaFeeRow } from "@/lib/queries/inversion-medios";

export const CANALES_FACT = ["meta", "google", "tiktok", "otras"] as const;
export type CanalFact = (typeof CANALES_FACT)[number];

export const CANAL_FACT_LABEL: Record<CanalFact, string> = {
  meta: "Meta",
  google: "Google",
  tiktok: "TikTok",
  otras: "Otras",
};

export type FacturacionMes = {
  periodo: string; // YYYY-MM
  meta: number;
  google: number;
  tiktok: number;
  otras: number;
  consumoUsd: number; // suma de los 4 canales (USD)
  consumoClp: number;
  feeUsd: number; // fee de Cardda (USD)
  feeClp: number;
  feeStatus: string | null; // draft | issued
  fiscalInvoiceId: string | null;
};

function esCanal(x: string): x is CanalFact {
  return (CANALES_FACT as readonly string[]).includes(x);
}

/** Pivotea consumo (mes×canal) + fee (mes) a una fila por período, desc por fecha. */
export function buildFacturacion(
  consumo: CarddaConsumoRow[],
  fee: CarddaFeeRow[],
): FacturacionMes[] {
  const byPeriodo = new Map<string, FacturacionMes>();
  const ensure = (periodo: string): FacturacionMes => {
    let m = byPeriodo.get(periodo);
    if (!m) {
      m = {
        periodo,
        meta: 0,
        google: 0,
        tiktok: 0,
        otras: 0,
        consumoUsd: 0,
        consumoClp: 0,
        feeUsd: 0,
        feeClp: 0,
        feeStatus: null,
        fiscalInvoiceId: null,
      };
      byPeriodo.set(periodo, m);
    }
    return m;
  };

  for (const c of consumo) {
    const m = ensure(c.periodo);
    const canal: CanalFact = esCanal(c.canal) ? c.canal : "otras";
    m[canal] += c.gastoUsd;
    m.consumoUsd += c.gastoUsd;
    m.consumoClp += c.gastoClp;
  }
  for (const f of fee) {
    const m = ensure(f.periodo);
    m.feeUsd += f.feeUsd;
    m.feeClp += f.feeClp;
    m.feeStatus = f.status || m.feeStatus;
    m.fiscalInvoiceId = f.fiscalInvoiceId ?? m.fiscalInvoiceId;
  }

  return [...byPeriodo.values()].sort((a, b) => b.periodo.localeCompare(a.periodo));
}

export type ResumenFacturacion = {
  consumoTotal: number; // histórico USD
  feeTotal: number; // histórico USD
  consumoUltimoMes: number;
  feeUltimoMes: number;
  ultimoPeriodo: string | null;
  porCanalTotal: Record<CanalFact, number>; // histórico USD por canal
};

/** KPIs: total histórico + último mes + total por canal. `meses` viene desc. */
export function resumenFacturacion(meses: FacturacionMes[]): ResumenFacturacion {
  const porCanalTotal: Record<CanalFact, number> = { meta: 0, google: 0, tiktok: 0, otras: 0 };
  let consumoTotal = 0;
  let feeTotal = 0;
  for (const m of meses) {
    consumoTotal += m.consumoUsd;
    feeTotal += m.feeUsd;
    for (const c of CANALES_FACT) porCanalTotal[c] += m[c];
  }
  const ultimo = meses[0] ?? null; // ya viene desc
  return {
    consumoTotal,
    feeTotal,
    consumoUltimoMes: ultimo?.consumoUsd ?? 0,
    feeUltimoMes: ultimo?.feeUsd ?? 0,
    ultimoPeriodo: ultimo?.periodo ?? null,
    porCanalTotal,
  };
}

const MESES_ABBR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-06" → "jun 2026" · "2026-06-15" (lunes ISO) → "sem 15 jun 2026". */
export function fmtPeriodo(periodo: string): string {
  const partes = periodo.split("-").map(Number);
  const [y, m, d] = partes;
  if (!y || !m || m < 1 || m > 12) return periodo;
  if (partes.length === 3 && d) return `sem ${d} ${MESES_ABBR[m - 1]} ${y}`;
  return `${MESES_ABBR[m - 1]} ${y}`;
}
