"use server";

import { revalidatePath } from "next/cache";
import { requireSuperadmin } from "@/lib/access";
import {
  createUser,
  restoreUser,
  revokeUser,
  setUserCountry,
  setUserDashboards,
  setUserRole,
  type CreateUserInput,
} from "@/lib/admin-users-service";
import type { Country, Role } from "@/db/schema";
import { EditoresError, esCapacidad, setEditores } from "@/lib/editores-capacidad";

const ROLES: Role[] = ["superadmin", "user"];
const COUNTRIES: Country[] = ["CL", "PE"];

function asRole(v: unknown): Role {
  if (typeof v === "string" && (ROLES as string[]).includes(v)) return v as Role;
  throw new Error(`Rol inválido: ${String(v)}`);
}

function asCountry(v: unknown): Country | null {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string" && (COUNTRIES as string[]).includes(v))
    return v as Country;
  throw new Error(`País inválido: ${String(v)}`);
}

export async function createUserAction(input: CreateUserInput) {
  const ctx = await requireSuperadmin();
  await createUser(ctx.email, input);
  revalidatePath("/admin/users");
}

export async function setCountryAction(userId: string, country: string | null) {
  const ctx = await requireSuperadmin();
  await setUserCountry(ctx.email, userId, asCountry(country));
  revalidatePath("/admin/users");
}

export async function setRoleAction(userId: string, role: string) {
  const ctx = await requireSuperadmin();
  await setUserRole(ctx.email, userId, asRole(role));
  revalidatePath("/admin/users");
}

export async function setDashboardsAction(
  userId: string,
  dashboardKeys: string[],
) {
  const ctx = await requireSuperadmin();
  await setUserDashboards(ctx.email, userId, dashboardKeys);
  revalidatePath("/admin/users");
}

export async function revokeUserAction(userId: string) {
  const ctx = await requireSuperadmin();
  await revokeUser(ctx.email, userId);
  revalidatePath("/admin/users");
}

export async function restoreUserAction(userId: string) {
  const ctx = await requireSuperadmin();
  await restoreUser(ctx.email, userId);
  revalidatePath("/admin/users");
}

/**
 * Lista completa de editores de una capacidad (hoy: `metas-evento`, hasta 2).
 * Lista vacía = nadie. Rige al instante: la capacidad se lee de la base en cada
 * carga y en cada guardado, no del token. El tope lo valida setEditores.
 * Los rechazos esperados vuelven como valor: un error lanzado desde una server
 * action llega al cliente de producción con un mensaje genérico, sin el texto.
 */
export async function setEditoresAction(
  capacidad: string,
  userIds: string[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await requireSuperadmin();
  if (!esCapacidad(capacidad)) return { ok: false, error: "Capacidad inválida" };
  if (!Array.isArray(userIds) || userIds.some((id) => typeof id !== "string")) {
    return { ok: false, error: "Lista de usuarios inválida" };
  }
  try {
    await setEditores(capacidad, userIds, ctx.userId);
  } catch (err) {
    if (err instanceof EditoresError) return { ok: false, error: err.message };
    console.error("[admin/users] setEditores falló", err);
    return { ok: false, error: "No se pudo guardar. Intenta de nuevo." };
  }
  revalidatePath("/admin/users");
  return { ok: true };
}
