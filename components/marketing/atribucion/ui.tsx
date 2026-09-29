/**
 * Piezas compartidas de la sección "Atribución de compras" (/marketing/weekly).
 * Sin "use client" ni imports de servidor: las usan tanto los bloques server
 * (LentesPaidMedia, SaludMedicion) como los cliente (tablas, gráfico).
 *
 * Tokens brutalistas locales de la ruta (excepción documentada del manual de
 * marca en docs/MARKETING_DASHBOARD.md): bordes negros gruesos, mono en
 * etiquetas, amarillo de hover. No usar en otros dashboards.
 */

/** Entero es-CL ("1.609"); "—" si no es finito. */
export const fmtNum = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString("es-CL") : "—");

const FECHA_LARGA = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
/** "2025-11-12" → "12 nov 2025". Fecha de calendario: se arma en UTC. */
export function fmtFechaLarga(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return FECHA_LARGA.format(Date.UTC(y, m - 1, d));
}

/** "1 orden" / "3 órdenes": `n` ya formateado con su singular o plural. */
export const plural = (n: number, uno: string, varios: string) => `${fmtNum(n)} ${n === 1 ? uno : varios}`;

/**
 * Título de un bloque dentro de la sección, con subtítulo opcional. Es un <h4>
 * (el panel "Atribución de compras" es el <h3>) para poder saltar entre bloques
 * con un lector de pantalla.
 */
export function BloqueTitulo({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h4 className="font-mono-data uppercase text-xs font-bold">{children}</h4>
      {sub && <p className="font-mono-data text-xs text-black/60 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Nota "Cómo leer" / aclaraciones al pie de un bloque. */
export function Nota({ children }: { children: React.ReactNode }) {
  return <p className="font-mono-data text-xs text-black/50 mt-2">{children}</p>;
}

/** Estilo de tooltip de los gráficos de la ruta (borde negro de 4px, sin radio). */
export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "#fff",
  border: "4px solid #000",
  borderRadius: 0,
  fontFamily: "var(--font-ibm-plex-mono)",
  fontSize: 12,
  padding: "6px 10px",
};

/** Ticks de eje de los gráficos de la ruta. */
export const TICK_STYLE = { fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" } as const;
