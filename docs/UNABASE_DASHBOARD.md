# Arquitectura y Detalles del Dashboard "Unabase" (Cierre Mensual)

Este documento es una referencia rápida para entender la estructura, origen de datos y visualizaciones del subproyecto Unabase dentro del repositorio.

El subproyecto funciona como un gran **Dashboard Analítico** para ver estados de resultados, ingresos, gastos y evolución de las áreas de negocio. 

El punto de entrada principal es `app/unabase/cierre-mensual/page.tsx`, el cual simplemente carga el componente central: `CierreMensualDashboard`.

---

## 1. Las Pestañas (Tabs) y sus Gráficos / Paneles

El dashboard se divide actualmente en **4 pestañas principales** (alojadas directamente en `components/unabase/CierreMensualDashboard.tsx`). 

### 🟦 Pestaña 1: "Negocios" (Nueva)
Muestra la salud financiera, metas y evolución centrada en el estado comercial de los negocios y áreas.
*   **"Resultado por área de negocio"**: Gráfico principal de resultados enfocado en negocios.
    *   *Componente:* `NegociosAreaResultChart.tsx`
*   **"Evolución de ingresos por área"**: Muestra la evolución temporal en base a los ingresos de negocios.
    *   *Componente:* `NegociosAreaEvolutionChart.tsx`
*   **Métricas de Metas (Grid de 4 paneles)**: Gráficos de barra/avance contra metas anuales específicas:
    *   *Producción de eventos propios* — meta $6.500M
    *   *Corporativos* — meta $1.000M
    *   *BTL* — meta $1.100M
    *   *Eventos de marca* — meta $1.000M
    *   *Componente unificado:* `NegociosAreaGoalChart.tsx`

### 🟩 Pestaña 2: "Resumen por área"
Muestra la salud financiera dividida por áreas generales.
*   **"Resultado por área de negocio"**: Muestra la rentabilidad de cada macro-área.
    *   *Componente:* `AreaResultChart.tsx`
*   **"Evolución de ingresos por área"**: Muestra cómo los ingresos crecen a través del tiempo, segmentados.
    *   *Componente:* `AreaIncomeEvolutionChart.tsx`

### 🟨 Pestaña 3: "Resumen ejecutivo"
Da la foto global y macro del estado actual. Contiene componentes de resumen (sin título explícito en la cabecera del panel) y gráficos específicos:
*   **Alertas y Tarjetas de Resumen**: Alertas de presupuesto excedido e indicadores rápidos (KPIs globales).
    *   *Componentes:* `AlertsPanel.tsx`, `SummaryCards.tsx`, `InsightsPanel.tsx`
*   **"Distribución por estado"**: Un gráfico circular tipo dona indicando cómo se distribuyen los proyectos (ej. Cerrado, En proceso, etc).
    *   *Componente:* `StatusDonutChart.tsx`
*   **"Evolución mensual — ingreso · gasto · presupuesto"**: Comparativo en el tiempo de las 3 métricas clave.
    *   *Componente:* `MonthlyEvolutionChart.tsx`
*   **Tabla Resumen de Negocios**: Una lista tipo tabla de todos los proyectos/negocios.
    *   *Componente:* `SummaryBusinessTable.tsx`
*   **"Resultado por negocio"**: Gráfico comparativo que muestra la rentabilidad individual de cada evento o proyecto.
    *   *Componente:* `BusinessResultChart.tsx`
*   **"Gasto por categoría"**: Gráfico que muestra cuánto porcentaje de presupuesto se va en cada categoría (ej. Producción, Talento, Marketing).
    *   *Componente:* `CategoryExpenseChart.tsx`

### 🟥 Pestaña 4: "Detalle de gasto"
Un drill-down específico y profundo en la estructura de costos.
*   **"Evolución de gasto por categoría"**: Curva histórica de dónde se gasta la plata.
    *   *Componente:* `CategoryEvolutionChart.tsx`
*   **"Matriz de gasto por categoría × evento"**: Una tabla cruzada (heatmap o matriz de celdas).
    *   *Filtro especial interno:* Botones para alternar entre "Total" y "Per cápita".
    *   *Componente:* `ExpenseMatrix.tsx`
*   **Tabla General de Gastos**: 
    *   *Componente:* `ExpenseTable.tsx`
*   **"Desglose por subcategoría"**: Matriz o gráfico específico de segundo nivel.
    *   *Filtro especial interno:* Dropdown "Categoría abierta" (Eliges una categoría mayor para ver sus subcategorías).
    *   *Componente:* `ExpenseSubcategoryMatrix.tsx`
*   **Tabla de Gastos por Subcategoría**:
    *   *Componente:* `ExpenseSubcategoryTable.tsx`

---

## 2. Los Filtros Globales y de Fechas

*   **Filtros Globales de Negocios:** El sistema global de filtros (proyectos, estatus) se aloja en `components/unabase/filters/FilterBar.tsx` (y se apoya en `MultiSelectFilter.tsx`). Este componente se ubica siempre en la parte superior y se aplica a las pestañas principales.
*   **Filtro por Rango de Fechas (`useDateFilter`):** Introducido en la pestaña de "Negocios", permite filtrar las tablas y gráficos por `dateStart` y `dateEnd` comparando contra la `fecha_asignacion` del negocio.

---

## 3. ¿De qué campos se alimentan los datos?

Todo el subproyecto usa una arquitectura de datos global apoyada en **React Context** y **Custom Hooks**. 
*   **Data Provider Global:** `components/unabase/context/DashboardContext.tsx`. Reparte variables como `businessRows`, `filteredRows`, `filteredExpenseRows` y los estados del filtro de fecha a las pestañas.
*   **Hook de Negocios Independiente:** `components/unabase/hooks/useNegociosData.ts`. Administra el fetching de la metadata de "negocios" específica para la nueva pestaña.
*   **Las Queries de Base de Datos:** Todo lo que nutre a este contexto se extrae desde **`lib/queries/unabase.ts`**. Las queries consumen datos cruzados sobre Negocios, Categorías de Gastos, Subcategorías, Ingresos y Presupuestos.

---

## 📌 Resumen de Rutas para pedir ediciones específicas:

Si necesitas editar un gráfico, cambiar un título o modificar un comportamiento, estos son los lugares exactos:

*   **Para la disposición de las pestañas (ahora son 4) o los Títulos principales de los cuadros:** `components/unabase/CierreMensualDashboard.tsx`
*   **Para la lógica y renderizado de la Pestaña "Negocios":** Revisar la función `NegociosTab()` dentro de `CierreMensualDashboard.tsx`.
*   **Para modificar los nuevos gráficos de metas (Goal Charts):** `components/unabase/charts/NegociosAreaGoalChart.tsx`
*   **Para cualquier gráfico en particular:** `components/unabase/charts/[NombreDelGrafico].tsx`
*   **Para editar las tablas de resumen:** `components/unabase/panels/[NombreDeLaTabla].tsx`
*   **Para el comportamiento del multiselect o filtros generales:** `components/unabase/filters/FilterBar.tsx`
*   **Para cambiar cómo se cruzan las bases de datos o extraer un dato nuevo:** `lib/queries/unabase.ts`, `components/unabase/hooks/useNegociosData.ts` y `components/unabase/context/DashboardContext.tsx`
