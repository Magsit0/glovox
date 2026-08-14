# Arquitectura y Detalles del Dashboard "Marketing"

Este documento es una referencia rápida para entender la estructura, origen de datos y visualizaciones del subproyecto de Marketing dentro del repositorio.

A diferencia del dashboard de Unabase (que es multipestaña y basado en contexto global), el dashboard de Marketing tiene una estructura de una sola página enfocada en el reporte y seguimiento semanal de eventos específicos, con un diseño "Brutalista".

El punto de entrada principal es `app/marketing/weekly/page.tsx`.

**Alcance de este documento:** cubre únicamente el dashboard `/marketing/weekly` ("VENTA DIARIA") — a eso apunta lo de "una sola página". El grupo MARKETING tiene además otros dashboards, cada uno con su propia ruta, queries y componentes. El más cercano a este es `/marketing/curvas` ("CURVAS DE VENTA", `app/marketing/curvas/page.tsx`), que compara la curva de compra acumulada de muchos eventos alineados por días de anticipación y sigue el manual de marca (`docs/STYLE_DASHBOARD.md`), no el diseño brutalista. Su contexto detallado vive en `app/marketing/curvas/CONTEXTO-PROMPT.md`.

---

## 1. Estructura de la Página y Paneles

El dashboard está diseñado en una cuadrícula con múltiples secciones o filas, cada una enfocada en un aspecto del rendimiento del evento seleccionado:

### 🎭 Selector de Eventos
*   Permite filtrar toda la página por un evento específico.
*   *Componente:* `EventSelector.tsx`

### 📊 Tira de KPIs (KPI Strip)
Un conjunto de 5 tarjetas rápidas que muestran métricas clave del evento:
*   **Tickets Vendidos:** Total vs Meta y porcentaje.
*   **Días para el Evento:** Cuenta regresiva.
*   **CPA Total Vendidos:** Costo Por Adquisición general.
*   **CPA Paid Media:** Costo Por Adquisición de medios pagados.
*   **Instagram Followers Δ:** Crecimiento o pérdida de seguidores.
*   *Componente:* `BrutalKpiCard.tsx`

### 📈 Venta Acumulada y Paid Media
Una fila dividida en dos grandes bloques:
*   **Venta Acumulada:** Gráfico que muestra la evolución de las ventas en el tiempo respecto a la meta y la fecha del evento.
    *   *Componente:* `charts/CumulativeSalesChart.tsx`
*   **Paid Media:** Un panel destacado con métricas textuales sobre la inversión publicitaria (Invertido, Budget, Ejecución, Compras por Pixel, Compras Puntoticket, CPA).
    *   *Componente:* `BrutalHighlightPanel.tsx`

### 🗺️ Origen de Venta y Funnel
*   **Origen de Venta:** Una tabla que detalla desde dónde provienen las ventas.
    *   *Componente:* `charts/SalesOriginTable.tsx`
*   **Funnel:** Gráfico de embudo que muestra la conversión a lo largo del flujo de compra.
    *   *Componente:* `charts/FunnelChart.tsx`

### 🎯 Desglose por Campaña
*   Gráfico que detalla el rendimiento o gasto segmentado por las diferentes campañas publicitarias en el tiempo.
    *   *Componente:* `charts/CampaignBreakdownChart.tsx`

### 🔗 Tráfico UTM
*   Tabla detallada que desglosa el tráfico web basándose en parámetros UTM (Source, Medium, Campaign, etc).
    *   *Componente:* `charts/UtmTrafficTable.tsx`

---

## 2. Componentes UI (Diseño Brutalista)

El dashboard hace uso intensivo de un sistema de diseño propio y llamativo ("Brutalista"), alojado en `components/marketing/`:
*   `BrutalChartPanel.tsx`: Contenedor base para los gráficos con bordes gruesos.
*   `BrutalHighlightPanel.tsx`: Contenedor para métricas destacadas.
*   `BrutalKpiCard.tsx`: Tarjetas individuales para la tira de KPIs.
*   `BrutalTable.tsx`: Estilo base para las tablas de datos.

---

## 3. ¿De qué campos se alimentan los datos?

A diferencia de Unabase, el dashboard de Marketing no usa un gran React Context global. Se apoya fuertemente en **Server Components** de Next.js, obteniendo los datos de forma asíncrona componente por componente usando Promesas (`Promise.all`).

*   **Consultas a Base de Datos:** Todas las queries de **este** dashboard (`/marketing/weekly`) están centralizadas en **`lib/queries/marketing.ts`**. El dashboard hermano `/marketing/curvas` NO usa ese archivo: sus consultas están en **`lib/queries/curvas.ts`** (`getCurvasEventOptions`, `getCurvasCompra`, `getCurvasTipoTicketOptions`) y toda la matemática de acumulado, agrupación, normalización y curva promedio en el módulo puro **`lib/marketing/curvas.ts`** (`buildCurvas`, `resumirCurvas`).
*   **Explicación detallada de las Queries en `lib/queries/marketing.ts`:**

    *   `getEventList`: Extrae todos los eventos agrupados, devolviendo el ID, nombre, categoría, fecha del evento y la cantidad total de tickets vendidos. Sirve para alimentar el selector principal.
    *   `getUpcomingEvents`: Similar a la anterior, pero filtra solo aquellos eventos cuya fecha es mayor o igual a la actual (`>= CURRENT_DATE()`), ordenados del más próximo al más lejano y sin tope de cantidad (la tira de accesos rápidos los muestra en una ventana de 3 con scroll). Ideal para accesos rápidos.
    *   `getTicketDateRange`: Calcula la "ventana de tiempo" activa de un evento. Busca la fecha del primer ticket vendido (`start_date`) y la fecha máxima actual para ventas (`end_date`).
    *   `getEventKpis`: Genera las métricas principales (KPI Strip) haciendo cruces entre las tablas de tickets, gastos en anuncios (`ADS`) y las metas de la categoría. Retorna ventas totales, ingresos, precio promedio, días restantes, CPA y porcentaje de ejecución del presupuesto.
    *   `getCumulativeSales`: Obtiene la evolución diaria de tickets vendidos y calcula la suma acumulada (`cumulative_tickets`) usando una función de ventana (`SUM() OVER`), lo que dibuja la curva de ventas históricas.
    *   `getPaidMediaSummary`: Consolida los resultados de marketing pago (Paid Media). Suma la inversión en `ADS`, cuenta las compras reportadas por el pixel publicitario, y cruza con la tabla de tickets para ver cuántos entraron referidos por pauta (`PM_%`). Calcula el CPA final.
    *   `getSalesOrigin`: Agrupa la cantidad de tickets y los ingresos según su origen (campo `Referido`). Por ejemplo, detecta ventas del "Club Glovox" cuando el referido empieza con `FF`.
    *   `getFollowersEvolution`: Entrega una serie de tiempo diaria indicando el total de seguidores y la variación diaria (`delta_followers`) de la cuenta de Instagram asociada al evento, durante su período de venta.
    *   `getFollowersDelta`: Suma todo el crecimiento o pérdida neta de seguidores en Instagram (`SUM(delta_followers)`) durante la ventana de tiempo del evento.
    *   `getClubSales` y `getClubMembersEvolution`: Consultas específicas para medir el impacto de la comunidad "Club Glovox". Miden ventas originadas desde el club y la evolución de nuevos usuarios registrados (`USERS`) durante el evento.
    *   `getSalesByCategory`: Agrupa y cuenta las ventas diarias segmentando por el tipo de ticket o categoría (ej. General, VIP).
    *   `getFunnelData`: Cruza los datos de Google Analytics 4 (`FUNNEL`) usando el `property_ga4` del evento. Obtiene cuántos usuarios hay en cada etapa del embudo de conversión (step_order).
    *   `getCampaignBreakdown`: Consulta a la tabla de `ADS` para desglosar el gasto y las compras diariamente según el nombre de la campaña y la plataforma (Meta, Google, etc.).
    *   `getUtmTraffic`: Extrae y agrega los datos de tráfico de GA4 (`UTM`), sumando sesiones, usuarios, vistas de página y calculando la tasa de rebote. Todo esto agrupado por Source, Medium, Content y Term durante las fechas del evento.

---

## 📌 Resumen de Rutas para pedir ediciones específicas:

*   **Para el orden de las secciones o agregar/quitar bloques:** `app/marketing/weekly/page.tsx`
*   **Para modificar el selector de eventos:** `components/marketing/EventSelector.tsx`
*   **Para la estética base (Bordes, sombras, tarjetas brutales):** Modificar los componentes en `components/marketing/` (ej. `BrutalChartPanel.tsx`).
*   **Para editar un gráfico o tabla específica:** Revisar dentro de `components/marketing/charts/`.
*   **Para cambiar las fuentes de datos, arreglar un cálculo o agregar un campo:** `lib/queries/marketing.ts`.
*   **Para el dashboard hermano "CURVAS DE VENTA" (`/marketing/curvas`):** página en `app/marketing/curvas/page.tsx`, filtros en `components/marketing/CurvasFilters.tsx`, gráfico en `components/marketing/charts/CurvasCompraChart.tsx`, queries en `lib/queries/curvas.ts` y el cálculo de las curvas en `lib/marketing/curvas.ts`. Comparte carpeta con los archivos de `/marketing/weekly` pero no comparte datos ni estética.
