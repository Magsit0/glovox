import { type NextRequest, NextResponse } from "next/server";
import { getCierreMensualRows } from "@/lib/queries/cierreMensual";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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
