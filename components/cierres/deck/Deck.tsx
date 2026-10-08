"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Download,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { NAV_BACK } from "@/lib/dashboard-groups";
import "./deck.css";

interface Props {
  /** Título corto en la barra superior, ej. "Cierre Piknic 3 · 26-27". */
  title: string;
  /** Ruta de regreso (hub del grupo). */
  backHref: string;
  backLabel: string;
  /** Nombre del archivo al guardar como PDF (sin extensión). */
  pdfFilename: string;
  /** Las láminas (<Slide>), renderizadas en el servidor. */
  children: React.ReactNode;
}

const NEXT_KEYS = ["ArrowDown", "ArrowRight", "PageDown", " "];
const PREV_KEYS = ["ArrowUp", "ArrowLeft", "PageUp"];

/**
 * Contenedor de una presentación de cierre: barra superior (volver, lámina
 * actual, PDF, pantalla completa) + scroller con una lámina por pantalla.
 *
 * Navegación: flechas / PageUp / PageDown / espacio pasan de lámina, Inicio y
 * Fin van a la primera y la última, F alterna pantalla completa. El PDF es
 * "Guardar como PDF" del navegador con las reglas @media print de deck.css
 * (una lámina 16:9 por página), mismo patrón que los reportes estáticos.
 */
export default function Deck({
  title,
  backHref,
  backLabel,
  pdfFilename,
  children,
}: Props) {
  const scrollerRef = useRef<HTMLElement>(null);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  const slides = useCallback(
    () =>
      Array.from(
        scrollerRef.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? [],
      ),
    [],
  );

  // Lámina actual = la que ocupa más de la mitad del scroller.
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;
    const list = slides();
    const io = new IntersectionObserver(
      (entries) => {
        setTotal(list.length);
        for (const e of entries) {
          if (e.isIntersecting) {
            setCurrent(list.indexOf(e.target as HTMLElement));
          }
        }
      },
      { root, threshold: 0.5 },
    );
    list.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [slides]);

  const goTo = useCallback(
    (i: number) => {
      const root = scrollerRef.current;
      const list = slides();
      const target = list[Math.max(0, Math.min(list.length - 1, i))];
      // scrollTo del propio scroller (es `relative`, así que offsetTop es la
      // posición dentro de él). scrollIntoView arrastraría también al documento.
      if (root && target) root.scrollTo({ top: target.offsetTop });
    },
    [slides],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) {
        return;
      }
      // Espacio sobre un botón o link lo activa: no lo robamos.
      if (e.key === " " && t && /^(BUTTON|A)$/.test(t.tagName)) return;
      if (NEXT_KEYS.includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (PREV_KEYS.includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === "Home") {
        e.preventDefault();
        goTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        goTo(Number.MAX_SAFE_INTEGER);
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo, toggleFullscreen]);

  const downloadPdf = useCallback(async () => {
    await document.fonts?.ready;
    const safeName =
      pdfFilename.replace(/[\\/:*?"<>|]+/g, "_").trim() || "cierre";
    const prevTitle = document.title;
    document.title = safeName;
    const restore = () => {
      document.title = prevTitle;
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  }, [pdfFilename]);

  const iconBtn =
    "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[var(--ink)] transition-colors hover:bg-[var(--surface-alt)] disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="ck-root flex h-svh flex-col bg-[var(--surface-alt)]">
      <header
        data-no-print="true"
        className="ck-topbar flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--divider)] bg-[var(--surface)] px-4 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href={backHref}
            transitionTypes={[NAV_BACK]}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
          <span className="h-5 w-px shrink-0 bg-[var(--divider)]" aria-hidden="true" />
          <p className="truncate font-display text-base font-bold tracking-tight text-[var(--ink)]">
            {title}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <div className="hidden items-center gap-1 lg:flex">
            <button
              type="button"
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className={iconBtn}
              aria-label="Lámina anterior"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <span
              className="min-w-14 text-center font-sans text-sm tabular-nums text-[var(--ink-muted)]"
              aria-live="polite"
            >
              {total > 0 ? `${current + 1} / ${total}` : ""}
            </span>
            <button
              type="button"
              onClick={() => goTo(current + 1)}
              disabled={total === 0 || current === total - 1}
              className={iconBtn}
              aria-label="Lámina siguiente"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              className={iconBtn}
              aria-label={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (F)"}
              title={fullscreen ? "Salir de pantalla completa" : "Pantalla completa (F)"}
            >
              {fullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
          <button
            type="button"
            onClick={downloadPdf}
            className="ml-2 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--ink)] bg-[var(--surface)] px-4 py-2 font-sans text-sm font-medium text-[var(--ink)] transition-colors hover:bg-[var(--surface-alt)]"
            aria-label="Descargar la presentación en PDF"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Descargar PDF</span>
          </button>
        </div>
      </header>

      <main
        ref={scrollerRef}
        id="main-content"
        className="ck-deck relative min-h-0 flex-1 overflow-y-auto lg:snap-y lg:snap-mandatory"
      >
        {children}
      </main>
    </div>
  );
}
