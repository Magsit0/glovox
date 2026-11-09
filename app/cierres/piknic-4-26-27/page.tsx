import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { mapaHref } from "@/lib/cierres/eventos";
import CierrePiknic4Deck from "@/components/cierres/piknic-4-26-27/CierrePiknic4Deck";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cierre Piknic 4 · 26-27 — Glovox Data",
};

const PATH = "/cierres/piknic-4-26-27";

/**
 * Presentación de la reunión de cierre del Piknic 4 · 26-27 (GLO216), dentro
 * del grupo CIERRES. Requiere grant explícito (o superadmin). El botón del mapa
 * de ventas aparece solo si el usuario también ve /cierres/mapas.
 */
export default async function CierrePiknic4Page() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, PATH)) redirect("/?unauthorized=1");

  const mapa = mapaHref("piknic-4-26-27");
  return <CierrePiknic4Deck mapaHref={canAccessPath(permissions, mapa) ? mapa : undefined} />;
}
