# Arquitectura y Detalles del Dashboard "Cierre mensual"

Este documento es una referencia rápida para entender la estructura, origen de datos y visualizaciones del dashboard **Cierre mensual** dentro del repositorio.

> **Nota de nombre:** este dashboard antes se llamaba "Unabase". Se renombró a **Cierre mensual** (ruta `/cierre-mensual`, key `cierre-mensual`, componentes en `components/cierre-mensual/`). El nombre `unabase` que aún aparece en el código corresponde a la **fuente de datos** (tablas BigQuery `finanzas.unabase_*` y la capa compartida `lib/unabase/`), no a este dashboard.

Funciona como un gran **Dashboard Analítico** para ver estados de resultados, ingresos, gastos y evolución de las áreas de negocio.

El punto de entrada principal es `app/cierre-mensual/page.tsx`, el cual simplemente carga el componente central: `CierreMensualDashboard` (`components/cierre-mensual/CierreMensualDashboard.tsx`).

---

## 1. Las Pestañas (Tabs) y sus Gráficos / Paneles

El dashboard se divide en **4 pestañas principales** (definidas en la constante `TABS` dentro de `components/cierre-mensual/CierreMensualDashboard.tsx`).

### 🟦 Pestaña 1: "Resumen por área" (función `NegociosTab`)
Muestra la salud financiera, metas y evolución centrada en el estado comercial de las áreas de negocio. Incluye filtro por rango de fecha (`useDateFilter`, contra `fecha_asignacion`) y un multiselect de área.
*   **"Resultado por área de negocio"**: gráfico principal de resultados por área.
    *   *Componente:* `charts/NegociosAreaResultChart.tsx`
*   **"Evolución de ingresos por área"**: evolución temporal de ingresos (toggle Por mes / Por año).
    *   *Componente:* `charts/NegociosAreaEvolutionChart.tsx`
*   **Métricas de Metas (Grid de 4 paneles)**: avance contra metas anuales:
    *   *Producción de eventos propios* — meta $6.500M
    *   *Corporativos* — meta $1.000M
    *   *BTL* — meta $1.100M
    *   *Eventos de marca* — meta $1.000M
    *   *Componente unificado:* `charts/NegociosAreaGoalChart.tsx`

### 🟨 Pestaña 2: "Resumen ejecutivo"
Da la foto global y macro del estado actual.
*   **Alertas y Tarjetas de Resumen**: alertas de presupuesto excedido e indicadores rápidos (KPIs globales) más insights.
    *   *Componentes:* `panels/AlertsPanel.tsx`, `panels/SummaryCards.tsx`, `panels/InsightsPanel.tsx`
*   **"Distribución por estado"**: dona con la distribución de proyectos por estado.
    *   *Componente:* `charts/StatusDonutChart.tsx`
*   **"Evolución mensual — ingreso, gasto y presupuesto"**: comparativo en el tiempo de las 3 métricas clave.
    *   *Componente:* `charts/MonthlyEvolutionChart.tsx`
*   **Tabla Resumen de Negocios**: lista tipo tabla de todos los proyectos/negocios.
    *   *Componente:* `panels/SummaryBusinessTable.tsx`
*   **"Resultado por negocio"**: rentabilidad individual de cada evento o proyecto.
    *   *Componente:* `charts/BusinessResultChart.tsx`
*   **"Gasto por categoría"**: porcentaje de presupuesto por categoría (ej. Producción, Talento, Marketing).
    *   *Componente:* `charts/CategoryExpenseChart.tsx`

### 🟥 Pestaña 3: "Detalle de gasto"
Un drill-down específico y profundo en la estructura de costos.
*   **"Evolución de gasto por categoría"**: curva histórica del gasto.
    *   *Componente:* `charts/CategoryEvolutionChart.tsx`
*   **"Matriz de gasto por categoría × evento"**: tabla cruzada (heatmap / matriz de celdas).
    *   *Filtro interno:* botones para alternar entre "Total" y "Per cápita".
    *   *Componente:* `charts/ExpenseMatrix.tsx`
*   **Tabla General de Gastos**:
    *   *Componente:* `panels/ExpenseTable.tsx`
*   **"Desglose por subcategoría"**: matriz específica de segundo nivel.
    *   *Filtro interno:* dropdown "Categoría abierta" (eliges una categoría mayor para ver sus subcategorías).
    *   *Componente:* `charts/ExpenseSubcategoryMatrix.tsx`
*   **Tabla de Gastos por Subcategoría**:
    *   *Componente:* `panels/ExpenseSubcategoryTable.tsx`

### 🟩 Pestaña 4: "Análisis financiero" (componente `FinancieroTab`)
Aplica el método de análisis de estados financieros (análisis vertical, estado de resultados y devengo vs caja) a la data de cierres. Carpeta: `components/cierre-mensual/financiero/`.

**Regla temporal propia:** cada negocio se imputa al período de su **fecha de realización** (devengo); si falta, cae a la fecha de asignación (chip de advertencia). Helpers `resolveFechaFinanciera` y de períodos en `lib/unabase/dates.ts`. Toggle de granularidad Mes/Trimestre/Año compartido por las tres secciones.

*   **Estado de resultados** (KPIs + cascada + tabla por período): Ingresos → Gasto directo de eventos → Margen de contribución → **Gasto de estructura GLOVOX** → Resultado operacional.
    *   *Componente:* `financiero/EstadoResultadosSection.tsx`
    *   *Estructura:* total mensual del gasto interno (scope de `/interno`), **solo agregado y en neto, sin desglose** (dato sensible). Query `getEstructuraMensual` en `lib/queries/cierreMensual.ts` → `app/api/cierre-mensual/estructura/route.ts` → `hooks/useEstructuraData.ts`.
*   **Análisis vertical (% del ingreso)**: tabla common-size con heatmap; corte "Por período" / "Por área"; top-8 categorías de gasto + "Otras".
    *   *Componente:* `financiero/AnalisisVerticalSection.tsx`
*   **Devengo vs caja**: KPIs de ciclo (venta/facturado/cobrado/por cobrar + DSO proxy), gráfico apilado por período, aging del saldo por cobrar y top-10 saldos con link al cierre del negocio. Usa `negociosRows` restringido al alcance filtrado (join por `negocioIds`).
    *   *Componente:* `financiero/DevengoCajaSection.tsx`

---

## 2. Los Filtros Globales y de Fechas

*   **Filtros Globales de Negocios:** el sistema global de filtros (proyectos, estatus) se aloja en `components/cierre-mensual/filters/FilterBar.tsx` (apoyado en `MultiSelectFilter.tsx`). Se ubica en la parte superior y se aplica a las pestañas principales.
*   **Filtro por Rango de Fechas (`useDateFilter`):** usado en la pestaña "Resumen por área", permite filtrar tablas y gráficos por `dateStart` y `dateEnd` comparando contra la `fecha_asignacion` del negocio.

> **Primitivas compartidas:** `filters/MultiSelectFilter.tsx` y `charts/ChartTooltip.tsx` viven bajo `components/cierre-mensual/` pero también los reutilizan los dashboards de **ticketing** y **frees**.

---

## 3. ¿De qué campos se alimentan los datos?

Todo el dashboard usa una arquitectura de datos global apoyada en **React Context** y **Custom Hooks**.
*   **Data Provider Global:** `components/cierre-mensual/context/DashboardContext.tsx`. Reparte `businessRows`, `filteredRows`, `filteredExpenseRows` y los estados del filtro de fecha a las pestañas.
*   **Hooks de fetch:** `components/cierre-mensual/hooks/useNegociosData.ts` (fetch a `/api/cierre-mensual/negocios`) y `hooks/useDashboardData.ts` (fetch a `/api/cierre-mensual/data`).
*   **Las Queries de Base de Datos:** todo lo que nutre a este contexto se extrae desde **`lib/queries/cierreMensual.ts`** (consumido por las rutas API `app/api/cierre-mensual/*`). Las queries cruzan datos sobre Negocios, Categorías de Gastos, Subcategorías, Ingresos y Presupuestos.

> **Fuente de verdad `finanzas.unabase_*`:** `getCierreMensualRows` y `getNegociosRows` leen de `finanzas.unabase_negocios` (negocio + financieros) + `glovox.categoriaEvento` (metadata de evento: `EventoID` = primeros 6 chars de `referencia` en mayúscula, `CategoriaEvento/2`, `NombreGlovox`) + `ticketsAndAABB.cierreEventos` (`NombreID`, `totalAsistentes`). Los items vienen de `finanzas.unabase_negocio_items` (jerárquica: solo ítems hoja, subcategoría reconstruida vía `llaveSubCat`). Las columnas de salida se alias-an a los nombres antiguos que consume `lib/unabase/normalization.ts`. Mapeos clave: `ingreso_total_neto ← total_neto`, `ingreso/ingresoAPI ← total_facturado`, `clientePrincipal ← razon_cliente`, `fechaNegocio ← fecha_realizacion`, `estadocierre ← LOWER(closed_compras)`. **Pendiente:** `lib/queries/cierreTrimestral.ts` sigue leyendo del dataset legacy `unabase.negocios`.

---

## 📌 Resumen de Rutas para pedir ediciones específicas:

*   **Disposición de las pestañas o Títulos principales de los cuadros:** `components/cierre-mensual/CierreMensualDashboard.tsx`
*   **Lógica y renderizado de la Pestaña "Resumen por área":** función `NegociosTab()` dentro de `CierreMensualDashboard.tsx`.
*   **Gráficos de metas (Goal Charts):** `components/cierre-mensual/charts/NegociosAreaGoalChart.tsx`
*   **Cualquier gráfico en particular:** `components/cierre-mensual/charts/[NombreDelGrafico].tsx`
*   **Tablas de resumen:** `components/cierre-mensual/panels/[NombreDeLaTabla].tsx`
*   **Multiselect o filtros generales:** `components/cierre-mensual/filters/FilterBar.tsx`
*   **Cómo se cruzan las bases de datos o extraer un dato nuevo:** `lib/queries/cierreMensual.ts`, `components/cierre-mensual/hooks/useNegociosData.ts` y `components/cierre-mensual/context/DashboardContext.tsx`
