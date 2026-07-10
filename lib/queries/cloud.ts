import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;

// Contrato estable producido por data-governance (vista curada). Une el histórico
// (seed CSV) y —tras el cutover— el export vivo de Cloud Billing. Una fila por
// (mes, servicio). Ver data-governance/schemas/bigquery/views/marts_gcp_gasto_mensual.sql
const GASTO_MENSUAL = `\`${P}.marts.gcp_gasto_mensual\``;

export type MonthTotal = { mes: string; costo: number };
export type ServiceTotal = { servicio: string; costo: number };

export type CloudSpend = {
  moneda: string;
  /** Totales por mes, orden ascendente ('YYYY-MM'). */
  monthly: MonthTotal[];
  /** Mes más reciente presente en el dato ('YYYY-MM'), o null si no hay datos. */
  currentMonth: string | null;
  /** Gasto del mes más reciente (= lo que va del mes / MTD). */
  currentMonthTotal: number;
  /** Gasto del mes inmediatamente anterior (para el delta). */
  prevMonthTotal: number;
  /** Desglose por servicio del mes más reciente, orden descendente. */
  currentByService: ServiceTotal[];
  /** Gasto total acumulado de toda la serie. */
  totalAllTime: number;
};

type MonthRow = { mes: string; costo: number; moneda: string | null };

/**
 * Lee el gasto de Google Cloud desde la vista curada y arma todo lo que la
 * pestaña /admin/cloud necesita. Dos queries en paralelo:
 *   1. totales por mes (barras + KPIs)
 *   2. desglose por servicio del mes más reciente.
 */
export async function getCloudSpend(): Promise<CloudSpend> {
  const monthlySql = `
    SELECT
      FORMAT_DATE('%Y-%m', mes) AS mes,
      CAST(SUM(costo) AS FLOAT64) AS costo,
      ANY_VALUE(moneda) AS moneda
    FROM ${GASTO_MENSUAL}
    GROUP BY mes
    ORDER BY mes
  `;

  const byServiceSql = `
    SELECT
      servicio,
      CAST(SUM(costo) AS FLOAT64) AS costo
    FROM ${GASTO_MENSUAL}
    WHERE mes = (SELECT MAX(mes) FROM ${GASTO_MENSUAL})
    GROUP BY servicio
    HAVING costo <> 0
    ORDER BY costo DESC
  `;

  const [monthRows, serviceRows] = await Promise.all([
    query<MonthRow>(monthlySql),
    query<ServiceTotal>(byServiceSql),
  ]);

  const monthly: MonthTotal[] = monthRows.map((r) => ({
    mes: r.mes,
    costo: Number(r.costo) || 0,
  }));

  const moneda = monthRows.find((r) => r.moneda)?.moneda ?? "CLP";
  const currentMonth = monthly.length ? monthly[monthly.length - 1].mes : null;
  const currentMonthTotal = monthly.length ? monthly[monthly.length - 1].costo : 0;
  const prevMonthTotal = monthly.length > 1 ? monthly[monthly.length - 2].costo : 0;
  const totalAllTime = monthly.reduce((s, m) => s + m.costo, 0);

  const currentByService: ServiceTotal[] = serviceRows.map((r) => ({
    servicio: r.servicio,
    costo: Number(r.costo) || 0,
  }));

  return {
    moneda,
    monthly,
    currentMonth,
    currentMonthTotal,
    prevMonthTotal,
    currentByService,
    totalAllTime,
  };
}
