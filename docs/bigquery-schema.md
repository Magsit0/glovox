# BigQuery Schema Reference

**Project:** `root-emissary-313321`

All columns are nullable. All monetary values are in CLP.

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
- `tickets.EventoID` = `forms.EventoID`, `saleCheck.EventoID`

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
