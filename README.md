# glovox-data

Proyecto interno de dashboards, reportes y herramientas operativas de GLOVOX.

## Relación con data-governance (leer primero)

Este repo **CONSUME** datos; el repo hermano `../data-governance` los **PRODUCE**. La app es **solo-lectura contra BigQuery** (proyecto `root-emissary-313321`): lee tablas del lake y las muestra. Toda ingesta (APIs → BigQuery) vive en `data-governance`, no aquí.

- **No escribas a BigQuery desde esta app.** Si un flujo necesita una tabla nueva o un cambio de schema en el lake, eso se hace en `data-governance` (ver [`../PLAYBOOK-GOBERNANZA-DATOS.md`](../PLAYBOOK-GOBERNANZA-DATOS.md)).
- Los dashboards leen una **mezcla** de tablas gobernadas (producidas por data-governance) y tablas legacy vivas (infra vieja). No rompas una tabla legacy sin confirmar quién la produce.
- El catálogo de gobernanza (`data/governance-catalog.json`) lo genera `data-governance`; la UI `/governance` (solo superadmin) lo refleja junto con la frescura viva de BigQuery. No edites ese JSON a mano.
- Escritura sí permitida a **Neon Postgres**: auth/permisos y datos operativos tipeados a mano (compras FFBB, proveedores, marcas). Ese es el rol de `db/` (Drizzle).

## Antes de editar

- Trabaja siempre sobre este proyecto principal; no uses worktrees ni archivos fuera del repo.
- Si modificas componentes de dashboard, lee primero [`docs/STYLE_DASHBOARD.md`](docs/STYLE_DASHBOARD.md).
- Este repo usa Next.js 16. Sus APIs pueden diferir de versiones anteriores: antes de cambiar routing, server actions, config, metadata o rendering, revisa la guía relevante en `node_modules/next/dist/docs/`.
- Respeta cambios existentes en el working tree. No reviertas archivos que no tocaste.
- Mantén los cambios acotados al flujo pedido; evita refactors laterales.

## Stack y comandos

- App: Next.js, React, TypeScript, Tailwind, server/client components.
- Datos: BigQuery, Postgres/Neon, Drizzle, Google Sheets y servicios externos puntuales.
- Instalación: `npm install`
- Desarrollo: `npm run dev` (puerto 3000). Si el 3000 está tomado por el repo hermano `glovox-operaciones`, usa `npm run dev -- --port 3100`; [`.claude/launch.json`](.claude/launch.json) trae ambas configuraciones (`dev` y `dev-3100`).
- Build: `npm run build`
- Lint: `npm run lint` — ⚠️ desde Next 16 `next build` ya **no** corre ESLint (`next lint` fue removido en favor del CLI de ESLint), así que hay que correrlo aparte: un build verde no garantiza lint limpio.
- Migraciones: `npm run db:generate`, `npm run db:migrate`, `npm run db:push`
- Seeds/scripts: revisa los comandos `db:*`, `bq:*` y `test:*` en [`package.json`](package.json).

## Entorno

Usa `.env.local` basado en [`.env.example`](.env.example). Variables habituales:

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
- `DATABASE_URL` o `POSTGRES_URL`
- `BIGQUERY_PROJECT_ID`, `BIGQUERY_SERVICE_ACCOUNT`
- `DASHBOARD_PERMISSIONS`
- `EVENTOS_SHEET_ID`, `EVENTOS_SHEET_RANGE`, `SHEETS_SERVICE_ACCOUNT`
- `MERCADOPAGO_ACCESS_TOKEN`
- `GOOGLE_GENERATIVE_AI_API_KEY`

No hagas commit de secretos ni credenciales reales.

## Estructura

- `app/`: rutas, layouts, server actions y API routes.
- `components/`: componentes compartidos y piezas de dashboard.
- `lib/`: servicios, queries, permisos, helpers y lógica de negocio.
- `db/`: schema, migraciones y scripts Drizzle.
- `docs/`: guías por dashboard, estilo visual, queries y análisis.

## Lineamientos de edición

- Prefiere patrones ya existentes en `app/`, `components/`, `lib/` y `db/`.
- Separa lógica de datos en `lib/queries` o servicios cuando el patrón ya exista.
- Valida inputs y permisos en server actions/API routes antes de tocar datos.
- ⚠️ **Negocios internos GLOVOX** (`area_negocio='GLOVOX'` en `marts.finanzas_*`: sueldos y gasto administrativo, flag `es_interno_glovox`): SOLO pueden mostrarse en `/interno`, su dashboard exclusivo de acceso restringido. NINGÚN otro dashboard, query o export debe incluirlos — toda query nueva sobre esas vistas filtra `NOT es_interno_glovox` (o `es_produccion_propia` / área explícita). Regla aplicada a todos los dashboards existentes el 20-jul-2026.
- Para cambios de schema, actualiza `db/schema.ts` y genera migración con Drizzle.
- Para UI, mantén densidad, jerarquía y lenguaje visual consistente con el dashboard afectado.
- Agrega o ejecuta pruebas/verificaciones proporcionales al riesgo: `npm run lint`, `npm run build` o scripts específicos. Los dos primeros no se sustituyen entre sí: el build no corre ESLint (ver "Stack y comandos").
- Si tocas datos externos, deja claro qué dataset, tabla, hoja o permiso requiere el flujo.

## Estándar de filtros

Todo filtro multi-selección de un dashboard usa [`components/filters/StandardMultiFilter.tsx`](components/filters/StandardMultiFilter.tsx) (buscador, checkboxes, "Seleccionar todos" y "Limpiar") y la lógica pura de [`lib/filters/`](lib/filters/). Es el único multi-select del proyecto: no crees otro; si un panel necesita algo distinto, extiende ese componente. El estilo está en [`docs/STYLE_DASHBOARD.md`](docs/STYLE_DASHBOARD.md) § FILTER CONTROLS.

Reglas (las mismas de Power BI, Looker, Metabase y Superset):

1. **Selección vacía = "Todos".** No existe el estado "ninguno": un filtro sin nada marcado no restringe.
2. **Un filtro nunca modifica a otro.** Cambiar o limpiar un filtro escribe solo su propia selección (su param de URL o su key de estado). Nada de resets en cascada, purgas ni `useEffect` que corrijan otro filtro.
3. **El encadenamiento acota las opciones, no las selecciones.** Cada dropdown muestra lo compatible con los otros filtros más lo ya seleccionado; lo seleccionado que quedó incompatible se ve atenuado (prop `available`) y nunca se borra. Si la combinación no deja resultados, muestra [`FilterConflictNotice`](components/filters/FilterConflictNotice.tsx) con un "Limpiar <filtro>" por cada faceta en conflicto. Nunca ocultes una faceta que tiene selección: el usuario tiene que poder limpiarla.
4. **El botón global "Limpiar filtros" vuelve al estado por defecto del dashboard.** Es el único control que toca varios filtros a la vez.

Piezas de `lib/filters/`:

- [`facetas.ts`](lib/filters/facetas.ts): cada filtro es una `Faceta<T>` (`key`, `valores(item)` que devuelve uno o varios valores, e `ignora` opcional para jerarquías de un solo sentido, padre → hijo). Con ellas usas `filtrar` (ítems que pasan todos los filtros), `disponibles` (valores compatibles por faceta), `opcionesVisibles` (opciones del dropdown: disponibles + seleccionadas) y `enConflicto` (facetas que chocan cuando nada calza).
- [`url.ts`](lib/filters/url.ts): `leerSeleccion`, `escribirSeleccion` y `reemplazarSeleccion` en el cliente (param repetido, `?eventos=GLO181&eventos=GLO213`; selección vacía = se borra el param), `normalizarSeleccion` (marcar el universo entero de una faceta se guarda como "Todos": filtra lo mismo y no arrastra listas de cientos de valores a la URL) y `valoresDeParam` en el servidor (`[]` = "Todos", sin condición en la query). Los links viejos con `__none__` se leen como "Todos".
- [`components/filters/useQueryFiltros.ts`](components/filters/useQueryFiltros.ts): hook de toda barra de filtros por URL. Devuelve `search` (el último cambio pedido aunque la navegación todavía no termine) y `navegar(qs)`. Arma siempre los cambios sobre ese `search`, nunca sobre `useSearchParams()` directo: si no, dos cambios seguidos se pisan mientras carga el servidor. El pedido pendiente se comparte entre todas las instancias de la misma ruta, así que dos controles separados de una página (un filtro y el switch neto/bruto, por ejemplo) pueden llamar cada uno a su propio `useQueryFiltros`.

Ejemplo mínimo con estado local:

```tsx
"use client";

import { useMemo, useState } from "react";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import FilterConflictNotice from "@/components/filters/FilterConflictNotice";
import {
  disponibles,
  enConflicto,
  filtrar,
  opcionesVisibles,
  type Faceta,
} from "@/lib/filters/facetas";

type Evento = { id: string; nombre: string; categoria: string };

const FACETAS: Faceta<Evento>[] = [
  { key: "categorias", valores: (e) => e.categoria },
  { key: "eventos", valores: (e) => e.id },
];
const LABEL: Record<string, string> = { categorias: "Categoría", eventos: "Evento" };

export default function EventosFiltros({ eventos }: { eventos: Evento[] }) {
  const [sel, setSel] = useState<Record<string, Set<string>>>({});
  // Regla 2: cada filtro escribe solo su propia key.
  const setFaceta = (key: string, next: Set<string>) =>
    setSel((prev) => ({ ...prev, [key]: next }));

  const disp = useMemo(() => disponibles(eventos, FACETAS, sel), [eventos, sel]);
  const filas = useMemo(() => filtrar(eventos, FACETAS, sel), [eventos, sel]);
  const conflictos = enConflicto(eventos, FACETAS, sel).map((key) => ({
    key,
    label: LABEL[key],
  }));

  const categorias = [...new Set(eventos.map((e) => e.categoria))].sort();
  const nombre = new Map(eventos.map((e) => [e.id, e.nombre]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <StandardMultiFilter
          label="Categoría"
          allLabel="Todas"
          options={opcionesVisibles(categorias, disp.categorias, sel.categorias).map((c) => ({
            value: c,
            label: c,
          }))}
          available={disp.categorias}
          selected={sel.categorias ?? new Set()}
          onChange={(next) => setFaceta("categorias", next)}
        />
        <StandardMultiFilter
          label="Evento"
          options={opcionesVisibles(
            eventos.map((e) => e.id),
            disp.eventos,
            sel.eventos,
          ).map((id) => ({ value: id, label: `${id} — ${nombre.get(id) ?? id}` }))}
          available={disp.eventos}
          selected={sel.eventos ?? new Set()}
          onChange={(next) => setFaceta("eventos", next)}
          searchPlaceholder="Buscar evento…"
        />
      </div>
      <FilterConflictNotice conflicts={conflictos} onClear={(key) => setFaceta(key, new Set())} />
      <p className="font-sans text-sm text-[var(--ink-muted)]">{filas.length} eventos</p>
    </div>
  );
}
```

Si los filtros viven en la URL, usa `useQueryFiltros`, lee cada filtro con `leerSeleccion` y haz que cada `onChange` reescriba solo su param:

```tsx
const { search, navegar } = useQueryFiltros("/mi-dashboard");
const sp = new URLSearchParams(search);
const sel = { categorias: leerSeleccion(sp, "categorias"), eventos: leerSeleccion(sp, "eventos") };

function setFaceta(param: string, next: Set<string>, universo: string[]) {
  // Solo este param; marcar el universo entero = "Todos".
  navegar(reemplazarSeleccion(search, param, normalizarSeleccion(next, universo)));
}

// Servidor (page.tsx)
const eventos = valoresDeParam((await searchParams).eventos); // [] = "Todos": sin condición
```

Casos reales: [`CurvasFilters.tsx`](components/marketing/CurvasFilters.tsx) y [`DemandaFilters.tsx`](components/ticketing/DemandaFilters.tsx) (URL), [`cierre-mensual/filters/FilterBar.tsx`](components/cierre-mensual/filters/FilterBar.tsx) (estado local con valor por defecto e `ignora`).

Los chequeos de `lib/filters/` corren con `npm run test:filtros`; agrega un caso ahí si cambias esa lógica.
