import { NextResponse } from "next/server";
import { getCierreMensualRows } from "@/lib/queries/unabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { rows, cached, cacheAgeSeconds } = await getCierreMensualRows();
    return NextResponse.json(rows, {
      headers: {
        "X-Cache": cached ? "HIT" : "MISS",
        "X-Cache-Age": String(cacheAgeSeconds),
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Error desconocido";
    const isTimeout = msg.includes("tardó demasiado");
    console.error("[api/unabase/data]", msg);
    return NextResponse.json({ error: msg }, { status: isTimeout ? 504 : 500 });
  }
}
