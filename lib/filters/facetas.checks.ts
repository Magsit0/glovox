/**
 * Chequeos de lib/filters/ (facetas.ts y url.ts) con casos cerrados.
 *   tsx lib/filters/facetas.checks.ts  (o `npm run test:filtros`)
 *
 * El primer caso es la regresión del 2026-11-12: limpiar un filtro borraba la
 * selección de los demás.
 */
import assert from "node:assert/strict";
import {
  calza,
  disponibles,
  enConflicto,
  filtrar,
  opcionesVisibles,
  type Faceta,
} from "./facetas";
import {
  NINGUNO_LEGADO,
  escribirSeleccion,
  leerSeleccion,
  normalizarSeleccion,
  reemplazarSeleccion,
  valoresDeParam,
} from "./url";

type Ev = { id: string; cat: string; temp: string; tipos: string[] };

const eventos: Ev[] = [
  { id: "GLO181", cat: "FDS", temp: "2025", tipos: ["General", "VIP"] },
  { id: "GLO213", cat: "FDS", temp: "2026", tipos: ["General"] },
  { id: "GLO200", cat: "Piknic", temp: "2026", tipos: ["General", "Happy"] },
];

const facetas: Faceta<Ev>[] = [
  { key: "categorias", valores: (e) => e.cat },
  { key: "temporadas", valores: (e) => e.temp },
  { key: "eventos", valores: (e) => e.id },
  { key: "tipos", valores: (e) => e.tipos },
];

const S = (...v: string[]) => new Set(v);
const ids = (list: Ev[]) => list.map((e) => e.id);

// 1. Regresión: Categoría = FDS, se limpia Evento (queda vacío = Todos).
//    Categoría sigue acotando y Evento ofrece los dos FDS.
{
  const sel = { categorias: S("FDS"), eventos: S() };
  assert.deepEqual(ids(filtrar(eventos, facetas, sel)), ["GLO181", "GLO213"]);
  const d = disponibles(eventos, facetas, sel);
  assert.deepEqual([...d.eventos], ["GLO181", "GLO213"]);
  assert.deepEqual([...d.categorias].sort(), ["FDS", "Piknic"]);
  assert.deepEqual(enConflicto(eventos, facetas, sel), []);
}

// 2. Vacío y ausente son lo mismo: sin restricción.
{
  assert.equal(filtrar(eventos, facetas, {}).length, 3);
  assert.equal(filtrar(eventos, facetas, { categorias: S(), tipos: S() }).length, 3);
  assert.ok(calza(eventos[0], facetas, { categorias: undefined }));
}

// 3. Encadenamiento en las dos direcciones, y la selección propia no se acota.
{
  const sel = { eventos: S("GLO200") };
  const d = disponibles(eventos, facetas, sel);
  assert.deepEqual([...d.categorias], ["Piknic"]);
  assert.deepEqual([...d.tipos].sort(), ["General", "Happy"]);
  assert.equal(d.eventos.size, 3);
}

// 4. Faceta multivaluada: calza si el evento tiene alguno de los elegidos.
{
  assert.deepEqual(ids(filtrar(eventos, facetas, { tipos: S("VIP", "Happy") })), [
    "GLO181",
    "GLO200",
  ]);
}

// 5. Un valor que queda incompatible NO se borra: sigue en la selección, deja
//    de estar disponible, y si nada calza se reporta el choque.
{
  const sel = { categorias: S("Piknic"), eventos: S("GLO181") };
  assert.equal(filtrar(eventos, facetas, sel).length, 0);
  assert.ok(!disponibles(eventos, facetas, sel).eventos.has("GLO181"));
  assert.deepEqual(enConflicto(eventos, facetas, sel).sort(), ["categorias", "eventos"]);
}

// 6. Incompatibilidad parcial: la intersección manda y no hay conflicto.
{
  const sel = { categorias: S("FDS"), eventos: S("GLO181", "GLO200") };
  assert.deepEqual(ids(filtrar(eventos, facetas, sel)), ["GLO181"]);
  assert.deepEqual(enConflicto(eventos, facetas, sel), []);
}

// 7. Choque de tres sin ninguna faceta aislada: se reportan todas las activas.
{
  const sel = { categorias: S("FDS"), temporadas: S("2026"), tipos: S("VIP") };
  assert.equal(filtrar(eventos, facetas, sel).length, 0);
  assert.deepEqual(enConflicto(eventos, facetas, sel).sort(), [
    "categorias",
    "temporadas",
    "tipos",
  ]);
}

// 8. Jerarquía padre → hijo: el padre ignora al hijo y conserva sus opciones.
{
  const jer: Faceta<Ev>[] = [
    { key: "categorias", valores: (e) => e.cat, ignora: ["eventos"] },
    { key: "eventos", valores: (e) => e.id },
  ];
  const d = disponibles(eventos, jer, { eventos: S("GLO200") });
  assert.deepEqual([...d.categorias].sort(), ["FDS", "Piknic"]);
}

// 9b. Opciones visibles: compatibles + seleccionadas (aunque no calcen), en el
//     orden del universo; lo seleccionado fuera del universo va al final.
{
  const sel = { categorias: S("Piknic"), eventos: S("GLO181", "GLO999") };
  const d = disponibles(eventos, facetas, sel);
  assert.deepEqual(
    opcionesVisibles(["GLO181", "GLO213", "GLO200"], d.eventos, sel.eventos),
    ["GLO181", "GLO200", "GLO999"],
  );
  assert.deepEqual(opcionesVisibles(["a", "b", "a"], new Set(["a", "b"]), undefined), ["a", "b"]);
}

// 9. URL: ausente = Todos; el centinela viejo y los vacíos se descartan.
{
  const sp = new URLSearchParams(`a=x&a=y&b=${NINGUNO_LEGADO}&c=`);
  assert.deepEqual([...leerSeleccion(sp, "a")], ["x", "y"]);
  assert.equal(leerSeleccion(sp, "b").size, 0);
  assert.equal(leerSeleccion(sp, "c").size, 0);
  assert.equal(leerSeleccion(sp, "z").size, 0);

  escribirSeleccion(sp, "a", S());
  assert.equal(sp.has("a"), false);
  escribirSeleccion(sp, "b", S("1", "2"));
  assert.deepEqual(sp.getAll("b"), ["1", "2"]);

  // Seleccionar el universo entero = Todos; cualquier subconjunto va tal cual.
  assert.deepEqual(normalizarSeleccion(S("a", "b", "c"), ["a", "b", "c"]), []);
  assert.deepEqual(normalizarSeleccion(S("a", "b"), ["a", "b", "c"]), ["a", "b"]);
  assert.deepEqual(normalizarSeleccion(S("a", "b", "c", "x"), ["a", "b", "c"]), []);
  assert.deepEqual(normalizarSeleccion(S("a"), []), ["a"]);
  assert.deepEqual(normalizarSeleccion(S(), ["a"]), []);

  // Reemplazar un filtro no toca los demás params.
  assert.equal(
    reemplazarSeleccion("tab=global&categorias=FDS&eventos=GLO181", "eventos", S()),
    "tab=global&categorias=FDS",
  );

  assert.deepEqual(valoresDeParam(undefined), []);
  assert.deepEqual(valoresDeParam(NINGUNO_LEGADO), []);
  assert.deepEqual(valoresDeParam(["x", "", NINGUNO_LEGADO]), ["x"]);
}

console.log("lib/filters: 10 grupos de chequeos OK");
