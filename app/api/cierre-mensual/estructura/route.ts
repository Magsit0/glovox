import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getEstructuraMensual } from "@/lib/queries/cierreMensual";

export const dynamic = "force-dynamic";

const RUTA = "/cierre-mensual";

// Total mensual del gasto interno GLOVOX (estructura) para la pestaña
// "Análisis financiero". Solo agregados por mes — sin categorías, proveedores
// ni detalle: el dato fino (sueldos) es sensible y vive en /interno.
export async function GET() {
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
    const { rows, cached, cacheAgeSeconds } = await getEstructuraMensual();
    return NextResponse.json(rows, {
      headers: {
        "X-Cache": cached ? "HIT" : "MISS",
        "X-Cache-Age": String(cacheAgeSeconds),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    const isTimeout = msg.includes("tardó demasiado");
    console.error("[api/cierre-mensual/estructura]", msg);
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 });
  }
}
