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
*   **Paid Media:** Un panel destacado con métricas textuales sobre la inversión publicitaria (Invertido, Budget, Ejecución, Compras por Pixel, Compras Puntoticket, CPA). Bajo el CPA, cuando el evento tiene medición GA4, un link "Compara con GA4 y Referido ↓" baja a la sección de atribución.
    *   *Componente:* `BrutalHighlightPanel.tsx`

### 🧾 Atribución de compras (GA4)
Sección de ancho completo entre "Venta Acumulada / Paid Media" y "Origen de Venta / Funnel" (ancla `#atribucion-compras`), con su propia ventana: **solo el período en que GA4 registra las compras con su número de orden** (no la ventana de venta del resto de la página) y solo órdenes del checkout web (Internet/marketplace, sin boletería, invitaciones, gratis ni pases de temporada). Aplica el scope de país.
*   **Cabecera:** chips con la ventana medida, las órdenes web medidas y la fecha de carga de GA4 (en rojo, "GA4 atrasado", si el último día cargado es anterior a anteayer en Santiago). Si GA4 mide solo parte de la venta (estado `parcial`), un aviso amarillo lo dice.
*   **Fila 1:**
    *   **Paid Media · compras por lente:** Pixel Meta (solo campañas de Ventas), GA4 último clic y Referido (PM_MT / PM_GG), cada uno con su CPA. El CPA de Meta usa el gasto de las campañas Meta de Ventas (`OUTCOME_SALES`) en la ventana; el resto del gasto Meta se muestra aparte ("Cobertura y otros objetivos"). Google usa todo su gasto. El CPA por Referido se oculta si menos del 8% de las órdenes trae código PM_.
    *   **Origen real de la venta:** un canal por orden (manda GA4; si GA4 no la vio o la vio como directa, sin canal o desde la pasarela, decide el Referido del link), barra de cobertura, fila Total y CSV. Los códigos FF aparecen como "Vendedores (ref)" (en "Origen de Venta" son Club Glovox). Los Referido "(not set)" / "(not provided)" que escribe Fever cuentan como vacíos, no como código. La venta va en la moneda del evento (CLP, o soles en los eventos de Perú, según `categoriaEvento.Pais`).
    *   **Salud de la medición:** % de órdenes web que GA4 ve, alertas de corte (un día con 10 o más órdenes y 0 vistas; después del primer día del evento se informa sin culpar al tag, porque esas ventas suelen ir por el portal de la ticketera o la entrada) o caída (últimos 3 días 15 pp o más bajo el resto), cobertura diaria (el último día cargado es provisional) y por medio de pago.
*   **Fila 2:**
    *   **Compras por día y canal:** barras apiladas de órdenes web medidas por día (`DATE(FechaOrden)`, como el resto de la página) con los 5 canales principales, "Otros canales" y "Sin origen conocido"; cada canal conserva su color entre eventos (todos los canales que emite el SQL tienen color fijo). El último día cargado se ve tenue (provisional).
    *   **Qué contenido vende:** sesiones UTM y órdenes GA4 por source/medium/content/term, con conversión y venta (top 15; CSV completo). El canal es el de las etiquetas UTM manuales, así que no coincide uno a uno con "Origen real" (el directo aparece como "(not set)").
*   **Fila 3 — Rendimiento por conjunto (Meta):** campaña, conjunto, objetivo, gasto, pixel, órdenes GA4 y los dos CPA (pixel y GA4) por adset, fila "Total (todos los objetivos)" sin CPA (incluye Cobertura; el CPA del evento es el de las lentes), pie con las órdenes Meta en GA4 sin conjunto identificado, y CSV.
*   Sin medición (evento sin órdenes, sin propiedad GA4, sin tracking o sin días medidos) muestra una sola línea que explica por qué. Un error de BigQuery deja un mensaje dentro de la sección y no tumba la página.
    *   *Componentes:* `atribucion/AtribucionSection.tsx` (datos) → `atribucion/AtribucionVista.tsx` (vista), `LentesPaidMedia`, `OrigenRealTable`, `SaludMedicion`, `ComprasDiaCanalChart`, `ContenidosTable`, `ConjuntosMetaTable`, `ui.tsx`; CSV en `csvExports.ts` (`buildOrigenRealCsv`, `buildContenidosCsv`, `buildConjuntosCsv`)

### 🗺️ Origen de Venta y Funnel
*   **Origen de Venta:** Una tabla que detalla desde dónde provienen las ventas.
    *   *Componente:* `charts/SalesOriginTable.tsx`
*   **Funnel:** Gráfico de embudo que muestra la conversión a lo largo del flujo de compra. El selector "Toda la venta | Desde medición GA4" (`?funnelVentana=ga4`) aparece solo si el evento tiene ventana medida (se resuelve junto con el gráfico, sin empujarlo; con `?funnelVentana=ga4` en un evento sin ventana, el funnel muestra toda la venta con una nota que explica por qué). En "Desde medición GA4" los pasos se recortan a la ventana medida y se agrega el paso "Compran (órdenes GA4)"; ese paso se oculta con un filtro de landing activo, y si el evento no tiene landings mapeadas una nota avisa que se cuenta toda la propiedad GA4. Los pasos del funnel (en ambos modos) no aplican el scope de país; el paso Compran sí.
    *   *Componentes:* `charts/FunnelChart.tsx`, `FunnelVentanaToggle.tsx`

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

*   **Consultas a Base de Datos:** Todas las queries de **este** dashboard (`/marketing/weekly`) están centralizadas en **`lib/queries/marketing.ts`**. El dashboard hermano `/marketing/curvas` NO usa ese archivo: sus consultas están en **`lib/queries/curvas.ts`** (`getCurvasEventOptions`, `getCurvasCompra`, `getCurvasTipoTicketMap`) y todo el cálculo en dos módulos puros: **`lib/marketing/curvas.ts`** (`buildCurvas`, `resumirCurvas` — acumulado, agrupación, normalización y curva promedio) y **`lib/marketing/curvasFacetas.ts`** (encadenamiento bidireccional de los filtros y purga de selecciones huérfanas).
*   **Explicación detallada de las Queries en `lib/queries/marketing.ts`:**

    *   `getEventList`: Extrae todos los eventos agrupados, devolviendo el ID, nombre, categoría, fecha del evento y la cantidad total de tickets vendidos. Sirve para alimentar el selector principal.
    *   `getUpcomingEvents`: Similar a la anterior, pero filtra solo aquellos eventos cuya fecha es mayor o igual a la actual (`>= CURRENT_DATE()`), ordenados del más próximo al más lejano y sin tope de cantidad (la tira de accesos rápidos los muestra en una ventana de 3 con scroll). Ideal para accesos rápidos.
    *   `getTicketDateRange`: Calcula la "ventana de tiempo" activa de un evento. Busca la fecha del primer ticket vendido (`start_date`) y la fecha máxima actual para ventas (`end_date`).
    *   `getEventKpis`: Genera las métricas principales (KPI Strip) haciendo cruces entre las tablas de tickets, gastos en anuncios (`ADS`) y las metas de la categoría. Retorna ventas totales, ingresos, precio promedio, días restantes, CPA y porcentaje de ejecución del presupuesto. Va envuelta en `React.cache` (por request): varias secciones la piden y se resuelve con un solo job.
    *   `getCumulativeSales`: Obtiene la evolución diaria de tickets vendidos y calcula la suma acumulada (`cumulative_tickets`) usando una función de ventana (`SUM() OVER`), lo que dibuja la curva de ventas históricas.
    *   `getPaidMediaSummary`: Consolida los resultados de marketing pago (Paid Media). Suma la inversión en `ADS`, cuenta las compras reportadas por el pixel publicitario, y cruza con la tabla de tickets para ver cuántos entraron referidos por pauta (`PM_%`). Calcula el CPA final.
    *   `getSalesOrigin`: Agrupa la cantidad de tickets y los ingresos según su origen (campo `Referido`). Por ejemplo, detecta ventas del "Club Glovox" cuando el referido empieza con `FF`.
    *   `getFollowersEvolution`: Entrega una serie de tiempo diaria indicando el total de seguidores y la variación diaria (`delta_followers`) de la cuenta de Instagram asociada al evento, durante su período de venta.
    *   `getFollowersDelta`: Suma todo el crecimiento o pérdida neta de seguidores en Instagram (`SUM(delta_followers)`) durante la ventana de tiempo del evento.
    *   `getClubSales` y `getClubMembersEvolution`: Consultas específicas para medir el impacto de la comunidad "Club Glovox". Miden ventas originadas desde el club y la evolución de nuevos usuarios registrados (`USERS`) durante el evento.
    *   `getSalesByCategory`: Agrupa y cuenta las ventas diarias segmentando por el tipo de ticket o categoría (ej. General, VIP).
    *   `getFunnelData`: Cruza los datos de Google Analytics 4 (`FUNNEL`) usando el `property_ga4` del evento. Obtiene cuántos usuarios hay en cada etapa del embudo de conversión (step_order). Un tercer argumento opcional `ventana` recorta los pasos a la ventana medida por GA4 (modo "Desde medición GA4"); sin él, la consulta es la de siempre.
    *   `getCampaignBreakdown`: Consulta a la tabla de `ADS` para desglosar el gasto y las compras diariamente según el nombre de la campaña y la plataforma (Meta, Google, etc.).
    *   `getUtmTraffic`: Extrae y agrega los datos de tráfico de GA4 (`UTM`), sumando sesiones, usuarios, vistas de página y calculando la tasa de rebote. Todo esto agrupado por Source, Medium, Content y Term durante las fechas del evento.
    *   `getAtribucionCompras(eventoId, country)`: Una sola consulta (con `React.cache`, compartida por la sección de atribución, el link del panel Paid Media y el Funnel) que cruza las compras de GA4 (`marts.ga4_purchases`, una fila por `transaction_id` = `OrdenID`) con las órdenes reales de `glovox.tickets` por `(OrdenID, Ticketera)`: estado y ventana medida (desde el primer día completo en que la propiedad mide compras con número de orden, hasta el último día que cargó el ETL de GA4: el menor entre el tráfico de `marts.ga4_utm` y la última carga de compras de `marts.ga4_purchases` − 1 día), conteo de órdenes por fase (pases, fuera de web, antes, pendientes, medibles, vistas), lentes Pixel / GA4 / Referido con el gasto de Ventas y total (`ADS`), canal real por orden y cobertura por día, por medio de pago y por día × canal. En la página se llama siempre con dos argumentos; el tercero (`hastaMax`) es solo para la auditoría y crearía otra entrada de caché.
    *   `getContenidosQueVenden(eventoId, country, ventana)`: "Qué contenido vende". Sesiones UTM (`marts.ga4_utm`, acotadas igual que `getUtmTraffic` pero a la ventana medida) y órdenes GA4 medidas, cruzadas por la clave manual source|medium|content|term (`mergeUtmOrdenes`).
    *   `getRendimientoConjuntos(eventoId, country, ventana)`: "Rendimiento por conjunto (Meta)". Gasto y pixel por adset (`ADS`, en la ventana medida) junto a las órdenes GA4 cuya sesión trae ese adset (`meta_adset_id`); el objetivo se etiqueta con `tipoDeObjetivo` de `/inversion-medios`.
    *   `getFunnelCompra(eventoId, country, ventana)`: paso "Compran" del Funnel. Órdenes que GA4 registró con su número de orden en la ventana medida; solo del evento si tiene landings mapeadas (`alcance: "evento"`), o de toda la propiedad GA4 si no (`alcance: "propiedad"`, con `otrosEventos`).
    *   Las tres últimas se llaman solo cuando el evento tiene ventana medida (`ventanaMedida()` no nulo, estados `parcial` o `completa`).
*   **Lógica pura de la atribución:** `lib/marketing/atribucion.ts` (client-safe: tipos, constantes de canales, umbrales y colores, estados, CPA, alertas, agrupaciones) y `lib/marketing/formato.ts` (`fmtUsd`, `fmtUsdOGuion`, `fmtPct` en puntos porcentuales 0–100, `fmtFechaCorta`). Checks con `npm run test:atribucion` (`lib/marketing/atribucion.checks.ts`) y auditoría de solo lectura contra BigQuery con `npm run audit:atribucion` (`scripts/audit-atribucion.ts`).

---

## 📌 Resumen de Rutas para pedir ediciones específicas:

*   **Para el orden de las secciones o agregar/quitar bloques:** `app/marketing/weekly/page.tsx`
*   **Para modificar el selector de eventos:** `components/marketing/EventSelector.tsx`
*   **Para la estética base (Bordes, sombras, tarjetas brutales):** Modificar los componentes en `components/marketing/` (ej. `BrutalChartPanel.tsx`).
*   **Para editar un gráfico o tabla específica:** Revisar dentro de `components/marketing/charts/`.
*   **Para cambiar las fuentes de datos, arreglar un cálculo o agregar un campo:** `lib/queries/marketing.ts`.
*   **Para la sección "Atribución de compras":** componentes en `components/marketing/atribucion/`, reglas y cálculos puros en `lib/marketing/atribucion.ts`, formatos en `lib/marketing/formato.ts` y consultas en `lib/queries/marketing.ts` (`getAtribucionCompras` y siguientes). El detalle de reglas y quirks (ventana medida, zonas horarias, scope) está en `app/marketing/weekly/CONTEXTO-PROMPT.md`.
*   **Para el dashboard hermano "CURVAS DE VENTA" (`/marketing/curvas`):** página en `app/marketing/curvas/page.tsx`, filtros en `components/marketing/CurvasFilters.tsx`, gráfico en `components/marketing/charts/CurvasCompraChart.tsx`, queries en `lib/queries/curvas.ts` y el cálculo en `lib/marketing/curvas.ts` (curvas) y `lib/marketing/curvasFacetas.ts` (facetas). Comparte carpeta con los archivos de `/marketing/weekly` pero no comparte datos ni estética.
