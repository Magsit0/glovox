import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { mapaHref } from "@/lib/cierres/eventos";
import CierrePiknic3Deck from "@/components/cierres/piknic-3-26-27/CierrePiknic3Deck";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cierre Piknic 3 · 26-27 — Glovox Data",
};

const PATH = "/cierres/piknic-3-26-27";

/**
 * Presentación de la reunión de cierre del Piknic 3 · 26-27 (GLO211), dentro
 * del grupo CIERRES. Requiere grant explícito (o superadmin), como cualquier
 * dashboard nuevo del catálogo.
 */
export default async function CierrePiknic3Page() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, PATH)) redirect("/?unauthorized=1");

  const mapa = mapaHref("piknic-3-26-27");
  return <CierrePiknic3Deck mapaHref={canAccessPath(permissions, mapa) ? mapa : undefined} />;
}
