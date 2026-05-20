"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, Inbox, Search } from "lucide-react";
import { motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/unabase/charts/ChartTooltip";
import {
  axisTick,
  gridProps,
  legendProps,
  seriesColor,
  SURFACE,
} from "@/lib/chart-colors";
import type {
  FreesCategoryNode,
  FreesDashboardData,
  FreesEventOption,
  FreesGeneroCategory,
  FreesGeneroData,
  FreesGeneroKpis,
  FreesGeneroRow,
  FreesGroupRow,
  FreesIngresoRow,
  FreesKpis,
} from "@/lib/queries/frees";
import { FreesEventSelect } from "./FreesEventSelect";

const numberFormatter = new Intl.NumberFormat("es-CL");
const percentFormatter = new Intl.NumberFormat("es-CL", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatNumber(v: number): string {
  return numberFormatter.format(v);
}
function formatPercent(v: number): string {
  return percentFormatter.format(v);
}

type Tab = "ticketType" | "categoria" | "genero";

const GENERO_COLORS: Record<string, string> = {
  Hombre: "#9F99F8",
  Mujer: "#ED75A0",
  "Sin clasificar": "#999999",
};

const TABS: { key: Tab; label: string; description: string }[] = [
  {
    key: "ticketType",
    label: "Tipo de ticket",
    description: "Distribución por ticketType en cortesías entregadas.",
  },
  {
    key: "categoria",
    label: "Categoría · Recipient",
    description: "Categoría declarada en la cortesía con sus recipients.",
  },
  {
    key: "genero",
    label: "Detalle por categoría",
    description:
      "Distribución por género, hora de ingreso y detalle por categoría/recipient.",
  },
];

export function FreesDashboard({
  data,
  events,
  selectedEvent,
}: {
  data: FreesDashboardData;
  events: FreesEventOption[];
  selectedEvent: string;
}) {
  const [tab, setTab] = useState<Tab>("ticketType");

  const categoriaRows = useMemo<FreesGroupRow[]>(
    () =>
      data.byCategory.map((c) => ({
        label: c.label,
        total: c.total,
        canjeadas: c.canjeadas,
        tasaCanje: c.tasaCanje,
      })),
    [data.byCategory],
  );

  const activeRows = useMemo<FreesGroupRow[]>(() => {
    switch (tab) {
      case "ticketType":
        return data.byTicketType;
      case "categoria":
        return categoriaRows;
      case "genero":
        return [];
    }
  }, [tab, data.byTicketType, categoriaRows]);

  const activeMeta = TABS.find((t) => t.key === tab)!;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              aria-label="Volver al menú principal"
              className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
            >
              <Image
                src="/glovox_logo_gvx_black.svg"
                alt="Glovox"
                width={18}
                height={18}
              />
            </Link>
            <p className="font-sans text-xs text-[#666666]">Glovox · Cortesías</p>
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#333333]">
              Free&apos;s
            </h1>
            <p className="max-w-2xl font-sans text-sm text-[#666666]">
              Análisis de cortesías entregadas por evento. Se recomienda escoger
              un evento en el filtro de la derecha.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <FreesEventSelect events={events} selected={selectedEvent} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
              {formatNumber(data.kpis.totalCortesias)} cortesías
            </span>
          </div>
        </div>
      </motion.header>

      <KpiSection kpis={data.kpis} />

      <nav className="flex flex-wrap gap-0 border-b border-[#E5E5E5]">
        {TABS.map((t) => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`-mb-px px-4 py-3 font-sans text-sm transition-colors ${
                isActive
                  ? "border-b-2 border-[#9F99F8] font-medium text-[#333333]"
                  : "border-b-2 border-transparent text-[#666666] hover:text-[#333333]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      <motion.section
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        {tab === "genero" ? (
          <GeneroSection
            data={data.byGenero}
            ingresoRows={data.ingresoRows}
            hasEventoFilter={Boolean(selectedEvent)}
          />
        ) : (
          <>
            <Panel
              className={tab === "ticketType" ? "lg:col-span-8" : "lg:col-span-12"}
              title={`Cortesías por ${activeMeta.label.toLowerCase()}`}
              subtitle={activeMeta.description}
            >
              <GroupBarChart rows={activeRows} />
            </Panel>
            {tab === "ticketType" && (
              <Panel
                className="lg:col-span-4"
                title="Cortesías por tipo de link"
                subtitle="Distribución por linkType declarado en la cortesía."
              >
                <GroupDonutChart rows={data.byLinkType} />
              </Panel>
            )}
            <Panel
              className="lg:col-span-12"
              title="Detalle"
              subtitle={
                tab === "categoria"
                  ? "Total entregadas, canjeadas vía ticket y tasa de canje. Expande una categoría para ver sus recipients."
                  : "Total entregadas, canjeadas vía ticket y tasa de canje."
              }
            >
              {tab === "categoria" ? (
                <CategoryTable nodes={data.byCategory} />
              ) : (
                <GroupTable rows={activeRows} />
              )}
            </Panel>
          </>
        )}
      </motion.section>
    </div>
  );
}

function KpiSection({ kpis }: { kpis: FreesKpis }) {
  const porAsignar = Math.max(
    0,
    kpis.totalCortesias - kpis.cortesiasConRecipient,
  );
  const tasaOtorgamiento =
    kpis.totalCortesias > 0
      ? kpis.cortesiasConRecipient / kpis.totalCortesias
      : 0;
  const noCanjeadasOtorgadas = Math.max(
    0,
    kpis.cortesiasConRecipient - kpis.totalCanjeadas,
  );

  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label="Cortesías emitidas"
        value={formatNumber(kpis.totalCortesias)}
        sub={`${formatNumber(kpis.ticketTypesUnicos)} tipos de ticket distintos`}
      />
      <KpiCard
        label="Cortesías asignadas"
        value={formatNumber(kpis.cortesiasConRecipient)}
        sub={`${formatNumber(porAsignar)} por asignar`}
      />
      <KpiCard
        label="Tasa de otorgamiento"
        value={formatPercent(tasaOtorgamiento)}
        sub={`${formatNumber(kpis.cortesiasConRecipient)} de ${formatNumber(kpis.totalCortesias)}`}
        delta={tasaOtorgamiento >= 0.5 ? "positive" : "negative"}
      />
      <KpiCard
        label="Cortesías canjeadas"
        value={formatNumber(kpis.totalCanjeadas)}
        sub={`${formatNumber(noCanjeadasOtorgadas)} aún sin canjear`}
        delta="positive"
      />
      <KpiCard
        label="Tasa de canje"
        value={formatPercent(kpis.tasaCanje)}
        sub={`${formatNumber(kpis.totalCanjeadas)} de ${formatNumber(kpis.cortesiasConRecipient)}`}
        delta={kpis.tasaCanje >= 0.5 ? "positive" : "negative"}
      />
    </section>
  );
}

function KpiCard({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: "positive" | "negative" | "neutral";
}) {
  const dotBg =
    delta === "positive"
      ? "bg-[#B1D750]"
      : delta === "negative"
        ? "bg-[#ED75A0]"
        : "bg-[#999999]";
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div className="font-sans text-xs text-[#666666]">{label}</div>
      <div className="mt-2 truncate font-display text-4xl font-bold leading-none tracking-tight text-[#333333]">
        {value}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {delta && <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${dotBg}`} />}
        <span className="truncate font-sans text-xs text-[#666666]">{sub}</span>
      </div>
    </article>
  );
}

function Panel({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6 ${className}`}
    >
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          {title}
        </h2>
        {subtitle && <p className="font-sans text-sm text-[#666666]">{subtitle}</p>}
      </header>
      {children}
    </article>
  );
}

function GroupBarChart({ rows }: { rows: FreesGroupRow[] }) {
  const data = useMemo(() => rows.slice(0, 12), [rows]);

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos
      </div>
    );
  }

  const height = Math.max(320, data.length * 38 + 40);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        barCategoryGap="30%"
      >
        <CartesianGrid {...gridProps} vertical horizontal={false} />
        <XAxis
          type="number"
          tick={axisTick}
          axisLine={{ stroke: SURFACE.divider }}
          tickLine={false}
          tickFormatter={(v: number) => formatNumber(v)}
        />
        <YAxis
          type="category"
          dataKey="label"
          tick={axisTick}
          axisLine={{ stroke: SURFACE.divider }}
          tickLine={false}
          width={220}
          interval={0}
        />
        <Tooltip
          cursor={{ fill: SURFACE.canvas }}
          content={({ active, label, payload }) => {
            const p = payload?.[0];
            if (!p) return <ChartTooltip active={false} items={[]} />;
            const row = p.payload as FreesGroupRow;
            return (
              <ChartTooltip
                active={active}
                label={String(label)}
                items={[
                  {
                    name: "Total emitidas",
                    color: String(p.payload?.fill ?? p.color),
                    formatted: formatNumber(row.total),
                  },
                  {
                    name: "Canjeadas",
                    color: "#B1D750",
                    formatted: formatNumber(row.canjeadas),
                  },
                  {
                    name: "Tasa de canje",
                    color: "#999999",
                    formatted: formatPercent(row.tasaCanje),
                  },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="total"
          radius={[0, 4, 4, 0]}
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={seriesColor(i)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function GroupDonutChart({ rows }: { rows: FreesGroupRow[] }) {
  const data = useMemo(() => {
    if (!rows.length) return [];
    const top = rows.slice(0, 6);
    const rest = rows.slice(6);
    const restTotal = rest.reduce((s, r) => s + r.total, 0);
    const result = top.map((r) => ({ name: r.label, value: r.total }));
    if (restTotal > 0) result.push({ name: "Otros", value: restTotal });
    return result;
  }, [rows]);

  const total = data.reduce((s, d) => s + d.value, 0);

  if (!data.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={1}
            stroke="none"
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={seriesColor(i)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                items={(payload ?? []).map((p) => ({
                  name: String(p.name),
                  color: p.payload?.fill,
                  formatted: `${formatNumber(Number(p.value))} cortesías`,
                }))}
              />
            )}
          />
          <Legend {...legendProps} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -translate-y-6">
        <span className="font-display text-3xl font-bold leading-none tracking-tight text-[#333333]">
          {formatNumber(total)}
        </span>
        <span className="mt-1 font-sans text-xs text-[#666666]">cortesías</span>
      </div>
    </div>
  );
}

function GroupTable({ rows }: { rows: FreesGroupRow[] }) {
  if (!rows.length) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos
      </div>
    );
  }

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const grandEmitidas = rows.reduce(
    (s, r) => s + (r.emitidas ?? r.total),
    0,
  );
  const grandCanjeadas = rows.reduce((s, r) => s + r.canjeadas, 0);
  const avgTasaOtorgamiento =
    rows.reduce((s, r) => {
      const emi = r.emitidas ?? r.total;
      return s + (emi ? r.total / emi : 0);
    }, 0) / rows.length;
  const avgTasaCanje =
    rows.reduce((s, r) => s + r.tasaCanje, 0) / rows.length;

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <Th>Etiqueta</Th>
              <Th align="right">Cortesías emitidas</Th>
              <Th align="right">Total</Th>
              <Th align="right">Tasa de otorgamiento</Th>
              <Th align="right">Canjeadas</Th>
              <Th align="right">Tasa de canje</Th>
              <Th align="right">% Otorgadas</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const share = grandTotal ? row.total / grandTotal : 0;
              const emitidas = row.emitidas ?? row.total;
              const tasaOtorgamiento = emitidas ? row.total / emitidas : 0;
              return (
                <tr
                  key={row.label}
                  className="border-b border-[#E5E5E5] transition-colors duration-150 hover:bg-[#FAFAFA]"
                >
                  <td className="px-4 py-3 font-sans text-sm text-[#333333]">{row.label}</td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                    {formatNumber(emitidas)}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                    {formatNumber(row.total)}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                    {formatPercent(tasaOtorgamiento)}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                    {formatNumber(row.canjeadas)}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                    {formatPercent(row.tasaCanje)}
                  </td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                    {formatPercent(share)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[#E5E5E5] bg-[#FAFAFA]">
              <td className="px-4 py-3 font-sans text-sm font-medium text-[#333333]">
                Total
              </td>
              <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                {formatNumber(grandEmitidas)}
              </td>
              <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                {formatNumber(grandTotal)}
              </td>
              <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#666666]">
                {formatPercent(avgTasaOtorgamiento)}
              </td>
              <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                {formatNumber(grandCanjeadas)}
              </td>
              <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#666666]">
                {formatPercent(avgTasaCanje)}
              </td>
              <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#666666]">
                {formatPercent(1)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function CategoryTable({ nodes }: { nodes: FreesCategoryNode[] }) {
  const [expandedCat, setExpandedCat] = useState<Set<string>>(new Set());

  if (!nodes.length) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos
      </div>
    );
  }

  const grandTotal = nodes.reduce((s, n) => s + n.total, 0);

  function toggleCat(label: string) {
    setExpandedCat((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <Th>Categoría · Recipient</Th>
              <Th align="right">Total</Th>
              <Th align="right">Canjeadas</Th>
              <Th align="right">Tasa</Th>
              <Th align="right">Participación</Th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((cat) => {
              const catOpen = expandedCat.has(cat.label);
              const catShare = grandTotal ? cat.total / grandTotal : 0;
              const catHasRecipients = cat.recipients.length > 0;
              return (
                <Fragment key={`cat-${cat.label}`}>
                  <tr
                    className={`border-b border-[#E5E5E5] transition-colors duration-150 ${
                      catHasRecipients ? "cursor-pointer hover:bg-[#FAFAFA]" : ""
                    }`}
                    onClick={() => catHasRecipients && toggleCat(cat.label)}
                    aria-expanded={catHasRecipients ? catOpen : undefined}
                  >
                    <td className="px-4 py-3 font-sans text-sm font-medium text-[#333333]">
                      <span className="inline-flex items-center gap-2">
                        {catHasRecipients ? (
                          <ChevronRight
                            className={`h-3.5 w-3.5 text-[#999999] transition-transform duration-150 ${
                              catOpen ? "rotate-90" : ""
                            }`}
                          />
                        ) : (
                          <span className="inline-block h-3.5 w-3.5" />
                        )}
                        <span>{cat.label}</span>
                        {catHasRecipients && (
                          <span className="font-sans text-xs text-[#999999]">
                            · {formatNumber(cat.recipients.length)}{" "}
                            {cat.recipients.length === 1
                              ? "recipient"
                              : "recipients"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                      {formatNumber(cat.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatNumber(cat.canjeadas)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                      {formatPercent(cat.tasaCanje)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                      {formatPercent(catShare)}
                    </td>
                  </tr>
                  {catOpen &&
                    cat.recipients.map((r) => {
                      const rShare = cat.total ? r.total / cat.total : 0;
                      return (
                        <tr
                          key={`rec-${cat.label}-${r.label}`}
                          className="border-b border-[#E5E5E5] bg-[#FAFAFA]/60 transition-colors duration-150"
                        >
                          <td className="px-4 py-2.5 font-sans text-sm text-[#666666]">
                            <span className="inline-flex items-center gap-2 pl-6">
                              <span className="h-1 w-1 rounded-full bg-[#9F99F8]" />
                              <span>{r.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#333333]">
                            {formatNumber(r.total)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#333333]">
                            {formatNumber(r.canjeadas)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#666666]">
                            {formatPercent(r.tasaCanje)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#999999]">
                            {formatPercent(rShare)}
                          </td>
                        </tr>
                      );
                    })}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type GeneroOpcion = "" | "Hombre" | "Mujer" | "Sin clasificar";

function GeneroSection({
  data,
  ingresoRows,
  hasEventoFilter,
}: {
  data: FreesGeneroData;
  ingresoRows: FreesIngresoRow[];
  hasEventoFilter: boolean;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [recipientFilter, setRecipientFilter] = useState<string>("");
  const [generoFilter, setGeneroFilter] = useState<GeneroOpcion>("");

  const categoryOptions = useMemo(
    () =>
      data.byCategory
        .map((c) => c.label)
        .sort((a, b) => a.localeCompare(b, "es")),
    [data.byCategory],
  );

  const recipientOptions = useMemo(() => {
    const cats = categoryFilter
      ? data.byCategory.filter((c) => c.label === categoryFilter)
      : data.byCategory;
    const set = new Set<string>();
    for (const c of cats) for (const r of c.recipients) set.add(r.label);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [data.byCategory, categoryFilter]);

  // Si cambian las opciones de recipient y el filtro actual ya no aplica, lo limpia.
  useEffect(() => {
    if (recipientFilter && !recipientOptions.includes(recipientFilter)) {
      setRecipientFilter("");
    }
  }, [recipientOptions, recipientFilter]);

  const hasNonGenderFilter = categoryFilter !== "" || recipientFilter !== "";

  const filteredCategories = useMemo<FreesGeneroCategory[]>(() => {
    let cats = data.byCategory;
    if (categoryFilter) {
      cats = cats.filter((c) => c.label === categoryFilter);
    }
    if (!recipientFilter) return cats;

    return cats
      .map((cat) => {
        const recipients = cat.recipients.filter(
          (r) => r.label === recipientFilter,
        );
        if (!recipients.length) return null;
        const totals = recipients.reduce(
          (acc, r) => {
            acc.total += r.total;
            acc.hombres += r.hombres;
            acc.mujeres += r.mujeres;
            acc.sinClasificar += r.sinClasificar;
            return acc;
          },
          { total: 0, hombres: 0, mujeres: 0, sinClasificar: 0 },
        );
        const denom = totals.hombres + totals.mujeres;
        return {
          label: cat.label,
          total: totals.total,
          hombres: totals.hombres,
          mujeres: totals.mujeres,
          sinClasificar: totals.sinClasificar,
          pctMujeres: denom ? totals.mujeres / denom : 0,
          recipients,
        } satisfies FreesGeneroCategory;
      })
      .filter((c): c is FreesGeneroCategory => c !== null);
  }, [data.byCategory, categoryFilter, recipientFilter]);

  const filteredDonutTotals = useMemo(() => {
    let h = 0;
    let m = 0;
    let sc = 0;
    for (const c of filteredCategories) {
      h += c.hombres;
      m += c.mujeres;
      sc += c.sinClasificar;
    }
    return { h, m, sc };
  }, [filteredCategories]);

  const filteredIngresoRows = useMemo<FreesIngresoRow[]>(() => {
    return ingresoRows.filter((r) => {
      if (categoryFilter && r.category !== categoryFilter) return false;
      if (recipientFilter && r.recipient !== recipientFilter) return false;
      if (generoFilter && r.genero !== generoFilter) return false;
      return true;
    });
  }, [ingresoRows, categoryFilter, recipientFilter, generoFilter]);

  const horaMediaLabel = useMemo(() => {
    if (filteredIngresoRows.length === 0) return "—";
    if (hasEventoFilter) {
      const m = median(filteredIngresoRows.map((r) => r.tsSeconds));
      return clockLabelFromSeconds(m);
    }
    const minutes = filteredIngresoRows.map((r) =>
      Math.floor((((r.tsSeconds % 86400) + 86400) % 86400) / 60),
    );
    return clockLabelFromMinutes(median(minutes));
  }, [filteredIngresoRows, hasEventoFilter]);

  const bucketSeries = useMemo(
    () =>
      aggregateByBucket(
        filteredIngresoRows,
        hasEventoFilter ? "absolute" : "modulo",
      ),
    [filteredIngresoRows, hasEventoFilter],
  );

  return (
    <>
      <Panel
        className="lg:col-span-12"
        title="Filtros"
        subtitle="Filtra por categoría, recipient y género."
      >
        <GeneroFilters
          categories={categoryOptions}
          categoryFilter={categoryFilter}
          onCategoryChange={setCategoryFilter}
          recipients={recipientOptions}
          recipientFilter={recipientFilter}
          onRecipientChange={setRecipientFilter}
          generoFilter={generoFilter}
          onGeneroChange={setGeneroFilter}
        />
        <p className="font-sans text-xs text-[#999999]">
          El filtro de género aplica solo a la curva horaria y al card de hora
          media. El donut y la tabla muestran la distribución completa por
          género.
        </p>
      </Panel>

      <div className="lg:col-span-12">
        <GeneroKpis
          kpis={data.kpis}
          horaMediaLabel={horaMediaLabel}
          ingresosFiltrados={filteredIngresoRows.length}
        />
      </div>

      <Panel
        className="lg:col-span-4"
        title="Distribución por género"
        subtitle={
          hasNonGenderFilter
            ? "Filtrado: solo categorías y recipients seleccionados."
            : "Hombre · Mujer · Sin clasificar sobre cortesías entregadas."
        }
      >
        <GeneroDonut
          hombres={
            hasNonGenderFilter ? filteredDonutTotals.h : data.kpis.totalHombres
          }
          mujeres={
            hasNonGenderFilter ? filteredDonutTotals.m : data.kpis.totalMujeres
          }
          sinClasificar={
            hasNonGenderFilter
              ? filteredDonutTotals.sc
              : data.kpis.totalSinClasificar
          }
        />
      </Panel>

      <Panel
        className="lg:col-span-8"
        title="Curva de ingresos por hora"
        subtitle={
          hasEventoFilter
            ? "Ingresos canjeados agregados en bloques de 30 min."
            : "Vista global: la curva mezcla fechas de todos los eventos por hora-del-día."
        }
      >
        <IngresoCurva data={bucketSeries} />
      </Panel>

      <Panel
        className="lg:col-span-12"
        title="Detalle por categoría y recipient"
        subtitle="Click en una categoría para ver sus recipients. Solo cortesías canjeadas tienen nombre nominado; el resto cae en 'Sin clasificar'."
      >
        <GeneroTable categories={filteredCategories} />
      </Panel>
    </>
  );
}

function GeneroKpis({
  kpis,
  horaMediaLabel,
  ingresosFiltrados,
}: {
  kpis: FreesGeneroKpis;
  horaMediaLabel: string;
  ingresosFiltrados: number;
}) {
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label="Hombres"
        value={formatNumber(kpis.totalHombres)}
        sub={
          kpis.totalHombres + kpis.totalMujeres > 0
            ? `${formatPercent(1 - kpis.pctMujeres)} sobre clasificables`
            : "Sin clasificables"
        }
      />
      <KpiCard
        label="Mujeres"
        value={formatNumber(kpis.totalMujeres)}
        sub={
          kpis.totalHombres + kpis.totalMujeres > 0
            ? `${formatPercent(kpis.pctMujeres)} sobre clasificables`
            : "Sin clasificables"
        }
        delta="positive"
      />
      <KpiCard
        label="Sin clasificar"
        value={formatNumber(kpis.totalSinClasificar)}
        sub="Nombre no encontrado o cortesía no canjeada"
        delta="neutral"
      />
      <KpiCard
        label="% clasificable"
        value={formatPercent(kpis.pctClasificable)}
        sub="Cortesías con género inferido"
        delta={kpis.pctClasificable >= 0.5 ? "positive" : "negative"}
      />
      <KpiCard
        label="Hora media de ingreso"
        value={horaMediaLabel}
        sub={
          ingresosFiltrados > 0
            ? `Mediana de ${formatNumber(ingresosFiltrados)} canjeados`
            : "Sin canjeados en el filtro"
        }
      />
    </section>
  );
}

function GeneroFilters({
  categories,
  categoryFilter,
  onCategoryChange,
  recipients,
  recipientFilter,
  onRecipientChange,
  generoFilter,
  onGeneroChange,
}: {
  categories: string[];
  categoryFilter: string;
  onCategoryChange: (v: string) => void;
  recipients: string[];
  recipientFilter: string;
  onRecipientChange: (v: string) => void;
  generoFilter: GeneroOpcion;
  onGeneroChange: (v: GeneroOpcion) => void;
}) {
  const hasFilter =
    categoryFilter !== "" || recipientFilter !== "" || generoFilter !== "";
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="font-sans text-xs text-[#666666]">Categoría</span>
        <CustomSelect
          value={categoryFilter}
          onChange={onCategoryChange}
          options={[
            { value: "", label: "Todas las categorías" },
            ...categories.map((c) => ({ value: c, label: c })),
          ]}
          searchable
          searchPlaceholder="Buscar categoría…"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="font-sans text-xs text-[#666666]">Recipient</span>
        <CustomSelect
          value={recipientFilter}
          onChange={onRecipientChange}
          options={[
            { value: "", label: "Todos los recipients" },
            ...recipients.map((r) => ({ value: r, label: r })),
          ]}
          searchable
          searchPlaceholder="Buscar recipient…"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5">
        <span className="font-sans text-xs text-[#666666]">Género</span>
        <CustomSelect
          value={generoFilter}
          onChange={(v) => onGeneroChange(v as GeneroOpcion)}
          options={[
            { value: "", label: "Todos" },
            { value: "Hombre", label: "Hombre" },
            { value: "Mujer", label: "Mujer" },
            { value: "Sin clasificar", label: "Sin clasificar" },
          ]}
        />
      </div>

      {hasFilter && (
        <button
          type="button"
          onClick={() => {
            onCategoryChange("");
            onRecipientChange("");
            onGeneroChange("");
          }}
          className="rounded-lg px-3 py-2 font-sans text-sm text-[#666666] transition-colors hover:bg-[#FAFAFA] hover:text-[#333333]"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

type SelectOption = { value: string; label: string };

function CustomSelect({
  value,
  onChange,
  options,
  searchable = false,
  searchPlaceholder = "Buscar…",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, search]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 text-left font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
      >
        <span className="truncate">{selected?.label ?? options[0]?.label}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#999999]" />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 flex w-full min-w-[220px] flex-col gap-2 rounded-lg border border-[#E5E5E5] bg-white p-2 shadow-md">
          {searchable && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#999999]" />
              <input
                type="search"
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-[#E5E5E5] bg-white py-1.5 pl-8 pr-2 font-sans text-sm text-[#333333] placeholder:text-[#999999] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              />
            </div>
          )}
          <div className="max-h-[280px] overflow-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-2 font-sans text-sm text-[#999999]">
                Sin resultados
              </div>
            )}
            {filtered.map((opt) => {
              const isChecked = opt.value === value;
              return (
                <button
                  key={opt.value || "__all__"}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-sans text-sm transition-colors ${
                    isChecked
                      ? "bg-[#F0EFFE] font-medium text-[#9F99F8]"
                      : "text-[#333333] hover:bg-[#FAFAFA]"
                  }`}
                >
                  <span className="flex-1 truncate">{opt.label}</span>
                  {isChecked && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-[#9F99F8]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function GeneroDonut({
  hombres,
  mujeres,
  sinClasificar,
}: {
  hombres: number;
  mujeres: number;
  sinClasificar: number;
}) {
  const slices = [
    { name: "Hombre", value: hombres, color: GENERO_COLORS["Hombre"] },
    { name: "Mujer", value: mujeres, color: GENERO_COLORS["Mujer"] },
    {
      name: "Sin clasificar",
      value: sinClasificar,
      color: GENERO_COLORS["Sin clasificar"],
    },
  ].filter((s) => s.value > 0);

  const total = slices.reduce((s, d) => s + d.value, 0);

  if (!total) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos
      </div>
    );
  }

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="90%"
            paddingAngle={1}
            stroke="none"
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
          >
            {slices.map((s) => (
              <Cell key={s.name} fill={s.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                items={(payload ?? []).map((p) => ({
                  name: String(p.name),
                  color: p.payload?.fill,
                  formatted: `${formatNumber(Number(p.value))} cortesías`,
                }))}
              />
            )}
          />
          <Legend {...legendProps} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -translate-y-6">
        <span className="font-display text-3xl font-bold leading-none tracking-tight text-[#333333]">
          {formatNumber(total)}
        </span>
        <span className="mt-1 font-sans text-xs text-[#666666]">cortesías</span>
      </div>
    </div>
  );
}

function GeneroTable({ categories }: { categories: FreesGeneroCategory[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (!categories.length) {
    return (
      <div className="flex h-32 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin datos
      </div>
    );
  }

  function toggle(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
      <div className="max-h-[560px] overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <Th>Categoría · Recipient</Th>
              <Th align="right">Total</Th>
              <Th align="right">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
                  Hombres
                </span>
              </Th>
              <Th align="right">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#ED75A0]" />
                  Mujeres
                </span>
              </Th>
              <Th align="right">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#999999]" />
                  Sin clasificar
                </span>
              </Th>
              <Th align="right">% Mujeres</Th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => {
              const isOpen = expanded.has(cat.label);
              const hasRecipients = cat.recipients.length > 0;
              return (
                <Fragment key={`gcat-${cat.label}`}>
                  <tr
                    className={`border-b border-[#E5E5E5] transition-colors duration-150 ${
                      hasRecipients ? "cursor-pointer hover:bg-[#FAFAFA]" : ""
                    }`}
                    onClick={() => hasRecipients && toggle(cat.label)}
                    aria-expanded={hasRecipients ? isOpen : undefined}
                  >
                    <td className="px-4 py-3 font-sans text-sm font-medium text-[#333333]">
                      <span className="inline-flex items-center gap-2">
                        {hasRecipients ? (
                          <ChevronRight
                            className={`h-3.5 w-3.5 text-[#999999] transition-transform duration-150 ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          />
                        ) : (
                          <span className="inline-block h-3.5 w-3.5" />
                        )}
                        <span>{cat.label}</span>
                        {hasRecipients && (
                          <span className="font-sans text-xs text-[#999999]">
                            · {formatNumber(cat.recipients.length)}{" "}
                            {cat.recipients.length === 1
                              ? "recipient"
                              : "recipients"}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm font-medium tabular-nums text-[#333333]">
                      {formatNumber(cat.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatNumber(cat.hombres)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                      {formatNumber(cat.mujeres)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                      {formatNumber(cat.sinClasificar)}
                    </td>
                    <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#666666]">
                      {cat.hombres + cat.mujeres > 0
                        ? formatPercent(cat.pctMujeres)
                        : "—"}
                    </td>
                  </tr>
                  {isOpen &&
                    cat.recipients.map((rec) => (
                      <tr
                        key={`grec-${cat.label}-${rec.label}`}
                        className="border-b border-[#E5E5E5] bg-[#FAFAFA]/60 transition-colors duration-150"
                      >
                        <td className="px-4 py-2.5 font-sans text-sm text-[#666666]">
                          <span className="inline-flex items-center gap-2 pl-6">
                            <span className="h-1 w-1 rounded-full bg-[#9F99F8]" />
                            <span>{rec.label}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#333333]">
                          {formatNumber(rec.total)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#333333]">
                          {formatNumber(rec.hombres)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#333333]">
                          {formatNumber(rec.mujeres)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#666666]">
                          {formatNumber(rec.sinClasificar)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-sans text-sm tabular-nums text-[#666666]">
                          {rec.hombres + rec.mujeres > 0
                            ? formatPercent(rec.pctMujeres)
                            : "—"}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function IngresoCurva({
  data,
}: {
  data: BucketRow[];
}) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 font-sans text-sm text-[#999999]">
        <Inbox className="h-6 w-6" />
        Sin ingresos canjeados
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
      >
        <defs>
          <linearGradient id="ingresoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9F99F8" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#9F99F8" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridProps} vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          axisLine={{ stroke: SURFACE.divider }}
          tickLine={false}
          interval={3}
        />
        <YAxis
          tick={axisTick}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ stroke: SURFACE.divider }}
          content={({ active, payload }) => {
            const p = payload?.[0];
            if (!p) return <ChartTooltip active={false} items={[]} />;
            const row = p.payload as BucketRow;
            return (
              <ChartTooltip
                active={active}
                label={`${row.label} – ${row.endLabel}`}
                items={[
                  {
                    name: "Ingresos",
                    color: "#9F99F8",
                    formatted: formatNumber(row.count),
                  },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#9F99F8"
          strokeWidth={2}
          fill="url(#ingresoFill)"
          isAnimationActive
          animationDuration={400}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function median(values: number[]): number {
  const n = values.length;
  if (!n) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function clockLabelFromMinutes(min: number): string {
  if (!Number.isFinite(min)) return "—";
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function clockLabelFromSeconds(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  return clockLabelFromMinutes(Math.floor(seconds / 60));
}

type BucketRow = {
  bucket: number;
  label: string;
  endLabel: string;
  count: number;
};

function aggregateByBucket(
  rows: FreesIngresoRow[],
  mode: "absolute" | "modulo",
): BucketRow[] {
  if (mode === "modulo") {
    // Eje rotado: arranca a las 06:00 para que la noche (cruces de medianoche)
    // fluya naturalmente al final del gráfico (23:30 → 00:00 → ...).
    const ANCHOR_MIN = 360;
    const counts = new Array(48).fill(0) as number[];
    for (const r of rows) {
      const minOfDay = Math.floor(
        (((r.tsSeconds % 86400) + 86400) % 86400) / 60,
      );
      const rotated = (minOfDay - ANCHOR_MIN + 1440) % 1440;
      const b = Math.min(47, Math.floor(rotated / 30));
      counts[b] += 1;
    }
    return counts.map((count, b) => {
      const realStartMin = (ANCHOR_MIN + b * 30) % 1440;
      return {
        bucket: b,
        label: clockLabelFromMinutes(realStartMin),
        endLabel: clockLabelFromMinutes(realStartMin + 30),
        count,
      };
    });
  }

  // Absolute mode: chronological, trim leading/trailing empties.
  if (rows.length === 0) return [];
  const BUCKET_SECONDS = 30 * 60;
  const bucketCounts = new Map<number, number>();
  for (const r of rows) {
    if (!Number.isFinite(r.tsSeconds) || r.tsSeconds <= 0) continue;
    const b = Math.floor(r.tsSeconds / BUCKET_SECONDS);
    bucketCounts.set(b, (bucketCounts.get(b) ?? 0) + 1);
  }
  if (bucketCounts.size === 0) return [];
  const keys = [...bucketCounts.keys()].sort((a, b) => a - b);
  const min = keys[0];
  const max = keys[keys.length - 1];

  // Safety: if range explodes (corrupt data), fall back to modulo.
  const MAX_BUCKETS = 200;
  if (max - min > MAX_BUCKETS) {
    return aggregateByBucket(rows, "modulo");
  }

  const out: BucketRow[] = [];
  for (let b = min; b <= max; b++) {
    out.push({
      bucket: b,
      label: clockLabelFromSeconds(b * BUCKET_SECONDS),
      endLabel: clockLabelFromSeconds((b + 1) * BUCKET_SECONDS),
      count: bucketCounts.get(b) ?? 0,
    });
  }
  return out;
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`sticky top-0 z-10 bg-[#FAFAFA] px-4 py-3 font-sans text-xs font-medium text-[#666666] ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}
