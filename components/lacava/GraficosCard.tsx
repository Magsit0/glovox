"use client";

import { useId, useRef, useState } from "react";
import type { LaCavaDiaRow, LaCavaJornadaDiaRow } from "@/lib/queries/lacava";
import type { PuntoTrayectoria } from "@/lib/lacava/proyeccion";
import VentaDiariaChart from "./VentaDiariaChart";
import PlanVentaCard, { type PlanTarget } from "./PlanVentaCard";
import CurvasEdicionesChart, { type CurvaVariant } from "./CurvasEdicionesChart";
import VentaPorDiaChart from "./VentaPorDiaChart";
import { CurvasSketch, EvolucionSketch, PlanSketch, VentaPorDiaSketch } from "./MiniSketches";
import type { Jornada } from "./jornadas";
import { LACAVA } from "./theme";
import { useEntraEnVista } from "./useEntraEnVista";

type TabKey = "evolucion" | "plan" | "curvas" | "dia";

type Tab = {
  key: TabKey;
  label: string;
  /** Pista corta bajo el nombre: qué muestra el gráfico. */
  hint: string;
  subtitle: string;
};

/**
 * Los gráficos principales del dashboard (evolución de venta, plan de venta,
 * curvas por edición y venta por día) en una sola card: un selector centrado
 * de tarjetas, cada una con un boceto en miniatura del gráfico que abre,
 * dibujado con sus mismos datos.
 *
 * Recibe DATOS, no elementos ya renderizados: los gráficos se crean aquí, del
 * lado cliente. (Pasar elementos creados en el servidor dentro de props hacía
 * que React advirtiera por keys al renderizar una pestaña no inicial.)
 *
 * Solo se monta la pestaña activa: al cambiar, los toggles internos de cada
 * gráfico vuelven a su default. La pestaña elegida se conserva al cambiar de
 * edición; si la edición nueva no la tiene (sin plan comercial), cae a la
 * primera.
 */
export default function GraficosCard({
  evolucion,
  plan,
  curvas,
  ventaPorDia,
}: {
  evolucion: {
    subtitle: string;
    dias: LaCavaDiaRow[];
    goalTickets?: number;
    fechaEvento: string;
  };
  /** Ausente cuando la edición no tiene plan comercial definido. */
  plan?: {
    subtitle: string;
    puntos: PuntoTrayectoria[];
    base: number;
    diasRestantes: number;
    targets: PlanTarget[];
  };
  curvas: { subtitle: string; variants: CurvaVariant[] };
  /** Ausente si la edición no tiene ventas por jornada. */
  ventaPorDia?: {
    subtitle: string;
    jornadas: Jornada[];
    series: LaCavaJornadaDiaRow[];
    /** YYYY-MM-DD de hoy. */
    hoy: string;
  };
}) {
  const baseId = useId();
  const [elegida, setElegida] = useState<TabKey>("evolucion");
  const tabRefs = useRef<Partial<Record<TabKey, HTMLButtonElement | null>>>({});
  // Trazado al entrar en pantalla: los bocetos de las pestañas se revelan en
  // cascada y el gráfico activo se vuelve a montar animado (antes, estático e
  // invisible; ver useEntraEnVista).
  const [tablistRef, tilesEnVista] = useEntraEnVista<HTMLDivElement>(0.5);
  const [panelRef, panelEnVista] = useEntraEnVista<HTMLDivElement>(0.25);

  const curvaBase =
    curvas.variants.find((v) => v.metric === "personas" && !v.normalizar) ??
    curvas.variants[0];
  const ediciones = curvaBase?.series.length ?? 0;

  const tabs: Tab[] = [
    {
      key: "evolucion",
      label: "Evolución de venta",
      hint: "Diaria y acumulada",
      subtitle: evolucion.subtitle,
    },
    ...(plan
      ? [
          {
            key: "plan" as const,
            label: "Plan de venta",
            hint: "Mínimo, objetivo y meta",
            subtitle: plan.subtitle,
          },
        ]
      : []),
    {
      key: "curvas",
      label: "Curvas por edición",
      hint: ediciones === 1 ? "1 edición" : `${ediciones} ediciones comparadas`,
      subtitle: curvas.subtitle,
    },
    ...(ventaPorDia
      ? [
          {
            key: "dia" as const,
            label: "Venta por día",
            hint: ventaPorDia.jornadas.some((j) => (j.objetivo ?? 0) > 0)
              ? "Cada jornada vs su sold out"
              : "Curva de cada jornada",
            subtitle: ventaPorDia.subtitle,
          },
        ]
      : []),
  ];
  const keys = tabs.map((t) => t.key);
  const activa: TabKey = keys.includes(elegida) ? elegida : keys[0];
  const tabActiva = tabs.find((t) => t.key === activa) ?? tabs[0];

  const seleccionar = (key: TabKey, foco = false) => {
    setElegida(key);
    if (foco) tabRefs.current[key]?.focus();
  };

  // Teclado del patrón "tabs" (WAI-ARIA): flechas, Inicio y Fin mueven la
  // selección y el foco; solo la pestaña activa queda en el orden de Tab.
  // Se mueve desde la pestaña ENFOCADA (un lector de pantalla puede enfocar
  // una no seleccionada) y se ignoran las combinaciones con modificadores
  // (Alt/Cmd + flecha es Atrás/Adelante del navegador).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const enfocada = (e.target as HTMLElement).closest('[role="tab"]');
    const desde = keys.findIndex((k) => tabRefs.current[k] === enfocada);
    const i = desde >= 0 ? desde : keys.indexOf(activa);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % keys.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + keys.length) % keys.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = keys.length - 1;
    if (next < 0) return;
    e.preventDefault();
    seleccionar(keys[next], true);
  };

  const sketch = (key: TabKey) => {
    if (key === "evolucion")
      return <EvolucionSketch dias={evolucion.dias} fechaEvento={evolucion.fechaEvento} />;
    if (key === "plan") return plan ? <PlanSketch puntos={plan.puntos} /> : null;
    if (key === "dia")
      return ventaPorDia ? (
        <VentaPorDiaSketch jornadas={ventaPorDia.jornadas} series={ventaPorDia.series} />
      ) : null;
    return <CurvasSketch variant={curvaBase} />;
  };

  return (
    <article
      className="overflow-hidden rounded-lg border bg-white p-4 shadow-sm sm:p-6"
      style={{ borderColor: LACAVA.borde }}
    >
      {/* Encabezado para quien navega por títulos con lector de pantalla:
          cada gráfico tenía su h2 cuando eran cards separadas. */}
      <h2 id={`${baseId}-titulo`} className="sr-only">
        Gráficos de venta
      </h2>
      <div
        ref={tablistRef}
        role="tablist"
        aria-labelledby={`${baseId}-titulo`}
        onKeyDown={onKeyDown}
        className={`mx-auto grid w-full gap-2 sm:gap-3 ${
          tabs.length === 4
            ? "max-w-4xl grid-cols-2 sm:grid-cols-4"
            : tabs.length === 3
              ? "max-w-3xl grid-cols-3"
              : "max-w-xl grid-cols-2"
        }`}
      >
        {tabs.map((t, i) => {
          const on = t.key === activa;
          return (
            <button
              key={t.key}
              ref={(el) => {
                tabRefs.current[t.key] = el;
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${t.key}`}
              aria-selected={on}
              aria-controls={`${baseId}-panel`}
              tabIndex={on ? 0 : -1}
              onClick={() => seleccionar(t.key)}
              className={`group flex min-w-0 cursor-pointer flex-col items-center gap-2 rounded-xl border px-2 pb-3 pt-2.5 text-center transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:px-3 ${
                // En alto contraste (Windows) se ignoran fondos y sombras: la
                // activa se distingue por grosor de borde y subrayado.
                on ? "forced-colors:border-[3px]" : ""
              }`}
              style={{
                borderColor: on ? LACAVA.verde : LACAVA.borde,
                backgroundColor: on ? LACAVA.cremaClara : "#FFFFFF",
                boxShadow: on ? `inset 0 0 0 1px ${LACAVA.verde}` : undefined,
                outlineColor: LACAVA.verde,
              }}
            >
              <span
                className={`block h-9 w-full transition duration-200 sm:h-11 ${
                  on
                    ? ""
                    : "opacity-50 grayscale group-hover:opacity-100 group-hover:grayscale-0"
                }`}
              >
                <span
                  className="lacava-barra-revela block h-full w-full"
                  style={{
                    animationDelay: `${i * 120}ms`,
                    animationPlayState: tilesEnVista ? "running" : "paused",
                  }}
                >
                  {sketch(t.key)}
                </span>
              </span>
              <span
                className={`font-sans text-xs font-medium leading-tight sm:text-sm ${
                  on ? "forced-colors:underline" : ""
                }`}
                style={{ color: on ? LACAVA.verde : LACAVA.tinta }}
              >
                {t.label}
              </span>
              <span
                className="hidden font-sans text-[11px] leading-tight sm:block"
                style={{ color: LACAVA.tintaSuave }}
              >
                {t.hint}
              </span>
            </button>
          );
        })}
      </div>

      <p
        id={`${baseId}-descripcion`}
        className="mx-auto mt-5 max-w-3xl text-center font-sans text-sm"
        style={{ color: LACAVA.tintaSuave }}
      >
        {tabActiva.subtitle}
      </p>

      <div
        ref={panelRef}
        role="tabpanel"
        id={`${baseId}-panel`}
        aria-labelledby={`${baseId}-tab-${activa}`}
        aria-describedby={`${baseId}-descripcion`}
        tabIndex={0}
        className={`mt-6 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${
          panelEnVista ? "" : "lacava-espera-vista"
        }`}
        style={{ outlineColor: LACAVA.verde }}
      >
        {/* La key remonta el gráfico al entrar en pantalla, para que la
            animación de trazado arranque desde cero a la vista. */}
        {activa === "evolucion" && (
          <VentaDiariaChart
            key={String(panelEnVista)}
            animar={panelEnVista}
            data={evolucion.dias}
            goalTickets={evolucion.goalTickets}
            fechaEvento={evolucion.fechaEvento}
          />
        )}
        {activa === "plan" && plan && (
          <PlanVentaCard
            key={String(panelEnVista)}
            animar={panelEnVista}
            puntos={plan.puntos}
            base={plan.base}
            diasRestantes={plan.diasRestantes}
            targets={plan.targets}
          />
        )}
        {activa === "curvas" && (
          <CurvasEdicionesChart
            key={String(panelEnVista)}
            animar={panelEnVista}
            variants={curvas.variants}
          />
        )}
        {activa === "dia" && ventaPorDia && (
          <VentaPorDiaChart
            key={String(panelEnVista)}
            animar={panelEnVista}
            jornadas={ventaPorDia.jornadas}
            series={ventaPorDia.series}
            hoy={ventaPorDia.hoy}
          />
        )}
      </div>
    </article>
  );
}
