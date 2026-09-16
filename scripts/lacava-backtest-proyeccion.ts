/**
 * Backtest del modelo de proyección de La Cava (lib/lacava/proyeccion.ts).
 *
 * Recorre la cadena de ediciones de Bocas Moradas (FBM): congela cada edición
 * cerrada a N días del evento, proyecta con el modelo (ancla = edición
 * anterior, comparables = solo eventos ANTERIORES para no filtrar futuro) y
 * compara contra su venta final real. Reporta el error del escenario realista
 * y la cobertura de la banda [pesimista, optimista].
 *
 * Uso:
 *   npx dotenv -e .env.local -- npx tsx scripts/lacava-backtest-proyeccion.ts
 */
import { getCurvasCompra, type CurvaRow } from "@/lib/queries/curvas";
import { buildProyeccion } from "@/lib/lacava/proyeccion";

const FREEZES = [30, 21, 14, 7];

function addDias(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

async function main() {
  const rows = await getCurvasCompra({
    country: "all",
    categoriaEventos: ["FBM", "JUMBO"],
    comunidad: "todos",
    incluirDevueltos: false,
    incluirCortesias: false,
  });

  // Metadatos por evento, reconstruidos desde las filas (fecha = hoy + diasHoy).
  const hoy = new Date().toISOString().slice(0, 10);
  const meta = new Map<string, { total: number; fecha: string; diasHoy: number }>();
  const rowsPorEvento = new Map<string, CurvaRow[]>();
  for (const r of rows) {
    const m = meta.get(r.eventoId) ?? { total: 0, fecha: addDias(hoy, r.diasHoy), diasHoy: r.diasHoy };
    m.total += r.personas;
    meta.set(r.eventoId, m);
    const list = rowsPorEvento.get(r.eventoId) ?? [];
    list.push(r);
    rowsPorEvento.set(r.eventoId, list);
  }

  // Cadena FBM cerrada en orden cronológico; el ancla es la edición anterior.
  const fbm = [...meta.entries()]
    .filter(([, m]) => m.diasHoy < 0)
    .filter(([id]) => !["GLO175", "GLO209"].includes(id)) // JUMBO no va como objetivo
    .sort((a, b) => a[1].fecha.localeCompare(b[1].fecha));

  const resultados: { freeze: number; ape: number; dentro: boolean }[] = [];

  console.log("objetivo  freeze  base  real  pes   rlsta opt   err%rlsta  banda");
  for (let i = 1; i < fbm.length; i++) {
    const [targetId, targetMeta] = fbm[i];
    const [, anchorMeta] = fbm[i - 1];
    const targetRows = rowsPorEvento.get(targetId) ?? [];
    const comparableRows = rows.filter((r) => {
      if (r.eventoId === targetId) return false;
      const m = meta.get(r.eventoId);
      return !!m && m.diasHoy < 0 && m.fecha < targetMeta.fecha;
    });

    for (const freeze of FREEZES) {
      const p = buildProyeccion({
        targetRows,
        comparableRows,
        fechaEvento: targetMeta.fecha,
        anchorTotal: anchorMeta.total,
        factorJornadas: 1,
        congelarEnDia: freeze,
      });
      if (!p.disponible) {
        console.log(`${targetId}  d-${freeze}  — ${p.motivo}`);
        continue;
      }
      const real = targetMeta.total;
      const [pes, rlsta, opt] = ["pesimista", "realista", "optimista"].map(
        (k) => p.escenarios.find((e) => e.key === k)?.finalPersonas ?? 0,
      );
      const ape = Math.abs(rlsta - real) / real;
      const dentro = real >= pes && real <= opt;
      resultados.push({ freeze, ape, dentro });
      console.log(
        `${targetId}  d-${String(freeze).padStart(2)}   ${String(p.base).padStart(5)} ${String(real).padStart(5)} ${String(pes).padStart(5)} ${String(rlsta).padStart(5)} ${String(opt).padStart(5)}  ${(ape * 100).toFixed(1).padStart(6)}%   ${dentro ? "sí" : "NO"}`,
      );
    }
  }

  console.log("\nResumen por freeze:");
  for (const freeze of FREEZES) {
    const del = resultados.filter((r) => r.freeze === freeze);
    if (del.length === 0) continue;
    const apes = del.map((r) => r.ape).sort((a, b) => a - b);
    const medApe = apes[Math.floor(apes.length / 2)];
    const cobertura = del.filter((r) => r.dentro).length / del.length;
    console.log(
      `  d-${freeze}: n=${del.length}  mediana |err| realista=${(medApe * 100).toFixed(1)}%  cobertura banda=${(cobertura * 100).toFixed(0)}%`,
    );
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
