"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { seriesColor } from "@/lib/chart-colors";
import type { NegocioRow } from "@/lib/unabase/types";
import CierreTable from "@/components/cierre-negocio/CierreTable";

export interface GrupoCardData {
  key: string;
  title: string;
  subtitle?: string;
  count: number;
}

export interface GrupoMode {
  key: string;
  label: string;
  title: string;
  groups: GrupoCardData[];
}

export interface GrupoItem {
  keys: Record<string, string>;
  row: NegocioRow;
}

interface Props {
  /** Área (produccion | btl) — para reflejar la selección en la URL. */
  area: string;
  eyebrowBase: string;
  modes: GrupoMode[];
  items: GrupoItem[];
  initialMode?: string;
  initialSelected?: string | null;
}

const LAYOUT_TRANSITION = { layout: { duration: 0.35, ease: [0.4, 0, 0.2, 1] as const } };

// Selección especial "Todos": muestra el listado completo del área, sin agrupar.
// No choca con las llaves reales (RUT normalizado, "__sin_rut__", nombre de
// ejecutivo o categoría) ni con la key del botón de volver ("__volver__").
const TODOS_KEY = "__all__";
const TODOS_COLOR = "#9F99F8";

export default function GrupoNav({
  area,
  eyebrowBase,
  modes,
  items,
  initialMode,
  initialSelected,
}: Props) {
  const firstMode = modes[0]?.key ?? "";
  const startMode = initialMode && modes.some((m) => m.key === initialMode) ? initialMode : firstMode;
  const startGroups = modes.find((m) => m.key === startMode)?.groups ?? [];
  const startSelected =
    initialSelected &&
    (initialSelected === TODOS_KEY || startGroups.some((g) => g.key === initialSelected))
      ? initialSelected
      : null;

  const [mode, setMode] = useState(startMode);
  const [selected, setSelected] = useState<string | null>(startSelected);

  const currentMode = modes.find((m) => m.key === mode) ?? modes[0];
  const groups = currentMode?.groups ?? [];
  const colorByKey = new Map(groups.map((g, i) => [g.key, seriesColor(i)] as const));
  const isOpen = selected !== null;
  const isTodos = selected === TODOS_KEY;
  const selectedInfo = isTodos
    ? { key: TODOS_KEY, title: "Todos los negocios", subtitle: "", count: items.length }
    : groups.find((g) => g.key === selected);
  // "Todos" no filtra: pasa el listado completo del área tal como llegó.
  const filteredRows = !isOpen
    ? []
    : isTodos
      ? items.map((it) => it.row)
      : items.filter((it) => it.keys[mode] === selected).map((it) => it.row);

  // Refleja el estado del selector en la URL SIN re-render (history.replaceState):
  // conserva la animación y hace que el listado sea direccionable, para que
  // "volver al listado" desde el detalle (vía ?from=…) y el refresh/atrás del
  // browser aterricen en el mismo lugar donde estabas.
  function syncUrl(nextMode: string, nextSelected: string | null) {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    params.set("area", area);
    if (modes.length > 1) params.set("group", nextMode);
    if (nextSelected) params.set(nextMode, nextSelected);
    window.history.replaceState(null, "", `/cierre-negocio?${params.toString()}`);
  }

  function chooseGroup(key: string) {
    const next = selected === key ? null : key;
    setSelected(next);
    syncUrl(mode, next);
  }

  function clearSelected() {
    setSelected(null);
    syncUrl(mode, null);
  }

  function switchMode(next: string) {
    setMode(next);
    setSelected(null);
    syncUrl(next, null);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/"
            aria-label="Volver al menú principal"
            className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
          >
            <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
          </Link>
          <Link
            href="/cierre-negocio"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#333333] bg-white px-4 py-2 font-sans text-sm font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
          >
            <ArrowLeft className="h-4 w-4" />
            Cambiar área
          </Link>
        </div>
        <p className="font-sans text-xs text-[#666666]">
          {eyebrowBase}
          {isOpen && selectedInfo ? ` · ${selectedInfo.title}` : ""}
        </p>
        <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
          {isOpen && selectedInfo ? selectedInfo.title : currentMode?.title}
        </h1>
        {isOpen && (
          <p className="font-sans text-sm text-[#666666]">
            Selecciona un negocio para ver su informe de cierre.
          </p>
        )}
      </header>

      {!isOpen && modes.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-sans text-sm text-[#666666]">Agrupar</span>
          {modes.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => switchMode(m.key)}
              className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
                mode === m.key
                  ? "bg-[#9F99F8] text-white"
                  : "border border-[#E5E5E5] bg-white text-[#666666] hover:text-[#333333]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}

      <motion.div
        layout
        transition={LAYOUT_TRANSITION}
        className={
          isOpen
            ? "flex flex-nowrap items-center gap-3 overflow-x-auto pb-1"
            : "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.button
              key="__volver__"
              type="button"
              layout
              transition={LAYOUT_TRANSITION}
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              onClick={clearSelected}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#333333] bg-white px-4 py-2 font-sans text-xs font-medium text-[#333333] transition-colors hover:bg-[#FAFAFA]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Volver
            </motion.button>
          )}
        </AnimatePresence>

        {/* "Todos" primero: atajo al listado completo del área, sin agrupar. */}
        <motion.button
          key={TODOS_KEY}
          type="button"
          layout
          transition={LAYOUT_TRANSITION}
          onClick={() => chooseGroup(TODOS_KEY)}
          style={
            isOpen && isTodos
              ? { backgroundColor: TODOS_COLOR, borderColor: TODOS_COLOR }
              : { borderColor: TODOS_COLOR }
          }
          className={
            isOpen
              ? `inline-flex shrink-0 items-center gap-2 rounded-full border border-l-2 px-4 py-2 font-sans text-xs font-medium transition-colors ${
                  isTodos ? "text-white" : "bg-white text-[#333333] hover:bg-[#FAFAFA]"
                }`
              : "flex min-h-[120px] flex-col justify-between gap-3 rounded-lg border border-l-2 border-[#E5E5E5] bg-white p-6 text-left transition-colors hover:bg-[#FAFAFA] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
          }
        >
          {isOpen ? (
            <>
              <span className="whitespace-nowrap">Todos</span>
              <span className={isTodos ? "text-white/80" : "text-[#999999]"}>{items.length}</span>
            </>
          ) : (
            <>
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: TODOS_COLOR }}
              />
              <div className="flex flex-col gap-1">
                <span className="line-clamp-2 font-display text-lg font-bold leading-tight tracking-tight text-[#333333]">
                  Todos
                </span>
                <span className="font-sans text-xs text-[#666666]">Sin agrupar</span>
              </div>
              <span className="font-sans text-xs text-[#999999]">
                {items.length} negocio{items.length === 1 ? "" : "s"}
              </span>
            </>
          )}
        </motion.button>

        {groups.map((g) => {
          const color = colorByKey.get(g.key) ?? seriesColor(0);
          const active = selected === g.key;
          return (
            <motion.button
              key={g.key}
              type="button"
              layout
              transition={LAYOUT_TRANSITION}
              onClick={() => chooseGroup(g.key)}
              style={
                isOpen && active ? { backgroundColor: color, borderColor: color } : { borderColor: color }
              }
              className={
                isOpen
                  ? `inline-flex shrink-0 items-center gap-2 rounded-full border border-l-2 px-4 py-2 font-sans text-xs font-medium transition-colors ${
                      active ? "text-white" : "bg-white text-[#333333] hover:bg-[#FAFAFA]"
                    }`
                  : "flex min-h-[120px] flex-col justify-between gap-3 rounded-lg border border-l-2 border-[#E5E5E5] bg-white p-6 text-left transition-colors hover:bg-[#FAFAFA] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]"
              }
            >
              {isOpen ? (
                <>
                  <span className="whitespace-nowrap">{g.title}</span>
                  <span className={active ? "text-white/80" : "text-[#999999]"}>{g.count}</span>
                </>
              ) : (
                <>
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <div className="flex flex-col gap-1">
                    <span className="line-clamp-2 font-display text-lg font-bold leading-tight tracking-tight text-[#333333]">
                      {g.title}
                    </span>
                    {g.subtitle && (
                      <span className="font-sans text-xs text-[#666666]">{g.subtitle}</span>
                    )}
                  </div>
                  <span className="font-sans text-xs text-[#999999]">
                    {g.count} negocio{g.count === 1 ? "" : "s"}
                  </span>
                </>
              )}
            </motion.button>
          );
        })}
      </motion.div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            key="tabla"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <CierreTable rows={filteredRows} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
