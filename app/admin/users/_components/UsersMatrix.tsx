"use client";

import { useState, useTransition } from "react";
import {
  createUserAction,
  restoreUserAction,
  revokeUserAction,
  setCountryAction,
  setDashboardsAction,
  setRoleAction,
} from "../actions";
import type { Country, Role } from "@/db/schema";

type DashboardCatalog = {
  key: string;
  pathPrefix: string;
  label: string;
  appliesCountryScope: boolean;
  sortOrder: number;
};

type UserRow = {
  id: string;
  email: string;
  role: Role;
  country: Country | null;
  revokedAt: string | null;
  createdAt: string;
  dashboardKeys: string[];
};

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Sin restricción" },
  { value: "CL", label: "🇨🇱 CL" },
  { value: "PE", label: "🇵🇪 PE" },
];

// Celda de encabezado inmovilizada: fondo opaco propio (el bg del <tr> no viaja
// con una celda sticky) + hairline inferior en la celda, no en el <tr>.
const HEAD_CELL = "border-b border-[#E5E5E5] bg-[#FAFAFA]";

export function UsersMatrix({
  users,
  catalog,
  myId,
}: {
  users: UserRow[];
  catalog: DashboardCatalog[];
  myId: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <div className="rounded-md border border-[#ED75A0] bg-white px-4 py-3 font-sans text-sm text-[#333333]">
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <span className="font-sans text-sm text-[#666666]">
          {users.length} {users.length === 1 ? "usuario" : "usuarios"}
        </span>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-md bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white hover:opacity-90"
        >
          {showAdd ? "Cancelar" : "+ Agregar usuario"}
        </button>
      </div>

      {showAdd ? (
        <AddUserForm
          catalog={catalog}
          disabled={isPending}
          onCancel={() => setShowAdd(false)}
          onSubmit={(input) =>
            run(async () => {
              await createUserAction(input);
              setShowAdd(false);
            })
          }
        />
      ) : null}

      {/* Scroll en ambos ejes con encabezado y columna Email inmovilizados.
          border-separate: con border-collapse los bordes de las celdas sticky
          no viajan con la celda al hacer scroll. */}
      <div className="max-h-[600px] overflow-auto rounded-lg border border-[#E5E5E5] bg-white">
        <table className="w-full border-separate border-spacing-0 font-sans text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[#666666]">
              <th className={`sticky left-0 top-0 z-30 min-w-[220px] border-r ${HEAD_CELL} px-4 py-3`}>
                Email
              </th>
              <th className={`sticky top-0 z-20 ${HEAD_CELL} px-4 py-3`}>Rol</th>
              <th className={`sticky top-0 z-20 ${HEAD_CELL} px-4 py-3`}>País</th>
              {catalog.map((d) => (
                <th
                  key={d.key}
                  className={`sticky top-0 z-20 ${HEAD_CELL} px-2 py-3 text-center`}
                >
                  <div className="text-[10px] font-semibold leading-tight">
                    {d.label}
                  </div>
                </th>
              ))}
              <th className={`sticky top-0 z-20 ${HEAD_CELL} px-4 py-3`}>Estado</th>
              <th className={`sticky top-0 z-20 ${HEAD_CELL} px-4 py-3`}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <UserMatrixRow
                key={u.id}
                user={u}
                catalog={catalog}
                isMe={u.id === myId}
                disabled={isPending}
                run={run}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UserMatrixRow({
  user,
  catalog,
  isMe,
  disabled,
  run,
}: {
  user: UserRow;
  catalog: DashboardCatalog[];
  isMe: boolean;
  disabled: boolean;
  run: (fn: () => Promise<void>) => void;
}) {
  const isSuperadmin = user.role === "superadmin";
  const isRevoked = !!user.revokedAt;
  const granted = new Set(user.dashboardKeys);
  // Con border-separate el divisor de fila va en cada celda (el <tr> no pinta
  // borde) y el fondo tambien, porque la celda Email es sticky.
  const cell = `border-b border-[#E5E5E5] ${isRevoked ? "bg-[#FAFAFA]" : "bg-white"}`;

  const toggleDashboard = (key: string) => {
    if (isSuperadmin) return; // superadmin tiene acceso implícito
    const next = new Set(granted);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    run(() => setDashboardsAction(user.id, Array.from(next)));
  };

  return (
    <tr className={isRevoked ? "text-[#999999]" : ""}>
      <td
        className={`sticky left-0 z-10 whitespace-nowrap border-r ${cell} px-4 py-3 font-medium`}
      >
        {user.email}
      </td>

      <td className={`${cell} px-4 py-3`}>
        <select
          value={user.role}
          disabled={disabled || isMe || isRevoked}
          onChange={(e) =>
            run(() => setRoleAction(user.id, e.currentTarget.value))
          }
          className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs"
        >
          <option value="user">user</option>
          <option value="superadmin">superadmin</option>
        </select>
      </td>

      <td className={`${cell} px-4 py-3`}>
        <select
          value={user.country ?? ""}
          disabled={disabled || isRevoked}
          onChange={(e) =>
            run(() =>
              setCountryAction(
                user.id,
                e.currentTarget.value === "" ? null : e.currentTarget.value,
              ),
            )
          }
          className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-xs"
        >
          {COUNTRY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </td>

      {catalog.map((d) => (
        <td key={d.key} className={`${cell} px-2 py-3 text-center`}>
          <input
            type="checkbox"
            checked={isSuperadmin || granted.has(d.key)}
            disabled={disabled || isSuperadmin || isRevoked}
            onChange={() => toggleDashboard(d.key)}
            aria-label={`${user.email} → ${d.label}`}
            className="h-4 w-4 cursor-pointer accent-[#9F99F8] disabled:cursor-not-allowed"
          />
        </td>
      ))}

      <td className={`${cell} px-4 py-3`}>
        {isRevoked ? (
          <span className="inline-flex rounded-full bg-[#FAFAFA] px-2 py-0.5 text-xs text-[#999999]">
            Revocado
          </span>
        ) : (
          <span className="inline-flex rounded-full bg-[#B1D750]/20 px-2 py-0.5 text-xs text-[#333333]">
            Activo
          </span>
        )}
      </td>

      <td className={`${cell} px-4 py-3 text-right`}>
        {isMe ? (
          <span className="text-xs text-[#999999]">tú</span>
        ) : isRevoked ? (
          <button
            type="button"
            disabled={disabled}
            onClick={() => run(() => restoreUserAction(user.id))}
            className="text-xs text-[#9F99F8] hover:underline"
          >
            Restaurar
          </button>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              if (
                confirm(
                  `¿Revocar acceso a ${user.email}? El usuario no podrá ingresar.`,
                )
              ) {
                run(() => revokeUserAction(user.id));
              }
            }}
            className="text-xs text-[#ED75A0] hover:underline"
          >
            Revocar
          </button>
        )}
      </td>
    </tr>
  );
}

function AddUserForm({
  catalog,
  disabled,
  onCancel,
  onSubmit,
}: {
  catalog: DashboardCatalog[];
  disabled: boolean;
  onCancel: () => void;
  onSubmit: (input: {
    email: string;
    role: Role;
    country: Country | null;
    dashboardKeys: string[];
  }) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("user");
  const [country, setCountry] = useState<string>("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    onSubmit({
      email: email.trim(),
      role,
      country: country === "" ? null : (country as Country),
      dashboardKeys: Array.from(selectedKeys),
    });
  };

  const toggle = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-[#E5E5E5] bg-white p-6"
    >
      <h2 className="mb-4 font-display text-lg font-bold text-[#333333]">
        Agregar usuario
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-[#666666]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="alguien@glovox.cl"
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#333333] focus:border-[#9F99F8] focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#666666]">
          Rol
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm"
          >
            <option value="user">user</option>
            <option value="superadmin">superadmin</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#666666]">
          País
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-md border border-[#E5E5E5] bg-white px-3 py-2 text-sm"
          >
            {COUNTRY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs text-[#666666]">Dashboards</p>
        <div className="flex flex-wrap gap-3">
          {catalog.map((d) => (
            <label
              key={d.key}
              className="flex items-center gap-2 text-sm text-[#333333]"
            >
              <input
                type="checkbox"
                checked={role === "superadmin" || selectedKeys.has(d.key)}
                disabled={role === "superadmin"}
                onChange={() => toggle(d.key)}
                className="h-4 w-4 accent-[#9F99F8]"
              />
              {d.label}
            </label>
          ))}
        </div>
        {role === "superadmin" ? (
          <p className="mt-2 text-xs text-[#999999]">
            Un superadmin tiene acceso implícito a todos los dashboards.
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={disabled}
          className="rounded-md bg-[#9F99F8] px-4 py-2 font-sans text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Crear
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="font-sans text-sm text-[#666666] hover:text-[#333333]"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
