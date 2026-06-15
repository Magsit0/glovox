/**
 * Seed de planes de pricing históricos (ejemplos) en `ticketing_planes` (Neon).
 *
 * Fuente: "Plan Ticketing Piknic 2025 - 2026 sept - abr.xlsx", hojas Piknic 1 y
 * Piknic 8. Mapeo curado a mano del modelo documento (tipo × etapa) — NO viene
 * de glovox.tickets. Sponsors: ENTEL+BANCO −20%, Club Sundeck Prime −15%.
 * CPS 15% / rebate 60% (defaults). Idempotente: borra por nombre y re-inserta.
 *
 * Uso:  node scripts/seed-pricing-historico.mjs
 */
import { readFileSync } from "fs";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// Cargar DATABASE_URL desde .env.local (mismo patrón que el resto de la app).
const envFile = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
for (const line of envFile.split("\n")) {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"(.*)"$/, "$1");
}

const SPONSORS_SIN_CUPO = [
  { nombre: "ENTEL + BANCO", pct: 0.2, cupo: null },
  { nombre: "Club Sundeck Prime", pct: 0.15, cupo: null },
];

const PLANES = [
  {
    nombre: "Piknic 1",
    country: "CL",
    fechaEvento: null,
    doc: {
      cpsPct: 0.15,
      rebatePct: 0.6,
      venueCapacidad: 5000,
      ventaEsperada: 154751250, // total "Ingresos*" de la hoja Piknic 1
      etapas: ["Early bird", "Preventa 1", "Preventa 2", "Preventa 3", "Venta general"],
      tiposProducto: ["Pase 8 fechas", "Pase 4 fechas", "Happy Piknic", "General", "Hospitality VIP"],
      // a vender = Σ stock de las celdas de cada tipo (sin cortesías en la hoja)
      tiposConfig: [
        { tipo: "Pase 8 fechas", aVender: 137, cortesias: null },
        { tipo: "Pase 4 fechas", aVender: 450, cortesias: null },
        { tipo: "Happy Piknic", aVender: 600, cortesias: null },
        { tipo: "General", aVender: 3300, cortesias: null },
        { tipo: "Hospitality VIP", aVender: 210, cortesias: null },
      ],
      sponsors: SPONSORS_SIN_CUPO,
      celdas: [
        { tipo: "Pase 8 fechas", etapa: "Early bird", precio: 16250, stock: 137 },
        { tipo: "Pase 4 fechas", etapa: "Venta general", precio: 20500, stock: 450 },
        { tipo: "Happy Piknic", etapa: "Preventa 1", precio: 18000, stock: 250 },
        { tipo: "Happy Piknic", etapa: "Venta general", precio: 20000, stock: 350 },
        { tipo: "General", etapa: "Preventa 1", precio: 25000, stock: 400 },
        { tipo: "General", etapa: "Preventa 2", precio: 30000, stock: 600 },
        { tipo: "General", etapa: "Preventa 3", precio: 35000, stock: 800 },
        { tipo: "General", etapa: "Venta general", precio: 40000, stock: 1500 },
        { tipo: "Hospitality VIP", etapa: "Early bird", precio: 60000, stock: 10 },
        { tipo: "Hospitality VIP", etapa: "Preventa 1", precio: 70000, stock: 80 },
        { tipo: "Hospitality VIP", etapa: "Venta general", precio: 80000, stock: 120 },
      ],
    },
  },
  {
    nombre: "Piknic 8",
    country: "CL",
    fechaEvento: null,
    doc: {
      cpsPct: 0.15,
      rebatePct: 0.6,
      venueCapacidad: 5000,
      ventaEsperada: 163266250, // total "Ingresos*" de la hoja Piknic 8
      etapas: ["Pre-registro", "Early bird", "Preventa 1", "Preventa 2", "Venta general"],
      tiposProducto: ["Pase 8 fechas", "Pase 4 fechas", "Happy Piknic", "General", "Backstage VIP"],
      tiposConfig: [
        { tipo: "Pase 8 fechas", aVender: 137, cortesias: null },
        { tipo: "Pase 4 fechas", aVender: 180, cortesias: null },
        { tipo: "Happy Piknic", aVender: 600, cortesias: null },
        { tipo: "General", aVender: 3600, cortesias: null },
        { tipo: "Backstage VIP", aVender: 185, cortesias: null },
      ],
      // Piknic 8 sí trae cupos de descuento al pie de la hoja.
      sponsors: [
        { nombre: "ENTEL + BANCO", pct: 0.2, cupo: 900 },
        { nombre: "Club Sundeck Prime", pct: 0.15, cupo: 500 },
      ],
      celdas: [
        { tipo: "Pase 8 fechas", etapa: "Early bird", precio: 16250, stock: 137 },
        { tipo: "Pase 4 fechas", etapa: "Venta general", precio: 20500, stock: 180 },
        { tipo: "Happy Piknic", etapa: "Pre-registro", precio: 16000, stock: 100 },
        { tipo: "Happy Piknic", etapa: "Preventa 1", precio: 19000, stock: 200 },
        { tipo: "Happy Piknic", etapa: "Venta general", precio: 22000, stock: 300 },
        { tipo: "General", etapa: "Pre-registro", precio: 25000, stock: 200 },
        { tipo: "General", etapa: "Preventa 1", precio: 30000, stock: 600 },
        { tipo: "General", etapa: "Preventa 2", precio: 35000, stock: 800 },
        { tipo: "General", etapa: "Venta general", precio: 40000, stock: 2000 },
        { tipo: "Backstage VIP", etapa: "Early bird", precio: 60000, stock: 5 },
        { tipo: "Backstage VIP", etapa: "Pre-registro", precio: 70000, stock: 10 },
        { tipo: "Backstage VIP", etapa: "Preventa 1", precio: 75000, stock: 50 },
        { tipo: "Backstage VIP", etapa: "Venta general", precio: 80000, stock: 120 },
      ],
    },
  },
];

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
const pool = new Pool({ connectionString: url });

try {
  for (const p of PLANES) {
    await pool.query("DELETE FROM ticketing_planes WHERE nombre = $1", [p.nombre]);
    const res = await pool.query(
      `INSERT INTO ticketing_planes (nombre, country, fecha_evento, doc)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [p.nombre, p.country, p.fechaEvento, JSON.stringify(p.doc)],
    );
    console.log(`✓ ${p.nombre} (${p.country}) → ${res.rows[0].id} · ${p.doc.celdas.length} celdas`);
  }
  const count = await pool.query("SELECT count(*)::int AS n FROM ticketing_planes");
  console.log(`Total planes en ticketing_planes: ${count.rows[0].n}`);
} finally {
  await pool.end();
}
