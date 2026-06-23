/**
 * Smoke end-to-end del optimizador: BQ (anclas reales de marca) → buildOptimizerInput
 * → optimizeRevenue, con un plan sintético. Valida que el plan ofrecido respeta
 * capacidad/cupo y que los precios escalan por etapa.
 *   dotenv -e .env.local -- tsx scripts/check-optimizer.ts
 */
import { getDemandAnchorsByStage } from "@/lib/queries/pricing";
import { buildOptimizerInput, optimizeRevenue } from "@/lib/ticketing-pricing/optimizer";
import { coerceDoc } from "@/lib/ticketing-pricing/config";

async function check(eventoId: string, capacidad: number) {
  const anchors = await getDemandAnchorsByStage(eventoId, { capacidadFallback: capacidad });
  // Reproduce el escenario real del usuario: plan vacío, sin capacidad por
  // tipo, sponsors SIN cupo (el caso que rompía con "demanda infinita").
  const doc = coerceDoc({
    eventoId,
    venueCapacidad: capacidad,
    etapas: ["Registrados", "Venta general", "Venta final"],
    tiposProducto: ["Early Entry", "General", "Stage VIP"],
    tiposConfig: [
      { tipo: "Early Entry", aVender: null, cortesias: null, capacidad: null },
      { tipo: "General", aVender: null, cortesias: null, capacidad: null },
      { tipo: "Stage VIP", aVender: null, cortesias: null, capacidad: null },
    ],
    sponsors: [
      { nombre: "Entel", pct: 0.2, cupo: 300 },
      { nombre: "Club Glovox Prime", pct: 0.15, cupo: null },
      { nombre: "Club Glovox Standard", pct: 0.05, cupo: null },
    ],
    celdas: [],
  });
  const anchorByKey = new Map(
    anchors.anchors.map((a) => [`${a.bucket}|${a.etapaNorm}`, { p0: a.p0, d0: a.d0 }]),
  );
  const input = buildOptimizerInput(doc, { anchorByKey, capacidadTotal: capacidad, ivaPct: 0.19 });
  const r = optimizeRevenue(input);

  console.log(
    `\n=== ${eventoId} | magnitud ${anchors.magnitudTotal} (${anchors.magnitudFuente}) | comparables ${anchors.comparables.length} | status ${r.status} ===`,
  );
  for (const c of r.cells) {
    const lanes = c.lanes
      .filter((l) => l.stock > 0)
      .map((l) => `${l.sponsor || "Gral"}:$${l.precio}×${l.stock}`)
      .join("   ");
    console.log(
      `${c.tipo.padEnd(8)} ${c.etapa.padEnd(15)} base=$${String(c.precioBase).padStart(6)}  ${lanes}${c.sinHistorico ? "  (sin hist)" : ""}`,
    );
  }
  console.log(
    `TOTAL vendidos=${r.totals.ticketsVendidos} (aforo ${r.totals.aforoUsado}/${capacidad})  bruto=$${Math.round(r.totals.ingresoBruto).toLocaleString()}  neto=$${Math.round(r.totals.ingresoNeto).toLocaleString()}`,
  );
  if (r.warnings.length) console.log("warnings:", r.warnings);
}

async function main() {
  await check("GLO204", 8000);
  await check("GLO203", 8000);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
