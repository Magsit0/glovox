"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  DollarSign,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LogOut,
  type LucideIcon,
} from "lucide-react";

const GLOVOX_LOGO = "/glovox_logo_gvx_black.svg";

type NavItem = {
  href: string;
  label: string;
  icon?: LucideIcon;
  logo?: string;
};

const navItems: NavItem[] = [
  { href: "/", label: "Menú principal", logo: GLOVOX_LOGO },
  { href: "/club", label: "Overview", icon: LayoutDashboard },
  { href: "/club/events", label: "Venta/Evento Comunidad", icon: CalendarDays },
  { href: "/club/earnings", label: "Venta/Mes Tech", icon: DollarSign },
];

interface AppSidebarProps {
  userName: string;
  onSignOut: () => void | Promise<void>;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export default function AppSidebar({
  userName,
  onSignOut,
  collapsed,
  onToggleCollapse,
}: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Logo */}
      <div
        className={`flex h-14 shrink-0 items-center border-b border-zinc-800 px-3 ${
          collapsed ? "justify-center" : "gap-2"
        }`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
          G
        </span>
        {!collapsed && (
          <span className="truncate text-sm font-semibold tracking-wide text-zinc-100">
            Glovox
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon, logo }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={`flex min-h-[44px] items-center rounded-md px-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                collapsed ? "justify-center" : "gap-3"
              } ${
                isActive
                  ? "bg-zinc-800 font-medium text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              {logo ? (
                <Image
                  src={logo}
                  alt=""
                  width={18}
                  height={18}
                  className="shrink-0 invert"
                  aria-hidden="true"
                />
              ) : Icon ? (
                <Icon size={18} className="shrink-0" aria-hidden="true" />
              ) : null}
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-zinc-800 p-2">
        <div
          className={`mb-1 flex min-h-[44px] items-center rounded-md px-2 ${
            collapsed ? "justify-center" : "gap-3"
          }`}
          title={collapsed ? userName : undefined}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-semibold uppercase text-zinc-300">
            {userName.charAt(0)}
          </span>
          {!collapsed && (
            <span className="truncate text-xs text-zinc-400">{userName}</span>
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={onSignOut}
              title="Sign out"
              aria-label="Sign out"
              className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
            >
              <LogOut size={15} aria-hidden="true" />
            </button>
          )}
        </div>

        {collapsed && (
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="flex min-h-[44px] w-full items-center justify-center rounded-md px-2 text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            <LogOut size={15} aria-hidden="true" />
          </button>
        )}

        {/* Desktop-only collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`hidden lg:flex min-h-[44px] w-full items-center rounded-md px-2 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
            collapsed ? "justify-center" : "gap-2"
          }`}
        >
          {collapsed ? (
            <ChevronRight size={15} aria-hidden="true" />
          ) : (
            <>
              <ChevronLeft size={15} aria-hidden="true" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
