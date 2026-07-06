"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useDashboardData } from "@/components/cierre-mensual/hooks/useDashboardData";
import { useNegociosData } from "@/components/cierre-mensual/hooks/useNegociosData";
import { montoModeFrom } from "@/components/montoMode";
import type { BusinessRow, ExpenseRow, NegocioRow } from "@/lib/unabase/types";

interface DataContextValue {
  businessRows: BusinessRow[];
  expenseRows: ExpenseRow[];
  loading: boolean;
  error: string | null;
  // Negocios crudos (NEGOCIOS_SQL): se cargan una sola vez acá y se comparten
  // entre el panel de resultados del mes y la pestaña "Resumen por área".
  negociosRows: NegocioRow[];
  negociosLoading: boolean;
  negociosError: string | null;
}

interface FiltersContextValue {
  filteredRows: BusinessRow[];
  setFilteredRows: (rows: BusinessRow[]) => void;
  filteredExpenseRows: ExpenseRow[];
}

type ExpenseViewMode = "total" | "percapita";

interface ExpenseUIContextValue {
  expenseViewMode: ExpenseViewMode;
  setExpenseViewMode: (mode: ExpenseViewMode) => void;
  selectedExpenseCategory: string | null;
  setSelectedExpenseCategory: (cat: string | null) => void;
}

interface DateFilterContextValue {
  dateStart: string;
  dateEnd: string;
  setDateStart: (v: string) => void;
  setDateEnd: (v: string) => void;
}

const DataContext = createContext<DataContextValue | null>(null);
const FiltersContext = createContext<FiltersContextValue | null>(null);
const ExpenseUIContext = createContext<ExpenseUIContextValue | null>(null);
const DateFilterContext = createContext<DateFilterContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  // Switch neto/bruto: se lee de la URL (?monto=bruto) y refetchea los datos.
  const monto = montoModeFrom(useSearchParams().get("monto"));
  const { businessRows, expenseRows, loading, error } = useDashboardData(monto);
  const {
    rows: negociosRows,
    loading: negociosLoading,
    error: negociosError,
  } = useNegociosData();

  const [userFilteredRows, setUserFilteredRows] = useState<BusinessRow[] | null>(null);
  const [expenseViewMode, setExpenseViewMode] = useState<ExpenseViewMode>("total");
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<string | null>(null);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");

  const filteredRows = userFilteredRows ?? businessRows;
  const setFilteredRows = useCallback((rows: BusinessRow[]) => {
    setUserFilteredRows(rows);
  }, []);

  const filteredExpenseRows = useMemo(() => {
    if (!expenseRows.length || !filteredRows.length) return [];
    const keys = new Set(filteredRows.map((r) => r.key));
    return expenseRows.filter((r) => keys.has(r.key));
  }, [filteredRows, expenseRows]);

  const resolvedExpenseCategory = useMemo(() => {
    if (!selectedExpenseCategory) return null;
    const exists = filteredExpenseRows.some(
      (r) => r.categoriaGasto === selectedExpenseCategory,
    );
    return exists ? selectedExpenseCategory : null;
  }, [filteredExpenseRows, selectedExpenseCategory]);

  const dataValue = useMemo(
    () => ({
      businessRows,
      expenseRows,
      loading,
      error,
      negociosRows,
      negociosLoading,
      negociosError,
    }),
    [
      businessRows,
      expenseRows,
      loading,
      error,
      negociosRows,
      negociosLoading,
      negociosError,
    ],
  );

  const filtersValue = useMemo(
    () => ({ filteredRows, setFilteredRows, filteredExpenseRows }),
    [filteredRows, filteredExpenseRows, setFilteredRows],
  );

  const expenseUIValue = useMemo(
    () => ({
      expenseViewMode,
      setExpenseViewMode,
      selectedExpenseCategory: resolvedExpenseCategory,
      setSelectedExpenseCategory,
    }),
    [expenseViewMode, resolvedExpenseCategory],
  );

  const dateFilterValue = useMemo(
    () => ({ dateStart, dateEnd, setDateStart, setDateEnd }),
    [dateStart, dateEnd],
  );

  return (
    <DataContext.Provider value={dataValue}>
      <FiltersContext.Provider value={filtersValue}>
        <ExpenseUIContext.Provider value={expenseUIValue}>
          <DateFilterContext.Provider value={dateFilterValue}>
            {children}
          </DateFilterContext.Provider>
        </ExpenseUIContext.Provider>
      </FiltersContext.Provider>
    </DataContext.Provider>
  );
}

function useCtx<T>(Ctx: React.Context<T | null>, name: string): T {
  const v = useContext(Ctx);
  if (!v) throw new Error(`${name} debe usarse dentro de DashboardProvider`);
  return v;
}

export const useDataset = () => useCtx(DataContext, "useDataset");
export const useFilters = () => useCtx(FiltersContext, "useFilters");
export const useExpenseUI = () => useCtx(ExpenseUIContext, "useExpenseUI");
export const useDateFilter = () => useCtx(DateFilterContext, "useDateFilter");

export function useDashboard() {
  return { ...useDataset(), ...useFilters(), ...useExpenseUI(), ...useDateFilter() };
}
