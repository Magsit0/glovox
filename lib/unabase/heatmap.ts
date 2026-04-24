import { compareEventsByFechaAsc } from "@/lib/unabase/dates";
import { safeText } from "@/lib/unabase/formatting";
import { heatmapScale } from "@/lib/chart-colors";
import type { CSSProperties } from "react";
import type { EventStat, ExpenseRow } from "@/lib/unabase/types";

export function getOrderedExpenseEventStats(rows: ExpenseRow[]): EventStat[] {
  const eventStats = new Map<string, EventStat>();

  rows.forEach((row) => {
    const eventKey = row.key || row.EventoID || row.nombre;
    if (!eventStats.has(eventKey)) {
      eventStats.set(eventKey, {
        key: eventKey,
        eventName: row.nombre,
        nombreGlovox: row.nombreGlovox || row.nombre,
        estado: row.estado || "Sin dato",
        fechaAsignacion: row.fechaAsignacion,
        asistentes: row.asistentes || 0,
        gasto: 0,
        presupuesto: 0,
      });
    }
    const stat = eventStats.get(eventKey)!;
    stat.gasto += row.gasto;
    stat.presupuesto += row.presupuesto;
    if (!stat.asistentes && row.asistentes > 0) stat.asistentes = row.asistentes;
    if (stat.fechaAsignacion === "Sin dato" && row.fechaAsignacion !== "Sin dato") {
      stat.fechaAsignacion = row.fechaAsignacion;
    }
    if (stat.eventName === "Sin dato" && row.nombre !== "Sin dato") {
      stat.eventName = row.nombre;
    }
    if (
      (stat.nombreGlovox === "Sin dato" || stat.nombreGlovox === stat.eventName) &&
      row.nombreGlovox &&
      row.nombreGlovox !== "Sin dato"
    ) {
      stat.nombreGlovox = row.nombreGlovox;
    }
    if (stat.estado === "Sin dato" && row.estado && row.estado !== "Sin dato") {
      stat.estado = row.estado;
    }
  });

  return Array.from(eventStats.values()).sort(compareEventsByFechaAsc);
}

export function heatStyle(value: number, max: number): CSSProperties {
  if (!max || !Number.isFinite(value) || value <= 0) {
    return { backgroundColor: "#FFFFFF" };
  }
  const ratio = Math.max(0, Math.min(1, value / max));
  const bg = heatmapScale(ratio).hex();
  return {
    backgroundColor: bg,
    color: ratio > 0.55 ? "#FFFFFF" : "#333333",
  };
}

export interface MatrixCell {
  gasto: number;
  presupuesto: number;
  asistentes: number;
}

export interface MatrixResult {
  groupMap: Map<string, Map<string, MatrixCell>>;
  eventStats: Map<string, EventStat>;
  events: string[];
  groups: string[];
  maxValue: number;
}

export function buildMatrix(
  rows: ExpenseRow[],
  groupKeyFn: (row: ExpenseRow) => string,
  mode: "total" | "percapita" = "total",
): MatrixResult {
  const groupMap = new Map<string, Map<string, MatrixCell>>();
  const orderedEventStats = getOrderedExpenseEventStats(rows);
  const eventStats = new Map<string, EventStat>(
    orderedEventStats.map((item) => [item.key, { ...item }]),
  );

  rows.forEach((row) => {
    const eventKey = row.key || row.EventoID || row.nombre;
    const group = groupKeyFn(row);
    if (!groupMap.has(group)) groupMap.set(group, new Map());
    const eventMap = groupMap.get(group)!;
    const current: MatrixCell = eventMap.get(eventKey) || {
      gasto: 0,
      presupuesto: 0,
      asistentes: row.asistentes || 0,
    };
    current.gasto += row.gasto;
    current.presupuesto += row.presupuesto;
    if (!current.asistentes && row.asistentes > 0) current.asistentes = row.asistentes;
    eventMap.set(eventKey, current);
  });

  const metric = (total: number, asistentes: number): number | null => {
    if (mode !== "percapita") return total;
    if (!asistentes || asistentes <= 0) return null;
    return total / asistentes;
  };

  const events = orderedEventStats.map((item) => item.key);
  const groups = Array.from(groupMap.keys()).sort((a, b) => {
    const aScore = Array.from(groupMap.get(a)!.values()).reduce(
      (s, c) => s + (metric(c.gasto, c.asistentes) || 0),
      0,
    );
    const bScore = Array.from(groupMap.get(b)!.values()).reduce(
      (s, c) => s + (metric(c.gasto, c.asistentes) || 0),
      0,
    );
    return bScore - aScore;
  });

  let maxValue = 0;
  groupMap.forEach((eventMap) => {
    eventMap.forEach((c) => {
      const v = metric(c.gasto, c.asistentes) || 0;
      if (v > maxValue) maxValue = v;
    });
  });

  return { groupMap, eventStats, events, groups, maxValue };
}

export const cellMetric = (
  cell: MatrixCell | undefined,
  mode: "total" | "percapita",
): number | null => {
  if (!cell) return null;
  if (mode !== "percapita") return cell.gasto;
  if (!cell.asistentes || cell.asistentes <= 0) return null;
  return cell.gasto / cell.asistentes;
};

export function truncateText(text: unknown, max: number = 26): string {
  const v = safeText(text);
  return v.length > max ? `${v.slice(0, max - 1)}…` : v;
}
