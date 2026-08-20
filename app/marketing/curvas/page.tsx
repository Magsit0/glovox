import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import type { Country } from "@/lib/queries/comunidad";
import {
  getCurvasCompra,
  getCurvasEventOptions,
  getCurvasTipoTicketMap,
  type CurvaComunidad,
  type CurvasFilters as CurvasQueryFilters,
} from "@/lib/queries/curvas";
import {
  buildCurvas,
  resumirCurvas,
  type CurvaGroupBy,
  type CurvaMetric,
  type CurvaVista,
} from "@/lib/marketing/curvas";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";
import CurvasFilters from "@/components/marketing/CurvasFilters";
import CurvasCompraChart from "@/components/marketing/charts/CurvasCompraChart";

export const dynamic = "force-dynamic";

/** Tope de curvas dibujadas: más que esto es ilegible y pesado de renderizar. */
const MAX_SERIES = 14;

interface PageProps {
  searchParams: Promise<{
    categorias?: string | string[];
    categorias2?: string | string[];
    categorias3?: string | string[];
    temporadas?: string | string[];
    eventos?: string | string[];
    tipos?: string | string[];
    country?: string;
    comunidad?: string;
    devueltos?: string;
    cortesias?: string;
    metrica?: string;
    agrupar?: string;
    vista?: string;
    escala?: string;
    promedio?: string;
  }>;
}

/** Normaliza un searchParam repetible a string[] (descarta vacíos y `__none__`). */
function toArray(v: string | string[] | undefined): string[] {
  if (v == null) return [];
  return (Array.isArray(v) ? v : [v]).filter((x) => Boolean(x) && x !== "__none__");
}

/** `__none__` = el usuario deseleccionó todo (distinto de "sin filtro"). */
function isNone(v: string | string[] | undefined): boolean {
  const list = v == null ? [] : Array.isArray(v) ? v : [v];
  return list.length === 1 && list[0] === "__none__";
}

function parseComunidad(v?: string): CurvaComunidad {
  return v === "solo" || v === "sin" ? v : "todos";
}

function parseMetric(v?: string): CurvaMetric {
  return v === "personas" || v === "venta" ? v : "tickets";
}

function parseGroupBy(v?: string): CurvaGroupBy {
  if (v === "categoria" || v === "categoria2" || v === "categoria3" || v === "temporada")
    return v;
  return "evento";
}

function parseVista(v?: string): CurvaVista {
  return v === "diario" ? "diario" : "acumulado";
}

const METRIC_LABEL: Record<CurvaMetric, string> = {
  tickets: "Tickets",
  personas: "Personas",
  venta: "Recaudación",
};

const GROUP_LABEL: Record<CurvaGroupBy, string> = {
  evento: "evento",
  categoria: "categoría de evento",
  categoria2: "familia",
  categoria3: "edición",
  temporada: "temporada",
};

export default async function CurvasPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/marketing/curvas")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;

  // El país de la sesión bloquea la vista; ?country sólo se respeta para
  // usuarios sin país asignado (staff glovox.cl).
  const sessionCountry = session.user.country ?? null;
  const countryLocked = sessionCountry != null;
  const country: Country = sessionCountry
    ? sessionCountry === "PE"
      ? "peru"
      : "chile"
    : params.country === "chile" || params.country === "peru"
      ? params.country
      : "all";

  const metric = parseMetric(params.metrica);
  const groupBy = parseGroupBy(params.agrupar);
  const vista = parseVista(params.vista);
  const normalizar = params.escala === "pct";
  const promedio = params.promedio !== "0";

  // Deseleccionar todo en una faceta debe dar cero resultados, no "todos". Se
  // fuerza con un valor imposible en lugar de omitir la condición.
  const facet = (v: string | string[] | undefined): string[] | undefined => {
    if (isNone(v)) return ["__ninguno__"];
    const list = toArray(v);
    return list.length ? list : undefined;
  };

  const filters: CurvasQueryFilters = {
    country,
    categoriaEventos: facet(params.categorias),
    categoriaEventos2: facet(params.categorias2),
    categoriaEventos3: facet(params.categorias3),
    temporadas: facet(params.temporadas),
    eventoIds: facet(params.eventos),
    tipoTickets: facet(params.tipos),
    comunidad: parseComunidad(params.comunidad),
    incluirDevueltos: params.devueltos === "1",
    incluirCortesias: params.cortesias === "1",
  };

  let events;
  let rows;
  let tipoTicketMap;
  try {
    [events, rows, tipoTicketMap] = await Promise.all([
      getCurvasEventOptions(country),
      getCurvasCompra(filters),
      getCurvasTipoTicketMap(filters),
    ]);
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
          <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">
            {err instanceof Error ? err.message : "Error al cargar las curvas de venta."}
          </p>
        </div>
      </Shell>
    );
  }

  const chart = buildCurvas({
    rows,
    events,
    groupBy,
    metric,
    vista,
    normalizar,
    promedio,
    maxSeries: MAX_SERIES,
  });
  const resumen = resumirCurvas(rows, metric);

  const fmtMetric = (v: number) =>
    metric === "venta" ? formatCurrency(v) : formatNumber(Math.round(v));
  const fmtPct = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
  const fmtDias = (d: number) =>
    d > 0 ? `${formatNumber(d)} d` : d === 0 ? "0 d" : `−${formatNumber(-d)} d`;

  const hayCerrados = resumen.eventos > resumen.eventosEnVenta;

  const kpis = [
    {
      label: "Eventos en la selección",
      value: formatNumber(resumen.eventos),
      caption:
        chart.seriesTotales > 0
          ? `${formatNumber(chart.seriesTotales)} curvas por ${GROUP_LABEL[groupBy]}` +
            (resumen.eventosEnVenta > 0
              ? ` · ${formatNumber(resumen.eventosEnVenta)} en venta`
              : "")
          : "Sin datos",
    },
    {
      label: `${METRIC_LABEL[metric]} vendido`,
      value: metric === "venta" ? compactCurrency(resumen.total) : formatNumber(resumen.total),
      caption:
        metric === "venta" ? formatCurrency(resumen.total) : "Suma de la selección",
    },
    {
      label: "Anticipación mediana",
      value: resumen.medianaDias == null ? "—" : fmtDias(resumen.medianaDias),
      caption: hayCerrados
        ? "Día en que se alcanza el 50% · solo eventos cerrados"
        : "Requiere al menos un evento con venta cerrada",
    },
    {
      label: "Venta anticipada",
      value: hayCerrados ? fmtPct(resumen.pctAnticipado) : "—",
      caption: hayCerrados
        ? `Día del evento ${fmtPct(resumen.pctDiaEvento)} · después ${fmtPct(resumen.pctPosterior)}`
        : "Requiere al menos un evento con venta cerrada",
    },
  ];

  return (
    <Shell>
      <Heading />

      <CurvasFilters
        events={events}
        tipoTicketMap={tipoTicketMap}
        country={country}
        countryLocked={countryLocked}
        comunidad={filters.comunidad}
        incluirDevueltos={filters.incluirDevueltos}
        incluirCortesias={filters.incluirCortesias}
        groupBy={groupBy}
        metric={metric}
        vista={vista}
        normalizar={normalizar}
        promedio={promedio}
      />

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <article
            key={k.label}
            className="flex flex-col rounded-lg border border-[#E5E5E5] bg-white p-6"
          >
            <p className="font-sans text-xs text-[#666666]">{k.label}</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
              {k.value}
            </p>
            <p className="mt-3 truncate font-sans text-xs text-[#666666]" title={k.caption}>
              {k.caption}
            </p>
          </article>
        ))}
      </section>

      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <header className="mb-6">
          <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
            Curva de compra acumulada
          </h2>
          <p className="mt-1 font-sans text-sm text-[#666666]">
            {vista === "acumulado" ? "Acumulado" : "Venta del día"} de{" "}
            {METRIC_LABEL[metric].toLowerCase()} por {GROUP_LABEL[groupBy]}, alineado por días
            de compra anticipada. Las curvas siguen después del día del evento (venta en puerta
            y posterior).
            {normalizar && " Cada curva va como % de su propio total."}
          </p>
          {chart.seriesEnVenta > 0 && (
            <p className="mt-2 font-sans text-xs text-[#666666]">
              {chart.seriesEnVenta === 1
                ? "1 curva sigue vendiendo"
                : `${formatNumber(chart.seriesEnVenta)} curvas siguen vendiendo`}
              : se cortan en el día de hoy —los días posteriores todavía no ocurrieron— y su
              total es parcial
              {normalizar && ", así que su % está calculado sobre lo vendido hasta hoy"}.
            </p>
          )}
          {chart.promedioKey && (
            <p className="mt-1 font-sans text-xs text-[#666666]">
              La curva promedio (línea negra segmentada) promedia solo las{" "}
              {formatNumber(chart.promedioBase)} curvas con venta cerrada, para que sirva de
              referencia estable.
            </p>
          )}
          {chart.seriesOcultas > 0 && (
            <p className="mt-2 font-sans text-xs text-[#EF8C34]">
              Se dibujan las {chart.series.length} curvas de mayor volumen de{" "}
              {chart.seriesTotales}. Afina los filtros para ver el resto (los KPIs y la curva
              promedio sí consideran todas).
            </p>
          )}
        </header>

        <CurvasCompraChart
          points={chart.points}
          series={chart.series}
          promedioKey={chart.promedioKey}
          promedioBase={chart.promedioBase}
          minDias={chart.minDias}
          maxDias={chart.maxDias}
          metric={metric}
          vista={vista}
          normalizar={normalizar}
        />
      </article>

      {chart.series.length > 0 && (
        <article className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
          <header className="border-b border-[#E5E5E5] px-6 py-4">
            <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
              Avance de cada curva
            </h2>
            <p className="mt-1 font-sans text-sm text-[#666666]">
              Porcentaje del total de cada curva ya vendido a 30 y 7 días del evento, y al cierre
              del día del evento. Las curvas en venta no lo reportan: el total final todavía no
              existe, así que el porcentaje no sería medible.
            </p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead className="bg-[#FAFAFA]">
                <tr className="border-b border-[#E5E5E5]">
                  <th className="px-4 py-3 text-left font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    {groupBy === "evento" ? "Evento" : GROUP_LABEL[groupBy]}
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Eventos
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    {METRIC_LABEL[metric]}
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    A 30 días
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    A 7 días
                  </th>
                  <th className="px-4 py-3 text-right font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
                    Al día del evento
                  </th>
                </tr>
              </thead>
              <tbody>
                {chart.series.map((s) => (
                  <tr
                    key={s.key}
                    className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-b-0 hover:bg-[#FAFAFA]"
                  >
                    <td className="px-4 py-3 font-sans text-sm text-[#333333]">
                      <span className="flex items-center gap-2">
                        <span>{s.label}</span>
                        {s.enVenta && (
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#F6C544]" />
                            en venta
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatNumber(s.eventos)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {fmtMetric(s.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                      {fmtPct(s.hitos.d30)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                      {fmtPct(s.hitos.d7)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {fmtPct(s.hitos.d0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      {children}
    </div>
  );
}

function Heading() {
  return (
    <header className="flex flex-col gap-2">
      <p className="font-sans text-xs text-[#666666]">Marketing</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Curvas de venta
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Análisis global del ritmo de compra: cómo se acumula la venta de cada evento a medida que
        se acerca la fecha, para comparar ediciones, familias y temporadas entre sí.
      </p>
    </header>
  );
}
