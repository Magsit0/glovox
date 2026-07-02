import Link from "next/link";
import type { FdsTabKey } from "@/lib/fds/types";

interface Props {
  active: FdsTabKey;
  eventoId: string;
  tieneFfbb: boolean;
  tieneFinanzas: boolean;
}

const TABS: { key: FdsTabKey; label: string }[] = [
  { key: "resumen", label: "Resumen" },
  { key: "tickets", label: "Tickets" },
  { key: "ffbb", label: "FF&BB" },
  { key: "finanzas", label: "Finanzas & Admin" },
];

export default function FdsTabs({ active, eventoId, tieneFfbb, tieneFinanzas }: Props) {
  return (
    <nav
      aria-label="Secciones de la edición"
      className="flex flex-wrap items-end gap-1 border-b border-[#E5E5E5]"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        const href =
          t.key === "resumen"
            ? `/fds?id=${encodeURIComponent(eventoId)}`
            : `/fds?id=${encodeURIComponent(eventoId)}&tab=${t.key}`;
        // Marca en gris claro las pestañas sin datos para esta edición.
        const sinDatos =
          (t.key === "ffbb" && !tieneFfbb) || (t.key === "finanzas" && !tieneFinanzas);
        return (
          <Link
            key={t.key}
            href={href}
            className={`-mb-px inline-flex items-center gap-2 px-4 py-2 font-sans text-sm transition-colors ${
              isActive
                ? "border-b-2 border-[#9F99F8] font-medium text-[#333333]"
                : "border-b-2 border-transparent text-[#666666] hover:text-[#333333]"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
            {sinDatos && (
              <span
                aria-hidden="true"
                title="Sin datos para esta edición"
                className="inline-block h-1.5 w-1.5 rounded-full bg-[#E5E5E5]"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
