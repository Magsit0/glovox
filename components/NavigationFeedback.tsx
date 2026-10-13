"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  finishNavigation,
  recordInteraction,
  startNavigation,
  subscribeNavigation,
} from "@/lib/navigation-feedback";

/**
 * Feedback transversal de navegación (docs/STYLE_DASHBOARD.md → "Feedback de
 * navegación"). Montado una vez en app/layout.tsx; ningún dashboard tiene que
 * hacer nada salvo importar `useRouter` desde lib/use-router.ts.
 *
 *  A · Barra morada de 2px en el borde superior mientras la página carga.
 *  B · Spinner + contorno morado sobre lo que se clickeó (card, fila, filtro).
 *
 * Solo aparece si la espera pasa de SHOW_DELAY_MS: las navegaciones
 * prefetcheadas terminan antes y no parpadean.
 */

const SHOW_DELAY_MS = 150;
/** Red de seguridad: si la navegación nunca hace commit, no queda colgado. */
const MAX_PENDING_MS = 20_000;
const FINISH_MS = 250;
const BADGE = 26;

/** Lo que cuenta como "lo que el usuario tocó". */
const INTERACTIVE =
  'a[href],button,[role="button"],[role="link"],[role="tab"],[role="option"],[role="menuitem"],summary,select,tr';

function interactiveFrom(target: Element): Element | null {
  const el = target.closest(INTERACTIVE);
  if (el) return el;
  // Divs con onClick: el ancestro más externo de la racha con cursor pointer.
  let node: Element | null = target;
  let found: Element | null = null;
  while (node && node !== document.body) {
    if (getComputedStyle(node).cursor === "pointer") found = node;
    else if (found) break;
    node = node.parentElement;
  }
  return found;
}

/**
 * Posición del spinner: centrado a la derecha en elementos bajos (filas,
 * botones, pills); esquina superior derecha en los altos (cards); centrado en
 * los muy angostos (botones de ícono).
 */
function badgePosition(el: Element): { top: number; left: number } | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  const right = Math.min(r.right, window.innerWidth);
  if (r.width < BADGE * 2.5) {
    return { top: r.top + r.height / 2 - BADGE / 2, left: r.left + r.width / 2 - BADGE / 2 };
  }
  if (r.height <= 64) {
    return { top: r.top + r.height / 2 - BADGE / 2, left: right - BADGE - 10 };
  }
  return { top: r.top + 14, left: right - BADGE - 14 };
}

type Phase = "idle" | "loading" | "finishing";

function NavigationFeedbackInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKey = `${pathname}?${searchParams.toString()}`;

  const [phase, setPhase] = useState<Phase>("idle");
  const [source, setSource] = useState<Element | null>(null);
  const [navId, setNavId] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timers = useRef<number[]>([]);

  // Entrada 1: clicks en links internos + registro de lo último que se tocó
  // (fuente del spinner cuando la navegación sale de un router.push).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      const el = interactiveFrom(e.target);
      if (el) recordInteraction(el);

      const a = e.target.closest("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      startNavigation(a.href, a);
    };
    const onChange = (e: Event) => {
      if (e.target instanceof Element) recordInteraction(e.target);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("change", onChange, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("change", onChange, true);
    };
  }, []);

  // Estado → fases visuales.
  useEffect(() => {
    const clear = () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
    const unsubscribe = subscribeNavigation((s) => {
      clear();
      if (s.pending) {
        timers.current.push(
          window.setTimeout(() => {
            setSource(s.source);
            setNavId(s.id);
            setPhase("loading");
          }, SHOW_DELAY_MS),
          window.setTimeout(finishNavigation, MAX_PENDING_MS),
        );
      } else {
        setSource(null);
        setPhase((p) => (p === "loading" ? "finishing" : "idle"));
        timers.current.push(window.setTimeout(() => setPhase("idle"), FINISH_MS));
      }
    });
    return () => {
      unsubscribe();
      clear();
    };
  }, []);

  // Entrada 2: la navegación termina cuando Next hace commit de la URL nueva.
  useEffect(() => {
    finishNavigation();
  }, [urlKey]);

  // El elemento clickeado se marca con data-nav-pending (contorno vía CSS) y el
  // spinner lo sigue si algo scrollea mientras espera.
  useEffect(() => {
    if (phase !== "loading" || !source) return;
    source.setAttribute("data-nav-pending", "");
    source.setAttribute("aria-busy", "true");
    let raf = 0;
    const place = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setPos(badgePosition(source)));
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      setPos(null);
      source.removeAttribute("data-nav-pending");
      source.removeAttribute("aria-busy");
    };
  }, [phase, source, navId]);

  if (phase === "idle") return null;

  return (
    <>
      <div
        role="progressbar"
        aria-label="Cargando página"
        aria-busy={phase === "loading"}
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]"
      >
        <div className="nav-feedback-bar h-full bg-[#9F99F8]" data-phase={phase} />
      </div>
      {phase === "loading" && pos && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[100] flex items-center justify-center rounded-full bg-[var(--surface)] shadow-md"
          style={{ top: pos.top, left: pos.left, width: BADGE, height: BADGE }}
        >
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--purple-tint)] border-t-[#9F99F8]" />
        </div>
      )}
    </>
  );
}

export default function NavigationFeedback() {
  // useSearchParams exige un límite de Suspense para no forzar render en cliente
  // de todo el árbol.
  return (
    <Suspense fallback={null}>
      <NavigationFeedbackInner />
    </Suspense>
  );
}
