"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/governance", label: "Catálogo" },
  { href: "/governance/etls", label: "ETLs" },
  { href: "/governance/calidad", label: "Calidad" },
  { href: "/governance/fuentes", label: "Fuentes" },
  { href: "/governance/flujo", label: "Flujo" },
  { href: "/governance/glosario", label: "Glosario" },
] as const;

export default function GovernanceNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1">
      {TABS.map((t) => {
        const active =
          t.href === "/governance"
            ? pathname === "/governance"
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`-mb-px border-b-2 px-3 pb-3 pt-2 font-sans text-sm transition-colors ${
              active
                ? "border-[#9F99F8] font-medium text-[#333333]"
                : "border-transparent text-[#666666] hover:text-[#333333]"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
