import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getCierreMensualRows } from "@/lib/queries/cierreMensual";

export const dynamic = "force-dynamic";

const RUTA = "/cierre-mensual";

export async function GET(request: NextRequest) {
  // El proxy no revisa permisos en /api/*: esta ruta exige sesión y el mismo
  // grant del dashboard que la consume. Sin esto, cualquier usuario con sesión
  // (incluidos externos sin acceso a /cierre-mensual) descargaba el dataset.
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canAccessPath(session.user.permissions ?? [], RUTA)) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  try {
    // Switch neto/bruto del dashboard: valor validado (mapa fijo en la query).
    const monto =
      request.nextUrl.searchParams.get("monto") === "bruto" ? "bruto" : "neto";
    const { rows, cached, cacheAgeSeconds } = await getCierreMensualRows({ monto });
    return NextResponse.json(rows, {
      headers: {
        "X-Cache": cached ? "HIT" : "MISS",
        "X-Cache-Age": String(cacheAgeSeconds),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    const isTimeout = msg.includes("tardó demasiado");
    console.error("[api/cierre-mensual/data]", msg);
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 });
  }
}
