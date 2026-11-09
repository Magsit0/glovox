import Link from "next/link";
import { ArrowLeft, ExternalLink, Presentation } from "lucide-react";
import { NAV_BACK } from "@/lib/dashboard-groups";
import type { EventoCierre } from "@/lib/cierres/eventos";

/**
 * Visor de un mapa de ventas: barra de la app (volver, evento, ir a la
 * presentación) y el HTML interactivo del mapa a pantalla completa en un
 * iframe que lo pide a `/api/cierres/mapas/<slug>`.
 */
export default function MapaVentas({
  evento,
  cierreHref,
}: {
  evento: EventoCierre;
  /** Presentación de cierre del mismo evento, si existe y el usuario la ve. */
  cierreHref?: string;
}) {
  const src = `/api/cierres/mapas/${evento.slug}`;
  const btn =
    "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]";
  return (
    <div className="flex h-svh flex-col bg-[var(--surface-alt)]">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-[var(--divider)] bg-[var(--surface)] px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/cierres"
            transitionTypes={[NAV_BACK]}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 font-sans text-sm text-[var(--ink-muted)] transition-colors hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Cierres
          </Link>
          <span className="h-5 w-px shrink-0 bg-[var(--divider)]" aria-hidden="true" />
          <p className="min-w-0 truncate font-display text-base font-bold tracking-tight text-[var(--ink)]">
            Mapa de ventas · {evento.nombre}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {cierreHref && (
            <Link href={cierreHref} className={btn}>
              <Presentation className="h-4 w-4" />
              <span className="hidden sm:inline">Presentación de cierre</span>
            </Link>
          )}
          <a href={src} target="_blank" rel="noopener" className={btn}>
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">Abrir en pestaña nueva</span>
          </a>
        </div>
      </header>
      <main id="main-content" className="min-h-0 flex-1">
        <iframe
          src={src}
          title={`Mapa de ventas ${evento.nombre}`}
          className="block h-full w-full border-0 bg-[var(--surface)]"
        />
      </main>
    </div>
  );
}
