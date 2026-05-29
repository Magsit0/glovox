/**
 * Seed inicial del catálogo de insumos FF&BB.
 * Idempotente: ON CONFLICT DO NOTHING — corré las veces que quieras.
 *
 * Solo persistimos las columnas que pidió el usuario:
 * nombre, grupo, mL, marca, porCaja.
 *
 * Uso:
 *   npx dotenv -e .env.local -- tsx db/scripts/seed-insumos-catalogo.ts
 */
import { db } from "../index";
import { insumosCatalogo } from "../schema";

interface SeedRow {
  insumo: string;
  grupo: string | null;
  mL: string | null;
  marca: string | null;
  porCaja: string | null;
}

const RAW: SeedRow[] = [
  { insumo: "1500cc ginger", grupo: "Bebida", mL: null, marca: null, porCaja: "6" },
  { insumo: "1500cc ginger zero", grupo: "Bebida", mL: null, marca: null, porCaja: "6" },
  { insumo: "1500cc tonica", grupo: "Bebida", mL: null, marca: null, porCaja: "6" },
  { insumo: "1500cc tonica zero", grupo: "Bebida", mL: null, marca: null, porCaja: "6" },
  { insumo: "Agua con gas", grupo: "Agua", mL: "600", marca: "Cachantun", porCaja: "12" },
  { insumo: "Agua sin gas", grupo: "Agua", mL: "600", marca: "Cachantun", porCaja: "12" },
  { insumo: "Agua puyehue con gas", grupo: "Agua", mL: null, marca: null, porCaja: "12" },
  { insumo: "Agua puyehue sin gas", grupo: "Agua", mL: null, marca: null, porCaja: "12" },
  { insumo: "Alto 40", grupo: "Alto 40", mL: null, marca: null, porCaja: "6" },
  { insumo: "Antiyal Sparkling Wine", grupo: "Antiyal Sparkling Wine", mL: null, marca: null, porCaja: "6" },
  { insumo: "Aperol", grupo: "Aperol", mL: null, marca: null, porCaja: "6" },
  { insumo: "Araucano", grupo: "Araucano", mL: null, marca: null, porCaja: "12" },
  { insumo: "Austral Calafate", grupo: "Austral Calafate", mL: null, marca: null, porCaja: "24" },
  { insumo: "Austral Lager", grupo: "Austral Lager", mL: null, marca: null, porCaja: "24" },
  { insumo: "Baileys", grupo: "Baileys", mL: null, marca: null, porCaja: "12" },
  { insumo: "Ballantines", grupo: "Ballantines", mL: null, marca: null, porCaja: "12" },
  { insumo: "Beefeater", grupo: "Beefeater", mL: null, marca: null, porCaja: "12" },
  { insumo: "Beefeater Pink", grupo: "Beefeater Pink", mL: null, marca: null, porCaja: "12" },
  { insumo: "Bombay", grupo: "Bombay", mL: null, marca: null, porCaja: "12" },
  { insumo: "Bulldog", grupo: "Bulldog", mL: null, marca: null, porCaja: "6" },
  { insumo: "Campari", grupo: "Campari", mL: null, marca: null, porCaja: "12" },
  { insumo: "Cerveza s/alcohol", grupo: "Cerveza s/alcohol", mL: null, marca: null, porCaja: "24" },
  { insumo: "Chivas 12", grupo: "Chivas 12", mL: null, marca: null, porCaja: "12" },
  { insumo: "Chivas 18", grupo: "Chivas 18", mL: null, marca: null, porCaja: "6" },
  { insumo: "Chivas XV", grupo: "Chivas XV", mL: null, marca: null, porCaja: "6" },
  { insumo: "Coca Cola", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Coca Cola Light", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Coca Cola Zero", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Copon", grupo: "Cristaleria", mL: null, marca: null, porCaja: "12" },
  { insumo: "Corona", grupo: "Corona", mL: null, marca: null, porCaja: "24" },
  { insumo: "Cousiño Macul Antiguas Reservas Cab Sauv", grupo: "Cousiño Macul Antiguas Reservas Cab Sauv", mL: null, marca: null, porCaja: "12" },
  { insumo: "Cousiño Macul Antiguas Reservas Chardonnay", grupo: "Cousiño Macul Antiguas Reservas Chardonnay", mL: null, marca: null, porCaja: "12" },
  { insumo: "Cousiño Macul Isidora Sauvignon Gris", grupo: "Cousiño Macul Isidora Sauvignon Gris", mL: null, marca: null, porCaja: "12" },
  { insumo: "Cousiño Macul Lota", grupo: "Cousiño Macul Lota", mL: null, marca: null, porCaja: "3" },
  { insumo: "Cousiño Macul W de Macul", grupo: "Cousiño Macul W de Macul", mL: null, marca: null, porCaja: "6" },
  { insumo: "Cusqueña", grupo: "Cusqueña", mL: null, marca: null, porCaja: "24" },
  { insumo: "Dreher", grupo: "Dreher", mL: null, marca: null, porCaja: "6" },
  { insumo: "Eristoff", grupo: "Eristoff", mL: null, marca: null, porCaja: "12" },
  { insumo: "Fanta", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Fernet", grupo: "Fernet", mL: null, marca: null, porCaja: "6" },
  { insumo: "Flor de Caña 4", grupo: "Flor de Caña 4", mL: null, marca: null, porCaja: "12" },
  { insumo: "Flor de Caña 7", grupo: "Flor de Caña 7", mL: null, marca: null, porCaja: "12" },
  { insumo: "Flor de Caña 12", grupo: "Flor de Caña 12", mL: null, marca: null, porCaja: "6" },
  { insumo: "Ginger Ale", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Ginger Ale Zero", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Ginger Beer", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Glenlivet 12", grupo: "Glenlivet 12", mL: null, marca: null, porCaja: "12" },
  { insumo: "Glenlivet 15", grupo: "Glenlivet 15", mL: null, marca: null, porCaja: "6" },
  { insumo: "Glenlivet Founder Reserve", grupo: "Glenlivet Founder Reserve", mL: null, marca: null, porCaja: "6" },
  { insumo: "Grey Goose", grupo: "Grey Goose", mL: null, marca: null, porCaja: "6" },
  { insumo: "Havana 3", grupo: "Havana 3", mL: null, marca: null, porCaja: "12" },
  { insumo: "Havana 7", grupo: "Havana 7", mL: null, marca: null, porCaja: "6" },
  { insumo: "Havana Especial", grupo: "Havana Especial", mL: null, marca: null, porCaja: "12" },
  { insumo: "Hendricks", grupo: "Hendricks", mL: null, marca: null, porCaja: "6" },
  { insumo: "Jack Daniels", grupo: "Jack Daniels", mL: null, marca: null, porCaja: "12" },
  { insumo: "Jack Daniels Apple", grupo: "Jack Daniels Apple", mL: null, marca: null, porCaja: "12" },
  { insumo: "Jack Daniels Fire", grupo: "Jack Daniels Fire", mL: null, marca: null, porCaja: "12" },
  { insumo: "Jack Daniels Honey", grupo: "Jack Daniels Honey", mL: null, marca: null, porCaja: "12" },
  { insumo: "Jameson", grupo: "Jameson", mL: null, marca: null, porCaja: "12" },
  { insumo: "Jameson Black Barrel", grupo: "Jameson Black Barrel", mL: null, marca: null, porCaja: "6" },
  { insumo: "Jhonnie Walker Black", grupo: "Jhonnie Walker Black", mL: null, marca: null, porCaja: "12" },
  { insumo: "Jhonnie Walker Red", grupo: "Jhonnie Walker Red", mL: null, marca: null, porCaja: "12" },
  { insumo: "Kross 5", grupo: "Kross 5", mL: null, marca: null, porCaja: "24" },
  { insumo: "Kross Golden", grupo: "Kross Golden", mL: null, marca: null, porCaja: "24" },
  { insumo: "Kross Maqui", grupo: "Kross Maqui", mL: null, marca: null, porCaja: "24" },
  { insumo: "Kross Stout", grupo: "Kross Stout", mL: null, marca: null, porCaja: "24" },
  { insumo: "Malibu", grupo: "Malibu", mL: null, marca: null, porCaja: "12" },
  { insumo: "Mistral 35", grupo: "Mistral 35", mL: null, marca: null, porCaja: "12" },
  { insumo: "Mistral 40", grupo: "Mistral 40", mL: null, marca: null, porCaja: "12" },
  { insumo: "Mistral Nobel", grupo: "Mistral Nobel", mL: null, marca: null, porCaja: "12" },
  { insumo: "Mistral Nobel 40", grupo: "Mistral Nobel 40", mL: null, marca: null, porCaja: "12" },
  { insumo: "Olmeca", grupo: "Olmeca", mL: null, marca: null, porCaja: "12" },
  { insumo: "Olmeca Chocolate", grupo: "Olmeca Chocolate", mL: null, marca: null, porCaja: "12" },
  { insumo: "Pajaro Loco", grupo: "Pajaro Loco", mL: null, marca: null, porCaja: "12" },
  { insumo: "Pampero Aniversario", grupo: "Pampero Aniversario", mL: null, marca: null, porCaja: "6" },
  { insumo: "Pisco 1733", grupo: "Pisco 1733", mL: null, marca: null, porCaja: "12" },
  { insumo: "Ramazzotti", grupo: "Ramazzotti", mL: null, marca: null, porCaja: "6" },
  { insumo: "Ramazzotti Violetto", grupo: "Ramazzotti Violetto", mL: null, marca: null, porCaja: "6" },
  { insumo: "Red Bull", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Red Bull Sugar Free", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Red Bull Tropical", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Red Bull Watermelon", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Riccadonna Asti", grupo: "Riccadonna Asti", mL: null, marca: null, porCaja: "6" },
  { insumo: "Riccadonna Prosecco", grupo: "Riccadonna Prosecco", mL: null, marca: null, porCaja: "6" },
  { insumo: "Riccadonna Ruby", grupo: "Riccadonna Ruby", mL: null, marca: null, porCaja: "6" },
  { insumo: "Royal", grupo: "Royal", mL: null, marca: null, porCaja: "24" },
  { insumo: "Santa Digna Cab Sauv", grupo: "Santa Digna Cab Sauv", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Digna Chardonnay", grupo: "Santa Digna Chardonnay", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Digna Merlot", grupo: "Santa Digna Merlot", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Digna Rose", grupo: "Santa Digna Rose", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Digna Sauv Blanc", grupo: "Santa Digna Sauv Blanc", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema 60/40", grupo: "Santa Ema 60/40", mL: null, marca: null, porCaja: "6" },
  { insumo: "Santa Ema Amplus Cab Sauv", grupo: "Santa Ema Amplus Cab Sauv", mL: null, marca: null, porCaja: "6" },
  { insumo: "Santa Ema Amplus Chardonnay", grupo: "Santa Ema Amplus Chardonnay", mL: null, marca: null, porCaja: "6" },
  { insumo: "Santa Ema Gran Reserva Cab Sauv", grupo: "Santa Ema Gran Reserva Cab Sauv", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema Gran Reserva Carmenere", grupo: "Santa Ema Gran Reserva Carmenere", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema Gran Reserva Merlot", grupo: "Santa Ema Gran Reserva Merlot", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema Gran Reserva Sauv Blanc", grupo: "Santa Ema Gran Reserva Sauv Blanc", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema Select Terroir Cab Sauv", grupo: "Santa Ema Select Terroir Cab Sauv", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema Select Terroir Chardonnay", grupo: "Santa Ema Select Terroir Chardonnay", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema Select Terroir Merlot", grupo: "Santa Ema Select Terroir Merlot", mL: null, marca: null, porCaja: "12" },
  { insumo: "Santa Ema Select Terroir Sauv Blanc", grupo: "Santa Ema Select Terroir Sauv Blanc", mL: null, marca: null, porCaja: "12" },
  { insumo: "Schwebbes Tonica", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Schwebbes Tonica Zero", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Skyy", grupo: "Skyy", mL: null, marca: null, porCaja: "12" },
  { insumo: "Somersby", grupo: "Somersby", mL: null, marca: null, porCaja: "24" },
  { insumo: "Sprite", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Sprite Zero", grupo: "Bebida", mL: null, marca: null, porCaja: "24" },
  { insumo: "Stolichnaya", grupo: "Stolichnaya", mL: null, marca: null, porCaja: "12" },
  { insumo: "Tanqueray", grupo: "Tanqueray", mL: null, marca: null, porCaja: "12" },
  { insumo: "Tanqueray Sevilla", grupo: "Tanqueray Sevilla", mL: null, marca: null, porCaja: "12" },
  { insumo: "Tanqueray Ten", grupo: "Tanqueray Ten", mL: null, marca: null, porCaja: "6" },
  { insumo: "Tequila Jose Cuervo", grupo: "Tequila Jose Cuervo", mL: null, marca: null, porCaja: "12" },
  { insumo: "Toro de Piedra Cab Sauv", grupo: "Toro de Piedra Cab Sauv", mL: null, marca: null, porCaja: "12" },
  { insumo: "Toro de Piedra Carmenere", grupo: "Toro de Piedra Carmenere", mL: null, marca: null, porCaja: "12" },
  { insumo: "Vaso", grupo: "Cristaleria", mL: null, marca: null, porCaja: "12" },
  { insumo: "W de Macul", grupo: "W de Macul", mL: null, marca: null, porCaja: "6" },
];

function toInt(v: string | null): number | null {
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  console.log(`→ Seeding ${RAW.length} insumos del catálogo FF&BB…`);
  let inserted = 0;
  let skipped = 0;
  for (const r of RAW) {
    const result = await db
      .insert(insumosCatalogo)
      .values({
        nombre: r.insumo,
        grupo: r.grupo,
        ml: toInt(r.mL),
        marca: r.marca,
        porCaja: toInt(r.porCaja),
      })
      .onConflictDoNothing({ target: insumosCatalogo.nombre })
      .returning({ id: insumosCatalogo.id });
    if (result.length > 0) {
      inserted += 1;
      console.log(`  ✓ ${r.insumo}`);
    } else {
      skipped += 1;
    }
  }
  console.log(`Done. Insertados: ${inserted} · Ya existían: ${skipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
