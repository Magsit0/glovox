import Link from "next/link";

export type TicketingTabKey = "analisis" | "global" | "pricing";

interface Props {
  active: TicketingTabKey;
  /** Si hay evento seleccionado en el tab de análisis, se arrastra al tab
   *  pricing como prefill al crear un plan. */
  eventParam?: string;
  /** El tab Pricing solo aparece para quien puede editar (/ticketing/pricing). */
  showPricing: boolean;
}

export default function TicketingTabs({ active, eventParam, showPricing }: Props) {
  const tabs: { key: TicketingTabKey; label: string; href: string }[] = [
    { key: "global", label: "Análisis global", href: "/ticketing?tab=global" },
    { key: "analisis", label: "Análisis", href: "/ticketing" },
    {
      key: "pricing",
      label: "Planificador de pricing",
      href: eventParam
        ? `/ticketing?tab=pricing&event=${encodeURIComponent(eventParam)}`
        : "/ticketing?tab=pricing",
    },
  ];
  const visible = tabs.filter((t) => t.key !== "pricing" || showPricing);

  return (
    <nav
      aria-label="Secciones de ticketing"
      className="flex items-end gap-1 border-b border-[#E5E5E5]"
    >
      {visible.map((t) => {
        const isActive = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
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
