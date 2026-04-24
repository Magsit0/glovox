"use client";

import DataTable, { type Column } from "./DataTable";
import type { EnrichedSellerRow } from "@/lib/queries/comunidad";

type Row = EnrichedSellerRow & { _rank: number };

function fmClp(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

const rankColors: Record<number, string> = {
  1: "bg-yellow-500 text-yellow-950",
  2: "bg-zinc-400 text-zinc-950",
  3: "bg-amber-700 text-amber-100",
};

const columns: Column<Row>[] = [
  {
    key: "_rank",
    label: "#",
    render: (v) => {
      const rank = Number(v);
      const cls = rankColors[rank] ?? "bg-zinc-700 text-zinc-300";
      return (
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${cls}`}>
          {rank}
        </span>
      );
    },
  },
  {
    key: "first_name",
    label: "Seller",
    sortable: true,
    render: (_, row) => (
      <span>
        <span className="font-medium text-zinc-100">
          {row.first_name} {row.last_name}
        </span>
        {row.instagram && (
          <span className="ml-2 text-xs text-zinc-500">
            @{row.instagram.replace(/^@/, "")}
          </span>
        )}
      </span>
    ),
  },
  {
    key: "referido",
    label: "Code",
    render: (v) => (
      <span className="font-mono text-xs text-zinc-400">{String(v)}</span>
    ),
  },
  {
    key: "revenue",
    label: "Revenue",
    sortable: true,
    align: "right",
    render: (v) => (
      <span className="font-semibold text-zinc-100">{fmClp(Number(v))}</span>
    ),
  },
  {
    key: "tickets",
    label: "Tickets",
    sortable: true,
    align: "right",
  },
  {
    key: "avg_price",
    label: "Avg Price",
    align: "right",
    render: (v) => fmClp(Math.round(Number(v))),
  },
  {
    key: "last_sale",
    label: "Last Sale",
    align: "right",
    render: (v) => <span className="text-xs text-zinc-500">{String(v)}</span>,
  },
];

export default function TopSellersTable({ data }: { data: EnrichedSellerRow[] }) {
  const rows: Row[] = data.map((row, i) => ({ ...row, _rank: i + 1 }));
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchable
      searchKeys={["first_name", "last_name", "referido"]}
    />
  );
}
