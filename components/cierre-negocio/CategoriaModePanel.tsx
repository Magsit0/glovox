"use client";

import { useState } from "react";
import type {
  CategoriaBreakdown as CategoriaBreakdownRow,
  CategoriaNode,
  CategoriaViewMode,
} from "@/lib/unabase/cierreNegocio";
import CategoriaBreakdown from "@/components/cierre-negocio/CategoriaBreakdown";
import CategoriaTree from "@/components/cierre-negocio/CategoriaTree";

/** Datos del desglose por categoría bajo UNA agrupación (oficial u original). */
export interface CategoriaPanelData {
  rows: CategoriaBreakdownRow[];
  itemsConOcByCategoria: Record<string, number>;
  arbol: CategoriaNode[];
}

interface Props {
  /** Agrupado por la tripleta oficial del catálogo (seed unabase_item_map). */
  oficial: CategoriaPanelData;
  /** Agrupado por los textos crudos tal como se armó el negocio en Unabase. */
  original: CategoriaPanelData;
}

const MODES: { key: CategoriaViewMode; label: string }[] = [
  { key: "oficial", label: "Catálogo oficial" },
  { key: "original", label: "Original del negocio" },
];

const CAPTION: Record<CategoriaViewMode, string> = {
  oficial:
    "Categorías estandarizadas al catálogo oficial de Glovox; lo no reconocido queda en “SIN CLASIFICAR”. El texto original de cada item se conserva en el detalle.",
  original:
    "Categorías tal como se armó el presupuesto del negocio en Unabase (texto libre, puede traer duplicados o errores de tipeo).",
};

/**
 * Envuelve "Avance por categoría" + "Detalle por item" con el switch
 * Oficial/Original. Ambas agrupaciones llegan pre-calculadas del server; el
 * toggle solo elige cuál se pinta (sin queries extra). Default: oficial.
 */
export default function CategoriaModePanel({ oficial, original }: Props) {
  const [modo, setModo] = useState<CategoriaViewMode>("oficial");
  const data = modo === "oficial" ? oficial : original;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl font-sans text-xs text-[#999999]">{CAPTION[modo]}</p>
        <div className="inline-flex shrink-0 gap-1 rounded-lg border border-[#E5E5E5] bg-white p-0.5">
          {MODES.map((m) => {
            const active = modo === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setModo(m.key)}
                aria-pressed={active}
                className={`rounded-md px-3 py-1 font-sans text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#F0EFFE] text-[#9F99F8]"
                    : "text-[#666666] hover:text-[#333333]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>
      <CategoriaBreakdown
        rows={data.rows}
        itemsConOcByCategoria={data.itemsConOcByCategoria}
      />
      <CategoriaTree arbol={data.arbol} modo={modo} />
    </div>
  );
}
