import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { eventoPorSlug, mapaHref } from "@/lib/cierres/eventos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * HTML interactivo de un mapa de ventas (lo muestra en un iframe la página
 * `/cierres/mapas/[slug]`). El proxy no revisa permisos en /api/*, así que la
 * ruta exige sesión + el grant del mapa. El slug solo se acepta si está en
 * `EVENTOS_CIERRE` con mapa: nunca se arma una ruta de archivo con texto libre.
 * Los archivos viven en `content/mapas-ventas/` (incluidos en el deploy por
 * `outputFileTracingIncludes` en next.config.ts).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { slug } = await params;
  const evento = eventoPorSlug(slug);
  if (!evento?.mapa) {
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  }
  if (!canAccessPath(session.user.permissions ?? [], mapaHref(evento.slug))) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const html = await readFile(
    path.join(process.cwd(), "content", "mapas-ventas", `${evento.slug}.html`),
    "utf8",
  );
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=300",
      // Solo se puede incrustar dentro de la propia app.
      "Content-Security-Policy": "frame-ancestors 'self'",
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    },
  });
}

