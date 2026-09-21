# STYLE_DASHBOARD.md

# GLOVOX DASHBOARD — STYLE GUIDE

> Visual language for Glovox **dashboards, charts, and tables**.
> Aligned with the Glovox brand manual: **"equilibrio entre lo corporativo y lo entretenido"** — restrained, elegant, modern layouts with vibrant brand colors used sparingly as accents. Data leads; chrome disappears.
> Read this in full before generating, modifying, or reviewing any dashboard component. Do not accept defaults from `21st-dev/magic`, `recharts`, or any library that conflict with this spec.

---

## BRAND VOICE

- **Líneas simples y modernas** — simple modern lines, generous whitespace, restrained composition.
- **Elegancia y simpleza** — surface chrome disappears so data leads.
- **Experiencias vibrantes** — brand colors applied as accents on a predominantly white/light canvas.

Forbidden: brutalist offset shadows, heavy 3px+ borders, uppercase-everything typography, monospace labels, dominant color fills across entire sections, comic-book devices, halftone treatments.

---

## TOOLS & LIBRARIES

- **Styling**: Tailwind CSS utility classes exclusively.
- **Charts**: `recharts` — all defaults overridden.
- **Color math**: `chroma-js` for programmatic tints/shades.
- **Motion**: `motion` (emilkowalski). Subtle, brief.
- **Components**: `21st-dev/magic` — then override to match this spec.

---

## COLOR SYSTEM

### Brand accents

| Token      | Hex       | Tailwind         | Role                                      |
| ---------- | --------- | ---------------- | ----------------------------------------- |
| `--purple` | `#9F99F8` | `bg-[#9F99F8]`   | **Primary brand accent**, default series  |
| `--green`  | `#B1D750` | `bg-[#B1D750]`   | Positive status, growth                   |
| `--pink`   | `#ED75A0` | `bg-[#ED75A0]`   | Negative delta, alert, destructive        |
| `--yellow` | `#F6C544` | `bg-[#F6C544]`   | Pending, attention                        |
| `--teal`   | `#87DACD` | `bg-[#87DACD]`   | Calm supporting accent                    |
| `--orange` | `#EF8C34` | `bg-[#EF8C34]`   | Warning, energy, secondary accent         |

### Neutrals

| Token          | Hex       | Tailwind             | Role                                    |
| -------------- | --------- | -------------------- | --------------------------------------- |
| `--ink`        | `#333333` | `text-[#333333]`     | Primary text                            |
| `--ink-muted`  | `#666666` | `text-[#666666]`     | Labels, subtitles, column headers       |
| `--ink-subtle` | `#999999` | `text-[#999999]`     | Captions, axis labels, placeholders     |
| `--divider`    | `#E5E5E5` | `border-[#E5E5E5]`   | Hairline borders, table dividers        |
| `--grid`       | `#F0F0F0` | `stroke-[#F0F0F0]`   | Chart grid lines                        |
| `--surface-alt`| `#FAFAFA` | `bg-[#FAFAFA]`       | Page canvas, table header, hover rows   |
| `--surface`    | `#FFFFFF` | `bg-white`           | Card & table background                 |

### Rules

- **No `#000000`.** Dark → `#333333`.
- **Brand colors are accents only.** Status dots, chart strokes, pill fills, active underlines. Never fill an entire card/section in brand hue (max: one spotlight KPI per view).
- **No gradients, no opacity on brand fills/borders.** Compute tints with `chroma-js`.
- Opacity on `text-white` / `text-[#333333]` is allowed on colored surfaces for hierarchy.
- **No Tailwind defaults** (`red-500`, `blue-600`). Only the tokens above.

---

## TYPOGRAPHY

Two typefaces. Sentence case is the default.

- **Titles / KPI values**: `Mont Bold` (700) — `font-display font-bold tracking-tight`
- **Body / labels / data / tables**: `Montserrat` (400; 500 for emphasis) — `font-sans`

### Scale

| Level        | Class                                                              | Use                       |
| ------------ | ------------------------------------------------------------------ | ------------------------- |
| Page title   | `font-display font-bold text-3xl text-[#333333]`                   | Top of dashboard          |
| Section      | `font-display font-bold text-xl text-[#333333]`                    | Section heading           |
| Card title   | `font-display font-bold text-lg text-[#333333]`                    | Chart / table title       |
| KPI value    | `font-display font-bold text-4xl leading-none text-[#333333]`      | Metric value              |
| Body         | `font-sans text-sm text-[#333333]`                                 | Table cell, paragraph     |
| Body muted   | `font-sans text-sm text-[#666666]`                                 | Subtitles, descriptions   |
| Label        | `font-sans text-xs text-[#666666]`                                 | KPI label, field label    |
| Caption      | `font-sans text-xs text-[#999999]`                                 | Axis, timestamp, helper   |

**Uppercase** is allowed only on: table column headers in dense views, and small status pill text. Never on page/card titles, KPI labels, buttons, or body.

**Forbidden fonts**: Inter, Roboto, Arial, system-ui, Bebas Neue, Anton, any monospace (IBM Plex Mono, Space Mono, etc.).

### Loading fonts

```tsx
// app/layout.tsx
import { Montserrat } from "next/font/google";
import localFont from "next/font/local";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

const mont = localFont({
  src: [
    { path: "../public/fonts/mont/Mont-Regular.woff2", weight: "400" },
    { path: "../public/fonts/mont/Mont-Bold.woff2",    weight: "700" },
  ],
  variable: "--font-display",
  display: "swap",
});
```

`Montserrat` → Google Fonts. `Mont` → commercial (Fontfabric), self-host `.woff2` in `public/fonts/mont/`.

### Tailwind config

```ts
fontFamily: {
  sans:    ["var(--font-sans)",    "system-ui", "sans-serif"],
  display: ["var(--font-display)", "sans-serif"],
}
```

---

## SURFACE, SPACING & ELEVATION

- **Card**: `bg-white border border-[#E5E5E5] rounded-lg`
- **Emphasis border**: `border border-[#333333]` — callouts only
- **Divider**: `border-b border-[#E5E5E5]` or `border-r border-[#E5E5E5]`
- **Radius**: `rounded-lg` default (8px); `rounded-xl` for large hero KPIs; `rounded-full` for pills, dots, avatars. Never `rounded-none`.
- **Elevation**: none by default; `shadow-sm` for raised cards; `shadow-md` on hover. Never offset brutalist shadows.
- **Gap**: `gap-6` default between cards.
- **Card padding**: `p-6` default; `p-4` for dense metric cards.
- **Page padding**: `px-8 py-10` on main content.
- **Page canvas**: `bg-[#FAFAFA]` so white cards breathe.

---

## LAYOUT

```
[ TOPBAR bg-white border-b border-[#E5E5E5] h-16 ]
[ SIDEBAR bg-white w-60 border-r ][ MAIN bg-[#FAFAFA] px-8 py-10 ]
```

- **Grid**: `grid grid-cols-12 gap-6`
  - KPI row: four `col-span-3` cards
  - Chart + side panel: `col-span-8` + `col-span-4`
  - Full-width chart: `col-span-12`
  - Table: `col-span-12`
- **Filter bar**: full-width above the grid, `flex flex-wrap gap-3 mb-6`.

---

## KPI CARD

```
bg-white border border-[#E5E5E5] rounded-lg p-6
```

- Label: `font-sans text-xs text-[#666666]`
- Value: `font-display font-bold text-4xl leading-none text-[#333333] mt-2`
- Delta (inline dot + number): `inline-flex items-center gap-1.5 font-sans text-xs font-medium text-[#333333] mt-3`
  - Dot: `w-1.5 h-1.5 rounded-full`
  - Positive dot: `bg-[#B1D750]`
  - Negative dot: `bg-[#ED75A0]`
  - Neutral dot: `bg-[#999999]`, text `text-[#666666]`
- Trend sparkline (optional): height `h-8 mt-3`, stroke `#9F99F8` at `1.5px`, no axis, no grid, no tooltip.

### Spotlight KPI (max one per view)

```
bg-[#9F99F8] rounded-xl p-8
```

- Label: `font-sans text-xs text-white/80`
- Value: `font-display font-bold text-5xl text-white leading-none mt-2`
- Caption: `font-sans text-sm text-white/80 mt-4`

---

## CHARTS (recharts)

### Base series palette — order matters

1. `#9F99F8` — purple (primary)
2. `#B1D750` — green
3. `#ED75A0` — pink
4. `#F6C544` — yellow
5. `#87DACD` — teal
6. `#EF8C34` — orange

### Extending beyond 6 series

Never introduce arbitrary colors. Use `seriesColor(i)` in `lib/chart-colors.ts`:

```ts
// lib/chart-colors.ts
import chroma from "chroma-js";

const base = [
  "#9F99F8", "#B1D750", "#ED75A0",
  "#F6C544", "#87DACD", "#EF8C34",
] as const;

export function seriesColor(i: number): string {
  const ring = Math.floor(i / base.length);
  const hue  = base[i % base.length];
  switch (ring) {
    case 0:  return hue;                               // base
    case 1:  return chroma(hue).brighten(1).hex();     // tint
    case 2:  return chroma(hue).darken(1).hex();       // shade
    default: return chroma(hue).set("hsl.h", "+180").hex(); // complement (last resort)
  }
}
```

### Chart chrome (applies to every chart type)

- Container: `bg-white border border-[#E5E5E5] rounded-lg p-6`
- Title: `font-display font-bold text-lg text-[#333333]`
- Subtitle: `font-sans text-sm text-[#666666] mt-1`
- Chart canvas: `mt-6`, responsive height `h-64` (default) or `h-80` (emphasis)
- **Axis line**: `stroke="#E5E5E5"`
- **Tick labels**: `tick={{ fontFamily: 'var(--font-sans)', fontSize: 12, fill: '#999999' }}`
- **Grid**: horizontal only — `<CartesianGrid vertical={false} stroke="#F0F0F0" strokeDasharray="0" />`
- **Legend**: `<Legend wrapperStyle={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: '#666666' }} iconType="circle" iconSize={8} />`
- **No** chart background fill, **no** axis tick marks (`tickLine={false}`, `axisLine={false}` on the Y axis when grid handles orientation).

### Line chart

```tsx
<LineChart data={data}>
  <CartesianGrid vertical={false} stroke="#F0F0F0" />
  <XAxis dataKey="date" tickLine={false} axisLine={{ stroke: '#E5E5E5' }}
         tick={{ fontSize: 12, fill: '#999999' }} />
  <YAxis tickLine={false} axisLine={false}
         tick={{ fontSize: 12, fill: '#999999' }} />
  <Tooltip content={<GlovoxTooltip />} cursor={{ stroke: '#E5E5E5' }} />
  <Line type="monotone" dataKey="v" stroke={seriesColor(0)} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
</LineChart>
```

- Stroke: `2px`
- Dots hidden by default (`dot={false}`); show on hover only (`activeDot={{ r: 4 }}`)
- Prefer `type="monotone"` for smooth; `type="linear"` for discrete.

### Area chart

- Fill: the series color at **15% opacity only for area fills** (this is the single place opacity on brand color is permitted — it's area, not surface).
- Stroke: `2px` at full brand color.
- Stack multiple series with `stackId` only when totals matter; otherwise prefer line overlays.

### Bar chart

- Bar fill: full brand color.
- **Corner radius**: `radius={[4, 4, 0, 0]}` on vertical bars (top corners only); `[0, 4, 4, 0]` on horizontal bars (right corners only).
- **Bar gap**: `barCategoryGap="30%"`.
- **No bar border**, no stroke.
- Grouped: assign each group via `seriesColor(i)`. Stacked: same, stacked via `stackId`.

### Pie / Donut

- Prefer donut (inner radius `60%`) over pie — more room for labels inside.
- Slice colors from `seriesColor(i)` in order.
- **No slice borders**.
- Label inside donut hole: `font-display font-bold text-3xl text-[#333333]` with a caption below.
- External labels only if ≤ 5 slices; otherwise move to legend.

### Scatter

- Dot radius: `6` default; `stroke="#FFFFFF"` at `1.5px` for separation on overlap.
- Axis as per standard chart chrome.

### Tooltip (chart)

Build one reusable component:

```
bg-white border border-[#E5E5E5] rounded-lg shadow-md px-3 py-2
font-sans text-sm text-[#333333]
```

- Header: date/label in `text-xs text-[#666666]`
- Rows: colored dot + series name + value, one per line
- Disable recharts' default tooltip styles entirely.

### Empty / loading states (charts)

- **Empty**: center `font-sans text-sm text-[#999999]` inside the chart container, icon `w-6 h-6 text-[#999999] mb-2`.
- **Loading**: skeleton of horizontal gray bars (`bg-[#F0F0F0] rounded-lg`) in the chart's shape; no spinner.

---

## TABLES

```
bg-white border border-[#E5E5E5] rounded-lg overflow-hidden
```

### Structure

- **Header row**: `bg-[#FAFAFA] border-b border-[#E5E5E5]`
  - Cell: `font-sans text-xs font-medium text-[#666666] px-4 py-3 text-left`
  - Dense view: `uppercase tracking-wide` acceptable for column labels
- **Body cell**: `font-sans text-sm text-[#333333] px-4 py-3`
- **Row divider**: `border-b border-[#E5E5E5]` (omit on last row; `overflow-hidden` on wrapper clips it cleanly)
- **Row hover**: `hover:bg-[#FAFAFA] transition-colors duration-150`
- **Zebra striping**: off by default; if needed, `even:bg-[#FAFAFA]`.
- **Sticky header** (long tables): wrap in `overflow-auto max-h-[480px]`, header cells `sticky top-0 z-10 bg-[#FAFAFA]`.

### Column conventions

| Type         | Alignment | Formatting                                                      |
| ------------ | --------- | --------------------------------------------------------------- |
| Text / name  | left      | `text-[#333333]`                                                |
| Number       | right     | `tabular-nums font-sans` — use `Intl.NumberFormat` with locale  |
| Currency     | right     | `tabular-nums`; render CLP as `$12.345`, USD as `$12,345.00`    |
| Date         | left      | `font-sans text-sm` — short format `22 abr 2026`                |
| Percent      | right     | `tabular-nums` — one decimal by default                         |
| Status       | center    | status pill (see Pills spec)                                    |
| Actions      | right     | icon buttons (`w-8 h-8`, ghost style)                           |

### Sort indicator

- Sortable header: `cursor-pointer hover:text-[#333333] flex items-center gap-1`
- Icon: Lucide `ArrowUp` / `ArrowDown` / `ArrowUpDown`, `w-3 h-3`, inherits `text-[#999999]` → `text-[#333333]` when active

### Pagination

```
flex items-center justify-between px-4 py-3 border-t border-[#E5E5E5] bg-white
```

- Range text: `font-sans text-sm text-[#666666]` → `"1–20 de 245"`
- Controls: `flex items-center gap-1`
  - Previous/next: ghost button, icon-only `w-8 h-8`
  - Page size selector: secondary button style
- Active page number: `text-[#333333] font-medium`; inactive: `text-[#666666]`

### Empty / loading states (tables)

- **Empty**: centered within body, `py-12`, icon + `font-sans text-sm text-[#999999]` + optional CTA button (primary).
- **Loading**: 5–8 skeleton rows with `bg-[#F0F0F0] rounded h-4` placeholders matching column widths.

---

## FILTER CONTROLS

All filter controls share these base tokens to feel like one system.

### Shared tokens

```
bg-white border border-[#E5E5E5] rounded-lg px-3 py-2
font-sans text-sm text-[#333333]
hover:border-[#333333] focus:border-[#9F99F8] focus:ring-1 focus:ring-[#9F99F8]
transition-colors
```

- Icon (leading): `w-4 h-4 text-[#666666]` — e.g., calendar icon for date, globe for country.
- Caret (trailing, for dropdowns): `w-4 h-4 text-[#999999]`.
- Disabled: `opacity-60 cursor-not-allowed`.
- Active (has value): border stays `#E5E5E5`; add a purple dot `w-1.5 h-1.5 rounded-full bg-[#9F99F8]` after the label.

### Single-select dropdown

- Trigger: shared tokens + caret.
- Menu: `bg-white border border-[#E5E5E5] rounded-lg shadow-md mt-1 py-1 min-w-full max-h-60 overflow-auto`
- Item: `px-3 py-2 text-sm text-[#333333] hover:bg-[#FAFAFA] cursor-pointer`
- Selected item: `bg-[#F0EFFE] text-[#9F99F8] font-medium` (pale purple tint, precompute once)
- Icon marker on selected: Lucide `Check w-4 h-4 text-[#9F99F8]` right-aligned.

### Multi-select

- Trigger shows selected count when > 1: `"Países · 3"`; full label when ≤ 1.
- Menu items: same as single-select + checkbox leading (`w-4 h-4 rounded border border-[#E5E5E5] checked:bg-[#9F99F8] checked:border-[#9F99F8]`).
- Clear: `text-[#666666] hover:text-[#333333] font-sans text-xs` link at the top of the menu.

### Date range picker

- Trigger shows `dd MMM – dd MMM` for same year, `dd MMM yyyy – dd MMM yyyy` across years.
- Calendar popover: `bg-white border border-[#E5E5E5] rounded-lg shadow-md p-4`
  - Day cell: `w-8 h-8 rounded-full text-sm text-[#333333] hover:bg-[#FAFAFA]`
  - In-range: `bg-[#F0EFFE] text-[#9F99F8] rounded-none`
  - Range endpoints: `bg-[#9F99F8] text-white rounded-full`
  - Today: underline, no fill
  - Disabled: `text-[#E5E5E5]`
- Preset buttons (left column): ghost buttons — "Hoy", "Últimos 7 días", "Este mes", "Últimos 30 días", "Este año".

### Country / multi-entity filter

Specialize the multi-select with a flag icon `w-4 h-4` before each country name; selected shows a purple dot + "N países" when > 3.

### Search input

```
bg-white border border-[#E5E5E5] rounded-lg px-3 py-2 pl-9
font-sans text-sm text-[#333333] placeholder:text-[#999999]
focus:border-[#9F99F8] focus:ring-1 focus:ring-[#9F99F8]
```

Leading `Search` icon (`w-4 h-4 text-[#999999]`) absolute-positioned.

### Reset / clear all

- Style: ghost button with `X` icon — `flex items-center gap-1 px-2 py-2 text-sm text-[#666666] hover:text-[#333333]`.
- Position: trailing the filter bar, only visible when ≥ 1 filter is active.

---

## PILLS / STATUS

```
inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
font-sans text-xs font-medium text-[#333333]
bg-white border border-[#E5E5E5]
```

Leading dot `w-1.5 h-1.5 rounded-full`:

| Status  | Dot       |
| ------- | --------- |
| Success | `#B1D750` |
| Pending | `#F6C544` |
| Warning | `#EF8C34` |
| Error   | `#ED75A0` |
| Info    | `#9F99F8` |
| Neutral | `#999999` |

---

## BUTTONS

Shared: `rounded-lg px-4 py-2 font-sans font-medium text-sm transition-colors`. Never uppercase.

- **Primary**: `bg-[#9F99F8] text-white hover:bg-[#8780F0]`
- **Secondary**: `bg-white border border-[#333333] text-[#333333] hover:bg-[#FAFAFA]`
- **Ghost**: `text-[#333333] hover:bg-[#F5F5F5]`
- **Destructive**: `bg-[#ED75A0] text-white hover:bg-[#E55C8F]`
- **Icon-only**: `w-9 h-9 rounded-lg inline-flex items-center justify-center` + one of the variants above.

Derive hover colors via `chroma(base).darken(0.3).hex()`.

---

## TOP BAR & SIDEBAR

### Top bar

```
flex items-center justify-between border-b border-[#E5E5E5] bg-white px-8 h-16
```

- Nav tab: `font-sans text-sm text-[#666666] px-3 py-2 hover:text-[#333333]`
- Active: `text-[#333333] border-b-2 border-[#9F99F8] -mb-px` (subtle underline)
- Breadcrumbs: `font-sans text-sm text-[#999999]` with `/` separator

### Sidebar

```
bg-white w-60 border-r border-[#E5E5E5] h-full flex flex-col py-6 px-3 gap-1
```

- Section divider: `font-sans text-xs uppercase tracking-wide text-[#999999] px-3 pt-4 pb-2` *(one of the few places uppercase is expected)*
- Item: `flex items-center gap-3 px-3 py-2 rounded-lg font-sans text-sm text-[#666666] hover:bg-[#FAFAFA] hover:text-[#333333]`
- Active item: `bg-[#F0EFFE] text-[#9F99F8] font-medium` (pale purple tint)
- Icon: Lucide, `w-4 h-4`, `currentColor`

---

## MOTION

Subtle, brief.

- **Mount (cards)**: fade + `translateY(8px → 0)`, `400ms`, `ease-out`, stagger `0.06s`
- **KPI count-up**: 0 → final over `600ms`, `easeOutQuart`
- **Chart lines/bars**: recharts `isAnimationActive={true}` with `animationDuration={400}`, `animationEasing="ease-out"`. Do not animate on every data refresh — gate via prop.
- **Card hover**: `-1px` translate, shadow `sm → md`, `150ms`
- **Table row hover**: background swap only, `150ms`; no transforms
- **Page transitions**: `AnimatePresence`, `duration: 0.2`

Avoid: bouncy springs, `scale` > `1.03`, rotation on chrome, parallax.

---

## THEME TOKENS & DARK MODE

Colors are no longer written as literals in components. They go through **CSS custom
properties** declared once in `app/globals.css`. In light mode every token resolves to
exactly the hex listed in the tables above, so this layer changed nothing visually — it
only created a single place to change a color.

| Token | Light | Dark | Role |
| ----- | ----- | ---- | ---- |
| `--ink` | `#333333` | `#EDEDED` | Primary text |
| `--ink-muted` | `#666666` | `#A8A8A8` | Labels, subtitles, column headers |
| `--ink-subtle` | `#999999` | `#8A8A8A` | Captions, axis labels, placeholders |
| `--divider` | `#E5E5E5` | `#383838` | Hairline borders, table dividers |
| `--grid` | `#F0F0F0` | `#2E2E2E` | Chart grid lines |
| `--surface` | `#FFFFFF` | `#242424` | Card & table background |
| `--surface-alt` | `#FAFAFA` | `#1A1A1A` | Page canvas, table header, hover rows |
| `--purple-tint` | `#F0EFFE` | `#2A2840` | Selected/active state fill |
| `--surface-sunken` | `#FBFBFD` | `#1F1F1F` | Rows revealed by expanding something; group headers |
| `--plan` | `#534AB7` | `#9F99F8` | The planned figure in `/inversion-medios` (real goes in `--ink`) |
| `--plan-hover` | `#3F3796` | `#CFCCFB` | Hover of a link painted in `--plan` |
| `--evento-tint` | `#FAEEDA` | `#3A2D14` | Fill of the event's own days |
| `--evento-ink` | `#854F0B` | `#F6C544` | Text over `--evento-tint` |
| `--amber-ink` | `#B8890B` | `#F6C544` | Amber status text over a surface (pairs with dot `#F6C544`) |
| `--green-ink` | `#3B6D11` | `#B1D750` | Green status text over a surface (pairs with dot `#B1D750`) |
| `--week-near-line` / `-tint` / `-ink` | `#CFCCFB` / `#F5F4FE` / `#6E67C4` | `#4A4680` / `#232136` / `#BFBBFA` | Week-highlight scale, 50% step |
| `--week-far-line` / `-tint` / `-ink` | `#E7E6FD` / `#FAFAFE` / `#8F89D9` | `#34314C` / `#1E1D29` / `#9F99F8` | Week-highlight scale, 25% step |
| `--brutal-ink` | `#000000` | `#EDEDED` | Title, tabs and borders of the `brutalist` GroupNav |
| `--etapa-N-bg` / `--etapa-N-ink` | 12 pastels | 12 sunken tints | Campaign-stage bands (N = 1…12) |

Tokens below `--purple-tint` are **paired** colors: a fill plus the ink that sits on it, or
a scale. They exist because a light tint cannot simply be reused in dark — it has to travel
the other way, toward the canvas — and because two of them (`--plan`, `--brutal-ink`) are
colors the manual never listed as accents, so nothing said what they should do in dark.

### Rules

- **Use the token, never the hex**: `text-[var(--ink)]`, `bg-[var(--surface)]`,
  `border-[var(--divider)]`. A literal neutral hex in a component is a bug — it will not
  follow the theme.
- **Brand accents do NOT change between themes.** The six accents (`#9F99F8`, `#B1D750`,
  `#ED75A0`, `#F6C544`, `#87DACD`, `#EF8C34`) keep their exact value in dark: they are
  mid-tone and already contrast against `#242424`. Redefining them would mean inventing
  brand variants this manual does not have. Keep writing them as literals.
- **`text-white` stays `text-white`.** It means "white on a brand accent" (the purple
  spotlight KPI, active pills) — it is not a surface color and must not be tokenized.
- **Country flags and other illustrative SVG fills stay literal.** They are artwork, not
  chrome.
- **No `#000000` still holds.** The darkest surface is `#1A1A1A`; cards lift to `#242424`
  so they separate from the canvas, the same gesture the white card makes over `#FAFAFA`
  in light mode.
- **Chart colors go through `lib/chart-colors.ts`.** `INK` and `SURFACE` there are now
  `var(--…)` strings — SVG resolves custom properties in `fill`/`stroke` like any color
  property, so recharts follows the theme with no per-chart change. ⚠️ Never feed those
  values to `chroma-js`: it needs a concrete color. Use `LIGHT_HEX` for color math. This
  holds for a `stroke=` written inline on a recharts child too (`<CartesianGrid>`), which
  is where a literal slips back in most easily.
- **A light tint + dark text pair is NOT an accent.** `#FAEEDA`/`#854F0B`-style pairs read
  fine in light and read fine in dark too — the pair is self-consistent — but they land as
  bright patches on a dark board. They get a token pair whose fill travels toward the
  canvas and whose ink travels toward the accent. Same for any scale of tints (see
  `--week-*`, `--etapa-*`).
- **A dark-toned near-accent is NOT covered by the accent exception.** `#534AB7` is not one
  of the six: it is darker, so on `#242424` it gives 2.3:1. Any purple/green/amber that is
  *not literally* one of the six hexes needs a token.
- **One `bg-*` utility per element.** A fixed `bg-[var(--surface-alt)]` plus a conditional
  `bg-[…]` in the same `className` are two utilities of equal specificity, and the winner
  is decided by the order of the generated CSS, not by the order of the string. Write the
  whole background as one ternary.
- **`color-scheme` is part of the theme.** `:root` declares `light` and `[data-theme="dark"]`
  declares `dark`, so scrollbars, `<input type="date">` pickers and other native chrome
  follow the switch. Without it a themed route keeps light scrollbars and a light date
  picker inside a dark card.
- **Opacity modifiers on a `var()` color DO work.** `bg-[var(--purple-tint)]/40` compiles to
  a `color-mix()` rule inside `@supports`, with the full-opacity declaration as fallback.
  That is the sanctioned way to write a weaker version of a *tint* token; the manual's
  no-opacity rule is about fills in a brand accent.

### Scope

Dark mode is **per route, not global**. `<ThemeSwitch>` (which mounts `<ThemeScope>`)
sets `data-theme="dark"` on `<html>` while mounted and removes it on unmount, so leaving
the route reverts to light. Today only `/paid-media` and `/inversion-medios` offer it
(`THEMED_ROUTES` in `lib/theme.ts`); every other dashboard resolves `:root` and is
untouched. Adding a route to dark mode = tokenize its literals + render `<ThemeSwitch>`.

The preference lives in `localStorage`, not in the URL: it is personal, and a query param
would impose your theme on whoever opens a link you share. Print always renders light —
`@media print` re-pins the tokens to their light values. ⚠️ **A new token has to be added
in three places**: `:root`, `[data-theme="dark"]` and the `@media print` re-pin. A token
missing from the print block prints near-white ink on white paper.

"Per route" means the chrome that surrounds the route counts too, not just its own files.
`GroupNav` (the group bar), `SuperadminPendingsFab` and `SuperadminPendingsModal` (mounted
globally in `app/layout.tsx`) all render *on* a themed route, so their literals are theme
bugs even though they live outside the route folder. Anything else the root layout mounts
has to be checked the same way when a new route joins `THEMED_ROUTES`.

---

## WHAT NOT TO DO

- No `#000000`. Always `#333333` or lighter.
- No neutral hex literals in components. Use the theme tokens (`var(--ink)`, `var(--surface)`, …) — a literal will not follow dark mode. Brand accents and illustrative SVG fills are the exception.
- No brutalist offset shadows (`shadow-[4px_4px_0px_*]`).
- No `rounded-none`. No heavy borders (3px+).
- No `uppercase` on page titles, card titles, KPI labels, buttons, body. Only: sidebar section dividers, table column headers (dense view), status pills.
- No `font-mono`, no monospace anywhere.
- No gradients, blur, glassmorphism.
- No opacity on brand-color fills/borders (sole exception: area-chart fills at ~15%).
- No full-section brand-color fills. Max one spotlight KPI per view.
- No recharts defaults — always override `stroke`, `fill`, `tick`, `tickLine`, `axisLine`, grid, tooltip.
- No mixing locale formats in a single table — commit to Chilean (CLP `$12.345`, dates `22 abr 2026`) and stick with it.
- No comic-book devices, no halftone treatments.

---

## HOW TO USE IN CLAUDE CODE

`CLAUDE.md` already includes:

```markdown
## Dashboard UI

Before building or modifying any dashboard component, read `docs/STYLE_DASHBOARD.md` in full.
```

Claude Code picks this up automatically at the start of any dashboard session.
