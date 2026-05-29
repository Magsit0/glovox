/**
 * Seed inicial del catálogo de proveedores FF&BB.
 * Idempotente: ON CONFLICT DO NOTHING — corré las veces que quieras.
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx db/scripts/seed-proveedores.ts
 */
import { db } from "../index";
import { proveedores } from "../schema";

const NOMBRES = [
  "GC",
  "CCU",
  "GLOVOX",
  "Santa Marta",
  "Andina",
  "Diageo",
  "Todo Licores",
  "La negra",
  "Madel",
  "CCU B",
  "GC B",
  "Viña San Pedro",
  "Jumbo",
  "ECCU",
  "Fodor",
  "Gruas Zamorano",
  "Gatorlit Bonificado",
  "Heineken Bonificado",
  "Abram spa",
  "Mistral",
  "Concha y toro",
];

async function main() {
  console.log(`→ Seeding ${NOMBRES.length} proveedores FF&BB…`);
  for (const nombre of NOMBRES) {
    await db
      .insert(proveedores)
      .values({ nombre })
      .onConflictDoNothing({ target: proveedores.nombre });
    console.log(`  ✓ ${nombre}`);
  }
  console.log("Done.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
