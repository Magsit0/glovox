"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import AppSidebar from "./AppSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  userName: string;
  onSignOut: () => void | Promise<void>;
}

export default function DashboardLayout({ children, userName, onSignOut }: DashboardLayoutProps) {
  const pathname = usePathname();
  const [drawerState, setDrawerState] = useState({
    mobileOpen: false,
    lastPath: pathname,
  });
  const [collapsed, setCollapsed] = useState(false);

  // Derive drawer close on route change (React-canonical: setState during render).
  if (drawerState.lastPath !== pathname) {
    setDrawerState({ mobileOpen: false, lastPath: pathname });
  }

  const mobileOpen = drawerState.mobileOpen;
  const setMobileOpen = (open: boolean) =>
    setDrawerState((s) => ({ ...s, mobileOpen: open }));

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar — overlay on mobile, inline on desktop */}
      <div
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col transition-transform duration-200
          lg:relative lg:z-auto lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
          ${collapsed ? "lg:w-14" : "lg:w-56"}
          w-72
        `}
      >
        {/* Mobile close button inside drawer */}
        <button
          className="absolute right-3 top-3.5 rounded p-1 text-zinc-400 hover:text-zinc-200 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={18} />
        </button>

        <AppSidebar
          userName={userName}
          onSignOut={onSignOut}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
      </div>

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="flex h-14 shrink-0 items-center border-b border-zinc-800 bg-zinc-900 px-4 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            <Menu size={20} />
          </button>
          <span className="ml-2 flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-xs font-bold text-white">
            G
          </span>
          <span className="ml-2 text-sm font-semibold text-zinc-100">Glovox</span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
