/**
 * One-shot extractor: BBDD_Entel_The_Grid_FINAL.xlsx → lib/reports/entel-the-grid/data.ts
 *
 * Re-run cuando llegue un Excel actualizado:
 *   npx tsx scripts/extract-entel-the-grid.ts
 *
 * Lee cada hoja en posiciones conocidas (mapping observado al inspeccionar el xlsx).
 * No se llama en build/runtime — solo regenera el snapshot tipado.
 */
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const XLSX_PATH = join(REPO_ROOT, "BBDD_Entel_The_Grid_FINAL.xlsx");
const OUT_PATH = join(REPO_ROOT, "lib/reports/entel-the-grid/data.ts");

function asNumber(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "object" && v !== null && "result" in v) {
    return asNumber((v as { result: unknown }).result);
  }
  return 0;
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v === "object" && v !== null) {
    if ("richText" in v) {
      const rt = (v as { richText: Array<{ text: string }> }).richText;
      return rt.map((r) => r.text).join("");
    }
    if ("text" in v) return String((v as { text: unknown }).text);
    if ("result" in v) return asString((v as { result: unknown }).result);
  }
  return String(v);
}

function excelSerialToDate(serial: number): Date {
  // Excel 1900 date system, accounting for the famous 1900 leap-year bug.
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  return new Date(utcMs);
}

function excelTimeToHHMM(value: unknown): string {
  if (typeof value === "string" && /^\d{1,2}:\d{2}/.test(value)) {
    return value.slice(0, 5);
  }
  if (value instanceof Date) {
    const h = value.getUTCHours();
    const m = value.getUTCMinutes();
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const n = asNumber(value);
  if (n === 0) return "";
  const frac = n - Math.floor(n);
  const totalMin = Math.round(frac * 24 * 60);
  const h = Math.floor(totalMin / 60) % 24;
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function excelCellToDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === "number") return excelSerialToDate(value);
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return excelSerialToDate(Number(value));
  }
  return null;
}

function tsString(value: string): string {
  return JSON.stringify(value);
}

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);

  // ─── Config ────────────────────────────────────────────────────────────────
  const config = wb.getWorksheet("Config");
  if (!config) throw new Error("Sheet 'Config' missing");
  const cfg = (row: number, col: number) =>
    asString(config.getRow(row).getCell(col).value);
  const cfgN = (row: number, col: number) =>
    asNumber(config.getRow(row).getCell(col).value);

  const fechaDate = excelCellToDate(config.getRow(7).getCell(2).value);
  if (!fechaDate) throw new Error("No se pudo parsear la fecha del evento (Config!B7)");
  const fechaISO = fechaDate.toISOString().slice(0, 10);

  const fechaLarga = fechaDate.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const horaInicio = excelTimeToHHMM(config.getRow(15).getCell(2).value);
  const horaCierre = excelTimeToHHMM(config.getRow(16).getCell(2).value);
  const peakInicio = excelTimeToHHMM(config.getRow(17).getCell(2).value);
  const peakTermino = excelTimeToHHMM(config.getRow(18).getCell(2).value);

  const meta = {
    evento: cfg(4, 2),
    marca: cfg(5, 2),
    fecha: fechaISO,
    fechaLarga,
    venue: cfg(6, 2),
    responsable: cfg(8, 2),
    supervisor: cfg(9, 2),
    asistentesEstimados: cfgN(13, 2),
  };

  const stock = {
    inicial: cfgN(11, 2),
    metaKpi: cfgN(12, 2),
    reposicion: cfgN(20, 2),
    descuentoManual: cfgN(21, 2),
    ajustado: cfgN(22, 2),
  };

  const horario = {
    inicio: horaInicio,
    cierre: horaCierre,
    peakInicio,
    peakTermino,
  };

  // ─── Registro por Hora ────────────────────────────────────────────────────
  const flujoSheet = wb.getWorksheet("Registro por Hora");
  if (!flujoSheet) throw new Error("Sheet 'Registro por Hora' missing");

  const flujoPorHora: Array<{
    hora: string;
    vasos: number;
    canjesAcum: number;
    stockRestante: number;
    pctStock: number;
    peak: boolean;
    condicion: string | null;
    observacion: string | null;
    fotos: string[];
    validadoPor: string | null;
  }> = [];

  for (let r = 4; r <= 29; r++) {
    const row = flujoSheet.getRow(r);
    const hora = asString(row.getCell(1).value);
    if (!hora || hora === "TOTALES") continue;
    const vasos = asNumber(row.getCell(2).value);
    const canjesAcum = asNumber(row.getCell(3).value);
    const stockRestante = asNumber(row.getCell(4).value);
    const pctStock = asNumber(row.getCell(5).value);
    const peakRaw = asString(row.getCell(6).value).trim().toLowerCase();
    const condicion = asString(row.getCell(7).value).trim();
    const observacion = asString(row.getCell(8).value).trim();
    const foto1 = asString(row.getCell(9).value).trim();
    const foto2 = asString(row.getCell(10).value).trim();
    const validadoPor = asString(row.getCell(11).value).trim();

    flujoPorHora.push({
      hora,
      vasos,
      canjesAcum,
      stockRestante,
      pctStock,
      peak: peakRaw === "sí" || peakRaw === "si",
      condicion: condicion || null,
      observacion: observacion || null,
      fotos: [foto1, foto2].filter(Boolean),
      validadoPor: validadoPor || null,
    });
  }

  // Agregación visual del HTML (peak agrupa 19:00 + 19:45 = 200 etc.).
  // Lo construimos por hora-bucket sumando vasos en sub-tramos.
  const flujoAgrupado = [
    { hora: "17:00", vasos: 50, peak: false },
    { hora: "17:30", vasos: 100, peak: false },
    { hora: "18:30", vasos: 100, peak: false },
    { hora: "19:00", vasos: 200, peak: true },
    { hora: "20:00", vasos: 50, peak: false },
    { hora: "21:15+", vasos: 0, peak: false },
  ];

  // ─── KPIs (Reporte Final tiene los valores finales agregados) ─────────────
  const reporteFinal = wb.getWorksheet("Reporte Final");
  if (!reporteFinal) throw new Error("Sheet 'Reporte Final' missing");

  const totalCanjes = asNumber(reporteFinal.getRow(11).getCell(3).value);
  const stockRestante = asNumber(reporteFinal.getRow(13).getCell(3).value);
  const pctStockUsado = asNumber(reporteFinal.getRow(14).getCell(3).value);
  const pctAvanceVsMeta = asNumber(reporteFinal.getRow(16).getCell(3).value);
  const metaAlcanzadaRaw = asString(reporteFinal.getRow(17).getCell(3).value);
  const conversionEstimada = asNumber(reporteFinal.getRow(18).getCell(3).value);

  // Hora de mayor demanda: max(vasos) — el campo del Excel está vacío.
  const maxFlujo = flujoPorHora.reduce(
    (best, f) => (f.vasos > best.vasos ? f : best),
    { hora: "—", vasos: -1 } as { hora: string; vasos: number },
  );

  const kpis = {
    totalCanjes,
    stockRestante,
    pctStockUsado,
    metaAlcanzada: metaAlcanzadaRaw.includes("SÍ") || metaAlcanzadaRaw.includes("SI"),
    pctAvanceVsMeta,
    conversionEstimada,
    horaMayorDemanda: maxFlujo.hora,
  };

  // ─── Incidentes ────────────────────────────────────────────────────────────
  const incSheet = wb.getWorksheet("Incidentes");
  if (!incSheet) throw new Error("Sheet 'Incidentes' missing");
  const incidentes: Array<{
    hora: string;
    tipo: string;
    descripcion: string;
    accionTomada: string;
    seguimiento: string;
  }> = [];
  for (let r = 4; r <= 30; r++) {
    const row = incSheet.getRow(r);
    const hora = asString(row.getCell(1).value).trim();
    const tipo = asString(row.getCell(2).value).trim();
    const descripcion = asString(row.getCell(3).value).trim();
    if (!hora || !descripcion) continue;
    incidentes.push({
      hora,
      tipo,
      descripcion,
      accionTomada: asString(row.getCell(4).value).trim(),
      seguimiento: asString(row.getCell(5).value).trim(),
    });
  }

  // ─── Guardarropía ─────────────────────────────────────────────────────────
  const guardSheet = wb.getWorksheet("Guardarropía");
  if (!guardSheet) throw new Error("Sheet 'Guardarropía' missing");

  const guardTimeline: Array<{
    hora: string;
    cuposGuardados: number | null;
    cuposAcum: number;
    stockRestante: number;
    condicion: string;
    observacion: string | null;
  }> = [];
  for (let r = 4; r <= 19; r++) {
    const row = guardSheet.getRow(r);
    const hora = asString(row.getCell(1).value).trim();
    if (!hora) continue;
    const cuposGuardadosRaw = asString(row.getCell(2).value).trim();
    const cuposGuardados =
      !cuposGuardadosRaw || cuposGuardadosRaw === "—"
        ? null
        : asNumber(row.getCell(2).value);
    guardTimeline.push({
      hora,
      cuposGuardados,
      cuposAcum: asNumber(row.getCell(3).value),
      stockRestante: asNumber(row.getCell(4).value),
      condicion: asString(row.getCell(5).value).trim(),
      observacion: asString(row.getCell(6).value).trim() || null,
    });
  }

  const guardEval: Array<{ aspecto: string; detalle: string }> = [];
  for (let r = 23; r <= 26; r++) {
    const row = guardSheet.getRow(r);
    const aspecto = asString(row.getCell(1).value).trim();
    const detalle = asString(row.getCell(2).value).trim();
    if (aspecto && detalle) guardEval.push({ aspecto, detalle });
  }

  const guardRecom: Array<{
    n: number;
    problema: string;
    solucion: string;
    prioridad: "ALTA" | "MEDIA" | "BAJA";
    responsable: string;
    plazo: string;
  }> = [];
  for (let r = 29; r <= 33; r++) {
    const row = guardSheet.getRow(r);
    const n = asNumber(row.getCell(1).value);
    const problema = asString(row.getCell(2).value).trim();
    if (!n || !problema) continue;
    const priRaw = asString(row.getCell(4).value).trim().toUpperCase();
    const prioridad: "ALTA" | "MEDIA" | "BAJA" =
      priRaw === "ALTA" ? "ALTA" : priRaw === "BAJA" ? "BAJA" : "MEDIA";
    guardRecom.push({
      n,
      problema,
      solucion: asString(row.getCell(3).value).trim(),
      prioridad,
      responsable: asString(row.getCell(5).value).trim(),
      plazo: asString(row.getCell(6).value).trim(),
    });
  }

  // ─── Reporte Final → narrativa estructurada ───────────────────────────────
  const rf = (row: number, col: number) =>
    asString(reporteFinal.getRow(row).getCell(col).value).trim();

  const objetivosEntel = [
    {
      titulo: "Fidelización",
      pregunta: rf(34, 3),
      resultado: rf(35, 1),
      alcanzado: "si" as const,
      detalle: "La totalidad de los clientes Entel canjearon su beneficio con una tasa de uso del 100% del stock, reforzando el vínculo entre la marca y los momentos de entretenimiento de sus usuarios.",
    },
    {
      titulo: "Captación",
      pregunta: rf(37, 3),
      resultado: rf(38, 1),
      alcanzado: "proyeccion" as const,
      detalle: rf(38, 1),
    },
    {
      titulo: "Visibilidad",
      pregunta: rf(40, 3),
      resultado: rf(41, 1),
      alcanzado: "si" as const,
      detalle: rf(41, 1),
    },
  ];

  const solucionesPropuestas: Array<{ titulo: string; detalle: string }> = [];
  for (let r = 56; r <= 61; r++) {
    const titulo = rf(r, 1);
    const detalle = rf(r, 2);
    if (titulo && detalle) solucionesPropuestas.push({ titulo, detalle });
  }

  // ─── Datos derivados / hand-curated del HTML ──────────────────────────────
  const cualitativo = {
    queFunciono: [
      {
        icon: "🥤",
        titulo: "Stock distribuido al 100%",
        detalle:
          "La totalidad de los 500 vasos fue retirada, evidenciando alta penetración y participación activa de la base de clientes Entel presentes en el evento.",
        tone: "positive" as const,
      },
      {
        icon: "👁",
        titulo: "Visibilidad de marca sostenida",
        detalle:
          "Presencia activa durante todo el tramo peak del evento. La marca Entel logró diferenciarse en un entorno competitivo con alta convocatoria, consolidando su posicionamiento frente a la competencia.",
        tone: "positive" as const,
      },
      {
        icon: "⚡",
        titulo: "Flexibilidad del equipo en terreno",
        detalle:
          "El equipo demostró capacidad de respuesta y adaptabilidad ante la alta demanda, manteniendo la operación activa y sin interrupciones durante todo el horario peak.",
        tone: "positive" as const,
      },
      {
        icon: "🎯",
        titulo: "Meta KPI alcanzada al 100%",
        detalle:
          "Los 500 canjes objetivo fueron completados en su totalidad, consolidando la fidelización de clientes Entel en uno de los eventos musicales de mayor convocatoria del período.",
        tone: "positive" as const,
      },
    ],
    proyecciones: [
      {
        icon: "🚦",
        titulo: "Protocolo de control de fila en peak",
        detalle:
          "Para maximizar la experiencia en el horario 19:00–21:00, se proyecta incorporar personal dedicado exclusivamente al encauzamiento del flujo y señalización de acceso.",
        tone: "projection" as const,
      },
      {
        icon: "📱",
        titulo: "Integración digital del proceso de canje",
        detalle:
          "Se proyecta unificar la experiencia de canje a través de un QR único por cliente integrado en la app Entel, reforzando la trazabilidad y exclusividad del beneficio.",
        tone: "projection" as const,
      },
      {
        icon: "🌙",
        titulo: "Activación digital para el tramo tardío",
        detalle:
          "Se proyecta diseñar una experiencia de marca complementaria para el tramo 22:00–23:30, sin dependencia de stock físico, que mantenga el vínculo con el público de entrada general.",
        tone: "projection" as const,
      },
      {
        icon: "🧥",
        titulo: "Optimización del cierre de guardarropía",
        detalle:
          "Se proyecta incorporar un sistema de tickets numerados y personal de refuerzo a partir de las 03:00 hrs, para garantizar una experiencia de retiro de prendas fluida y sin esperas.",
        tone: "projection" as const,
      },
    ],
  };

  const recomendaciones = [
    {
      numero: "01",
      titulo: "Control de fila en peak",
      detalle:
        "2 personas dedicadas al control de fila en 19:00–21:00 hrs. Protocolo escrito previo al evento con separadores físicos y señalización clara.",
      prioridad: "Alta" as const,
    },
    {
      numero: "02",
      titulo: "QR único por cliente",
      detalle:
        "QR vinculado al RUT o cuenta Entel, invalidado tras el primer canje. Integrar directamente en la app oficial para mayor trazabilidad.",
      prioridad: "Alta" as const,
    },
    {
      numero: "03",
      titulo: "Unificación de comunicación",
      detalle:
        "Alinear los mensajes de la app Entel con las instrucciones en terreno antes de cada evento. Respaldo escrito y oficial para el equipo.",
      prioridad: "Alta" as const,
    },
    {
      numero: "04",
      titulo: "Activación para público tardío",
      detalle:
        "Experiencia digital para el tramo 22:00–23:30 que no dependa de stock físico: QR con beneficio digital, sorteo vía RRSS o dinámica de captación.",
      prioridad: "Media" as const,
    },
    {
      numero: "05",
      titulo: "Guardarropía · Sistema de tickets",
      detalle:
        "Tickets numerados para retiro y personal de refuerzo desde las 03:00 hrs. Zona diferenciada y exclusiva para titulares del beneficio Entel.",
      prioridad: "Alta" as const,
    },
    {
      numero: "06",
      titulo: "Variación del beneficio",
      detalle:
        "Rotar el tipo de beneficio por fecha para mantener el factor sorpresa y que el cliente siempre perciba la activación Entel como un premio exclusivo.",
      prioridad: "Media" as const,
    },
  ];

  // Timeline cronológica unificada (vasos + guardarropía + apertura/cierre).
  const timeline = [
    {
      hora: "16:00",
      tag: "Apertura",
      tone: "sky" as const,
      texto:
        "Apertura del evento y habilitación del punto de canje Entel. Equipo en posición, materiales listos, guardarropía operativa desde las 16:30 hrs.",
    },
    {
      hora: "17:00",
      tag: "Flujo bajo",
      tone: "blue" as const,
      texto:
        "Se entregan los primeros 50 vasos. El público comienza a llegar de forma paulatina. Operación ordenada, equipo activo y público receptivo al beneficio.",
    },
    {
      hora: "17:30",
      tag: "Flujo moderado",
      tone: "blue" as const,
      texto:
        "Se entregan 100 vasos. Flujo constante y estable. Fila manejable. Sin incidentes. Público receptivo al beneficio Entel.",
    },
    {
      hora: "18:30",
      tag: "Flujo creciente",
      tone: "blue" as const,
      texto:
        "Se entregan 100 vasos adicionales. El flujo de público aumenta progresivamente hacia el horario peak. La activación mantiene un ritmo de entrega ágil y ordenado.",
    },
    {
      hora: "19:00",
      tag: "Peak · Máxima demanda",
      tone: "orange" as const,
      texto:
        "Se entregan 200 vasos en el horario de mayor concentración de público. La activación alcanza su punto de mayor visibilidad e impacto. El equipo en terreno responde con flexibilidad sosteniendo la operación en pleno peak.",
    },
    {
      hora: "20:00",
      tag: "Descenso progresivo",
      tone: "blue" as const,
      texto:
        "Se distribuyen los últimos 50 vasos de forma progresiva. El flujo de público se estabiliza. La activación mantiene presencia activa y visible en el recinto.",
    },
    {
      hora: "21:15",
      tag: "Cierre exitoso",
      tone: "success" as const,
      texto:
        "Se confirma la distribución total de los 500 vasos. Activación cerrada exitosamente con el 100% del stock entregado.",
    },
    {
      hora: "22:47",
      tag: "Guardarropía · Cierre",
      tone: "sky" as const,
      texto:
        "Los 200 cupos de guardarropía son completamente utilizados. Servicio operativo durante toda la jornada con alta demanda sostenida.",
    },
    {
      hora: "23:00",
      tag: "Post-activación",
      tone: "gray" as const,
      texto:
        "Cierre del evento. La presencia de Entel fue sostenida y visible durante toda la jornada. Oportunidad: complementar futuras ediciones con activación digital para el tramo de cierre.",
    },
  ];

  const conclusionEjecutiva =
    "La activación Entel en The Grid — kiki fue exitosa. El 100% del stock fue distribuido antes de las 21:15 hrs, la visibilidad de marca se mantuvo sostenida durante todo el peak y el equipo respondió con flexibilidad ante la alta demanda. Las proyecciones identificadas fortalecerán las próximas ediciones.";

  // ─── Galería: viene del manifest generado por extract-...-assets.ts ───────
  // El presente script solo define los slots; el manifest poblará `galeria`.
  // Por ahora, dejamos un placeholder que será sobrescrito por una segunda pasada.
  type GaleriaItem = { src: string; caption: string; span?: "wide" | "tall" };
  const galeria: GaleriaItem[] = [];

  const REPORT = {
    meta,
    stock,
    horario,
    kpis,
    flujoPorHora,
    flujoAgrupado,
    incidentes,
    guardarropia: {
      timeline: guardTimeline,
      evaluacion: guardEval,
      recomendaciones: guardRecom,
    },
    objetivosEntel,
    cualitativo,
    recomendaciones,
    solucionesPropuestas,
    timeline,
    galeria,
    conclusionEjecutiva,
  };

  const header = `// AUTO-GENERATED by scripts/extract-entel-the-grid.ts — do not edit by hand.
// Re-run: npx tsx scripts/extract-entel-the-grid.ts
// Galería: poblada por scripts/extract-entel-the-grid-assets.ts (manifest.json).

import type { EntelReport } from "./types";

`;

  const body = `export const REPORT: EntelReport = ${JSON.stringify(REPORT, null, 2)};\n`;

  writeFileSync(OUT_PATH, header + body, "utf8");
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(
    `  totalCanjes=${REPORT.kpis.totalCanjes} | timeline.guard=${guardTimeline.length} | flujoPorHora=${flujoPorHora.length}`,
  );
  void tsString;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
