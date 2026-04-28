"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import { DashboardProvider, useDashboard, useDateFilter } from "@/components/unabase/context/DashboardContext";
import FilterBar from "@/components/unabase/filters/FilterBar";
import SummaryCards from "@/components/unabase/panels/SummaryCards";
import AlertsPanel from "@/components/unabase/panels/AlertsPanel";
import InsightsPanel from "@/components/unabase/panels/InsightsPanel";
import SummaryBusinessTable from "@/components/unabase/panels/SummaryBusinessTable";
import ExpenseTable from "@/components/unabase/panels/ExpenseTable";
import ExpenseSubcategoryTable from "@/components/unabase/panels/ExpenseSubcategoryTable";
import NegociosAreaResultChart from "@/components/unabase/charts/NegociosAreaResultChart";
import NegociosAreaEvolutionChart from "@/components/unabase/charts/NegociosAreaEvolutionChart";
import NegociosAreaGoalChart from "@/components/unabase/charts/NegociosAreaGoalChart";
import StatusDonutChart from "@/components/unabase/charts/StatusDonutChart";
import MonthlyEvolutionChart from "@/components/unabase/charts/MonthlyEvolutionChart";
import BusinessResultChart from "@/components/unabase/charts/BusinessResultChart";
import CategoryExpenseChart from "@/components/unabase/charts/CategoryExpenseChart";
import CategoryEvolutionChart from "@/components/unabase/charts/CategoryEvolutionChart";
import ExpenseMatrix from "@/components/unabase/charts/ExpenseMatrix";
import ExpenseSubcategoryMatrix from "@/components/unabase/charts/ExpenseSubcategoryMatrix";
import DashboardSkeleton from "@/components/unabase/skeleton/DashboardSkeleton";
import { useNegociosData } from "@/components/unabase/hooks/useNegociosData";
import type { BusinessRow, NegocioRow } from "@/lib/unabase/types";
import { formatNumber } from "@/lib/unabase/formatting";

type Tab = "negocios" | "resumen" | "gasto";

const TABS: { key: Tab; label: string }[] = [
  { key: "negocios", label: "Resumen por área" },
  { key: "resumen", label: "Resumen ejecutivo" },
  { key: "gasto", label: "Detalle de gasto" },
];

export function CierreMensualDashboard() {
  return (
    <DashboardProvider>
      <DashboardBody />
    </DashboardProvider>
  );
}

function DashboardBody() {
  const {
    businessRows,
    filteredRows,
    filteredExpenseRows,
    loading,
    error,
    setFilteredRows,
    expenseViewMode,
    setExpenseViewMode,
    selectedExpenseCategory,
    setSelectedExpenseCategory,
  } = useDashboard();

  const [activeTab, setActiveTab] = useState<Tab>("negocios");

  const handleFilter = useCallback(
    (filtered: BusinessRow[]) => setFilteredRows(filtered),
    [setFilteredRows],
  );

  const expenseCategoryOptions = useMemo(() => {
    const set = new Set<string>();
    filteredExpenseRows.forEach((r) => {
      if (r.categoriaGasto) set.add(r.categoriaGasto);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [filteredExpenseRows]);

  if (error) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-24">
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-[#333333]">
          Algo salió mal
        </h1>
        <div className="flex w-full items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6 shadow-sm">
          <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
          <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0]"
        >
          Reintentar
        </button>
      </main>
    );
  }

  const badgeLabel = loading ? "…" : `${formatNumber(filteredRows.length)} negocios`;

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      <motion.header
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
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
            <p className="font-sans text-xs text-[#666666]">Unabase</p>
            <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-[#333333]">
              Cierre mensual
            </h1>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
            {badgeLabel}
          </span>
        </div>
      </motion.header>

      <section className="flex flex-col gap-3">
        <p className="font-sans text-xs text-[#666666]">Filtros</p>
        {!loading && businessRows.length > 0 && (
          <FilterBar rows={businessRows} onFilter={handleFilter} />
        )}
        {loading && (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-10 w-40 animate-pulse rounded-lg bg-[#F0F0F0]"
              />
            ))}
          </div>
        )}
      </section>

      <nav className="flex flex-wrap gap-0 border-b border-[#E5E5E5]">
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
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

      {loading && <DashboardSkeleton />}

      {activeTab === "negocios" && <NegociosTab />}

      {!loading && activeTab === "resumen" && (
        <motion.section
          key="resumen"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col gap-6"
        >
          <AlertsPanel />
          <SummaryCards />
          <InsightsPanel />
          <Panel title="Distribución por estado">
            <StatusDonutChart />
          </Panel>
          <Panel title="Evolución mensual — ingreso, gasto y presupuesto">
            <MonthlyEvolutionChart />
          </Panel>
          <SummaryBusinessTable />
          <Panel title="Resultado por negocio">
            <BusinessResultChart />
          </Panel>
          <Panel title="Gasto por categoría">
            <CategoryExpenseChart />
          </Panel>
        </motion.section>
      )}

      {!loading && activeTab === "gasto" && (
        <motion.section
          key="gasto"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col gap-6"
        >
          <Panel title="Evolución de gasto por categoría">
            <CategoryEvolutionChart />
          </Panel>
          <Panel
            title="Matriz de gasto por categoría × evento"
            right={
              <div className="inline-flex rounded-lg border border-[#E5E5E5] bg-white p-0.5">
                {(["total", "percapita"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setExpenseViewMode(m)}
                    className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
                      expenseViewMode === m
                        ? "bg-[#F0EFFE] text-[#9F99F8]"
                        : "text-[#666666] hover:text-[#333333]"
                    }`}
                  >
                    {m === "total" ? "Total" : "Per cápita"}
                  </button>
                ))}
              </div>
            }
          >
            <ExpenseMatrix />
          </Panel>
          <ExpenseTable />
          <Panel
            title="Desglose por subcategoría"
            right={
              <label className="flex items-center gap-2 font-sans text-xs text-[#666666]">
                <span>Categoría abierta</span>
                <select
                  value={selectedExpenseCategory ?? ""}
                  onChange={(e) => setSelectedExpenseCategory(e.target.value || null)}
                  className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-1.5 font-sans text-xs text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
                >
                  <option value="">Elige una categoría</option>
                  {expenseCategoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </label>
            }
          >
            <ExpenseSubcategoryMatrix />
          </Panel>
          <ExpenseSubcategoryTable />
        </motion.section>
      )}
    </div>
  );
}

function normalizeToYMD(dateStr: string): string | null {
  if (!dateStr || dateStr === "00-00-00" || dateStr === "Sin dato") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split("-");
    return `${y}-${m}-${d}`;
  }
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function applyDateFilter(rows: NegocioRow[], dateStart: string, dateEnd: string): NegocioRow[] {
  if (!dateStart && !dateEnd) return rows;
  return rows.filter((row) => {
    const ymd = normalizeToYMD(row.fecha_asignacion);
    if (!ymd) return true;
    if (dateStart && ymd < dateStart) return false;
    if (dateEnd && ymd > dateEnd) return false;
    return true;
  });
}

function NegociosTab() {
  const { rows, loading, error } = useNegociosData();
  const { dateStart, dateEnd } = useDateFilter();

  const filteredRows = useMemo(
    () => applyDateFilter(rows, dateStart, dateEnd),
    [rows, dateStart, dateEnd],
  );

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6 shadow-sm">
        <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
        <p className="flex-1 font-sans text-sm text-[#333333]">{error}</p>
      </div>
    );
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <motion.section
      key="negocios"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex flex-col gap-6"
    >
      <Panel title="Resultado por área de negocio">
        <NegociosAreaResultChart rows={filteredRows} />
      </Panel>
      <Panel title="Evolución de ingresos por área">
        <NegociosAreaEvolutionChart rows={filteredRows} />
      </Panel>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Panel title="Producción de eventos propios — meta $6.500M">
          <NegociosAreaGoalChart
            rows={filteredRows}
            area="PRODUCCION DE EVENTOS PROPIOS"
            meta={6_500_000_000}
          />
        </Panel>
        <Panel title="Corporativos — meta $1.000M">
          <NegociosAreaGoalChart
            rows={filteredRows}
            area="CORPORATIVOS"
            meta={1_000_000_000}
          />
        </Panel>
        <Panel title="BTL — meta $1.100M">
          <NegociosAreaGoalChart
            rows={filteredRows}
            area="BTL"
            meta={1_100_000_000}
          />
        </Panel>
        <Panel title="Eventos de marca — meta $1.000M">
          <NegociosAreaGoalChart
            rows={filteredRows}
            area="EVENTOS DE MARCA"
            meta={1_000_000_000}
          />
        </Panel>
      </div>
    </motion.section>
  );
}

function Panel({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-extrabold tracking-tight text-[#333333]">
          {title}
        </h2>
        {right}
      </header>
      {children}
    </article>
  );
}
