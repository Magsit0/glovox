"use client";

import { useEffect, useState } from "react";
import {
  aggregateBusinesses,
  normalizeExpenseRows,
} from "@/lib/unabase/normalization";
import type { BusinessRow, ExpenseRow, RawRow } from "@/lib/unabase/types";

interface DashboardDataResult {
  businessRows: BusinessRow[];
  expenseRows: ExpenseRow[];
  loading: boolean;
  error: string | null;
}

async function fetchRaw(monto: "neto" | "bruto"): Promise<RawRow[]> {
  const qs = monto === "bruto" ? "?monto=bruto" : "";
  const res = await fetch(`/api/cierre-mensual/data${qs}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed with ${res.status}`);
  }
  return (await res.json()) as RawRow[];
}

export function useDashboardData(
  monto: "neto" | "bruto" = "neto",
): DashboardDataResult {
  const [businessRows, setBusinessRows] = useState<BusinessRow[]>([]);
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const raw = await fetchRaw(monto);
        if (cancelled) return;
        setBusinessRows(aggregateBusinesses(raw));
        setExpenseRows(normalizeExpenseRows(raw));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error cargando datos");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [monto]);

  return { businessRows, expenseRows, loading, error };
}
