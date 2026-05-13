/**
 * One-shot: extrae las imágenes base64 del HTML original a archivos en public/
 * y emite el manifest que alimenta REPORT.galeria.
 *
 *   npx tsx scripts/extract-entel-the-grid-assets.ts
 *
 * Lee ENTEL_THE_GRID_SYSTEM.html, captura `const LOGO = '...'` y `const F1..F15 = '...'`
 * con regex acotado, decodifica el base64 y escribe:
 *   public/reports/entel-the-grid/logo.{ext}
 *   public/reports/entel-the-grid/gallery/01.jpg ... 15.jpg
 *   public/reports/entel-the-grid/hero/{1,2,3,4,5}.jpg   (subset: F1, F4, F7, F10, F13)
 *   public/reports/entel-the-grid/manifest.json
 *
 * Después actualiza el campo `galeria` en lib/reports/entel-the-grid/data.ts
 * con un find-and-replace puntual sobre la línea `"galeria": [],`.
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..");
const HTML_PATH = join(REPO_ROOT, "ENTEL_THE_GRID_SYSTEM.html");
const OUT_DIR = join(REPO_ROOT, "public/reports/entel-the-grid");
const DATA_PATH = join(REPO_ROOT, "lib/reports/entel-the-grid/data.ts");

const CAPTIONS = [
  "Activación Entel — punto de canje",
  "Distribución de vasos Entel",
  "Equipo en terreno",
  "Flujo de público",
  "Stand Entel en horario peak",
  "Operación general del evento",
  "Control de acceso al beneficio",
  "Activación en alta demanda",
  "Público participante",
  "Vista general — Espacio Riesco",
  "Canje de beneficio Entel",
  "Dinámica de activación",
  "Momento de entrega",
  "Guardarropía Entel",
  "Cierre de activación",
];

// Layout mapping del HTML: posiciones 0 y 9 son 'tall', 5 es 'wide'.
const LAYOUT: Record<number, "wide" | "tall" | undefined> = {
  0: "tall",
  5: "wide",
  9: "tall",
};

function extractDataUri(html: string, name: string): string | null {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*'(data:image\\/[a-z]+;base64,[^']+)'`);
  const m = html.match(re);
  return m ? m[1] : null;
}

function writeDataUri(uri: string, outPath: string) {
  const m = uri.match(/^data:image\/([a-z]+);base64,(.+)$/);
  if (!m) throw new Error(`Invalid data URI for ${outPath}`);
  const buf = Buffer.from(m[2], "base64");
  writeFileSync(outPath, buf);
}

function uriExt(uri: string): string {
  const m = uri.match(/^data:image\/([a-z]+);base64,/);
  if (!m) return "bin";
  // Algunos archivos arrancan con FFD8 (JPEG) aunque el MIME diga otra cosa.
  // Mantenemos el MIME declarado salvo que sea 'jpg' vs 'jpeg'.
  return m[1] === "jpeg" ? "jpg" : m[1];
}

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true });
}

function main() {
  const html = readFileSync(HTML_PATH, "utf8");

  ensureDir(OUT_DIR);
  ensureDir(join(OUT_DIR, "gallery"));
  ensureDir(join(OUT_DIR, "hero"));

  // Logo
  const logoUri = extractDataUri(html, "LOGO");
  if (!logoUri) throw new Error("LOGO data URI not found");
  const logoExt = uriExt(logoUri);
  const logoPath = join(OUT_DIR, `logo.${logoExt}`);
  writeDataUri(logoUri, logoPath);
  console.log(`✓ logo → /reports/entel-the-grid/logo.${logoExt}`);

  // Photos F1..F15
  const photos: { idx: number; src: string; caption: string; span?: "wide" | "tall" }[] = [];
  for (let i = 1; i <= 15; i++) {
    const uri = extractDataUri(html, `F${i}`);
    if (!uri) {
      console.warn(`! F${i} not found`);
      continue;
    }
    const ext = uriExt(uri);
    const fname = `${String(i).padStart(2, "0")}.${ext}`;
    writeDataUri(uri, join(OUT_DIR, "gallery", fname));
    photos.push({
      idx: i - 1,
      src: `/reports/entel-the-grid/gallery/${fname}`,
      caption: CAPTIONS[i - 1] ?? `Foto ${i}`,
      span: LAYOUT[i - 1],
    });
  }
  console.log(`✓ ${photos.length} gallery photos → /reports/entel-the-grid/gallery/`);

  // Hero subset: el HTML mostraba photos[0,3,6,9,12]
  const heroIdx = [0, 3, 6, 9, 12];
  heroIdx.forEach((sourceIdx, heroSlot) => {
    const p = photos.find((x) => x.idx === sourceIdx);
    if (!p) return;
    // Copiamos el binario decodificado tal cual.
    const uri = extractDataUri(html, `F${sourceIdx + 1}`);
    if (!uri) return;
    const ext = uriExt(uri);
    const heroPath = join(OUT_DIR, "hero", `${heroSlot + 1}.${ext}`);
    writeDataUri(uri, heroPath);
  });
  console.log(`✓ hero subset → /reports/entel-the-grid/hero/`);

  // Manifest
  const manifest = {
    logo: `/reports/entel-the-grid/logo.${logoExt}`,
    hero: heroIdx.map((sourceIdx, heroSlot) => {
      const uri = extractDataUri(html, `F${sourceIdx + 1}`);
      const ext = uri ? uriExt(uri) : "jpg";
      return `/reports/entel-the-grid/hero/${heroSlot + 1}.${ext}`;
    }),
    gallery: photos.map((p) => ({ src: p.src, caption: p.caption, ...(p.span ? { span: p.span } : {}) })),
  };
  writeFileSync(
    join(OUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );
  console.log(`✓ manifest → /reports/entel-the-grid/manifest.json`);

  // Patch data.ts: reemplaza la línea "galeria": [] por la galería real.
  const galeriaLiteral = JSON.stringify(manifest.gallery, null, 2)
    .split("\n")
    .map((line, i) => (i === 0 ? line : "  " + line))
    .join("\n");

  let dataTs = readFileSync(DATA_PATH, "utf8");
  const before = dataTs;
  dataTs = dataTs.replace(/"galeria":\s*\[\][^,}]*/, `"galeria": ${galeriaLiteral}`);

  if (dataTs === before) {
    console.warn(
      "! No pude parchear data.ts (no encontré `\"galeria\": []`). " +
        "Editar a mano o re-ejecutar el extractor de Excel primero.",
    );
  } else {
    writeFileSync(DATA_PATH, dataTs, "utf8");
    console.log(`✓ patched ${DATA_PATH} con galería (${photos.length} fotos)`);
  }
}

main();
