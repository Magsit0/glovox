"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import { FoldHorizontal, UnfoldHorizontal } from "lucide-react";
import {
  clampAncho,
  COL_NOMBRE_MAX,
  guardarAncho,
  leerAncho,
  suscribirAncho,
  type ColumnaNombre,
} from "@/lib/inversion-medios/col-nombre";

/**
 * Columna de nombres AJUSTABLE de las tablas de /inversion-medios (calendario
 * global y sábana del drill). El ancho viaja como variable CSS `--col-nombre`
 * en el contenedor de la tabla; las celdas de la columna usan `W_NOMBRE`. Así
 * cambiarlo re-maqueta sin re-renderizar filas memoizadas.
 *
 * Decisiones tras una revisión con verificación adversarial (2026-10-15):
 *  - el arrastre escribe la variable CSS directo en el DOM; el estado de React
 *    cambia recién al soltar (antes, un setState por pointermove re-renderizaba
 *    el panel entero);
 *  - el ancho EFECTIVO se topa con el ancho de la tabla menos dos días, para
 *    que en pantallas angostas siempre queden días a la vista y los controles
 *    para achicarla no se vayan fuera de pantalla (la preferencia guardada no
 *    se toca: en una pantalla ancha vuelve a valer);
 *  - cookie (no localStorage), con snapshot de servidor = la cookie que leyó la
 *    page: el primer render ya sale con el ancho guardado, sin salto;
 *  - el tope por contenedor va TAMBIÉN en CSS (`100cqw` del contenedor, que es
 *    `container-type: inline-size`): el HTML del servidor no conoce el ancho de
 *    la pantalla, y sin esto en un celular la columna salía con lo guardado y
 *    saltaba al tope al hidratar. El número (aria, botón, arrastre, tramo
 *    visible) sale del ResizeObserver y usa el mismo ancho (`offsetWidth` del
 *    área que scrollea = `100cqw`).
 */

// Literal, para que Tailwind genere las clases.
export const W_NOMBRE = "w-[var(--col-nombre)] min-w-[var(--col-nombre)] max-w-[var(--col-nombre)]";

const COL_DIA = 64; // w-16
const RESERVA = 2 * COL_DIA; // siempre quedan al menos dos días a la vista

/** Clases del contenedor que lleva `estiloContenedor`: es el contenedor de las
 *  unidades `cqw` del tope en CSS. */
export const CONTENEDOR_NOMBRE = "[container-type:inline-size]";

/** Ancho efectivo: lo guardado, sin dejar menos de dos días visibles. */
export function topeAncho(v: number, contenedor: number | null, col: ColumnaNombre): number {
  if (contenedor == null) return v;
  return Math.max(col.min, Math.min(v, contenedor - RESERVA));
}

export type AnchoColumna = {
  col: ColumnaNombre;
  /** Preferencia guardada (puede superar lo que cabe). */
  anchoGuardado: number;
  /** Ancho efectivo en pantalla. */
  anchoNombre: number;
  columnaAncha: boolean;
  /** ¿Queda espacio para ensanchar? (en un celular angosto, no). */
  puedeEnsanchar: boolean;
  arrastrando: boolean;
  estiloContenedor: CSSProperties;
  iniciarResize: (e: ReactPointerEvent<HTMLDivElement>) => void;
  alternarAncho: () => void;
  ajustarAncho: () => void;
  teclaResize: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
};

/**
 * @param scrollRef el contenedor que scrollea la tabla: de él sale el ancho
 *   disponible (tope) y dentro de él se miden los `[data-nombre]` truncados.
 */
export function useAnchoColumna(
  col: ColumnaNombre,
  inicial: number,
  scrollRef: RefObject<HTMLDivElement | null>,
): {
  /** Va en el contenedor que lleva `estiloContenedor` (el arrastre escribe ahí
   *  `--col-nombre` directo). Separada de `ctl` porque `ctl` se pasa a los
   *  controles como prop y una ref no se lee durante el render. */
  calRef: RefObject<HTMLDivElement | null>;
  ctl: AnchoColumna;
} {
  const leer = useCallback(() => leerAncho(col), [col]);
  const suscribir = useCallback((cb: () => void) => suscribirAncho(col, cb), [col]);
  const anchoGuardado = useSyncExternalStore(suscribir, leer, () => inicial);

  // Ancho disponible de la tabla. El ResizeObserver avisa al observar, así que
  // no hace falta medir a mano en el efecto.
  const [contenedorW, setContenedorW] = useState<number | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // offsetWidth (con la barra de scroll) = `100cqw` del contenedor: el tope
    // numérico y el de CSS coinciden.
    const obs = new ResizeObserver(() =>
      setContenedorW((prev) => (prev === el.offsetWidth ? prev : el.offsetWidth)),
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [scrollRef]);

  const anchoNombre = topeAncho(anchoGuardado, contenedorW, col);
  const [arrastrando, setArrastrando] = useState(false);
  const calRef = useRef<HTMLDivElement>(null);

  // Arrastrar el borde: pointer capture (sigue aunque el puntero salga del
  // borde) y la variable CSS escrita directo; se persiste al soltar.
  const iniciarResize = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const cont = calRef.current;
      const tope = scrollRef.current ? scrollRef.current.offsetWidth - RESERVA : COL_NOMBRE_MAX;
      const x0 = e.clientX;
      const w0 = anchoNombre;
      let ultimo = w0;
      setArrastrando(true);
      const mover = (ev: PointerEvent) => {
        ultimo = Math.max(col.min, Math.min(clampAncho(w0 + ev.clientX - x0, col), tope));
        cont?.style.setProperty("--col-nombre", `${ultimo}px`);
      };
      const soltar = () => {
        el.removeEventListener("pointermove", mover);
        el.removeEventListener("pointerup", soltar);
        el.removeEventListener("pointercancel", soltar);
        setArrastrando(false);
        // Un clic sin arrastre (o el doble clic) no guarda nada: guardaría el
        // ancho topado de esta pantalla y pisaría la preferencia.
        if (ultimo !== w0) guardarAncho(col, ultimo);
      };
      el.addEventListener("pointermove", mover);
      el.addEventListener("pointerup", soltar);
      el.addEventListener("pointercancel", soltar);
    },
    [anchoNombre, col, scrollRef],
  );

  // "Ajustar a los nombres": lo que le falta al nombre más truncado de las filas
  // VISIBLES (scrollWidth − clientWidth de cada `[data-nombre]`).
  const anchoAjustado = useCallback((): number => {
    const el = scrollRef.current;
    if (!el) return anchoNombre;
    let falta = 0;
    el.querySelectorAll<HTMLElement>("[data-nombre]").forEach((n) => {
      if (n.closest("tr")?.classList.contains("hidden")) return;
      falta = Math.max(falta, n.scrollWidth - n.clientWidth);
    });
    return clampAncho(anchoNombre + falta + (falta > 0 ? 4 : 0), col);
  }, [anchoNombre, col, scrollRef]);

  const columnaAncha = anchoNombre > col.def;
  const puedeEnsanchar = contenedorW == null || contenedorW - RESERVA > anchoNombre;
  const alternarAncho = useCallback(() => {
    if (!columnaAncha && !puedeEnsanchar) return; // no guardar algo que no se vería
    guardarAncho(col, columnaAncha ? col.def : Math.max(anchoAjustado(), col.def + 96));
  }, [col, columnaAncha, puedeEnsanchar, anchoAjustado]);
  const ajustarAncho = useCallback(() => guardarAncho(col, anchoAjustado()), [col, anchoAjustado]);

  // Teclado sobre el borde (separador enfocable): ←/→ de a 16px (Shift: 64),
  // Inicio = ancho original.
  const teclaResize = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const paso = e.shiftKey ? 64 : 16;
      if (e.key === "ArrowLeft") guardarAncho(col, anchoNombre - paso);
      else if (e.key === "ArrowRight") guardarAncho(col, topeAncho(anchoNombre + paso, contenedorW, col));
      else if (e.key === "Home") guardarAncho(col, col.def);
      else return;
      e.preventDefault();
    },
    [anchoNombre, col, contenedorW],
  );

  return {
    calRef,
    ctl: {
      col,
      anchoGuardado,
      anchoNombre,
      columnaAncha,
      puedeEnsanchar,
      arrastrando,
      // El mismo tope que `topeAncho`, resuelto por el navegador: vale desde el
      // HTML del servidor, antes de que haya JS que mida la pantalla.
      estiloContenedor: {
        "--col-nombre": `max(${col.min}px, min(${anchoGuardado}px, calc(100cqw - ${RESERVA}px)))`,
      } as CSSProperties,
      iniciarResize,
      alternarAncho,
      ajustarAncho,
      teclaResize,
    },
  };
}

/** Botón ⇔ junto al título de la columna: ajustar a los nombres / volver al original. */
export function BotonAncho({ ctl }: { ctl: AnchoColumna }) {
  return (
    <button
      type="button"
      onClick={ctl.alternarAncho}
      disabled={!ctl.columnaAncha && !ctl.puedeEnsanchar}
      title={
        ctl.columnaAncha
          ? "Volver al ancho original de la columna"
          : ctl.puedeEnsanchar
            ? "Ensanchar la columna hasta el nombre más largo visible (también puedes arrastrar su borde)"
            : "No hay espacio para ensanchar la columna en esta pantalla"
      }
      aria-label={ctl.columnaAncha ? "Angostar la columna de nombres" : "Ensanchar la columna de nombres"}
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--ink-muted)] transition-colors hover:bg-[var(--grid)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#9F99F8] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
    >
      {ctl.columnaAncha ? <FoldHorizontal className="h-3.5 w-3.5" /> : <UnfoldHorizontal className="h-3.5 w-3.5" />}
    </button>
  );
}

/**
 * Borde arrastrable en el lado derecho del encabezado de la columna (el th
 * tiene que estar posicionado: `sticky` ya lo está). Doble clic = ajustar a los
 * nombres. Con puntero grueso (touch) el área crece a 24px hacia el primer día,
 * que no es interactivo.
 */
export function BordeAncho({ ctl }: { ctl: AnchoColumna }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Ancho de la columna de nombres"
      aria-valuenow={ctl.anchoNombre}
      aria-valuetext={`${ctl.anchoNombre} píxeles`}
      aria-valuemin={ctl.col.min}
      aria-valuemax={COL_NOMBRE_MAX}
      tabIndex={0}
      title="Arrastra para cambiar el ancho · doble clic para ajustar a los nombres"
      onPointerDown={ctl.iniciarResize}
      onDoubleClick={ctl.ajustarAncho}
      onKeyDown={ctl.teclaResize}
      className="group/resize absolute -right-1 top-0 z-10 flex h-full w-2 cursor-col-resize touch-none select-none justify-center focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#9F99F8] pointer-coarse:-right-5 pointer-coarse:w-6 pointer-coarse:justify-start pointer-coarse:pl-[3px]"
    >
      <span
        className={`h-full w-0.5 transition-colors ${
          ctl.arrastrando
            ? "bg-[#9F99F8]"
            : "bg-transparent group-hover/resize:bg-[#9F99F8] group-focus-visible/resize:bg-[#9F99F8]"
        }`}
      />
    </div>
  );
}
