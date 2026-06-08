import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Tope defensivo: la matriz/detalle más grandes rondan las ~6k filas.
const MAX_ROWS = 100_000;
const MAX_COLS = 60;

const bodySchema = z.object({
  filename: z.string().min(1).max(120),
  sheetName: z.string().min(1).max(31).optional(),
  headers: z.array(z.string()).min(1).max(MAX_COLS),
  rows: z
    .array(z.array(z.union([z.string(), z.number(), z.null()])).max(MAX_COLS))
    .max(MAX_ROWS),
});

/** Nombre de hoja válido para Excel (sin \ / ? * [ ] :). */
function safeSheetName(name: string): string {
  const clean = name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31);
  return clean || "Datos";
}

/** Nombre de archivo seguro para el header Content-Disposition. */
function safeFilename(name: string): string {
  const base = name.replace(/[^\w.\-]+/g, "_").replace(/\.xlsx$/i, "");
  return `${base || "export"}.xlsx`;
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!canAccessPath(session.user.permissions ?? [], "/proveedor")) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { filename, headers, rows } = parsed;
  const sheetName = safeSheetName(parsed.sheetName ?? "Datos");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Glovox";
  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Encabezado
  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: "FF333333" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF0EFFE" },
  };
  headerRow.alignment = { vertical: "middle" };

  // Datos
  for (const r of rows) {
    const row = ws.addRow(r);
    row.eachCell((cell) => {
      if (typeof cell.value === "number") {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right" };
      }
    });
  }

  // Ancho de columnas: en base al header y a una muestra de celdas.
  headers.forEach((h, i) => {
    let max = h.length;
    for (let r = 0; r < Math.min(rows.length, 200); r++) {
      const v = rows[r]?.[i];
      const len = v == null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    ws.getColumn(i + 1).width = Math.min(48, Math.max(10, max + 2));
  });

  if (rows.length > 0) {
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(Buffer.from(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safeFilename(filename)}"`,
      "Cache-Control": "no-store",
    },
  });
}
