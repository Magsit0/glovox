"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { superadminPendings, type SuperadminPending } from "@/db/schema";
import { requireSuperadmin } from "@/lib/access";
import { DASHBOARDS_CATALOG, ALL_DASHBOARD_KEYS } from "@/lib/dashboards-catalog";

export type PendingLists = {
  pending: SuperadminPending[];
  done: SuperadminPending[];
};

export type AllPendingsByDashboard = {
  dashboardKey: string;
  dashboardLabel: string;
  pending: SuperadminPending[];
  done: SuperadminPending[];
};

function assertDashboardKey(key: string): void {
  if (!ALL_DASHBOARD_KEYS.includes(key)) {
    throw new Error(`Dashboard key inválido: ${key}`);
  }
}

function trimOrNull(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length > 0 ? s : null;
}

async function fetchLists(dashboardKey: string): Promise<PendingLists> {
  const rows = await db
    .select()
    .from(superadminPendings)
    .where(eq(superadminPendings.dashboardKey, dashboardKey))
    .orderBy(desc(superadminPendings.createdAt));
  return {
    pending: rows.filter((r) => r.status === "pending"),
    done: rows.filter((r) => r.status === "done"),
  };
}

export async function listPendings(dashboardKey: string): Promise<PendingLists> {
  await requireSuperadmin();
  assertDashboardKey(dashboardKey);
  return fetchLists(dashboardKey);
}

export async function createPending(
  dashboardKey: string,
  title: string,
  description?: string,
): Promise<PendingLists> {
  const ctx = await requireSuperadmin();
  assertDashboardKey(dashboardKey);
  const cleanTitle = title.trim();
  if (cleanTitle.length === 0) throw new Error("El título no puede estar vacío");

  await db.insert(superadminPendings).values({
    dashboardKey,
    title: cleanTitle,
    description: trimOrNull(description),
    createdBy: ctx.userId,
  });
  return fetchLists(dashboardKey);
}

export async function updatePending(
  id: string,
  patch: { title?: string; description?: string | null },
): Promise<PendingLists> {
  await requireSuperadmin();
  const [existing] = await db
    .select()
    .from(superadminPendings)
    .where(eq(superadminPendings.id, id))
    .limit(1);
  if (!existing) throw new Error("Pendiente no encontrado");

  const next: Partial<typeof superadminPendings.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (patch.title !== undefined) {
    const cleanTitle = patch.title.trim();
    if (cleanTitle.length === 0) throw new Error("El título no puede estar vacío");
    next.title = cleanTitle;
  }
  if (patch.description !== undefined) {
    next.description = trimOrNull(patch.description);
  }

  await db
    .update(superadminPendings)
    .set(next)
    .where(eq(superadminPendings.id, id));
  return fetchLists(existing.dashboardKey);
}

export async function togglePendingStatus(id: string): Promise<PendingLists> {
  await requireSuperadmin();
  const [existing] = await db
    .select()
    .from(superadminPendings)
    .where(eq(superadminPendings.id, id))
    .limit(1);
  if (!existing) throw new Error("Pendiente no encontrado");

  const now = new Date();
  const nextStatus = existing.status === "pending" ? "done" : "pending";
  await db
    .update(superadminPendings)
    .set({
      status: nextStatus,
      completedAt: nextStatus === "done" ? now : null,
      updatedAt: now,
    })
    .where(eq(superadminPendings.id, id));
  return fetchLists(existing.dashboardKey);
}

export async function deletePending(id: string): Promise<PendingLists> {
  await requireSuperadmin();
  const [existing] = await db
    .select()
    .from(superadminPendings)
    .where(eq(superadminPendings.id, id))
    .limit(1);
  if (!existing) throw new Error("Pendiente no encontrado");

  await db.delete(superadminPendings).where(eq(superadminPendings.id, id));
  return fetchLists(existing.dashboardKey);
}

export async function pendingCountsByDashboard(): Promise<Record<string, number>> {
  await requireSuperadmin();
  const rows = await db
    .select()
    .from(superadminPendings)
    .where(eq(superadminPendings.status, "pending"));
  const counts: Record<string, number> = {};
  for (const r of rows) {
    counts[r.dashboardKey] = (counts[r.dashboardKey] ?? 0) + 1;
  }
  return counts;
}

export async function listAllPendings(): Promise<AllPendingsByDashboard[]> {
  await requireSuperadmin();
  const rows = await db
    .select()
    .from(superadminPendings)
    .orderBy(desc(superadminPendings.dashboardKey), desc(superadminPendings.createdAt));

  const catalogMap = new Map(DASHBOARDS_CATALOG.map((d) => [d.key, d]));
  const grouped = new Map<
    string,
    { pending: SuperadminPending[]; done: SuperadminPending[] }
  >();

  for (const row of rows) {
    if (!grouped.has(row.dashboardKey)) {
      grouped.set(row.dashboardKey, { pending: [], done: [] });
    }
    const list = grouped.get(row.dashboardKey)!;
    if (row.status === "pending") list.pending.push(row);
    else list.done.push(row);
  }

  return Array.from(grouped.entries()).map(([key, lists]) => ({
    dashboardKey: key,
    dashboardLabel: catalogMap.get(key)?.label ?? key,
    ...lists,
  }));
}
