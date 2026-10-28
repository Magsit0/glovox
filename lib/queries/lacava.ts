/**
 * Dashboard La Cava (`/lacava`) — eventos con `CategoriaEvento = 'JUMBO'`
 * (expo de vinos La Cava de Jumbo, producida por Glovox: GLO175 2025,
 * GLO209 2026, y las ediciones que vengan).
 *
 * Todas las queries acotan por la categoría en `glovox.categoriaEvento`, así
 * una edición nueva aparece sola sin tocar código. La curva comparativa entre
 * ediciones NO vive acá: reutiliza `getCurvasCompra` de `lib/queries/curvas.ts`
 * con el filtro `categoriaEventos: ["JUMBO"]` (misma matemática que
 * /marketing/curvas, ver `app/lacava/page.tsx`).
 *
 * Convenciones espejo de `lib/queries/marketing.ts`:
 *  - venta neta = SUM(Precio - Descuento), el CargoServicio se reporta aparte.
 *  - personas = SUM(PersonasPorTicket); transacciones = COUNT(*).
 *  - clase de ticket: MedioPago='Otro' → cortesía/pase/mesa; el resto es VENTA.
 *  - los devueltos quedan fuera de todos los agregados de venta.
 *
 * Solo lectura. Valores de usuario siempre por parámetros `@x`.
 */
import { query } from "@/lib/bigquery";

const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
const CATEGORY = `\`${P}.glovox.categoriaEvento\``;

/** Espejo del CASE de `TICKET_TYPE_FILTER` de lib/queries/marketing.ts. */
const CLASE_CASE = `
  CASE
    WHEN t.MedioPago = 'Otro' AND (LOWER(t.TipoTicket) LIKE '%pase%' OR LOWER(t.TipoTicket) LIKE '%pass%') THEN 'PASE TEMPORADA'
    WHEN t.MedioPago = 'Otro' AND LOWER(t.TipoTicket) LIKE '%mesa%' THEN 'MESA VIP'
    WHEN t.MedioPago = 'Otro' THEN 'CORTESIA'
    ELSE 'VENTA'
  END`;

/** Fila que cuenta como venta real (incluye pases, excluye devueltos). */
const ES_VENTA = `${CLASE_CASE} IN ('VENTA', 'PASE TEMPORADA') AND t.EsDevuelto IS NOT TRUE`;

/** CTE con el último día del evento (@eventoId): ancla de las jornadas. */
const FIN_CTE = `fin AS (
      SELECT DATE(MAX(FechaEvento)) AS ultimo_dia
      FROM ${TICKETS}
      WHERE EventoID = @eventoId
    )`;

/**
 * Jornada vigente de un ticket (alias `t`, con `fin` como `f`): el día del
 * calendario actual con el MISMO día de la semana que su `FechaEvento`,
 * anclado al último día del evento. Así los tickets comprados antes de un
 * reagendamiento (que conservan la fecha original) caen en su jornada
 * equivalente: viernes 6 nov → viernes 11 dic. Supone jornadas dentro de una
 * misma semana (un fin de semana largo); sin reagendamiento, el día no cambia.
 */
const DIA_JORNADA = `DATE_SUB(
        f.ultimo_dia,
        INTERVAL MOD(
          EXTRACT(DAYOFWEEK FROM f.ultimo_dia)
            - EXTRACT(DAYOFWEEK FROM DATE(t.FechaEvento)) + 7,
          7
        ) DAY
      )`;

function n(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "object" && "value" in (v as object))
    return Number((v as { value: unknown }).value);
  return Number(v);
}

function s(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object" && "value" in (v as object))
    return String((v as { value: unknown }).value);
  return String(v);
}

// ---------- Tipos ----------

export type LaCavaEvento = {
  eventoId: string;
  nombre: string;
  temporada: string;
  fechaEvento: string; // YYYY-MM-DD (último día del evento)
  /** fechaEvento - hoy; >= 0 mientras el evento no pasó. */
  diasParaEvento: number;
  goalTickets: number;
  personas: number;
  transacciones: number;
  ventaNeta: number;
  cargoServicio: number;
  /** Personas en cortesías (no devueltas). Fuera de `personas`/`ventaNeta`. */
  cortesias: number;
  /** Entradas VENDIDAS (venta o pase) que se reembolsaron. Fuera de `personas`. */
  devueltas: number;
  /** Venta neta (Precio - Descuento) de esas entradas devueltas. */
  ventaDevuelta: number;
  primeraOrden: string; // YYYY-MM-DD
  ultimaOrden: string; // YYYY-MM-DD
};

export type LaCavaDiaRow = {
  fecha: string; // YYYY-MM-DD
  personas: number;
  transacciones: number;
  venta: number;
  personasAcum: number;
  ventaAcum: number;
};

export type LaCavaJornadaDiaRow = {
  /** YYYY-MM-DD de la jornada (calendario vigente). */
  diaEvento: string;
  /** YYYY-MM-DD de la orden (hora local). */
  fecha: string;
  personas: number;
  venta: number;
};

export type LaCavaTipoRow = {
  /** YYYY-MM-DD de la jornada (calendario vigente) para la que vale el ticket. */
  diaEvento: string;
  tipoTicket: string;
  clase: string; // VENTA | CORTESIA | PASE TEMPORADA | MESA VIP
  transacciones: number;
  personas: number;
  venta: number;
  /** De `personas`, las compradas para una fecha anterior a un reagendamiento. */
  reasignadas: number;
  /** Entradas VENDIDAS (venta o pase) de esta jornada que se devolvieron.
   *  No están en `personas` ni en `venta`. */
  devueltas: number;
  /** De `devueltas`, las compradas para una fecha anterior a un reagendamiento. */
  devueltasReasignadas: number;
  /** Venta neta (Precio - Descuento) de esas entradas devueltas. */
  ventaDevuelta: number;
};

export type LaCavaPrecioRow = {
  precioLista: number;
  /** % de descuento aplicado sobre el precio de lista, redondeado (0 = sin dcto). */
  pctDescuento: number;
  transacciones: number;
  personas: number;
  venta: number;
};

export type LaCavaMedioRow = {
  medioPago: string;
  transacciones: number;
  personas: number;
  venta: number;
};

// ---------- Queries ----------

/**
 * Una fila por edición de La Cava, con sus agregados de venta. Ordenadas de la
 * más reciente a la más antigua (por fecha del evento).
 */
export async function getLaCavaEventos(): Promise<LaCavaEvento[]> {
  const rows = await query<Record<string, unknown>>(`
    SELECT
      c.EventoID                                            AS evento_id,
      ANY_VALUE(c.NombreGlovox)                             AS nombre,
      ANY_VALUE(c.Temporada)                                AS temporada,
      FORMAT_TIMESTAMP('%Y-%m-%d', MAX(t.FechaEvento))      AS fecha_evento,
      -- Hoy en Chile, el mismo reloj que FechaOrdenLocal (CURRENT_DATE() es UTC:
      -- desde las 21:00 de Chile ya sería mañana).
      DATE_DIFF(DATE(MAX(t.FechaEvento)), CURRENT_DATE('America/Santiago'), DAY) AS dias_para_evento,
      COALESCE(ANY_VALUE(c.goalTickets), 0)                 AS goal_tickets,
      SUM(IF(${ES_VENTA}, t.PersonasPorTicket, 0))          AS personas,
      COUNTIF(${ES_VENTA})                                  AS transacciones,
      SUM(IF(${ES_VENTA}, t.Precio - IFNULL(t.Descuento, 0), 0)) AS venta_neta,
      SUM(IF(${ES_VENTA}, t.CargoServicio, 0))              AS cargo_servicio,
      SUM(IF(${CLASE_CASE} = 'CORTESIA' AND t.EsDevuelto IS NOT TRUE, t.PersonasPorTicket, 0)) AS cortesias,
      SUM(IF(${CLASE_CASE} IN ('VENTA', 'PASE TEMPORADA') AND t.EsDevuelto IS TRUE, t.PersonasPorTicket, 0)) AS devueltas,
      SUM(IF(${CLASE_CASE} IN ('VENTA', 'PASE TEMPORADA') AND t.EsDevuelto IS TRUE, t.Precio - IFNULL(t.Descuento, 0), 0)) AS venta_devuelta,
      FORMAT_DATE('%Y-%m-%d', MIN(DATE(t.FechaOrdenLocal)))      AS primera_orden,
      FORMAT_DATE('%Y-%m-%d', MAX(DATE(t.FechaOrdenLocal)))      AS ultima_orden
    FROM ${CATEGORY} c
    JOIN ${TICKETS} t ON t.EventoID = c.EventoID
    WHERE c.CategoriaEvento = 'JUMBO'
      AND c.isCanceled IS NOT TRUE
    GROUP BY c.EventoID
    HAVING fecha_evento IS NOT NULL
    ORDER BY fecha_evento DESC
  `);
  return rows.map((r) => ({
    eventoId: s(r.evento_id),
    nombre: s(r.nombre),
    temporada: s(r.temporada),
    fechaEvento: s(r.fecha_evento),
    diasParaEvento: n(r.dias_para_evento),
    goalTickets: n(r.goal_tickets),
    personas: n(r.personas),
    transacciones: n(r.transacciones),
    ventaNeta: n(r.venta_neta),
    cargoServicio: n(r.cargo_servicio),
    cortesias: n(r.cortesias),
    devueltas: n(r.devueltas),
    ventaDevuelta: n(r.venta_devuelta),
    primeraOrden: s(r.primera_orden),
    ultimaOrden: s(r.ultima_orden),
  }));
}

/**
 * Venta diaria del evento (solo ventas reales) con acumulado, por fecha de
 * orden real — el gráfico de evolución, espejo del de /marketing/weekly.
 */
export async function getLaCavaVentaDiaria(
  eventoId: string,
): Promise<LaCavaDiaRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH diario AS (
      SELECT
        FORMAT_DATE('%Y-%m-%d', DATE(t.FechaOrdenLocal))  AS fecha,
        SUM(t.PersonasPorTicket)                     AS personas,
        COUNT(*)                                     AS transacciones,
        SUM(t.Precio - IFNULL(t.Descuento, 0))       AS venta
      FROM ${TICKETS} t
      WHERE t.EventoID = @eventoId
        AND t.FechaOrdenLocal IS NOT NULL
        AND ${ES_VENTA}
      GROUP BY fecha
    )
    SELECT
      fecha,
      personas,
      transacciones,
      venta,
      SUM(personas) OVER (ORDER BY fecha) AS personas_acum,
      SUM(venta)    OVER (ORDER BY fecha) AS venta_acum
    FROM diario
    ORDER BY fecha
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    fecha: s(r.fecha),
    personas: n(r.personas),
    transacciones: n(r.transacciones),
    venta: n(r.venta),
    personasAcum: n(r.personas_acum),
    ventaAcum: n(r.venta_acum),
  }));
}

/**
 * Venta diaria (solo ventas reales) de cada jornada del evento, por fecha de
 * orden local: la curva de cada día hacia su sold out (pestaña "Venta por
 * día"). Los tickets de fechas previas a un reagendamiento ya vienen en su
 * jornada vigente.
 */
export async function getLaCavaVentaPorJornada(
  eventoId: string,
): Promise<LaCavaJornadaDiaRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ${FIN_CTE}
    SELECT
      FORMAT_DATE('%Y-%m-%d', ${DIA_JORNADA})        AS dia_evento,
      FORMAT_DATE('%Y-%m-%d', DATE(t.FechaOrdenLocal)) AS fecha,
      SUM(t.PersonasPorTicket)                        AS personas,
      SUM(t.Precio - IFNULL(t.Descuento, 0))          AS venta
    FROM ${TICKETS} t
    CROSS JOIN fin f
    WHERE t.EventoID = @eventoId
      AND t.FechaOrdenLocal IS NOT NULL
      AND t.FechaEvento IS NOT NULL
      AND ${ES_VENTA}
    GROUP BY dia_evento, fecha
    ORDER BY dia_evento, fecha
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    diaEvento: s(r.dia_evento),
    fecha: s(r.fecha),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}

/**
 * Desglose por jornada del evento × tipo de ticket × clase. La Cava dura
 * varios días y cada ticket vale para un día específico (su `FechaEvento`).
 * Incluye cortesías y pases (para eso está la clase). Los devueltos van
 * aparte, en `devueltas`: no suman a `personas`, `venta` ni `transacciones`.
 * Una fila puede traer personas = 0 si todo lo de ese tipo se devolvió.
 *
 * Reagendamientos: cuando el evento cambia de fecha, los tickets vendidos
 * antes conservan su `FechaEvento` original (La Cava 2026 pasó del 6–8 nov
 * al 11–13 dic); cada uno se asigna a su jornada vigente (ver DIA_JORNADA).
 */
export async function getLaCavaTipos(
  eventoId: string,
): Promise<LaCavaTipoRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH ${FIN_CTE},
    base AS (
      SELECT
        DATE(t.FechaEvento) AS dia_original,
        ${DIA_JORNADA} AS dia_jornada,
        COALESCE(NULLIF(TRIM(t.TipoTicket), ''), '(sin tipo)') AS tipo_ticket,
        ${CLASE_CASE} AS clase,
        t.EsDevuelto IS TRUE AS devuelto,
        t.PersonasPorTicket AS personas,
        t.Precio - IFNULL(t.Descuento, 0) AS venta
      FROM ${TICKETS} t
      CROSS JOIN fin f
      WHERE t.EventoID = @eventoId
        AND t.FechaEvento IS NOT NULL
    )
    SELECT
      FORMAT_DATE('%Y-%m-%d', dia_jornada)                    AS dia_evento,
      tipo_ticket,
      clase,
      COUNTIF(NOT devuelto)                                   AS transacciones,
      SUM(IF(devuelto, 0, personas))                          AS personas,
      SUM(IF(devuelto, 0, venta))                             AS venta,
      SUM(IF(NOT devuelto AND dia_original != dia_jornada, personas, 0)) AS reasignadas,
      -- Devoluciones: solo entradas vendidas (venta o pase), igual que la
      -- card "Devoluciones" de getLaCavaEventos.
      SUM(IF(devuelto AND clase IN ('VENTA', 'PASE TEMPORADA'), personas, 0)) AS devueltas,
      SUM(IF(devuelto AND clase IN ('VENTA', 'PASE TEMPORADA')
               AND dia_original != dia_jornada, personas, 0))   AS devueltas_reasignadas,
      SUM(IF(devuelto AND clase IN ('VENTA', 'PASE TEMPORADA'), venta, 0)) AS venta_devuelta
    FROM base
    GROUP BY dia_evento, tipo_ticket, clase
    ORDER BY dia_evento, personas DESC
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    diaEvento: s(r.dia_evento),
    tipoTicket: s(r.tipo_ticket),
    clase: s(r.clase),
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    venta: n(r.venta),
    reasignadas: n(r.reasignadas),
    devueltas: n(r.devueltas),
    devueltasReasignadas: n(r.devueltas_reasignadas),
    ventaDevuelta: n(r.venta_devuelta),
  }));
}

/**
 * Tramos de precio de lista × % de descuento aplicado (solo ventas reales).
 * En La Cava el TipoTicket es casi siempre "GENERAL": la diferenciación real
 * del producto está en el precio de lista (preventa 1/2/3, general) y en el
 * descuento del medio de pago (Cencosud / Prime / Prime+Cencosud).
 */
export async function getLaCavaPrecios(
  eventoId: string,
): Promise<LaCavaPrecioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      t.Precio AS precio_lista,
      CAST(ROUND(SAFE_DIVIDE(IFNULL(t.Descuento, 0), NULLIF(t.Precio, 0)) * 100) AS INT64) AS pct_descuento,
      COUNT(*)                               AS transacciones,
      SUM(t.PersonasPorTicket)               AS personas,
      SUM(t.Precio - IFNULL(t.Descuento, 0)) AS venta
    FROM ${TICKETS} t
    WHERE t.EventoID = @eventoId
      AND ${ES_VENTA}
    GROUP BY precio_lista, pct_descuento
    ORDER BY precio_lista, pct_descuento
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    precioLista: n(r.precio_lista),
    pctDescuento: n(r.pct_descuento),
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}

/** Desglose por medio de pago (solo ventas reales), ordenado por venta. */
export async function getLaCavaMedios(
  eventoId: string,
): Promise<LaCavaMedioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    SELECT
      COALESCE(NULLIF(TRIM(t.MedioPago), ''), '(sin medio)') AS medio_pago,
      COUNT(*)                               AS transacciones,
      SUM(t.PersonasPorTicket)               AS personas,
      SUM(t.Precio - IFNULL(t.Descuento, 0)) AS venta
    FROM ${TICKETS} t
    WHERE t.EventoID = @eventoId
      AND ${ES_VENTA}
    GROUP BY medio_pago
    ORDER BY venta DESC
    `,
    { eventoId },
  );
  return rows.map((r) => ({
    medioPago: s(r.medio_pago),
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}

export type LaCavaBeneficio =
  | "Normal"
  | "Prime"
  | "Cencosud"
  | "Prime + Cencosud"
  | "Colaboradores"
  | "Otros";

export type LaCavaBeneficioRow = {
  beneficio: LaCavaBeneficio;
  transacciones: number;
  personas: number;
  venta: number;
};

/**
 * Tipo de ticket según el beneficio usado (solo ventas reales). La ticketera
 * no guarda el beneficio: se deduce del precio de lista, el % de descuento y
 * el medio de pago, según el plan de ticketing de cada edición.
 *  - código COLABORADOR… → Colaboradores
 *  - precio de la preventa exclusiva Prime (`precioPreventaPrime`, 2026:
 *    $10.000): sin descuento → Prime; con Tarjeta Cencosud ($9.000) →
 *    Prime + Cencosud
 *  - sin descuento → Normal
 *  - Tarjeta Cencosud con ≥ 20% → Prime + Cencosud (2026: 30%)
 *  - Tarjeta Cencosud con menos → Cencosud (2026: 10%; 2025: 15%)
 *  - otro medio con descuento < 100% → Prime (2026: 20%; 2025: 20–25%)
 *  - el resto (descuento total, etc.) → Otros
 */
export async function getLaCavaBeneficios(
  eventoId: string,
  /** Precio de lista de la preventa exclusiva Prime; 0 si la edición no tuvo. */
  precioPreventaPrime = 0,
): Promise<LaCavaBeneficioRow[]> {
  const rows = await query<Record<string, unknown>>(
    `
    WITH base AS (
      SELECT
        t.Precio AS precio,
        t.PersonasPorTicket AS personas,
        t.Precio - IFNULL(t.Descuento, 0) AS venta,
        SAFE_DIVIDE(IFNULL(t.Descuento, 0), NULLIF(t.Precio, 0)) AS pct,
        IFNULL(t.MedioPago, '') LIKE '%Cencosud%' AS cencosud,
        UPPER(IFNULL(t.CodigoPromocion, '')) LIKE 'COLABORADOR%' AS colaborador
      FROM ${TICKETS} t
      WHERE t.EventoID = @eventoId
        AND ${ES_VENTA}
    )
    SELECT
      CASE
        WHEN colaborador THEN 'Colaboradores'
        WHEN @precioPreventaPrime > 0 AND precio = @precioPreventaPrime AND cencosud
          AND IFNULL(pct, 0) >= 0.005 THEN 'Prime + Cencosud'
        WHEN @precioPreventaPrime > 0 AND precio = @precioPreventaPrime THEN 'Prime'
        WHEN IFNULL(pct, 0) < 0.005 THEN 'Normal'
        WHEN cencosud AND pct >= 0.195 THEN 'Prime + Cencosud'
        WHEN cencosud THEN 'Cencosud'
        WHEN pct < 0.995 THEN 'Prime'
        ELSE 'Otros'
      END                AS beneficio,
      COUNT(*)           AS transacciones,
      SUM(personas)      AS personas,
      SUM(venta)         AS venta
    FROM base
    GROUP BY beneficio
    ORDER BY personas DESC
    `,
    { eventoId, precioPreventaPrime },
  );
  return rows.map((r) => ({
    beneficio: s(r.beneficio) as LaCavaBeneficio,
    transacciones: n(r.transacciones),
    personas: n(r.personas),
    venta: n(r.venta),
  }));
}
