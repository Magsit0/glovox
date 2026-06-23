/**
 * Muestra p0_ij y D0_ij POR CELDA (tipo × etapa) tal como los arma el modelo,
 * incluyendo el reparto del bucket entre tipos que lo comparten.
 *   dotenv -e .env.local -- tsx scripts/show-anchors-by-cell.ts
 */
import { query } from "@/lib/bigquery";
import { getDemandAnchorsByStage } from "@/lib/queries/pricing";
import { buildOptimizerInput, bucketTipo } from "@/lib/ticketing-pricing/optimizer";
import { coerceDoc } from "@/lib/ticketing-pricing/config";

const uv = (v: unknown): unknown =>
  v && typeof v === "object" && "value" in (v as object) ? (v as { value: unknown }).value : v;

async function main() {
  const eventoId = "GLO204";
  const cap = 8000;
  const temporadas = ["Sundeck 23-24", "Sundeck 24-25"];

  const seasonRows = await query<Record<string, unknown>>(
    `SELECT EventoID AS id FROM \`root-emissary-313321.glovox.categoriaEvento\`
     WHERE CategoriaEvento IN UNNEST(@t) GROUP BY EventoID`,
    { t: temporadas },
  );
  const refIds = seasonRows.map((r) => String(uv(r.id)));

  const anchors = await getDemandAnchorsByStage(eventoId, { refEventoIds: refIds, capacidadFallback: cap });
  const anchorByKey = new Map(
    anchors.anchors.map((a) => [`${a.bucket}|${a.etapaNorm}`, { p0: a.p0, d0: a.d0 }]),
  );

  const doc = coerceDoc({
    eventoId,
    venueCapacidad: cap,
    etapas: ["Registrados", "Venta general", "Venta final"],
    tiposProducto: ["Early Entry", "General", "Stage VIP"],
    tiposConfig: [
      { tipo: "Early Entry", capacidad: null },
      { tipo: "General", capacidad: null },
      { tipo: "Stage VIP", capacidad: null },
    ],
    sponsors: [],
    celdas: [],
  });

  const input = buildOptimizerInput(doc, { anchorByKey, capacidadTotal: cap, ivaPct: 0.19 });

  console.log(`GLO204 · referencia ${temporadas.join(" + ")} (${refIds.length} eventos) · magnitud M = ${anchors.magnitudTotal} (${anchors.magnitudFuente})\n`);
  console.log(`${"tipo".padEnd(12)} ${"etapa".padEnd(14)} ${"bucket".padEnd(8)} ${"p0_ij".padStart(10)} ${"D0_ij".padStart(8)}`);
  for (const c of input.cells) {
    const bk = bucketTipo(c.tipo);
    if (!c.sinHistorico) {
      console.log(`${c.tipo.padEnd(12)} ${c.etapa.padEnd(14)} ${bk.padEnd(8)} ${("$" + Math.round(c.precio).toLocaleString()).padStart(10)} ${String(Math.round(c.demanda)).padStart(8)}`);
    } else {
      console.log(`${c.tipo.padEnd(12)} ${c.etapa.padEnd(14)} ${bk.padEnd(8)} ${"—".padStart(10)} ${"—".padStart(8)}  sin histórico`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
