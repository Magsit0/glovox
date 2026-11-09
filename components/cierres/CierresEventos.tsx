import Link from "next/link";
import { ArrowRight, MapIcon, Presentation } from "lucide-react";
import { NAV_FORWARD, type GroupMember } from "@/lib/dashboard-groups";
import { EVENTOS_CIERRE, mapaHref, MAPAS_PATH } from "@/lib/cierres/eventos";

/**
 * Cuerpo del hub `/cierres`: una fila por evento, con su presentación de
 * cierre y su mapa de ventas lado a lado. Un evento sin presentación (o sin
 * mapa) lo muestra como hueco en vez de ocultarlo, para que se vea qué falta.
 * Solo aparecen los eventos donde el usuario ve al menos una de las dos cosas.
 */
export default function CierresEventos({ members }: { members: GroupMember[] }) {
  const porPath = new Map(members.map((m) => [m.path, m]));
  const mapas = porPath.get(MAPAS_PATH);

  const filas = EVENTOS_CIERRE.map((e) => ({
    evento: e,
    cierre: e.cierre ? porPath.get(e.cierre) : undefined,
    // El grant de mapas cubre todos los mapas (mismo prefijo).
    mapa: e.mapa && mapas ? mapaHref(e.slug) : undefined,
  })).filter((f) => f.cierre || f.mapa);

  return (
    <div className="flex flex-col gap-8">
      {filas.map(({ evento, cierre, mapa }) => (
        <section key={evento.slug} aria-labelledby={`ev-${evento.slug}`} className="flex flex-col gap-3">
          <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2
              id={`ev-${evento.slug}`}
              className="font-display text-xl font-bold tracking-tight text-[var(--ink)]"
            >
              {evento.nombre}
            </h2>
            <p className="font-sans text-sm text-[var(--ink-muted)]">
              {evento.fechaTexto} · {evento.lugar} · {evento.eventoId}
            </p>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {cierre ? (
              <Tarjeta
                href={cierre.path}
                icono={<Presentation size={22} strokeWidth={2.5} className={cierre.accentText} />}
                acento={cierre.accentClass}
                titulo="Presentación de cierre"
                texto={cierre.description}
              />
            ) : (
              <Hueco texto={evento.cierre ? "Sin acceso a la presentación." : "Este evento no tiene presentación de cierre."} />
            )}
            {mapa && mapas ? (
              <Tarjeta
                href={mapa}
                icono={<MapIcon size={22} strokeWidth={2.5} className={mapas.accentText} />}
                acento={mapas.accentClass}
                titulo="Mapa de ventas"
                texto="Venta de Onfire por punto y asistentes por zona, dibujados sobre el layout del evento. Interactivo."
              />
            ) : (
              <Hueco texto={evento.mapa ? "Sin acceso al mapa." : "Este evento no tiene mapa de ventas."} />
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function Tarjeta({
  href,
  icono,
  acento,
  titulo,
  texto,
}: {
  href: string;
  icono: React.ReactNode;
  acento: string;
  titulo: string;
  texto: string;
}) {
  return (
    <Link
      href={href}
      transitionTypes={[NAV_FORWARD]}
      className="group flex h-full flex-col rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-5 shadow-sm transition-all duration-150 hover:-translate-y-px hover:shadow-md"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className={`inline-flex shrink-0 items-center justify-center rounded-lg p-2.5 ${acento}`}>
          {icono}
        </div>
        <h3 className="font-display text-lg font-bold leading-none tracking-tight text-[var(--ink)]">
          {titulo}
        </h3>
      </div>
      <p className="grow font-sans text-sm leading-relaxed text-[var(--ink-muted)]">{texto}</p>
      <span className="mt-4 inline-flex w-fit items-center gap-1.5 font-sans text-sm font-medium text-[var(--ink)]">
        Abrir
        <ArrowRight size={14} strokeWidth={2.5} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function Hueco({ texto }: { texto: string }) {
  return (
    <div className="flex h-full min-h-28 items-center rounded-lg border border-[var(--divider)] bg-[var(--surface-alt)] p-5">
      <p className="font-sans text-sm text-[var(--ink-subtle)]">{texto}</p>
    </div>
  );
}
