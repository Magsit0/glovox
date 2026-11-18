import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { mapaHref } from "@/lib/cierres/eventos";
import CierreFds26Deck from "@/components/cierres/fds-26/CierreFds26Deck";
import { esSuperadminVigente } from "@/lib/access";
import { META } from "@/lib/cierres/fds-26";
import { getFechaClaveEvento } from "@/lib/produccion/fechas-clave";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cierre Feria del Sánguche 2026 — Glovox Data",
};

const PATH = "/cierres/fds-26";

/**
 * Presentación de la reunión de cierre de la Feria del Sánguche 2026 (GLO213),
 * dentro del grupo CIERRES. Requiere grant explícito (o superadmin). El botón
 * del mapa de ventas aparece solo si el usuario también ve /cierres/mapas.
 */
export default async function CierreFds26Page() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, PATH)) redirect("/?unauthorized=1");

  const mapa = mapaHref("fds-26");
  // Informe de marcas: en vivo desde la carta Gantt (plan 1240). Un superadmin
  // puede anotar la fecha real desde la lámina 2 (escribe en la Gantt).
  const [informeMarcas, editar] = await Promise.all([
    getFechaClaveEvento(META.planGantt, "informe_marcas", "Feria"),
    session.user.role === "superadmin"
      ? esSuperadminVigente(session.user.email).catch(() => false)
      : Promise.resolve(false),
  ]);
  return (
    <CierreFds26Deck
      mapaHref={canAccessPath(permissions, mapa) ? mapa : undefined}
      informeMarcas={informeMarcas}
      editarFechasClave={editar}
    />
  );
}
