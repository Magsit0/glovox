/**
 * Carga masiva de ingresos de marca / medios desde un CSV, reusando la misma
 * lógica que el formulario del one-pager (upsert facturador → marca_cliente →
 * ingreso por (evento, cliente)). Pensado para el backfill de la hoja
 * "Auspicio 2025-2026" sin tipear celda por celda.
 *
 * Uso:
 *   dotenv -e .env.local -- tsx scripts/import-marca-ingresos.ts <archivo.csv> [--commit]
 *
 * Sin --commit corre en DRY-RUN: no escribe nada, sólo loguea qué haría.
 *
 * Formato del CSV (encabezado obligatorio, en cualquier orden):
 *   tabla,evento_id,marca,rut,razon_social,monto_neto
 * - tabla: "marca" (fee de auspicio → marca_ingresos) | "medios" (plan de
 *   medios → medios_ingresos; además marca la marca con tiene_plan_medios=true).
 * - evento_id: EventoID de BigQuery (ej. GLO190). Debe existir el evento.
 * - marca: nombre de la marca (UNIQUE en marca_clientes).
 * - rut / razon_social: del facturador. Si el RUT ya existe se reusa su razón
 *   social; si la marca ya existe se reusa su ficha (rut/razon se ignoran).
 * - monto_neto: entero CLP (acepta "$1.234.567" o "1234567"). <=0 se ignora.
 *
 * El bruto se deriva del neto + IVA 19% (lib/constants/tax.ts), igual que la UI.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  marcaClientes,
  marcaFacturadores,
  marcaIngresos,
  mediosIngresos,
} from "@/db/schema";
import { netoToBruto } from "@/lib/constants/tax";
import { isValidRut, normalizeRut } from "@/lib/utils/rut";

type Tabla = "marca" | "medios";
interface Row {
  tabla: Tabla;
  eventoId: string;
  marca: string;
  rut: string;
  razonSocial: string;
  montoNeto: number;
  line: number;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function money(v: string): number {
  const n = Number((v || "").replace(/[$\s.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function fmt(n: number): string {
  return "$" + n.toLocaleString("es-CL");
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes("--commit");
  const csvArg = args.find((a) => !a.startsWith("--"));
  if (!csvArg) {
    console.error("Falta el archivo CSV. Uso: tsx scripts/import-marca-ingresos.ts <csv> [--commit]");
    process.exit(1);
  }
  const csvPath = path.resolve(process.cwd(), csvArg);
  const raw = fs.readFileSync(csvPath, "utf8").replace(/\r/g, "");
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const idx = {
    tabla: col("tabla"),
    eventoId: col("evento_id"),
    marca: col("marca"),
    rut: col("rut"),
    razon: col("razon_social"),
    neto: col("monto_neto"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v < 0) {
      console.error(`El CSV no tiene la columna requerida: ${k}`);
      process.exit(1);
    }
  }

  const rows: Row[] = [];
  const errors: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = parseCsvLine(lines[i]);
    const tabla = (c[idx.tabla] || "").trim().toLowerCase();
    const marca = (c[idx.marca] || "").trim();
    const eventoId = (c[idx.eventoId] || "").trim();
    const rawRut = (c[idx.rut] || "").trim();
    const razonSocial = (c[idx.razon] || "").trim();
    const montoNeto = money(c[idx.neto] || "");
    if (!marca && !eventoId) continue; // fila vacía
    if (tabla !== "marca" && tabla !== "medios") {
      errors.push(`L${i + 1}: tabla inválida "${tabla}" (marca|medios)`);
      continue;
    }
    if (!eventoId) { errors.push(`L${i + 1}: falta evento_id (${marca})`); continue; }
    if (!marca) { errors.push(`L${i + 1}: falta marca`); continue; }
    if (montoNeto <= 0) continue; // nada que imputar
    const norm = normalizeRut(rawRut);
    if (!norm || !isValidRut(norm)) {
      errors.push(`L${i + 1}: RUT inválido "${rawRut}" (${marca})`);
      continue;
    }
    if (!razonSocial) { errors.push(`L${i + 1}: falta razon_social (${marca})`); continue; }
    rows.push({
      tabla: tabla as Tabla,
      eventoId,
      marca,
      rut: norm,
      razonSocial,
      montoNeto,
      line: i + 1,
    });
  }

  const totNeto = rows.reduce((a, r) => a + r.montoNeto, 0);
  const byTabla = { marca: 0, medios: 0 } as Record<Tabla, number>;
  for (const r of rows) byTabla[r.tabla] += r.montoNeto;
  console.log(`\n${commit ? "COMMIT" : "DRY-RUN"} · ${csvArg}`);
  console.log(`Filas válidas: ${rows.length} · neto total: ${fmt(totNeto)}`);
  console.log(`  marca_ingresos: ${fmt(byTabla.marca)} · medios_ingresos: ${fmt(byTabla.medios)}`);
  if (errors.length) {
    console.log(`\n${errors.length} fila(s) con problemas (se omiten):`);
    for (const e of errors) console.log("  ⚠ " + e);
  }
  if (rows.length === 0) {
    console.log("\nNada que cargar.");
    await closeDb();
    return;
  }

  if (!commit) {
    console.log("\n[dry-run] No se escribió nada. Reejecutá con --commit para persistir.");
    await closeDb();
    return;
  }

  let facturadoresNuevos = 0;
  let clientesNuevos = 0;
  let escritas = 0;

  for (const r of rows) {
    // 1. Facturador por RUT (reusa si existe).
    let facturadorId: string;
    const [fx] = await db
      .select({ id: marcaFacturadores.id })
      .from(marcaFacturadores)
      .where(eq(marcaFacturadores.rut, r.rut))
      .limit(1);
    if (fx) {
      facturadorId = fx.id;
    } else {
      const [created] = await db
        .insert(marcaFacturadores)
        .values({ rut: r.rut, razonSocial: r.razonSocial })
        .returning({ id: marcaFacturadores.id });
      facturadorId = created.id;
      facturadoresNuevos++;
    }

    // 2. Marca por nombre (reusa si existe). Si es medios, marca el flag.
    const [existing] = await db
      .select({ id: marcaClientes.id, nombre: marcaClientes.nombre })
      .from(marcaClientes)
      .where(eq(marcaClientes.nombre, r.marca))
      .limit(1);
    let clienteId: string;
    if (existing) {
      clienteId = existing.id;
      if (r.tabla === "medios") {
        await db
          .update(marcaClientes)
          .set({ tienePlanMedios: true, updatedAt: new Date() })
          .where(eq(marcaClientes.id, clienteId));
      }
    } else {
      const [created] = await db
        .insert(marcaClientes)
        .values({
          nombre: r.marca,
          facturadorId,
          tienePlanMedios: r.tabla === "medios",
        })
        .returning({ id: marcaClientes.id });
      clienteId = created.id;
      clientesNuevos++;
    }

    // 3. Upsert del ingreso (delete-then-insert por par).
    const target = r.tabla === "marca" ? marcaIngresos : mediosIngresos;
    const montoBruto = netoToBruto(r.montoNeto);
    await db.transaction(async (tx) => {
      await tx
        .delete(target)
        .where(and(eq(target.eventoId, r.eventoId), eq(target.clienteId, clienteId)));
      await tx.insert(target).values({
        eventoId: r.eventoId,
        clienteId,
        rutCliente: r.rut,
        cliente: r.marca,
        montoNeto: r.montoNeto,
        montoBruto,
      });
    });
    escritas++;
  }

  console.log(
    `\n✓ Escritas ${escritas} celdas · facturadores nuevos: ${facturadoresNuevos} · marcas nuevas: ${clientesNuevos}`,
  );
  await closeDb();
}

async function closeDb() {
  // El pool serverless de Neon no expone end() acá; el proceso termina solo.
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
