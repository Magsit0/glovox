import { NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import { getFfbbInsumos } from "@/lib/queries/ffbb";
import type { CompraInput } from "@/app/ffbb/actions";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Gemini puede tardar 10-30s con un PDF mediano

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por archivo
const SUPPORTED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Schema que el modelo DEBE respetar (generateObject lo fuerza con structured outputs).
const InvoiceItem = z.object({
  insumo: z
    .string()
    .describe(
      "Nombre del insumo. Si matchea con uno de la lista canónica, usar exactamente el nombre canónico. Si no, copiar el texto literal del ítem en la factura.",
    ),
  matchedToCanonical: z
    .boolean()
    .describe(
      "true si 'insumo' es uno de los nombres canónicos de la lista provista. false si es texto libre extraído del PDF.",
    ),
  recibido: z
    .number()
    .nullable()
    .describe(
      "Cantidad recibida TOTAL en unidades individuales (no en cajas/displays). Si la factura dice '12 displays x 24un', recibido=288. null si no aparece.",
    ),
  pedido: z.number().nullable().describe("Cantidad pedida si aparece distinta a la recibida; sino null."),
  costoUnitario: z.number().nullable().describe("Costo por unidad individual (CLP, sin signos)."),
  costoNeto: z.number().nullable().describe("Costo neto del ítem (subtotal sin IVA)."),
  iva: z.number().nullable().describe("IVA del ítem si aparece desglosado."),
  bruto: z.number().nullable().describe("Total bruto del ítem (neto + IVA)."),
  obs: z.string().nullable().describe("Cualquier observación que ayude a identificar el ítem (presentación, marca, etc)."),
});

const InvoiceExtraction = z.object({
  proveedor: z.string().nullable().describe("Razón social o nombre comercial del proveedor."),
  numeroFactura: z
    .string()
    .nullable()
    .describe("Número, folio o identificador del documento."),
  fechaCompra: z
    .string()
    .nullable()
    .describe(
      "Fecha del documento en formato YYYY-MM-DD. Si dice 'DD-MM-YYYY' convertir. null si no es legible.",
    ),
  items: z.array(InvoiceItem).describe("Cada línea de ítem facturada como una entrada."),
  notas: z
    .string()
    .nullable()
    .describe("Notas generales sobre el documento si hay algo raro o ambiguo."),
});

type Extraction = z.infer<typeof InvoiceExtraction>;

export type ExtractedRow = Partial<CompraInput> & {
  matchedToCanonical: boolean;
};

export interface ExtractResponse {
  ok: boolean;
  rows?: ExtractedRow[];
  meta?: {
    proveedor: string | null;
    numeroFactura: string | null;
    fechaCompra: string | null;
    notas: string | null;
    itemsTotal: number;
    itemsMatched: number;
  };
  error?: string;
}

export async function POST(request: Request): Promise<NextResponse<ExtractResponse>> {
  // -------------------- auth --------------------
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }
  if (!canAccessPath(session.user.permissions ?? [], "/ffbb")) {
    return NextResponse.json({ ok: false, error: "Sin permiso FF&BB" }, { status: 403 });
  }

  // -------------------- env check --------------------
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Falta GOOGLE_GENERATIVE_AI_API_KEY en .env.local. Sacala de https://aistudio.google.com/apikey",
      },
      { status: 500 },
    );
  }

  // -------------------- parse form --------------------
  let form: FormData;
  try {
    form = await request.formData();
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `No pude leer el form: ${err instanceof Error ? err.message : "error desconocido"}`,
      },
      { status: 400 },
    );
  }

  const file = form.get("file");
  const eventoId = String(form.get("eventoId") ?? "").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "Falta el archivo" }, { status: 400 });
  }
  if (!eventoId) {
    return NextResponse.json({ ok: false, error: "Falta eventoId" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ ok: false, error: "Archivo vacío" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Máximo ${MAX_BYTES / 1024 / 1024} MB.`,
      },
      { status: 413 },
    );
  }

  const mediaType = file.type || "application/pdf";
  if (!SUPPORTED_TYPES.has(mediaType)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Tipo de archivo no soportado: ${mediaType}. Subí un PDF o una imagen (JPG/PNG/HEIC/WEBP).`,
      },
      { status: 415 },
    );
  }

  // -------------------- read insumos canónicos --------------------
  let insumosCanonicos: string[] = [];
  try {
    insumosCanonicos = await getFfbbInsumos();
  } catch (err) {
    // No es fatal: seguimos sin lista canónica; todos los items quedan como "no listado"
    console.warn("No pude cargar insumos canónicos:", err);
  }

  // -------------------- read file --------------------
  const buffer = new Uint8Array(await file.arrayBuffer());

  // -------------------- prompt --------------------
  const systemPrompt = `Sos un asistente especializado en leer facturas y guías de despacho chilenas de proveedores de alimentos y bebidas para eventos.

Las facturas pueden ser:
- PDFs con texto digital limpio
- Escaneos de celular con perspectiva torcida, sombras, mala iluminación
- Fotos parciales o con doblez

Tu tarea: extraer cada ítem facturado como una fila estructurada según el schema.

═══════════════════════════════════════════════════════════
FORMATO DE NÚMEROS CHILENO (CRÍTICO — LA MAYORÍA DE TUS ERRORES PROVIENEN DE ESTO)
═══════════════════════════════════════════════════════════
- PUNTO (.) es separador de MILES. Ejemplos:
    "12.000"    = 12000  (doce mil)
    "5.647.056" = 5647056 (cinco millones seiscientos cuarenta y siete mil)
    "1.200"     = 1200 (mil doscientos)
- COMA (,) es separador DECIMAL. Ejemplos:
    "470,588"   = 470.588 (cuatrocientos setenta coma cinco ocho ocho)
    "39,22"     = 39.22

Es el sistema OPUESTO al de EEUU. NUNCA confundas: en Chile "1.000" siempre es mil, nunca uno.

═══════════════════════════════════════════════════════════
REGLAS DE EXTRACCIÓN (LEER, NO CALCULAR)
═══════════════════════════════════════════════════════════
1. "recibido" = LEÉ EXACTAMENTE la columna "Cantidad" (o "Cant.", "Cant", "Qty") de la factura.
   NO MULTIPLIQUES por nada.
   NO USES el código entre paréntesis "(Cod.XXXXX)" como factor — es código de catálogo del proveedor, NO es un multiplicador.
   Si la factura dice "Cant. 12.000", recibido = 12000.
   Solo aplicar la regla "displays × unidades" si la factura NO tiene una columna explícita de cantidad total y dice algo como "12 cajas de 24 unidades cada una" en texto libre.

2. "costoUnitario" = LEÉ EXACTAMENTE la columna "Precio" / "Precio Unit" / "P. Unit" de la factura.
   NUNCA calcules costoUnitario dividiendo total / cantidad. SIEMPRE leelo directamente.
   Si la factura dice "Precio 470,588", costoUnitario = 470.588.

3. "bruto" = LEÉ EXACTAMENTE la columna "Valor" / "Total" / "Subtotal" / "Bruto" de la factura.
   Si la factura dice "Valor 5.647.056", bruto = 5647056.

4. SANITY CHECK: cantidad × precio ≈ valor (tolerancia ~1%).
   Si no cuadra, RE-LEÉ los tres campos. Probablemente confundiste el formato chileno.
   Ejemplo de chequeo: 12000 × 470.588 = 5.647.056 ✓ (cuadra).
   Ejemplo de error: 12 × 470.588 = 5.647,06 (NO cuadra con 5.647.056 — la cantidad estaba mal).

5. "costoNeto" / "iva" son distintos a "bruto". Si la factura muestra solo el bruto por línea (afecto a IVA), dejá costoNeto e iva en null y completá solo bruto.

6. Fecha: convertir a YYYY-MM-DD. "29-08-2025" → "2025-08-29".

7. NO INVENTES. Si un campo no aparece o es ilegible, devolvé null.

═══════════════════════════════════════════════════════════
EJEMPLO COMPLETO (factura chilena típica)
═══════════════════════════════════════════════════════════
Si la línea dice:
  Código:      A-CS-448171
  Descripción: AGUA CACHANTUN SIN GAS 600 CC (Cod.00012)
  Cant.:       12.000
  Precio:      470,588
  Valor:       5.647.056

La extracción CORRECTA es:
{
  "insumo": "Agua",                 // matcheado contra lista canónica
  "matchedToCanonical": true,
  "recibido": 12000,                // ← LITERAL de "Cant.": 12.000 = doce mil
  "costoUnitario": 470.588,         // ← LITERAL de "Precio": 470,588 con coma decimal
  "costoNeto": null,                // ← no aparece desglosado
  "iva": null,                      // ← no aparece desglosado
  "bruto": 5647056,                 // ← LITERAL de "Valor": 5.647.056
  "obs": "Cachantún sin gas 600cc"  // ← detalle para distinguir presentación
}

Errores comunes que NO debés cometer:
❌ recibido: 144000  (NO multipliques 12.000 × 12 del código entre paréntesis)
❌ recibido: 12      (NO interpretes "12.000" como formato USA = 12)
❌ costoUnitario: 39.22  (NO calcules total/cantidad: leé la columna Precio directamente)

═══════════════════════════════════════════════════════════
MATCHING DE INSUMOS
═══════════════════════════════════════════════════════════
Lista canónica de insumos del sistema:
${insumosCanonicos.length > 0 ? insumosCanonicos.map((i) => `- ${i}`).join("\n") : "(lista vacía — todos los items serán matchedToCanonical=false)"}

Para cada ítem del PDF:
- Si claramente corresponde a uno de la lista, poné el NOMBRE EXACTO de la lista en "insumo" y matchedToCanonical=true.
  Ejemplo: "COCA COLA 350cc LATA" → si en la lista hay "Bebida", insumo="Bebida", matched=true.
  Ejemplo: "AGUA CACHANTUN SIN GAS" → si en la lista hay "Agua", insumo="Agua", matched=true.
- Distinguí variantes si la lista las tiene: "AGUA TONICA CANADA DRY" no es lo mismo que "AGUA SIN GAS". Si en la lista hay "Agua tónica", usá eso, no "Agua".
- Si NO matchea o estás dudando, poné el texto literal del PDF en "insumo" y matchedToCanonical=false.
- Mantenete conservador: ante la duda, matched=false.

En "obs" siempre incluí la presentación específica (con gas / sin gas / lata / botella / tamaño) para que el operador pueda distinguir filas que comparten el mismo insumo canónico.`;

  const userText = `Extraé las compras de este documento. EventoID asociado: ${eventoId} (no lo incluyas en cada item, lo agrego yo).`;

  // -------------------- call Gemini --------------------
  let extraction: Extraction;
  try {
    const result = await generateObject({
      model: google("gemini-2.5-flash"),
      schema: InvoiceExtraction,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: userText },
            { type: "file", data: buffer, mediaType },
          ],
        },
      ],
    });
    extraction = result.object;
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: `El modelo falló al procesar el archivo: ${err instanceof Error ? err.message : "error desconocido"}`,
      },
      { status: 502 },
    );
  }

  // -------------------- map a CompraInput[] --------------------
  const rows: ExtractedRow[] = extraction.items.map((item) => ({
    eventoId,
    insumo: item.insumo,
    matchedToCanonical: item.matchedToCanonical,
    numeroFactura: extraction.numeroFactura,
    proveedor: extraction.proveedor,
    fechaCompra: extraction.fechaCompra,
    recibido: item.recibido,
    pedido: item.pedido,
    tipoOperacion: "ingreso",
    costoUnitario: item.costoUnitario,
    costoNeto: item.costoNeto,
    iva: item.iva,
    bruto: item.bruto,
    obs: item.obs,
    // Campos sin info del LLM
    nPallets: null,
    nDisplay: null,
    xDisplay: null,
    sueltas: null,
    lugar: null,
  }));

  const itemsMatched = extraction.items.filter((i) => i.matchedToCanonical).length;

  return NextResponse.json({
    ok: true,
    rows,
    meta: {
      proveedor: extraction.proveedor,
      numeroFactura: extraction.numeroFactura,
      fechaCompra: extraction.fechaCompra,
      notas: extraction.notas,
      itemsTotal: extraction.items.length,
      itemsMatched,
    },
  });
}
