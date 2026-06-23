/**
 * Chequeos del optimizador (modelo techo) con casos cerrados.
 *   tsx lib/ticketing-pricing/optimizer.checks.ts  (o `npm run test:optimizer`)
 */
import assert from "node:assert/strict";
import {
  buildOptimizerInput,
  optimizeRevenue,
  type OptimizerCell,
  type OptimizerInput,
} from "./optimizer";
import { coerceDoc, emptyDoc } from "./config";

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok  ${name}`);
}

function cell(over: Partial<OptimizerCell> & { tipo: string; etapa: string }): OptimizerCell {
  return { precio: 10000, demanda: 500, sinHistorico: false, sponsors: [], ...over };
}

function input(cells: OptimizerCell[], over: Partial<OptimizerInput> = {}): OptimizerInput {
  const tipos = [...new Set(cells.map((c) => c.tipo))];
  return {
    cells,
    tipoCaps: tipos.map((t) => ({ tipo: t, capacidad: null, cortesias: 0 })),
    capacidadTotal: null,
    cpsPct: 0.15,
    rebatePct: 0.6,
    ivaPct: 0.19,
    ...over,
  };
}

const find = (r: ReturnType<typeof optimizeRevenue>, tipo: string, etapa: string) =>
  r.cells.find((c) => c.tipo === tipo && c.etapa === etapa)!;
const gen = (c: ReturnType<typeof find>) => c.lanes.find((l) => l.sponsor === "")!;

console.log("optimizer.checks (modelo techo)");

// 1) Sin topes → vende toda la demanda al precio dado (el techo).
check("vende toda la demanda", () => {
  const r = optimizeRevenue(input([cell({ tipo: "G", etapa: "E", precio: 10000, demanda: 500 })]));
  const c = gen(find(r, "G", "E"));
  assert.equal(c.precio, 10000);
  assert.equal(c.stock, 500);
  assert.equal(r.totals.ingresoBruto, 5_000_000);
});

// 2) Capacidad total atante → greedy por valor (mayor precio primero).
check("capacidad atante greedy", () => {
  const r = optimizeRevenue(
    input(
      [
        cell({ tipo: "A", etapa: "E", precio: 10000, demanda: 600 }),
        cell({ tipo: "B", etapa: "E", precio: 5000, demanda: 600 }),
      ],
      { capacidadTotal: 1000 },
    ),
  );
  assert.equal(gen(find(r, "A", "E")).stock, 600);
  assert.equal(gen(find(r, "B", "E")).stock, 400);
  assert.equal(r.totals.ticketsVendidos, 1000);
});

// 3) Tope por tipo (con cortesías que ocupan aforo).
check("tope por tipo y cortesías", () => {
  const r = optimizeRevenue(
    input([cell({ tipo: "G", etapa: "E", precio: 10000, demanda: 2000 })], {
      tipoCaps: [{ tipo: "G", capacidad: 1000, cortesias: 100 }],
    }),
  );
  assert.equal(gen(find(r, "G", "E")).stock, 900); // 1000 − 100 cortesías
  assert.ok(find(r, "G", "E").reasons.includes("capTipo"));
});

// 4) Sponsor: precio con descuento y cupo.
check("sponsor descuento + cupo", () => {
  const r = optimizeRevenue(
    input([
      cell({
        tipo: "G",
        etapa: "E",
        precio: 10000,
        demanda: 1000,
        sponsors: [{ nombre: "Entel", disc: 0.2, cupo: 200 }],
      }),
    ]),
  );
  const sp = find(r, "G", "E").lanes.find((l) => l.sponsor === "Entel")!;
  assert.equal(sp.precio, 8000);
  assert.equal(sp.stock, 200);
  assert.equal(gen(find(r, "G", "E")).stock, 1000);
  assert.equal(r.sponsors.find((s) => s.nombre === "Entel")!.asignado, 200);
});

// 5) Sin histórico → no vende, status degraded.
check("sin histórico passthrough", () => {
  const r = optimizeRevenue(
    input([cell({ tipo: "G", etapa: "E", precio: 0, demanda: 0, sinHistorico: true })]),
  );
  assert.equal(gen(find(r, "G", "E")).stock, 0);
  assert.equal(r.status, "degraded");
});

// 6) Celda completada a mano (override) → participa con esos valores.
check("celda completada por override", () => {
  const r = optimizeRevenue(input([cell({ tipo: "VIP", etapa: "E", precio: 5000, demanda: 100 })]));
  assert.equal(gen(find(r, "VIP", "E")).stock, 100);
  assert.equal(gen(find(r, "VIP", "E")).precio, 5000);
});

// 7) Paridad de derivados con las fórmulas del dominio.
check("paridad rebate/neto", () => {
  const r = optimizeRevenue(input([cell({ tipo: "G", etapa: "E", precio: 10000, demanda: 1000 })]));
  assert.ok(Math.abs(r.totals.rebate - r.totals.ingresoBruto * 0.15 * 0.6) < 1e-6);
  assert.ok(Math.abs(r.totals.ingresoNeto - r.totals.ingresoBruto / 1.19) < 1e-6);
});

// 8) buildOptimizerInput: ancla + reparto de bucket entre tipos que lo comparten.
check("buildOptimizerInput reparte bucket", () => {
  const doc = coerceDoc({
    ...emptyDoc(),
    eventoId: "GLO999",
    tiposProducto: ["Early entry", "General"], // ambos → bucket GENERAL
    etapas: ["Venta general"],
    tiposConfig: [
      { tipo: "Early entry", capacidad: null, cortesias: 0 },
      { tipo: "General", capacidad: null, cortesias: 0 },
    ],
    celdas: [],
  });
  const inp = buildOptimizerInput(doc, {
    anchorByKey: new Map([["GENERAL|GENERAL", { p0: 20000, d0: 200 }]]),
    capacidadTotal: 8000,
    ivaPct: 0.19,
  });
  const ee = inp.cells.find((c) => c.tipo === "Early entry")!;
  const ge = inp.cells.find((c) => c.tipo === "General")!;
  assert.equal(ee.precio, 20000);
  assert.equal(ee.demanda, 100); // 200 repartido entre 2 tipos
  assert.equal(ge.demanda, 100);
});

// 9) buildOptimizerInput: override por celda pisa al histórico.
check("buildOptimizerInput override por celda", () => {
  const doc = coerceDoc({
    ...emptyDoc(),
    eventoId: "GLO999",
    tiposProducto: ["General"],
    etapas: ["Venta general"],
    tiposConfig: [{ tipo: "General", capacidad: null, cortesias: 0 }],
    celdas: [],
  });
  const inp = buildOptimizerInput(doc, {
    anchorByKey: new Map([["GENERAL|GENERAL", { p0: 20000, d0: 200 }]]),
    capacidadTotal: 8000,
    ivaPct: 0.19,
    priceByCell: new Map([["General|Venta general", 25000]]),
    demandByCell: new Map([["General|Venta general", 150]]),
  });
  const c = inp.cells[0];
  assert.equal(c.precio, 25000);
  assert.equal(c.demanda, 150);
  assert.equal(c.sinHistorico, false);
});

console.log(`\n${passed} checks passed.`);
