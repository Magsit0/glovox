"use client";

import DataTable, { type Column } from "./DataTable";
import type { DormantSellerRow } from "@/lib/queries/comunidad";

function fmClp(v: number) {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

const columns: Column<DormantSellerRow>[] = [
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
    key: "revenue_ever",
    label: "Revenue ever",
    sortable: true,
    align: "right",
    render: (v) => (
      <span className="font-semibold text-zinc-100">{fmClp(Number(v))}</span>
    ),
  },
  {
    key: "tickets_ever",
    label: "Tickets ever",
    sortable: true,
    align: "right",
  },
  {
    key: "last_sale",
    label: "Last Sale",
    align: "right",
    render: (v) => <span className="text-xs text-zinc-500">{String(v)}</span>,
  },
  {
    key: "days_silent",
    label: "Silent",
    sortable: true,
    align: "right",
    render: (v) => {
      const days = Number(v);
      return (
        <span className={`text-xs font-medium ${days > 180 ? "text-red-400" : "text-amber-400"}`}>
          {days}d
        </span>
      );
    },
  },
];

export default function DormantSellersTable({ data }: { data: DormantSellerRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      searchable
      searchKeys={["first_name", "last_name", "referido"]}
    />
  );
}
