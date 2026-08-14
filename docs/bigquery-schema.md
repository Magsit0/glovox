# BigQuery Schema Reference

**Project:** `root-emissary-313321`

All columns are nullable.

**Currency.** Most tables store CLP, but paid media does not: ad accounts bill in CLP, USD and BRL,
so every row of `paidMedia.ads_performance` carries its own `currency`. Never `SUM(gasto)` across
that table without grouping by currency — use the governed view `marts.paidmedia_ads_performance`,
which converts each row to USD with the rate of that row's own date. See
[Paid media & FX](#paid-media--fx) below.

---

## Connecting to BigQuery

The app uses `@google-cloud/bigquery` via a singleton client in `lib/bigquery.ts`.

### Environment variables

| Variable | Description |
|---|---|
| `BIGQUERY_PROJECT_ID` | GCP project — `root-emissary-313321` |
| `BIGQUERY_SERVICE_ACCOUNT` | Full service account JSON as a single-line string |

Service account email: `glovox-data-reader@root-emissary-313321.iam.gserviceaccount.com`

Set both in `.env.local` (never commit this file).

### Usage

```ts
import { query } from "@/lib/bigquery";

const rows = await query<MyType>(
  "SELECT * FROM `root-emissary-313321.glovox.tickets` WHERE EventoID = @id LIMIT 100",
  { id: "GLO174" }
);
```

Always use `@param` placeholders for user-supplied values — never interpolate into the SQL string.

### Adding a new API route query

Expose queries through `app/api/query/route.ts` by adding an entry to the `QUERIES` map. Validate and allowlist any params before passing them to `query()`. The route requires an active session (`auth()`) — unauthenticated requests get a 401.

### Table reference pattern used in queries

```ts
const P = process.env.BIGQUERY_PROJECT_ID;
const TICKETS = `\`${P}.glovox.tickets\``;
const USERS  = `\`${P}.comunidadGlovox.users\``;
```

---

## Join keys

- `FF{users.id}` = `tickets.Referido` — community member referral code (e.g. user id 76 → code `FF76`)
- `users.rut` = `tickets.Rut` — buyer identity
- `users.id` = `saleCheck.userId`, `resumenUsers.id`, `survey.userID`
- `users.rut` = `action.rut`, `forms.Rut`
- `tickets.EventoID` = `forms.EventoID`, `saleCheck.EventoID`, `categoriaEvento.EventoID`
- `CAST(categoriaEvento.property_ga4 AS STRING)` = `google_analytics.utm.property_id`, `google_analytics.funnel.property_id` (the GA4 columns are STRING, `property_ga4` is INT64)

---

## glovox.tickets — 612,993 rows

Core sales table. One row per ticket item.

| Column | Type | Notes |
|---|---|---|
| Ticketera | STRING | Ticketing platform |
| EventoID | STRING | e.g. `GLO174` |
| Evento | STRING | Event name |
| FechaEvento | TIMESTAMP | Date of the event |
| FechaOrden | TIMESTAMP | Purchase date |
| SucursalVenta | STRING | Sales branch |
| TipoEnvio | STRING | Delivery type |
| MedioPago | STRING | Payment method (Webpay, BancoChile, etc.) |
| CategoriaTicket | STRING | Ticket tier (Preventa 1/2/3, Normal, etc.) |
| CodigoPromocion | STRING | Promo code applied |
| OrdenID | INT64 | Order ID (multiple items per order) |
| Item | INT64 | Item index within an order |
| TipoTicket | STRING | Ticket type |
| Precio | FLOAT64 | Base price |
| Descuento | FLOAT64 | Discount amount |
| CargoServicio | FLOAT64 | Service fee |
| PrecioFinal | FLOAT64 | Final price paid |
| Genero | STRING | Buyer gender |
| Nombres | STRING | Buyer name |
| Email | STRING | Buyer email |
| RutNominado | STRING | Attendee RUT (if nominated) |
| NombreNominado | STRING | Attendee name |
| FechaNacimientoNominado | TIMESTAMP | Attendee birthdate |
| EmailNominado | STRING | Attendee email |
| TelefonoNominado | STRING | Attendee phone |
| Rut | STRING | Buyer RUT → joins to `users.rut` |
| Referido | STRING | Referral code — `FF{user.id}` for community sellers |
| CreatedAt | TIMESTAMP | Record creation timestamp |
| EsDevuelto | BOOL | Refunded/returned ticket |
| EsQuemado | BOOL | Scanned at door |
| EsComunidad | BOOL | Buyer is a community member |
| VentaComunidad | BOOL | Sale attributed to community |
| ventaNoventa | STRING | 90-day sale flag |

**Key filters used in dashboards:**
- `Referido LIKE 'FF%' AND EsDevuelto = false` — active community referral sales
- `CAST(REGEXP_EXTRACT(Referido, r'FF(\d+)') AS INT64)` — extract user ID from FF code

---

## glovox.categoriaEvento — 230 rows / 225 distinct EventoID

Event catalog: classifies and groups every event, and links it to its GA4 property, goal and paid-media budget. Joined to `tickets` on `EventoID` by most dashboards.

⚠️ **Not one row per event.** 230 rows for 225 distinct `EventoID`. Today the only duplicate is **`GLO042`, with 6 rows and 15,151 tickets** — so any `JOIN`/`LEFT JOIN tickets ON EventoID` against this table without aggregating first multiplies that event's ticket rows by 6 (inflated counts, revenue and people). Aggregate to one row per event before joining (`SELECT EventoID, ANY_VALUE(...) … GROUP BY EventoID`, as `lib/queries/curvas.ts` does in its `ev` CTE), or de-duplicate the source table. Several existing queries do join directly (`lib/queries/marketing.ts`, `lib/queries/ticketing.ts`, `lib/queries/onepager.ts`, `lib/queries/frees.ts`) — check before trusting a total that includes `GLO042`.

| Column | Type | Notes |
|---|---|---|
| EventoID | STRING | → `tickets.EventoID` (e.g. `GLO174`). Not unique — see warning above |
| NombreGlovox | STRING | Internal event name |
| CategoriaEvento | STRING | Category **+ season** (e.g. `Piknic 25-26`, `FDS`, `GRID 26-27`) |
| CategoriaEvento2 | STRING | Brand / family (e.g. `Piknic`, `After Piknic`, `Feria`, `Festival`, `Sundeck`, `Pase Temporada`) |
| CategoriaEvento3 | STRING | Edition within the series (`Piknic 1`…`Piknic 9`, `Piknic Playa`, `After Piknic 4`); `Otro` for families that don't number editions |
| UnabaseID | INT64 | Business id in Unabase |
| Temporada | STRING | Season (`25-26`); NULL on older events |
| CuentaIG | INT64 | Instagram account → `marketing.rrss_fllws.blog_id` |
| property_ga4 | INT64 | GA4 property → `google_analytics.*.property_id` (cast to STRING to join) |
| goalTickets | INT64 | Ticket goal (people, not transactions) |
| budgetPm | INT64 | Paid media budget |
| isCanceled | BOOL | Cancelled event |
| venue | STRING | Venue |
| Fecha | DATE | Event date. Dashboards that need a timestamp use `MAX(tickets.FechaEvento)` instead |
| sold_out | BOOL | Event sold out |

**Key filters used in dashboards:**
- `isCanceled IS NOT TRUE` — exclude cancelled events
- `EventoID LIKE 'GLO%'` / `LIKE 'GLP%'` — country scope (Chile / Perú)
- `CategoriaEvento` / `CategoriaEvento2` / `CategoriaEvento3` / `Temporada` — chained event facets in `/marketing/curvas` and `/ticketing`

---

## comunidadGlovox.users — 12,039 rows

Core community members table.

| Column | Type | Notes |
|---|---|---|
| id | INT64 | Primary key → `CONCAT('FF', id)` = referral code |
| rut | STRING | Chilean RUT → joins to `tickets.Rut` |
| firstName | STRING | |
| lastName | STRING | |
| birthday | TIMESTAMP | |
| phoneNumber | INT64 | |
| email | STRING | |
| countryCode | STRING | |
| address | STRING | |
| createdAt | TIMESTAMP | Member join date |
| instagram | STRING | Instagram handle |
| emailVerified | TIMESTAMP | When email was verified |
| gender | STRING | |
| payerEmail | STRING | Email used for payment |
| startSubscriptionDate | TIMESTAMP | Subscription start |
| paidUntil | TIMESTAMP | Active subscriber if `> CURRENT_TIMESTAMP()` |
| yearly | BOOL | Annual vs monthly subscription |

---

## comunidadGlovox.resumenUsers — 12,039 rows

Derived summary per user (same row count as `users`, 1:1 relationship).

| Column | Type | Notes |
|---|---|---|
| id | INT64 | → `users.id` |
| rut | STRING | |
| firstName | STRING | |
| lastName | STRING | |
| birth_month | INT64 | |
| birth_year | INT64 | |
| edad | INT64 | Age |
| gender | STRING | |
| yearly | BOOL | |
| countryCode | STRING | |
| fechaingreso | STRING | Join date string |
| fechaingresoYM | STRING | Join date YYYY-MM |
| fechaingresoYMword | STRING | Join date human-readable |
| activeuserForms | STRING | Whether user has filled forms |
| activeuserSold | STRING | Whether user has ever sold |
| usertype | STRING | User classification |
| PuntosGanados | INT64 | Points earned |
| PuntosGastados | INT64 | Points spent |
| PuntosPorGastar | INT64 | Points available |
| ingresoOrganico | STRING | `"organico"` (referred) or `"no organico"` (direct) |

---

## comunidadGlovox.action — 44,330 rows

Points ledger — one row per point event.

| Column | Type | Notes |
|---|---|---|
| difPuntos | INT64 | Points delta (positive = earned, negative = spent) |
| rut | STRING | → `users.rut` |
| motivo | STRING | Reason (e.g. `ANSWER_SURVEY`, `REDEMPTION`) |
| fecha | TIMESTAMP | Event timestamp |
| tipoBeneficio | STRING | Benefit type |
| code | STRING | Redemption code (alphanumeric, not FF codes) |
| eventoID | STRING | → `tickets.EventoID` |
| countryCode | STRING | |

---

## comunidadGlovox.saleCheck — 345 rows

Verification log for community benefit claims at ticket purchase.

| Column | Type | Notes |
|---|---|---|
| id | INT64 | |
| userId | INT64 | → `users.id` |
| userRut | STRING | → `users.rut` |
| eventId | INT64 | |
| eventName | STRING | |
| EventoID | STRING | → `tickets.EventoID` |
| eventCountry | STRING | |
| orderId | STRING | → `tickets.OrdenID` (as string) |
| rutProvided | STRING | RUT the user claimed |
| status | STRING | `APPROVED` or other statuses |
| message | STRING | Verification message |
| createdAt | TIMESTAMP | |
| updatedAt | TIMESTAMP | |
| rutProvided_normalized | STRING | Normalized RUT |
| rutProvided_digits | STRING | Digits-only RUT |

---

## comunidadGlovox.survey — 18,100 rows

Survey responses from community members.

| Column | Type | Notes |
|---|---|---|
| surveyID | INT64 | Survey identifier |
| userID | INT64 | → `users.id` |
| answerID | INT64 | Answer identifier |
| question | STRING | Question text |
| answer | STRING | Answer text |
| createdAt | TIMESTAMP | |

---

## comunidadGlovox.forms — 123,176 rows

Per-event form submissions, keyed by RUT. Large table.

| Column | Type | Notes |
|---|---|---|
| Rut | STRING | → `users.rut` |
| EventoID | STRING | → `tickets.EventoID` |
| Respuesta | STRING | Form response |
| FechaRespuesta | TIMESTAMP | Submission timestamp |

---

## google_analytics.utm — partitioned by `date`

GA4-derived UTM attribution per event per day. One row per unique combination of (date, evento_id, source, medium, campaign, content, term, landing_page).

| Column | Type | Mode | Notes |
|---|---|---|---|
| property_id | STRING | REQUIRED | GA4 property ID |
| evento_id | STRING | NULLABLE | → `tickets.EventoID` |
| date | DATE | REQUIRED | Partition column |
| source | STRING | NULLABLE | UTM source (e.g. `instagram`, `google`) |
| medium | STRING | NULLABLE | UTM medium (e.g. `cpc`, `organic`) |
| campaign | STRING | NULLABLE | UTM campaign name |
| content | STRING | NULLABLE | UTM content |
| term | STRING | NULLABLE | UTM term |
| landing_page | STRING | NULLABLE | First page visited in session |
| screen_page_views | INTEGER | NULLABLE | Total page views |
| sessions | INTEGER | NULLABLE | Session count |
| bounce_rate | FLOAT | NULLABLE | Bounce rate (0–1) |
| total_users | INTEGER | NULLABLE | Unique users |
| event_count | INTEGER | NULLABLE | GA4 events fired |
| ingested_at | TIMESTAMP | REQUIRED | ETL load timestamp |

---

## google_analytics.funnel — partitioned by `date`

GA4-derived funnel step completion per event per day. One row per (date, evento_id, funnel_step).

| Column | Type | Mode | Notes |
|---|---|---|---|
| property_id | STRING | REQUIRED | GA4 property ID |
| evento_id | STRING | NULLABLE | → `tickets.EventoID` |
| date | DATE | REQUIRED | Partition column |
| funnel_step | STRING | REQUIRED | Step name (e.g. `page_view`, `add_to_cart`, `purchase`) |
| step_order | INTEGER | REQUIRED | Numeric order of the step in the funnel |
| landing_page | STRING | NULLABLE | Landing page associated with this step |
| total_users | INTEGER | NULLABLE | Users who reached this step |
| ingested_at | TIMESTAMP | REQUIRED | ETL load timestamp |

---

## Paid media & FX

Three tables plus one governed view. Read the view, not the raw table.

### `paidMedia.ads_performance` — 16,625 rows

Raw daily ad performance, one row per (platform, date, adset). Partitioned by `fecha` (DAY),
clustered by `(plataforma, account_id)`. **Multi-currency** — see the warning above.

| Column | Type | Notes |
|---|---|---|
| plataforma | STRING | `meta` \| `google` \| `tiktok` |
| fecha | DATE | Partition column |
| account_id / account_name | STRING | Ad account. Currency is a property of the account — no account bills in two currencies |
| currency | STRING | `CLP` (61.5M spend), `USD` (204.8K), `BRL` (1.6K) |
| campaign_id / campaign_name | STRING | Meta encodes the EventoID in the first 6 chars of the name |
| objective | STRING | e.g. `OUTCOME_SALES`, `PERFORMANCE_MAX` |
| adset_id / adset_name | STRING | |
| impresiones, clics, alcance | INT64 | `alcance` is **not additive** across accounts or platforms (Google reports NULL) |
| gasto, valor_conversion | FLOAT64 | In `currency` |
| ctr, cpc, cpm, roas | FLOAT64 | **Per-row ratios — never SUM or AVG these.** Recompute from the sums |
| conversiones | FLOAT64 | Definitions differ per platform |
| EventoID | STRING | Governed attribution. NULL on 7,039 of 16,625 rows |

### `referencia.tipo_cambio` — 5,046 rows

Daily FX to USD from central banks. **Dense**: weekends and holidays are filled with the last
business-day value (`imputado = TRUE`). Covers 2022-01-01 onward for CLP, BRL and USD.

| Column | Type | Notes |
|---|---|---|
| fecha | DATE | REQUIRED. Part of the upsert key |
| currency | STRING | REQUIRED. `CLP` \| `BRL` \| `USD`. Part of the upsert key |
| units_per_usd | FLOAT64 | Local units per 1 USD. `monto_usd = monto_local / units_per_usd` |
| fuente | STRING | `BCCH_OBSERVADO` (Chile) \| `BCB_PTAX_CIERRE` (Brazil) \| `IDENTIDAD` (USD = 1.0) |
| serie | STRING | Source series id, e.g. `F073.TCO.PRE.Z.D` |
| imputado | BOOL | TRUE = carry-forward of the last business day |
| loaded_at | TIMESTAMP | |

⚠️ **`PEN` is not covered.** `lib/eventos-create.ts` assigns it to every Perú (GLP) event. Today
nothing breaks because Perú spend runs through USD and CLP accounts, but the first advertising
account in soles would produce `gasto_usd = NULL` permanently.

⚠️ **Freshness.** The FX pipeline runs ~18:00 UTC and the ads pipeline ~13:10 UTC, so ad rows for
the current day can briefly outrun the published rate. Consumers must treat `gasto_usd IS NULL` as
"not yet convertible", never as zero.

### `marts.paidmedia_ads_performance` — VIEW

`ads_performance` LEFT JOINed to `tipo_cambio` on `(currency, fecha)`. Adds `gasto_usd`, `cpc_usd`,
`cpm_usd`, `valor_conversion_usd`, `fx_units_per_usd`, `fx_imputado`. Defined in the
**data-governance** repo (`schemas/bigquery/views/marts_paidmedia_ads_performance.sql`) — this repo
has read-only credentials. Consumers: `/paid-media`, `/marketing/weekly`, `/inversion-medios`.

Safe to aggregate: `gasto_usd`, `valor_conversion_usd`, `impresiones`, `clics`, `conversiones`.
Never aggregate: `ctr`, `cpc`, `cpm`, `roas`, `cpc_usd`, `cpm_usd` (per-row ratios) or `alcance`.

To express amounts in a currency other than USD, multiply the already-converted USD value by that
currency's rate **for the same row's date** — not by a single average rate for the whole range.
`lib/queries/paidMedia.ts` does this for its USD ↔ CLP switch.

### `paidMedia.fx_rates` — RETIRED

Flat 3-row table with no date column (CLP=900, BRL=5.4, USD=1), hand-edited in BigQuery. Replaced
by `referencia.tipo_cambio`. Using it understated CLP spend by ~2% and overstated BRL by ~5.8%.
No code reads it any more.

### `paidMedia.campaign_event_map`

Manual `campaign_id` → `EventoID` map. Google campaigns need it because their names do not encode
the event; Meta does not.
