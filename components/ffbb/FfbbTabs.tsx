import Link from "next/link";

export type FfbbTabKey = "ventas" | "insumos" | "inventario";

interface Props {
  active: FfbbTabKey;
  eventoId: string;
}

const TABS: { key: FfbbTabKey; label: string }[] = [
  { key: "ventas", label: "Ventas" },
  { key: "insumos", label: "Insumos" },
  { key: "inventario", label: "Inventario" },
];

export default function FfbbTabs({ active, eventoId }: Props) {
  return (
    <nav
      aria-label="Secciones del evento"
      className="flex items-end gap-1 border-b border-[#E5E5E5]"
    >
      {TABS.map((t) => {
        const isActive = t.key === active;
        const href =
          t.key === "ventas"
            ? `/ffbb?id=${encodeURIComponent(eventoId)}`
            : `/ffbb?id=${encodeURIComponent(eventoId)}&tab=${t.key}`;
        return (
          <Link
            key={t.key}
            href={href}
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
