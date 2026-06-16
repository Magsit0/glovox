"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Database, Loader2 } from "lucide-react";
import { syncBigQueryAction } from "../actions";

const TABLE_LABEL: Record<string, string> = {
  eventos: "glovox.categoriaEvento",
  venues: "glovox.venues",
};

/**
 * Botón a demanda que corre el CREATE OR REPLACE de la tabla nativa de la
 * pestaña (Sheet → BigQuery). No se dispara solo al guardar: el usuario lo
 * aprieta cuando terminó sus cambios de la sesión.
 */
export default function SyncBigQueryButton({
  target,
}: {
  target: "eventos" | "venues";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const tableName = TABLE_LABEL[target] ?? target;

  function sync() {
    if (
      !window.confirm(
        `Sincronizar a BigQuery: reemplaza ${tableName} con lo que está en el Sheet. ¿Continuar?`,
      )
    ) {
      return;
    }
    setError(null);
    setDone(null);
    startTransition(async () => {
      const res = await syncBigQueryAction(target);
      if (!res.ok) {
        setError(res.error ?? "Error inesperado");
        return;
      }
      const n = res.data?.rows;
      setDone(`Sincronizado${typeof n === "number" ? ` · ${n} filas` : ""}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={sync}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-[#8780F0] disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Database className="h-4 w-4" />
        )}
        Sincronizar a BigQuery
      </button>
      {done && (
        <span className="inline-flex items-center gap-1 font-sans text-xs text-[#4F9D69]">
          <Check className="h-3.5 w-3.5" /> {done}
        </span>
      )}
      {error && (
        <span className="inline-flex max-w-xs items-center gap-1 text-right font-sans text-xs text-[#A8336B]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
        </span>
      )}
    </div>
  );
}
