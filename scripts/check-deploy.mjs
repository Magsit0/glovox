#!/usr/bin/env node
/**
 * Preflight de deploy: detecta lo que `npm run lint` y `npm run build` locales
 * NO pueden detectar, porque en tu máquina el problema no existe.
 *
 *  1. ERROR  Imports con ruta absoluta de una máquina (/Users/…, /home/…, C:\…)
 *            en cualquier .ts/.tsx/.mts/.js/.mjs/.cjs que viaje al deploy
 *            (trackeado o nuevo sin ignorar). Localmente resuelve; en el
 *            builder de Vercel da "Cannot find module". Los archivos ignorados
 *            por git los cubre la regla 2.
 *  2. ERROR  Archivos .ts/.tsx/.mts ignorados por git pero dentro del alcance de
 *            tsconfig (no cubiertos por su `exclude`). No viajan en un deploy por
 *            Git, pero `vercel --prod` desde el CLI SÍ los sube (no lee el
 *            .gitignore) y `next build` los tipea.
 *  3. AVISO  Archivos de código nuevos sin `git add`. Si el código commiteado los
 *            importa, el build local pasa y el deploy por Git falla con
 *            "Module not found".
 *
 * Uso: `npm run check:deploy` (también lo corre `npm run preflight`).
 * Sale con código 1 si hay errores; los avisos no cortan.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = process.cwd();

/** `git ls-files -z` entrega rutas crudas (UTF-8, con espacios) separadas por NUL. */
function gitFiles(args) {
  const out = execSync(`git ls-files -z ${args}`, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    maxBuffer: 64 * 1024 * 1024,
  });
  return out.split("\0").filter(Boolean);
}

const CODE = /\.(ts|tsx|mts|js|mjs|cjs)$/;
const TS = /\.(ts|tsx|mts)$/;
const SKIP_DIRS = /^(node_modules|\.next|\.vercel|\.git|out|build)\//;
const ABS_IMPORT =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s*)["'](\/Users\/|\/home\/|\/Volumes\/|[A-Za-z]:\\)/;

const visibles = gitFiles("--cached --others --exclude-standard").filter(
  (f) => !SKIP_DIRS.test(f),
);
const ignorados = gitFiles("--others --ignored --exclude-standard").filter(
  (f) => !SKIP_DIRS.test(f) && f !== "next-env.d.ts",
);
const sinAdd = gitFiles("--others --exclude-standard").filter(
  (f) => !SKIP_DIRS.test(f) && CODE.test(f),
);

const errores = [];
const avisos = [];

// 1. Imports absolutos de máquina en lo que viaja al deploy (trackeado o nuevo).
for (const f of visibles.filter((f) => CODE.test(f))) {
  let src;
  try {
    src = readFileSync(`${root}/${f}`, "utf8");
  } catch {
    continue;
  }
  const lineas = src.split("\n");
  lineas.forEach((linea, i) => {
    if (ABS_IMPORT.test(linea)) {
      errores.push(
        `${f}:${i + 1} importa una ruta absoluta de esta máquina. En Vercel no existe → "Cannot find module". Usa una ruta relativa/paquete, o saca el script del repo.`,
      );
    }
  });
}

// 2. .ts ignorados por git que tsconfig igual tipearía.
let exclude = ["node_modules"];
try {
  const tsconfig = JSON.parse(readFileSync(`${root}/tsconfig.json`, "utf8"));
  if (Array.isArray(tsconfig.exclude)) exclude = tsconfig.exclude;
} catch {
  avisos.push("No pude leer tsconfig.json; asumo exclude = [node_modules].");
}
const prefijos = exclude.map((e) =>
  e.replace(/^\.\//, "").replace(/\/\*\*(\/\*)?$/, "").replace(/\/$/, ""),
);
const cubierto = (f) => prefijos.some((p) => f === p || f.startsWith(`${p}/`));
for (const f of ignorados.filter((f) => TS.test(f) && !cubierto(f))) {
  errores.push(
    `${f} está ignorado por git pero tsconfig lo incluye: un \`vercel --prod\` desde el CLI lo sube y \`next build\` lo tipea. Agrega su carpeta a "exclude" en tsconfig.json y a .vercelignore, o muévelo fuera del repo.`,
  );
}

// 3. Código nuevo sin git add.
for (const f of sinAdd) {
  avisos.push(
    `${f} es nuevo y no está en git (falta \`git add\`). Si el código lo importa, el deploy por Git falla con "Module not found".`,
  );
}

for (const a of avisos) console.warn(`⚠ ${a}`);
for (const e of errores) console.error(`✗ ${e}`);

if (errores.length > 0) {
  console.error(`\ncheck:deploy — ${errores.length} error(es). El deploy fallaría en Vercel.`);
  process.exit(1);
}
console.log(
  `✓ check:deploy OK — ${visibles.length} archivos revisados, ${ignorados.length} locales ignorados` +
    (avisos.length ? `, ${avisos.length} aviso(s).` : "."),
);
