"use client";

import { useEffect, useState } from "react";
import type { NegocioRow } from "@/lib/unabase/types";

interface NegociosDataResult {
  rows: NegocioRow[];
  loading: boolean;
  error: string | null;
}

async function fetchNegocios(): Promise<NegocioRow[]> {
  const res = await fetch("/api/cierre-mensual/negocios", { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `Request failed with ${res.status}`);
  }
  return (await res.json()) as NegocioRow[];
}

export function useNegociosData(): NegociosDataResult {
  const [rows, setRows] = useState<NegocioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchNegocios();
        if (!cancelled) setRows(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error cargando negocios");
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
