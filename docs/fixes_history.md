Fix 1:

Let's go fixing each section

0. Event Selector Header

- Create a second select for categoriaEvento that filters the first select to only show events of the previously selected categoriaEvento.
- Instead of being a default select html component create a custom selector in the style of the dashboard. (docs/STYLE_DASHBOARD.md)

1. Card grid:

- Change "Tickets" label for "Tickets Vendidos"
- Remove the following cards: "Ingreso", "Precio Prom.", "Spend", "Ejec. Budget"
- Change "CPA" label for "CPA Total Vendidos"
- Add a "Instagram Followers Δ" with the diff of instagram followers during the campaign.

2. Venta Acumulada Chart

- Make the last day shown in the chart the day of the event for running events. To have a visual guide of how much time we have left.

3. Paid Media Yellow Card

- Change "CPA" label for "CPA Paid Media"

4. Origen Venta Table

- Group by categories and make them that if clicked open it to see the details of the category, make it obvious with a different style is the detail of the category and if clicked again close it.
  Categories should include: starting with "PM_MT" as "Paid Media Meta", "PM_GG" as "Paid Media Google", "EMAIL" as "Email", "ORG_LT" as "Linktree"
  - Remove "Ingreso" Column

5. Remove "Instagram Followers" Chart

6. Remove "Venta por Categoria" Chart

7. Change the layout to this:

[Event Selector Header]
[Card grid]
[Venta Acumulada][Paid Media Yellow Card] # the same as it is now
[Origen Venta Table][Funnel]
[Desgloce por campaña]

---

Fix 2:

0. General Changes

- Use dollar amounts for CPA and CPA Paid Media with one decimal.
- Use percentages in Ejecucion and "sold over goal tickets %" of Card grid section without decimals.
- use UI-UX-MAX skill for making the whole layout to work good on mobile but having desktop as a priority.

1. Card grid:

- In "Tickets Vendidos" card show the value as follows: {soldTickets}/{goalTickets} ({percentage}%)
- Change "Días al Evento" for "Días para el Evento"
- After "CPA Total Vendidos" add "CPA Paid Media"

2. "Venta Acumulada" Chart

- Remove "Acumulado" line and red area for the days that are remaining until the event.

3. "Origen de Venta"
   Change "Comunidad" for "Club Glovox" and sort by tickets sold, independent if they are a group or not.

4. "Funnel"

- Get funnel data for an event joining google_analytics.funnel.property_id with glovox.categoriaEvento.property_ga4.

5. "Desglose por Campaña"

- Make the last day shown in the chart the day of the event for running events. To have a visual guide of how much time we have left.

6. Tráfico

- Get UTM traffic data for an event joining google_analytics.utm.property_id with glovox.categoriaEvento.property_ga4.
- Create a section to show the traffic data according the UTM origin in a way is actionable for marketing decisions.
