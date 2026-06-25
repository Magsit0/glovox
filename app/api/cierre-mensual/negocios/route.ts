import { NextResponse } from "next/server";
import { getNegociosRows } from "@/lib/queries/cierreMensual";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows, cached, cacheAgeSeconds } = await getNegociosRows();
    return NextResponse.json(rows, {
      headers: {
        "X-Cache": cached ? "HIT" : "MISS",
        "X-Cache-Age": String(cacheAgeSeconds),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    const isTimeout = msg.includes("tardó demasiado");
    console.error("[api/cierre-mensual/negocios]", msg);
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 });
  }
}
