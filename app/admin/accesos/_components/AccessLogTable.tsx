"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Row = {
  id: number;
  accessedAt: string;
  userId: string;
  email: string;
  dashboardKey: string;
  dashboardLabel: string;
  path: string;
};

type Option = { value: string; label: string };

type Props = {
  rows: Row[];
  total: number;
  pageSize: number;
  page: number;
  userOptions: { id: string; email: string }[];
  dashboardOptions: { key: string; label: string }[];
  filters: {
    userId: string | null;
    dashboardKey: string | null;
    from: string;
    to: string;
  };
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AccessLogTable({
  rows,
  total,
  pageSize,
  page,
  userOptions,
  dashboardOptions,
  filters,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const userSelect: Option[] = [
    { value: "", label: "Todos los usuarios" },
    ...userOptions.map((u) => ({ value: u.id, label: u.email })),
  ];
  const dashboardSelect: Option[] = [
    { value: "", label: "Todos los dashboards" },
    ...dashboardOptions.map((d) => ({ value: d.key, label: d.label })),
  ];

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    // Resetea paginación cuando cambia un filtro.
    if (!("page" in updates)) params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasActiveFilters =
    !!filters.userId ||
    !!filters.dashboardKey ||
    !!filters.from ||
    !!filters.to;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-lg font-bold text-[#333333]">
        Log detallado
      </h2>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-[#E5E5E5] bg-white p-4">
        <Field label="Usuario">
          <select
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333]"
            value={filters.userId ?? ""}
            onChange={(e) =>
              updateParams({ userId: e.target.value || null })
            }
            disabled={pending}
          >
            {userSelect.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Dashboard">
          <select
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333]"
            value={filters.dashboardKey ?? ""}
            onChange={(e) =>
              updateParams({ dashboardKey: e.target.value || null })
            }
            disabled={pending}
          >
            {dashboardSelect.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Desde">
          <input
            type="date"
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333]"
            value={filters.from}
            onChange={(e) => updateParams({ from: e.target.value || null })}
            disabled={pending}
          />
        </Field>

        <Field label="Hasta">
          <input
            type="date"
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333]"
            value={filters.to}
            onChange={(e) => updateParams({ to: e.target.value || null })}
            disabled={pending}
          />
        </Field>

        {hasActiveFilters ? (
          <Link
            href={pathname}
            className="self-end font-sans text-xs text-[#666666] underline hover:text-[#333333]"
          >
            Limpiar filtros
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full text-left font-sans text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA] text-xs uppercase tracking-wide text-[#666666]">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Usuario</th>
              <th className="px-4 py-3">Dashboard</th>
              <th className="px-4 py-3">Path</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-[#999999]"
                >
                  Sin accesos para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[#F0F0F0] last:border-b-0"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                    {formatTimestamp(r.accessedAt)}
                  </td>
                  <td className="px-4 py-3 text-[#333333]">{r.email}</td>
                  <td className="px-4 py-3 text-[#333333]">
                    {r.dashboardLabel}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-[#666666]">
                    {r.path}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between font-sans text-xs text-[#666666]">
        <span>
          {total === 0
            ? "Sin resultados"
            : `Mostrando ${page * pageSize + 1}-${Math.min(
                (page + 1) * pageSize,
                total,
              )} de ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page === 0 || pending}
            onClick={() =>
              updateParams({ page: page > 1 ? String(page - 1) : null })
            }
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span>
            Página {page + 1} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages || pending}
            onClick={() => updateParams({ page: String(page + 1) })}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-1 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-sans text-xs uppercase tracking-wide text-[#666666]">
        {label}
      </span>
      {children}
    </label>
  );
}
