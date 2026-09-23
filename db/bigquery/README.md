# GA4 reporting views

`ga4_utm.sql` and `ga4_funnel.sql` contain the SELECT definitions of
`root-emissary-313321.marts.ga4_utm` and `marts.ga4_funnel`.
They were synchronized with the live views on 2026-09-23. Application deployment
does not apply these definitions: view changes require a separate BigQuery
metadata update, a backup of the current definition, and read-back verification.

The views recognize event IDs in PuntoTicket paths and Fever `/m/<id>` and
`/purchase/<id>/...` paths. The application additionally limits each event by its
catalog property, sale window, and governed landing map. Explicit IDs of another
event are excluded even when the funnel landing filter is set manually. Pages
without an event ID cannot be assigned solely from a shared property.

UTM classification keeps these cases separate:

- `(direct) / (none)` → `Directo`.
- A source or medium equal to `(not set)` → `(not set)`.
- Otherwise, a missing or blank source or medium → `Sin dato`.

This changes report classification, not raw GA4 events or their historical
attribution. Missing ticket referral codes also display as `Sin dato`.

The catalog source sheet and BigQuery catalog were aligned to the observed
Fever property 538472909 for events 751455, 738502, and 708092. Each event has its
own `/m/<id>` and `/purchase/<id>/*` entries in
`glovox_inputs.ga4_landing_event_map`. Sharing the property does not authorize
combining event traffic. La Cava remains unmapped pending an identified property.

Validation: both SELECT definitions were dry-run and checked with eight URL and
attribution fixtures each; before/after row counts and summed metrics matched;
real dashboard UTM/timeline totals matched for the five checked events; explicit
cross-event manual selections were checked separately. Session and user sums are
the existing dashboard aggregates, not counts of unique purchasers.
