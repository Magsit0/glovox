import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { eventoPorSlug, mapaHref } from "@/lib/cierres/eventos";
import MapaVentas from "@/components/cierres/MapaVentas";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const evento = eventoPorSlug((await params).slug);
  return { title: evento ? `Mapa de ventas ${evento.nombre} — Glovox Data` : "Glovox Data" };
}

/**
 * Mapa de ventas de un evento (grupo CIERRES): el HTML interactivo de
 * `content/mapas-ventas/` dentro de un iframe, con la barra de la app.
 * Permiso: grant de `/cierres/mapas` (o superadmin), el mismo que revisa la
 * ruta /api que entrega el HTML.
 */
export default async function MapaVentasPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const { slug } = await params;
  const evento = eventoPorSlug(slug);
  if (!evento?.mapa) notFound();
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, mapaHref(evento.slug))) redirect("/?unauthorized=1");

  const cierre =
    evento.cierre && canAccessPath(permissions, evento.cierre) ? evento.cierre : undefined;
  return <MapaVentas evento={evento} cierreHref={cierre} />;
}
