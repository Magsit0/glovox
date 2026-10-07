import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { csvFilename, parseCompradoresParams } from "@/lib/compradores/filtros";
import { createCompradoresCsvStream } from "@/lib/queries/compradores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Un export de todos los eventos son cientos de miles de filas: dale aire.
export const maxDuration = 300;

const RUTA = "/marketing/compradores";

/**
 * CSV completo de /marketing/compradores con los mismos filtros de la página
 * (misma query string). El proxy no revisa permisos en /api/*, así que la
 * ruta exige sesión + el mismo grant del dashboard, y aplica el mismo scope
 * de país de la sesión. La respuesta se transmite en streaming desde BigQuery.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canAccessPath(session.user.permissions ?? [], RUTA)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const raw: Record<string, string[]> = {};
  for (const [key, value] of request.nextUrl.searchParams) {
    (raw[key] ??= []).push(value);
  }
  // Sin `event` ni `cat` en la URL, la API exporta todos los eventos (la
  // página siempre manda la selección explícita, así que acá no hay default).
  const { filters } = parseCompradoresParams(raw);
  const scope = { country: session.user.country ?? null };

  const stream = createCompradoresCsvStream(filters, scope);
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(filters)}"`,
      "Cache-Control": "no-store",
    },
  });
}
