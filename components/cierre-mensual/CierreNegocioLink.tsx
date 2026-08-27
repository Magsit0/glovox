"use client";

import { ExternalLink } from "lucide-react";

interface Props {
  /** negocio_id(s) que corresponden a la fila. */
  negocioIds: string[];
  /** Texto visible (nombre del negocio / referencia). */
  children: React.ReactNode;
  /** Línea secundaria opcional bajo el nombre (ej. EventoID). */
  subtitle?: string;
}

/**
 * Nombre de un negocio como enlace al informe /cierre-negocio, en pestaña nueva
 * (no se pierde lo que se está mirando en /cierre-mensual).
 *
 * Cuando la fila agrupa VARIOS negocios (un EventoID compartido: GLO042 tiene 6,
 * GLO176 tiene 2) un link único mentiría — se muestra texto plano con un tooltip
 * que explica por qué no hay enlace.
 */
export default function CierreNegocioLink({ negocioIds, children, subtitle }: Props) {
  const unico = negocioIds.length === 1 ? negocioIds[0] : null;
  const ambiguo = negocioIds.length > 1;

  const sub = subtitle ? (
    <div className="font-sans text-xs text-[#999999]">{subtitle}</div>
  ) : null;

  if (!unico) {
    return (
      <div
        title={
          ambiguo
            ? `${negocioIds.length} negocios comparten este EventoID: no se puede abrir un informe único.`
            : undefined
        }
      >
        <div className="font-medium text-[#333333]">{children}</div>
        {sub}
      </div>
    );
  }

  return (
    <div>
      <a
        href={`/cierre-negocio?id=${encodeURIComponent(unico)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="Abrir el cierre de este negocio en una pestaña nueva"
        className="group inline-flex items-center gap-1.5 font-medium text-[#333333] transition-colors hover:text-[#9F99F8]"
      >
        <span className="underline decoration-[#E5E5E5] underline-offset-2 transition-colors group-hover:decoration-[#9F99F8]">
          {children}
        </span>
        <ExternalLink
          className="h-3 w-3 shrink-0 text-[#999999] transition-colors group-hover:text-[#9F99F8]"
          aria-hidden="true"
        />
      </a>
      {sub}
    </div>
  );
}
