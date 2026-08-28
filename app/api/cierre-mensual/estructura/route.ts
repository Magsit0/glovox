import { NextResponse } from "next/server";
import { getEstructuraMensual } from "@/lib/queries/cierreMensual";

export const dynamic = "force-dynamic";

// Total mensual del gasto interno GLOVOX (estructura) para la pestaña
// "Análisis financiero". Solo agregados por mes — sin categorías, proveedores
// ni detalle: el dato fino (sueldos) es sensible y vive en /interno.
export async function GET() {
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
