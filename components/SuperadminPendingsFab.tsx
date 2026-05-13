"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ListTodo } from "lucide-react";
import {
  DASHBOARDS_CATALOG,
  type DashboardCatalogEntry,
} from "@/lib/dashboards-catalog";
import {
  listPendings,
  type PendingLists,
} from "@/lib/superadminPendings";
import type { Role } from "@/db/schema";
import SuperadminPendingsModal from "./SuperadminPendingsModal";

const SORTED_DASHBOARDS: readonly DashboardCatalogEntry[] = [
  ...DASHBOARDS_CATALOG,
].sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);

function matchDashboard(pathname: string): DashboardCatalogEntry | null {
  for (const d of SORTED_DASHBOARDS) {
    if (pathname === d.pathPrefix || pathname.startsWith(d.pathPrefix + "/")) {
      return d;
    }
  }
  return null;
}

export default function SuperadminPendingsFab({ role }: { role: Role }) {
  const pathname = usePathname();
  const dashboard = useMemo(() => matchDashboard(pathname ?? ""), [pathname]);

  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<PendingLists | null>(null);

  // Reset state during render when the active dashboard changes
  // (React-canonical, avoids setState inside an effect).
  const [knownKey, setKnownKey] = useState<string | null>(null);
  const currentKey = dashboard?.key ?? null;
  if (knownKey !== currentKey) {
    setKnownKey(currentKey);
    setLists(null);
    setOpen(false);
  }

  useEffect(() => {
    if (role !== "superadmin" || !dashboard) return;
    let cancelled = false;
    listPendings(dashboard.key)
      .then((data) => {
        if (!cancelled) setLists(data);
      })
      .catch(() => {
        /* silent — UI just shows no badge */
      });
    return () => {
      cancelled = true;
    };
  }, [role, dashboard]);

  if (role !== "superadmin" || !dashboard) return null;

  const count = lists?.pending.length ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Pendientes — ${dashboard.label}`}
        className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#9F99F8] text-white shadow-md transition-all duration-200 hover:bg-[#8780F0] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9F99F8] focus-visible:ring-offset-2"
      >
        <ListTodo className="h-6 w-6" />
        {lists && count > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#ED75A0] px-1 font-sans text-[10px] font-semibold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && lists && (
        <SuperadminPendingsModal
          dashboard={dashboard}
          lists={lists}
          onChange={setLists}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
