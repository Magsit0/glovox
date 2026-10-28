"use client";

import { useEffect, useState } from "react";
import { useEntraEnVista } from "./useEntraEnVista";

export type FormatoKpi = "entero" | "clp" | "clpCompacto";

// Mismos formatos que usaba la página para estos valores (formatNumber,
// formatCurrency y el compacto con "$"): el servidor y el cliente deben
// producir el mismo texto para que la hidratación calce.
const entero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });
const clp = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});
const compacto = new Intl.NumberFormat("es-CL", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

function formatear(v: number, formato: FormatoKpi): string {
  if (formato === "clp") return clp.format(v);
  if (formato === "clpCompacto") return `$${compacto.format(Math.round(v))}`;
  return entero.format(Math.round(v));
}

const DURACION_MS = 900;

/**
 * Valor de una KPI que cuenta desde 0 cuando entra en pantalla (y de nuevo al
 * cambiar de edición): el equivalente numérico del trazado de los gráficos.
 * En el teléfono las KPIs quedan bajo el pliegue; si contaran al cargar,
 * terminarían antes de que alguien llegue a verlas.
 *
 * El servidor renderiza el valor FINAL, oculto por `.lacava-cuenta-espera`
 * (app/globals.css), así no se ve el número completo y luego un salto a 0.
 * Si el JS no llega, el valor aparece igual a los 2 s, y si llega tarde (ya
 * visible) no se vuelve a contar. Al hidratar a tiempo, espera oculto a
 * entrar en pantalla. Al imprimir se ve siempre; con "reducir movimiento" se
 * muestra el valor final sin contar.
 */
export default function ContadorKpi({
  valor,
  formato,
}: {
  valor: number;
  formato: FormatoKpi;
}) {
  const [ref, enVista, el] = useEntraEnVista<HTMLSpanElement>(0.6);
  // inicial: HTML del servidor · esperando: hidratado, oculto hasta verse ·
  // listo: sin cuenta (el respaldo ya lo mostró, o reducir movimiento).
  const [fase, setFase] = useState<"inicial" | "esperando" | "listo">("inicial");
  const [mostrado, setMostrado] = useState<number | null>(null);

  useEffect(() => {
    if (!el || fase !== "inicial") return;
    const reducido = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const yaVisible = getComputedStyle(el).opacity !== "0";
    setFase(reducido || yaVisible ? "listo" : "esperando");
  }, [el, fase]);

  useEffect(() => {
    if (fase !== "esperando" || !enVista) return;
    let t0: number | undefined;
    let raf = 0;
    const paso = (t: number) => {
      // t0 sale del primer cuadro: con performance.now() el primer timestamp
      // de rAF puede ser anterior y la cuenta partía en negativo ("-0").
      t0 ??= t;
      const p = Math.min(1, (t - t0) / DURACION_MS);
      // easeOutQuart: rápido al inicio, se asienta suave en el valor final.
      setMostrado(valor * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [fase, enVista, valor]);

  const clase =
    fase === "inicial"
      ? "lacava-cuenta-espera"
      : fase === "esperando" && mostrado === null
        ? "lacava-espera-vista"
        : undefined;

  return (
    <span ref={ref} className={clase}>
      {formatear(fase === "esperando" && mostrado !== null ? mostrado : valor, formato)}
    </span>
  );
}
