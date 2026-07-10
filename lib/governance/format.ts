/**
 * Metadata de presentación y helpers de formato para `/governance`.
 * Sin dependencias de servidor: usable desde componentes server y client.
 */
import type { Area, AssetStatus, AssetType, Freshness } from "./types";

export const STATUS_META: Record<
  AssetStatus,
  { label: string; dot: string; help: string }
> = {
  governed: {
    label: "Gobernada",
    dot: "#B1D750",
    help: "Pipeline versionado y en uso por al menos un dashboard.",
  },
  governed_unconsumed: {
    label: "Sin consumir",
    dot: "#F6C544",
    help: "Pipeline versionado pero ningún dashboard la usa todavía (el switch pendiente).",
  },
  legacy_ungoverned: {
    label: "Legacy",
    dot: "#ED75A0",
    help: "Consumida por dashboards pero sin productor versionado (el riesgo).",
  },
  pending: {
    label: "Pendiente",
    dot: "#999999",
    help: "Fuente identificada, sin pipeline aún.",
  },
};

// Color por área para la vista de Flujo (paleta de marca, usada con libertad).
export const AREA_COLOR: Record<Area, string> = {
  marketing: "#9F99F8",
  finanzas: "#B1D750",
  tickets: "#ED75A0",
  comunidad: "#87DACD",
  ffbb: "#EF8C34",
  email: "#F6C544",
  ops: "#666666",
};

export const AREA_LABEL: Record<Area, string> = {
  marketing: "Marketing",
  finanzas: "Finanzas",
  tickets: "Tickets",
  comunidad: "Comunidad",
  ffbb: "FF&BB",
  email: "Email",
  ops: "Infraestructura",
};

export const ALL_STATUSES: AssetStatus[] = [
  "governed",
  "governed_unconsumed",
  "legacy_ungoverned",
  "pending",
];

export const ALL_AREAS: Area[] = [
  "marketing",
  "finanzas",
  "tickets",
  "comunidad",
  "ffbb",
  "email",
  "ops",
];

// Para tablas de frecuencia diaria: >48h sin cargar = desactualizada.
export const STALE_AFTER_HOURS = 48;

export function isStale(f: Freshness | null): boolean {
  if (!f?.exists || !f.lastModified) return false;
  const ageMs = Date.now() - new Date(f.lastModified).getTime();
  return ageMs > STALE_AFTER_HOURS * 3600 * 1000;
}

/**
 * Estado del job diario, DERIVADO de la frescura viva (no declarado):
 *   running  cargó hace ≤48h
 *   stopped  la tabla existe pero los datos están viejos (job detenido/atrasado)
 *   never    la tabla no existe en BQ (nunca corrió)
 *   na       vista / on-demand / frescura desconocida
 */
export type JobStatus = "running" | "stopped" | "never" | "na";

export const JOB_META: Record<
  JobStatus,
  { label: string; tone: "ok" | "bad" | "muted" }
> = {
  running: { label: "corre", tone: "ok" },
  stopped: { label: "detenido", tone: "bad" },
  never: { label: "nunca corrió", tone: "bad" },
  na: { label: "—", tone: "muted" },
};

export function jobStatus(assetType: AssetType, freshness: Freshness | null): JobStatus {
  if (assetType === "view") return "na";
  if (!freshness) return "na";
  if (!freshness.exists) return "never";
  return isStale(freshness) ? "stopped" : "running";
}

const dateFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});
const numFmt = new Intl.NumberFormat("es-CL");

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateFmt.format(d);
}

export function formatRelative(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

export function formatNumber(n: number | null): string {
  if (n == null) return "—";
  return numFmt.format(n);
}
