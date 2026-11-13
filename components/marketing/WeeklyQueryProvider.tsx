"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useQueryFiltros } from "@/components/filters/useQueryFiltros";

// Una sola query vigente para los filtros de /marketing/weekly. Cada instancia
// de useQueryFiltros guarda su propio pedido pendiente: con una por control, un
// clic en otro filtro (o en "Limpiar <filtro>" del aviso) mientras BigQuery
// responde se armaba sobre la URL confirmada y deshacía el cambio recién pedido.
// Con el contexto, los cambios de Tipo Ticket, Landing, comparativos, día,
// ventana del funnel y el aviso se suman. (useQueryFiltros ya comparte el
// pedido pendiente por ruta, así que el contexto es redundante pero inocuo.)
// EventSelector todavía arma la URL sobre useSearchParams(): cambia el evento
// principal y navega a otra vista, fuera de la regla de filtros.
const QueryContext = createContext<ReturnType<typeof useQueryFiltros> | null>(null);

/** Envuelve la página (app/marketing/weekly/page.tsx). */
export function WeeklyQueryProvider({ children }: { children: ReactNode }) {
  const query = useQueryFiltros("/marketing/weekly");
  return <QueryContext.Provider value={query}>{children}</QueryContext.Provider>;
}

/** Query vigente de la página (el último cambio pedido) y cómo cambiarla. */
export function useQueryWeekly(): ReturnType<typeof useQueryFiltros> {
  const query = useContext(QueryContext);
  if (!query) {
    throw new Error(
      "Los filtros de /marketing/weekly van dentro de <WeeklyQueryProvider>.",
    );
  }
  return query;
}
