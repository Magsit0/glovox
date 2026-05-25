"use client";

import { useState } from "react";
import { ChevronRight, FileText } from "lucide-react";
import type {
  CategoriaNode,
  ItemDetail,
  SubcategoriaNode,
} from "@/lib/unabase/cierreNegocio";
import { compactCurrency, formatCurrency, formatNumber } from "@/lib/unabase/formatting";

interface Props {
  arbol: CategoriaNode[];
}

function avanceFor(presupuesto: number, gastoReal: number): number {
  if (presupuesto > 0) return gastoReal / presupuesto;
  if (gastoReal > 0) return Infinity;
  return 0;
}

function avanceLabel(avance: number): string {
  if (!Number.isFinite(avance)) return "S/Presup";
  return `${Math.round(avance * 100)}%`;
}

function avanceClass(avance: number): string {
  if (!Number.isFinite(avance)) return "text-[#999999]";
  if (avance > 1) return "text-[#ED75A0]";
  if (avance === 0) return "text-[#999999]";
  return "text-[#333333]";
}

function diferenciaClass(diferencia: number): string {
  if (diferencia < 0) return "text-[#ED75A0]";
  if (diferencia === 0) return "text-[#999999]";
  return "text-[#333333]";
}

export default function CategoriaTree({ arbol }: Props) {
  if (arbol.length === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Detalle por item
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">Sin items registrados.</p>
      </article>
    );
  }

  return (
    <article className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
      <header className="border-b border-[#E5E5E5] p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Detalle por item
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Abre una categoría para ver sus subcategorías, y una subcategoría para ver sus items.
        </p>
      </header>

      <div className="grid grid-cols-[minmax(0,1fr)_72px_112px_128px_128px_96px] items-center bg-[#FAFAFA] border-b border-[#E5E5E5] px-4 py-3 font-sans text-xs font-medium uppercase tracking-wide text-[#666666]">
        <span>Categoría / Subcategoría / Item</span>
        <span className="px-3 text-right">Items</span>
        <span className="px-3 text-right">Presup.</span>
        <span className="px-3 text-right">Gasto real</span>
        <span className="px-3 text-right">Dif.</span>
        <span className="px-3 text-right">Avance</span>
      </div>

      <ul>
        {arbol.map((cat) => (
          <CategoryRow key={cat.categoria} node={cat} />
        ))}
      </ul>
    </article>
  );
}

function CategoryRow({ node }: { node: CategoriaNode }) {
  const [open, setOpen] = useState(false);
  const avance = avanceFor(node.presupuesto, node.gastoReal);

  return (
    <li className="border-b border-[#E5E5E5] last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_72px_112px_128px_128px_96px] items-center px-4 py-3 text-left transition-colors hover:bg-[#FAFAFA]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight
            data-pdf-caret
            className={`h-4 w-4 shrink-0 text-[#999999] transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="truncate font-sans text-sm font-medium uppercase tracking-wide text-[#333333]">
            {node.categoria}
          </span>
        </span>
        <span className="px-3 text-right font-sans text-sm tabular-nums text-[#666666]">
          {formatNumber(node.itemsCount)}
        </span>
        <span className="px-3 text-right font-sans text-sm tabular-nums text-[#333333]">
          {compactCurrency(node.presupuesto)}
        </span>
        <span className="px-3 text-right font-sans text-sm tabular-nums text-[#333333]">
          {compactCurrency(node.gastoReal)}
        </span>
        <span className={`px-3 text-right font-sans text-sm tabular-nums ${diferenciaClass(node.diferencia)}`}>
          {compactCurrency(node.diferencia)}
        </span>
        <span className={`px-3 text-right font-sans text-sm font-medium tabular-nums ${avanceClass(avance)}`}>
          {avanceLabel(avance)}
        </span>
      </button>

      <ul
        data-pdf-expand
        className={`bg-[#FAFAFA] ${open ? "" : "hidden print:block"}`}
      >
        {node.subcategorias.map((sub) => (
          <SubcategoryRow key={sub.subcategoria} node={sub} />
        ))}
        {node.subcategorias.length === 0 && (
          <li className="px-4 py-3 pl-12 font-sans text-sm text-[#999999]">
            Sin subcategorías.
          </li>
        )}
      </ul>
    </li>
  );
}

function SubcategoryRow({ node }: { node: SubcategoriaNode }) {
  const [open, setOpen] = useState(false);
  const avance = avanceFor(node.presupuesto, node.gastoReal);

  return (
    <li className="border-t border-[#E5E5E5] first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_72px_112px_128px_128px_96px] items-center px-4 py-2.5 pl-10 text-left transition-colors hover:bg-white"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight
            data-pdf-caret
            className={`h-3.5 w-3.5 shrink-0 text-[#999999] transition-transform ${open ? "rotate-90" : ""}`}
            aria-hidden="true"
          />
          <span className="truncate font-sans text-sm text-[#333333]">
            {node.subcategoria}
          </span>
        </span>
        <span className="px-3 text-right font-sans text-sm tabular-nums text-[#666666]">
          {formatNumber(node.itemsCount)}
        </span>
        <span className="px-3 text-right font-sans text-sm tabular-nums text-[#333333]">
          {compactCurrency(node.presupuesto)}
        </span>
        <span className="px-3 text-right font-sans text-sm tabular-nums text-[#333333]">
          {compactCurrency(node.gastoReal)}
        </span>
        <span className={`px-3 text-right font-sans text-sm tabular-nums ${diferenciaClass(node.diferencia)}`}>
          {compactCurrency(node.diferencia)}
        </span>
        <span className={`px-3 text-right font-sans text-sm font-medium tabular-nums ${avanceClass(avance)}`}>
          {avanceLabel(avance)}
        </span>
      </button>

      <ul
        data-pdf-expand
        className={`bg-white ${open ? "" : "hidden print:block"}`}
      >
        {node.items.map((it) => (
          <ItemRow key={it.llave_item} item={it} />
        ))}
        {node.items.length === 0 && (
          <li className="px-4 py-2.5 pl-16 font-sans text-sm text-[#999999]">
            Sin items.
          </li>
        )}
      </ul>
    </li>
  );
}

function ItemRow({ item }: { item: ItemDetail }) {
  const avance = avanceFor(item.presupuesto, item.gastoReal);

  return (
    <li
      className="grid grid-cols-[minmax(0,1fr)_72px_112px_128px_128px_96px] items-start border-t border-[#E5E5E5] px-4 py-2.5 pl-16 first:border-t-0"
      title={item.descripcion || undefined}
    >
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="h-3.5 w-3.5 shrink-0 text-[#999999]" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-sans text-sm text-[#333333]">{item.item}</span>
          {item.descripcion && (
            <span className="truncate font-sans text-xs text-[#999999]">{item.descripcion}</span>
          )}
        </span>
      </span>
      <span className="px-3 text-right font-sans text-sm tabular-nums text-[#666666]" title="Cantidad">
        {formatNumber(item.cantidad)}
      </span>
      <span
        className="px-3 text-right font-sans text-sm tabular-nums text-[#333333]"
        title={formatCurrency(item.presupuesto)}
      >
        {compactCurrency(item.presupuesto)}
      </span>
      <span
        className="px-3 text-right font-sans text-sm tabular-nums text-[#333333]"
        title={
          item.nFacturas > 0
            ? `${formatCurrency(item.gastoReal)} en ${item.nFacturas} ${
                item.nFacturas === 1 ? "documento" : "documentos"
              }`
            : "Sin OC"
        }
      >
        {compactCurrency(item.gastoReal)}
        {item.nFacturas > 0 && (
          <span className="ml-1 font-sans text-xs text-[#999999]">×{item.nFacturas}</span>
        )}
      </span>
      <span className={`px-3 text-right font-sans text-sm tabular-nums ${diferenciaClass(item.diferencia)}`}>
        {compactCurrency(item.diferencia)}
      </span>
      <span className={`px-3 text-right font-sans text-sm font-medium tabular-nums ${avanceClass(avance)}`}>
        {avanceLabel(avance)}
      </span>
    </li>
  );
}
