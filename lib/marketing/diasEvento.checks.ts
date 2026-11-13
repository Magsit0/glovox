/**
 * Chequeos de lib/marketing/diasEvento.ts con fechas reales de glovox.tickets
 * (tickets vendidos por día de FechaEvento, consultados el 2026-11-13).
 *   tsx lib/marketing/diasEvento.checks.ts  (o `npm run test:dias-evento`)
 */
import assert from "node:assert/strict";
import {
  etiquetaDia,
  filtroDeJornada,
  jornadaElegida,
  jornadasDelEvento,
  nombreDiaSemana,
  type DiaEventoRow,
} from "./diasEvento";

const filas = (pares: [string, number][]): DiaEventoRow[] =>
  pares.map(([dia, tickets]) => ({ dia, tickets, personas: tickets }));
const dias = (rows: DiaEventoRow[]) => jornadasDelEvento(rows).map((j) => j.dia);

// FDS 26 (GLO213): tres jornadas, vie a dom.
const fds26 = filas([["2026-11-13", 775], ["2026-11-14", 1284], ["2026-11-15", 465]]);
assert.deepEqual(dias(fds26), ["2026-11-13", "2026-11-14", "2026-11-15"]);

// Un día: sin filtro.
assert.deepEqual(dias(filas([["2026-11-07", 4525]])), []);

// Sundeck Apache PE (751455): 2 tickets sueltos el día anterior no lo vuelven
// un evento de dos días.
assert.deepEqual(dias(filas([["2026-10-02", 2], ["2026-10-03", 190]])), []);

// FDS 24 (GLO145): el viernes chico (4,7%) sigue siendo jornada.
assert.deepEqual(dias(filas([["2024-11-15", 365], ["2024-11-16", 4070], ["2024-11-17", 3354]])), [
  "2024-11-15",
  "2024-11-16",
  "2024-11-17",
]);

// FDS 20 (GLO069): el jueves con 6 tickets queda fuera; el resto sí.
assert.deepEqual(
  dias(filas([["2020-03-12", 6], ["2020-03-13", 125], ["2020-03-14", 653], ["2020-03-15", 7396]])),
  ["2020-03-13", "2020-03-14", "2020-03-15"],
);

// La Cava 2026 (GLO209): reagendada del 6–8 nov al 11–13 dic. Cada jornada
// junta los tickets de su fecha original con los de la nueva.
const lacava = jornadasDelEvento(
  filas([
    ["2026-11-06", 907],
    ["2026-11-07", 1354],
    ["2026-11-08", 502],
    ["2026-12-11", 89],
    ["2026-12-12", 151],
    ["2026-12-13", 49],
  ]),
);
assert.deepEqual(
  lacava.map((j) => [j.dia, j.originales, j.tickets]),
  [
    ["2026-12-11", ["2026-11-06", "2026-12-11"], 996],
    ["2026-12-12", ["2026-11-07", "2026-12-12"], 1505],
    ["2026-12-13", ["2026-11-08", "2026-12-13"], 551],
  ],
);

// Pedro Engel 2025 2 (GLO173): dos funciones a 27 días. No es un
// reagendamiento (el miércoles no cae en un día con tickets de la última
// semana): cada fecha queda igual.
assert.deepEqual(dias(filas([["2025-09-03", 117], ["2025-09-30", 60]])), ["2025-09-03", "2025-09-30"]);

// Piknic 5 17-18 (GLO042): temporada de varios sábados y un domingo, tampoco.
assert.equal(
  jornadasDelEvento(
    filas([
      ["2017-11-18", 697],
      ["2017-12-03", 710],
      ["2018-01-06", 531],
      ["2018-02-17", 692],
      ["2018-03-24", 1748],
      ["2018-04-07", 1301],
    ]),
  ).length,
  6,
);

// Filas sin fecha válida se ignoran.
assert.deepEqual(dias([...fds26, { dia: "", tickets: 50, personas: 50 }]), ["2026-11-13", "2026-11-14", "2026-11-15"]);

// ?dia= de otro evento: sin filtro.
const jornadas = jornadasDelEvento(fds26);
assert.equal(jornadaElegida(jornadas, "2026-11-14")?.dia, "2026-11-14");
assert.equal(jornadaElegida(jornadas, "2025-11-22"), null);
assert.equal(jornadaElegida(jornadas, undefined), null);

// Día de la semana para BigQuery (1 = domingo … 7 = sábado).
assert.deepEqual(filtroDeJornada(jornadas[1]), { dias: ["2026-11-14"], diaSemana: 7 });
assert.deepEqual(filtroDeJornada(lacava[0]), { dias: ["2026-11-06", "2026-12-11"], diaSemana: 6 });

assert.equal(etiquetaDia("2026-11-14"), "sáb 14 nov");
assert.equal(etiquetaDia("2026-09-06"), "dom 6 sept");
assert.equal(nombreDiaSemana("2026-11-13"), "viernes");

console.log("diasEvento: OK");
