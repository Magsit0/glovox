"use client";

import { useState, useMemo } from "react";
import type { SalesOriginRow } from "@/lib/queries/marketing";

type Props = {
  data: SalesOriginRow[];
};

const CATEGORY_MAP: Record<string, string> = {
  PM_MT: "Paid Media Meta",
  PM_GG: "Paid Media Google",
  EMAIL: "Email",
  ORG_LT: "Linktree",
};

function categorize(origin: string): string | null {
  for (const prefix of Object.keys(CATEGORY_MAP)) {
    if (origin.startsWith(prefix)) return prefix;
  }
  return null;
}

type GroupEntry = {
  type: "group";
  prefix: string;
  label: string;
  tickets: number;
  pct: number;
  children: { origin: string; tickets: number; pct: number }[];
};

type SingleEntry = {
  type: "single";
  origin: string;
  tickets: number;
  pct: number;
};

type Entry = GroupEntry | SingleEntry;

export default function SalesOriginTable({ data }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const totalTickets = data.reduce((sum, r) => sum + r.tickets, 0);

  const entries: Entry[] = useMemo(() => {
    const catMap = new Map<string, SalesOriginRow[]>();
    const ungrouped: SalesOriginRow[] = [];

    for (const row of data) {
      const cat = categorize(row.origin);
      if (cat) {
        if (!catMap.has(cat)) catMap.set(cat, []);
        catMap.get(cat)!.push(row);
      } else {
        ungrouped.push(row);
      }
    }

    const all: Entry[] = [];

    for (const [prefix, rows] of catMap) {
      const catTickets = rows.reduce((s, r) => s + r.tickets, 0);
      all.push({
        type: "group",
        prefix,
        label: CATEGORY_MAP[prefix],
        tickets: catTickets,
        pct: totalTickets > 0 ? Math.round((catTickets / totalTickets) * 100) : 0,
        children: rows
          .sort((a, b) => b.tickets - a.tickets)
          .map((r) => ({
            origin: r.origin,
            tickets: r.tickets,
            pct: totalTickets > 0 ? Math.round((r.tickets / totalTickets) * 100) : 0,
          })),
      });
    }

    for (const row of ungrouped) {
      all.push({
        type: "single",
        origin: row.origin,
        tickets: row.tickets,
        pct: totalTickets > 0 ? Math.round((row.tickets / totalTickets) * 100) : 0,
      });
    }

    all.sort((a, b) => b.tickets - a.tickets);
    return all;
  }, [data, totalTickets]);

  function toggle(prefix: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      return next;
    });
  }

  return (
    <div className="border-4 border-black rounded-none w-full overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="bg-black text-white">
            <th className="font-mono-data uppercase text-xs px-4 py-3 text-left">Origen</th>
            <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">Tickets</th>
            <th className="font-mono-data uppercase text-xs px-4 py-3 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) =>
            entry.type === "single" ? (
              <tr
                key={entry.origin}
                className="border-b-2 border-black hover:bg-[#FFFF00] transition-colors duration-150"
              >
                <td className="font-mono-data text-sm px-4 py-3">{entry.origin || "(directo)"}</td>
                <td className="font-mono-data text-sm px-4 py-3 text-right">
                  {entry.tickets.toLocaleString("es-CL")}
                </td>
                <td className="font-mono-data text-sm px-4 py-3 text-right">{entry.pct}%</td>
              </tr>
            ) : (
              <GroupRow
                key={entry.prefix}
                group={entry}
                isExpanded={expanded.has(entry.prefix)}
                onToggle={() => toggle(entry.prefix)}
              />
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

function GroupRow({
  group,
  isExpanded,
  onToggle,
}: {
  group: GroupEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b-2 border-black cursor-pointer hover:bg-[#FFFF00] transition-colors duration-150"
      >
        <td className="font-mono-data text-sm px-4 py-3 font-bold">
          <span className="mr-2">{isExpanded ? "▼" : "▶"}</span>
          {group.label}
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">
          {group.tickets.toLocaleString("es-CL")}
        </td>
        <td className="font-mono-data text-sm px-4 py-3 text-right font-bold">{group.pct}%</td>
      </tr>
      {isExpanded &&
        group.children.map((child) => (
          <tr
            key={child.origin}
            className="border-b border-black/30 bg-black/5 transition-colors duration-150"
          >
            <td className="font-mono-data text-xs px-4 py-2 pl-10 text-black/60">{child.origin}</td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">
              {child.tickets.toLocaleString("es-CL")}
            </td>
            <td className="font-mono-data text-xs px-4 py-2 text-right text-black/60">{child.pct}%</td>
          </tr>
        ))}
    </>
  );
}
