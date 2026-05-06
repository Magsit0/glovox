"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { motion } from "motion/react";
import {
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
  FreesDashboardData,
  FreesEventOption,
  FreesGroupRow,
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

type Tab = "ticketType" | "recipient" | "category";

const TABS: { key: Tab; label: string; description: string; field: keyof FreesDashboardData }[] = [
  {
    key: "ticketType",
    label: "Tipo de ticket",
    description: "Distribución por ticketType en cortesías.",
    field: "byTicketType",
  },
  {
    key: "recipient",
    label: "Recipient",
    description: "A quién quedó asignada la cortesía.",
    field: "byRecipient",
  },
  {
    key: "category",
    label: "Category",
    description: "Categoría declarada en la cortesía.",
    field: "byCategory",
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
  const selectedEventOption = useMemo(
    () => events.find((e) => e.eventoId === selectedEvent),
    [events, selectedEvent],
  );

  const activeRows = useMemo<FreesGroupRow[]>(() => {
    switch (tab) {
      case "ticketType":
        return data.byTicketType;
      case "recipient":
        return data.byRecipient;
      case "category":
        return data.byCategory;
    }
  }, [tab, data]);

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
              Cortesías emitidas y su tasa de canje contra <code>glovox.tickets</code>.
              El canje se determina por el match entre los últimos 8 caracteres del{" "}
              <code>sellerLink</code> y <code>CodigoPromocion</code>.
              {selectedEventOption && (
                <>
                  {" "}
                  <span className="font-medium text-[#333333]">
                    Filtrando por evento {selectedEventOption.eventoId} —{" "}
                    {selectedEventOption.nombre}.
                  </span>
                </>
              )}
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
        <Panel
          className="lg:col-span-8"
          title={`Cortesías por ${activeMeta.label.toLowerCase()}`}
          subtitle={activeMeta.description}
        >
          <GroupBarChart rows={activeRows} />
        </Panel>
        <Panel
          className="lg:col-span-4"
          title="Distribución"
          subtitle="Top 6 categorías; el resto se agrupa como Otros."
        >
          <GroupDonutChart rows={activeRows} />
        </Panel>
        <Panel
          className="lg:col-span-12"
          title="Detalle"
          subtitle="Total emitidas, canjeadas vía ticket y tasa de canje."
        >
          <GroupTable rows={activeRows} />
        </Panel>
      </motion.section>
    </div>
  );
}

function KpiSection({ kpis }: { kpis: FreesKpis }) {
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Cortesías emitidas"
        value={formatNumber(kpis.totalCortesias)}
        sub={`${formatNumber(kpis.ticketTypesUnicos)} tipos de ticket distintos`}
      />
      <KpiCard
        label="Cortesías canjeadas"
        value={formatNumber(kpis.totalCanjeadas)}
        sub={`${formatNumber(kpis.totalNoCanjeadas)} aún sin canjear`}
        delta="positive"
      />
      <KpiCard
        label="Tasa de canje"
        value={formatPercent(kpis.tasaCanje)}
        sub={`${formatNumber(kpis.totalCanjeadas)} de ${formatNumber(kpis.totalCortesias)}`}
        delta={kpis.tasaCanje >= 0.5 ? "positive" : "negative"}
      />
      <KpiCard
        label="Con recipient asignado"
        value={formatNumber(kpis.cortesiasConRecipient)}
        sub={`${formatNumber(kpis.cortesiasConCategory)} con category`}
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

  return (
    <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
      <div className="max-h-[480px] overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
              <Th>Etiqueta</Th>
              <Th align="right">Total</Th>
              <Th align="right">Canjeadas</Th>
              <Th align="right">Tasa</Th>
              <Th align="right">Share</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const share = grandTotal ? row.total / grandTotal : 0;
              return (
                <tr
                  key={row.label}
                  className="border-b border-[#E5E5E5] transition-colors duration-150 last:border-b-0 hover:bg-[#FAFAFA]"
                >
                  <td className="px-4 py-3 font-sans text-sm text-[#333333]">{row.label}</td>
                  <td className="px-4 py-3 text-right font-sans text-sm tabular-nums text-[#333333]">
                    {formatNumber(row.total)}
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
        </table>
      </div>
    </div>
  );
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
