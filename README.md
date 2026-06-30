# glovox-data

Proyecto interno de dashboards, reportes y herramientas operativas de GLOVOX.

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
- Desarrollo: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`
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
- Para cambios de schema, actualiza `db/schema.ts` y genera migración con Drizzle.
- Para UI, mantén densidad, jerarquía y lenguaje visual consistente con el dashboard afectado.
- Agrega o ejecuta pruebas/verificaciones proporcionales al riesgo: `npm run lint`, `npm run build` o scripts específicos.
- Si tocas datos externos, deja claro qué dataset, tabla, hoja o permiso requiere el flujo.

## Estándar de filtros

Todo filtro nuevo en dashboards debe tener tres elementos:

1. **Buscador**: input que filtra opciones por texto, sub-string y case-insensitive.
2. **Multiselector**: selección múltiple con checkboxes; conjunto vacío = "Todos".
3. **Limpiador**: botón "Limpiar" que vacía la selección.

Por defecto reutiliza [`components/onepager/MultiFilter.tsx`](components/onepager/MultiFilter.tsx):

```tsx
import { useState } from "react";
import MultiFilter from "@/components/onepager/MultiFilter";

const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

<MultiFilter
  label="Categoría"
  options={opcionesUnicasYOrdenadas}
  selected={seleccion}
  onChange={setSeleccion}
  searchPlaceholder="Buscar categoría..."
/>;
```

Para filtros en cascada, deriva las `options` del segundo filtro desde la selección del primero. Ver [`FfbbDetalleTable.tsx`](components/onepager/FfbbDetalleTable.tsx) y [`FfbbEvolucionChart.tsx`](components/onepager/FfbbEvolucionChart.tsx).

Si un panel necesita otro look, igual debe cumplir buscador, multiselección y limpiador, salvo que haya una razón explícita documentada en el cambio.
