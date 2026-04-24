"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/actions";

const navLinks = [
  { href: "/", label: "Overview" },
  { href: "/earnings", label: "Venta Tecnología por Mes" },
  { href: "/events", label: "Venta/Evento Comunidad" },
];

export default function Header({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-800 bg-zinc-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-y-2 px-6 py-4">
        <nav className="flex flex-wrap items-center gap-1" aria-label="Main navigation">
          {navLinks.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`rounded px-2 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                  isActive
                    ? "font-semibold text-zinc-50"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="cursor-pointer rounded px-3 py-2 text-xs text-zinc-500 transition-colors hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            aria-label="Sign out"
          >
            Sign out · {userName}
          </button>
        </form>
      </div>
    </header>
  );
}
