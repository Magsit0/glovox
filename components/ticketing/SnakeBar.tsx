"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Props {
  /** Magnitud que define el largo de la serpiente. */
  value: number;
  /** Valor que llena exactamente una fila horizontal completa. */
  unitMax: number;
  /** Texto ya formateado que se ancla al final del trazo. */
  label: string;
}

const H = 14; // grosor de la barra (px)
const GAP = 8; // separación vertical entre vueltas (px)
const PITCH = H + GAP; // distancia entre líneas centrales de filas
const TURN_R = PITCH / 2; // radio de la curva en "U"
const MAX_ROWS = 3; // máximo de vueltas antes de clampear
const LABEL_PAD = 64; // reserva a la derecha para la etiqueta del valor

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Barra "serpiente": un único trazo continuo que avanza a la derecha, da una
 * vuelta en "U" redondeada y regresa a la izquierda, encadenando hasta MAX_ROWS
 * filas. El final de cada fila queda unido al inicio de la siguiente por la
 * curva. Relleno con degradado glossy (que se repite por fila) + glow difuso.
 */
export default function SnakeBar({ value, unitMax, label }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const rawId = useId();
  const gid = `snk-${rawId.replace(/:/g, "")}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr) setW(cr.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Nº de filas: depende sólo del valor, no del ancho → sin saltos de layout.
  const units = unitMax > 0 ? value / unitMax : 0;
  const fullRows = Math.floor(units + 1e-9);
  const partial = units - fullRows;
  const hasPartial = partial > 1e-6 || fullRows === 0;
  const rows = Math.max(1, Math.min(MAX_ROWS, fullRows + (hasPartial ? 1 : 0)));

  const yOf = (i: number) => H / 2 + i * PITCH;
  const svgH = H + (rows - 1) * PITCH;

  const xL = TURN_R;
  const xR = Math.max(xL, w - TURN_R - LABEL_PAD);
  const rowLen = Math.max(0, xR - xL);

  const lenOf = (i: number) => {
    const isPartialRow = i === fullRows && rows > fullRows;
    return isPartialRow ? Math.max(partial * rowLen, 0) : rowLen;
  };

  // Final del último tramo (para anclar la etiqueta del valor).
  const lastGoingRight = (rows - 1) % 2 === 0;
  const endX = lastGoingRight ? xL + lenOf(rows - 1) : xR - lenOf(rows - 1);
  const endY = yOf(rows - 1);

  let d = `M ${round(xL)} ${round(yOf(0))}`;
  for (let i = 0; i < rows; i++) {
    const goingRight = i % 2 === 0;
    const ex = goingRight ? xL + lenOf(i) : xR - lenOf(i);
    d += ` L ${round(ex)} ${round(yOf(i))}`;
    if (i < rows - 1) {
      // Vuelta en U que une el final de esta fila con el inicio de la siguiente.
      const tx = goingRight ? xR : xL;
      const sweep = goingRight ? 1 : 0;
      d += ` A ${round(TURN_R)} ${round(TURN_R)} 0 0 ${sweep} ${round(tx)} ${round(yOf(i + 1))}`;
    }
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height: svgH }}>
      {w > 0 && (
        <>
          <svg
            className="absolute inset-0 overflow-visible"
            width="100%"
            height="100%"
            viewBox={`0 0 ${round(w)} ${round(svgH)}`}
            preserveAspectRatio="none"
          >
            <defs>
              {/* userSpaceOnUse: evita el degradado degenerado en barras de una
                  sola fila (bbox de altura 0). Repite el glossy cada PITCH para
                  dar el efecto de tubo en cada vuelta. */}
              <linearGradient
                id={gid}
                gradientUnits="userSpaceOnUse"
                x1="0"
                y1="0"
                x2="0"
                y2={PITCH}
                spreadMethod="repeat"
              >
                <stop offset="0%" stopColor="#F7A8C9" />
                <stop offset="30%" stopColor="#ED75A0" />
                <stop offset="63%" stopColor="#DA5E92" />
                <stop offset="100%" stopColor="#DA5E92" />
              </linearGradient>
            </defs>
            <path
              d={d}
              fill="none"
              stroke={`url(#${gid})`}
              strokeWidth={H}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                filter:
                  "drop-shadow(0 0 3px rgba(237,117,160,0.55)) drop-shadow(0 0 7px rgba(237,117,160,0.35))",
              }}
            />
          </svg>
          <span
            className="pointer-events-none absolute font-sans text-xs font-semibold tabular-nums text-[#333333]"
            style={
              lastGoingRight
                ? { left: endX + 8, top: endY, transform: "translateY(-50%)" }
                : { right: w - endX + 8, top: endY, transform: "translateY(-50%)" }
            }
          >
            {label}
          </span>
        </>
      )}
    </div>
  );
}
