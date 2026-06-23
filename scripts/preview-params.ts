/**
 * Vista previa de los parámetros con que correría el optimizador para un evento:
 * comparables (auto vs. scope manual por temporada) + anclas de demanda (D0/p0)
 * + elasticidad. NO necesita un plan guardado: la parte histórica sale del
 * EventoID. Uso: dotenv -e .env.local -- tsx scripts/preview-params.ts
 */
import { query } from "@/lib/bigquery";
import { getComparableEvents, getDemandAnchorsByStage } from "@/lib/queries/pricing";

const uv = (v: unknown): unknown =>
  v && typeof v === "object" && "value" in (v as object) ? (v as { value: unknown }).value : v;

async function main() {
  const eventoId = "GLO204";
  const cap = 8000;
  const temporadas = ["Sundeck 23-24", "Sundeck 24-25"];

  const seasonRows = await query<Record<string, unknown>>(
    `SELECT EventoID AS id, ANY_VALUE(NombreGlovox) AS nombre, ANY_VALUE(CategoriaEvento) AS cat
     FROM \`root-emissary-313321.glovox.categoriaEvento\`
     WHERE CategoriaEvento IN UNNEST(@temps)
     GROUP BY EventoID`,
    { temps: temporadas },
  );
  const refIds = seasonRows.map((r) => String(uv(r.id)));
  console.log(`Referencia elegida (${temporadas.join(" + ")}): ${refIds.length} eventos`);
  for (const r of seasonRows) {
    console.log(`  ${String(uv(r.id)).padEnd(8)} ${String(uv(r.cat)).padEnd(16)} ${String(uv(r.nombre))}`);
  }

  const auto = await getComparableEvents(eventoId);
  console.log(`\nComparables AUTO de hoy (top ${auto.length}, marca+país+tamaño):`);
  for (const c of auto) {
    console.log(`  ${c.eventoId.padEnd(8)} ${(c.temporada || "?").padEnd(12)} ${String(c.tickets).padStart(6)} tickets  score=${c.score}  ${c.nombre}`);
  }

  const res = await getDemandAnchorsByStage(eventoId, { refEventoIds: refIds, capacidadFallback: cap });
  console.log(`\n=== Parámetros del modelo (referencia = temporadas elegidas) ===`);
  console.log(`magnitud total esperada = ${res.magnitudTotal} (fuente: ${res.magnitudFuente})`);
  console.log(`anclas por (bucket × etapa):`);
  console.log(`  ${"bucket".padEnd(8)} ${"etapa".padEnd(12)} ${"D0(prom)".padStart(9)} ${"p0(prom)".padStart(10)}  nEv`);
  for (const a of res.anchors) {
    console.log(
      `  ${a.bucket.padEnd(8)} ${a.etapaNorm.padEnd(12)} ${String(a.d0).padStart(9)} ${("$" + a.p0.toLocaleString()).padStart(10)}  ${a.nEventos}`,
    );
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
