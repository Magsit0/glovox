"use client";

import { useEffect, useState } from "react";
import type { EstructuraMensualRow } from "@/lib/unabase/types";

interface EstructuraDataResult {
  rows: EstructuraMensualRow[];
  loading: boolean;
  error: string | null;
}

async function fetchEstructura(): Promise<EstructuraMensualRow[]> {
  const res = await fetch("/api/cierre-mensual/estructura", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed with ${res.status}`);
  }
  return (await res.json()) as EstructuraMensualRow[];
}

/**
 * Gasto de estructura GLOVOX (total mensual, sin desglose) para la pestaña
 * "Análisis financiero". Se monta recién al abrir la pestaña, así que el fetch
 * es lazy por construcción.
 */
export function useEstructuraData(): EstructuraDataResult {
  const [rows, setRows] = useState<EstructuraMensualRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchEstructura();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error cargando gasto de estructura");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, loading, error };
}
