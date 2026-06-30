import Link from "next/link";

export type PaidMediaTabKey = "overall" | "detalle";

interface Props {
  active: PaidMediaTabKey;
  /** Params globales que se arrastran al cambiar de pestaña (moneda, plataforma,
   *  familia de evento y rango de fechas son transversales a ambas vistas). */
  currency: string;
  plataforma?: string | string[];
  prefix?: string;
  from?: string;
  to?: string;
}

const TABS: { key: PaidMediaTabKey; label: string }[] = [
  { key: "overall", label: "Overall" },
  { key: "detalle", label: "Detalle" },
];

export default function PaidMediaTabs({
  active,
  currency,
  plataforma,
  prefix,
  from,
  to,
}: Props) {
  function hrefFor(key: PaidMediaTabKey): string {
    const params = new URLSearchParams();
    if (currency) params.set("currency", currency);
    const plataformas = Array.isArray(plataforma)
      ? plataforma.filter(Boolean)
      : plataforma
        ? [plataforma]
        : [];
    for (const item of plataformas) params.append("plataforma", item);
    // La familia solo aplica al tab Overall.
    if (prefix && key === "overall") params.set("prefix", prefix);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    // "overall" es el default de la página — no hace falta el param.
    if (key !== "overall") params.set("tab", key);
    const qs = params.toString();
    return `/paid-media${qs ? `?${qs}` : ""}`;
  }

  return (
    <nav
      aria-label="Secciones de paid media"
      className="flex items-end gap-1 border-b border-[#E5E5E5]"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={hrefFor(t.key)}
            className={`-mb-px inline-flex items-center px-4 py-2 font-sans text-sm transition-colors ${
              isActive
                ? "border-b-2 border-[#9F99F8] font-medium text-[#333333]"
                : "border-b-2 border-transparent text-[#666666] hover:text-[#333333]"
            }`}
            aria-current={isActive ? "page" : undefined}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
