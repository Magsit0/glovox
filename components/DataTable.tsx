"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, Search } from "lucide-react";

export type Column<T> = {
  key: keyof T;
  label: string;
  sortable?: boolean;
  align?: "left" | "right";
  render?: (val: T[keyof T], row: T) => React.ReactNode;
};

type SortDir = "asc" | "desc";

type Props<T extends Record<string, unknown>> = {
  columns: Column<T>[];
  data: T[];
  searchable?: boolean;
  searchKeys?: (keyof T)[];
};

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  searchable = false,
  searchKeys,
}: Props<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [query, setQuery] = useState("");

  function handleHeaderClick(col: Column<T>) {
    if (!col.sortable) return;
    if (sortKey === col.key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(col.key);
      setSortDir("asc");
    }
  }

  const effectiveSearchKeys = searchKeys ?? (columns.map((c) => c.key) as (keyof T)[]);

  const filtered = useMemo(() => {
    if (!searchable || query.trim() === "") return data;
    const q = query.trim().toLowerCase();
    return data.filter((row) =>
      effectiveSearchKeys.some((k) => {
        const v = row[k];
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [data, query, searchable, effectiveSearchKeys]);

  const sorted = useMemo(() => {
    if (sortKey === null) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-3">
      {searchable && (
        <div className="relative max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
            size={14}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900 py-1.5 pl-8 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-800/60 text-sm">
          <thead className="bg-zinc-900">
            <tr>
              {columns.map((col) => {
                const isActive = sortKey === col.key;
                const align = col.align === "right" ? "text-right" : "text-left";
                return (
                  <th
                    key={String(col.key)}
                    scope="col"
                    onClick={() => handleHeaderClick(col)}
                    className={[
                      "px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-400",
                      align,
                      col.sortable ? "cursor-pointer select-none hover:text-zinc-200" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {col.sortable && (
                        <span className="inline-flex flex-col">
                          <ChevronUp
                            size={11}
                            className={isActive && sortDir === "asc" ? "text-zinc-200" : "text-zinc-700"}
                          />
                          <ChevronDown
                            size={11}
                            className={[
                              "-mt-0.5",
                              isActive && sortDir === "desc" ? "text-zinc-200" : "text-zinc-700",
                            ].join(" ")}
                          />
                        </span>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 bg-zinc-900">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                  No results.
                </td>
              </tr>
            ) : (
              sorted.map((row, i) => (
                <tr key={i} className="transition-colors hover:bg-zinc-800/40">
                  {columns.map((col) => {
                    const val = row[col.key];
                    const align = col.align === "right" ? "text-right" : "text-left";
                    return (
                      <td key={String(col.key)} className={`px-4 py-3 text-zinc-300 ${align}`}>
                        {col.render ? col.render(val, row) : (val as React.ReactNode)}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
