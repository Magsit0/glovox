import { redirect } from "next/navigation";
import { Download, Inbox } from "lucide-react";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import type { DataScope } from "@/lib/scopes";
import {
  eventoPorDefecto,
  filasExport,
  getCompradoresEventOptions,
  getCompradoresPreview,
  getCompradoresResumen,
  type CompradoresClaseRow,
  type CompradoresEventoRow,
  type CompradoresKpis,
} from "@/lib/queries/compradores";
import {
  claseColor,
  claseLabel,
  exportColumns,
  quienLabel,
  filtersToSearchParams,
  formatCell,
  parseCompradoresParams,
  type CompradoresEventOption,
  type CompradoresFilters as Filters,
  type CompradoresModo,
  type ExportColumn,
  type ExportRow,
} from "@/lib/compradores/filtros";
import CompradoresFilters from "./_components/CompradoresFilters";

export const dynamic = "force-dynamic";

const RUTA = "/marketing/compradores";
const PREVIEW_LIMIT = 50;

/** Hoy en hora de Santiago (UTC voltearía el día a las ~20:00 locales). */
function hoyISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

const INT = new Intl.NumberFormat("es-CL");
const fmtInt = (v: number) => INT.format(v);

/** Porcentaje con un decimal ("65,2%"); "—" sin denominador. */
function fmtPct(parte: number, total: number): string {
  if (!total) return "—";
  return (
    ((parte / total) * 100).toLocaleString("es-CL", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + "%"
  );
}

const FECHA = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** "2026-11-15" → "15 nov 2026". Fecha de calendario (sin zona): se arma en UTC. */
function fmtFecha(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return FECHA.format(Date.UTC(y, m - 1, d));
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CompradoresPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Acceso por grant de dashboard (prefijo /marketing/compradores); el proxy
  // ya lo exige, esto es el refuerzo server-side. El scope de país de la
  // sesión acota las ticketeras, igual que en /marketing/weekly.
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  if (!canAccessPath(session.user.permissions ?? [], RUTA)) {
    redirect("/?unauthorized=1");
  }
  const scope: DataScope = { country: session.user.country ?? null };

  const sp = await searchParams;
  const { filters: parsed, eventosExplicitos } = parseCompradoresParams(sp);
  const hasParams = Object.keys(sp).length > 0;

  const events = await getCompradoresEventOptions(scope);
  if (events.length === 0) {
    return (
      <Shell>
        <Heading />
        <EmptyCard>No hay eventos con tickets para tu alcance.</EmptyCard>
      </Shell>
    );
  }

  // Sin selección en la URL: el próximo evento por fecha (o el último realizado).
  let filters: Filters = parsed;
  if (!eventosExplicitos) {
    const def = eventoPorDefecto(events, hoyISO());
    filters = { ...parsed, eventos: def ? [def] : [] };
  }

  const [resumen, preview] = await Promise.all([
    getCompradoresResumen(filters, scope),
    getCompradoresPreview(filters, scope, PREVIEW_LIMIT),
  ]);

  const filas = filasExport(resumen.kpis, filters.modo);
  const cols = exportColumns(filters.modo, filters.datos);
  const quien = quienLabel(filters.datos);
  const csvHref = `/api${RUTA}/csv?${filtersToSearchParams(filters).toString()}`;

  return (
    <Shell>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Heading />
        <DownloadLink href={csvHref} filas={filas} modo={filters.modo} />
      </div>

      <CompradoresFilters events={events} filters={filters} hasParams={hasParams} />

      <p className="-mt-4 font-sans text-sm text-[var(--ink-muted)]">
        Selección: <span className="text-[var(--ink)]">{describirSeleccion(filters, events)}</span>
      </p>

      <KpiRow kpis={resumen.kpis} quien={quien} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <CoberturaEventos rows={resumen.porEvento} quien={quien} />
        <Composicion
          rows={resumen.porClase}
          total={resumen.kpis.tickets}
          compradores={filters.datos === "compradores"}
        />
        <Preview cols={cols} rows={preview} filas={filas} modo={filters.modo} />
      </div>
    </Shell>
  );
}

// ---------- Texto de la selección ----------

function describirSeleccion(filters: Filters, events: CompradoresEventOption[]): string {
  const partes: string[] = [];
  if (filters.eventos.length === 1) {
    const ev = events.find((e) => e.eventoId === filters.eventos[0]);
    partes.push(ev ? `${ev.nombre} (${ev.eventoId})` : filters.eventos[0]);
  } else if (filters.eventos.length > 1) {
    partes.push(`${filters.eventos.length} eventos`);
  } else if (filters.categorias.length > 0) {
    partes.push(
      filters.categorias.length === 1
        ? `todos los eventos de ${filters.categorias[0]}`
        : `todos los eventos de ${filters.categorias.length} categorías`,
    );
  } else {
    partes.push("todos los eventos");
  }
  partes.push(
    filters.tipo === "ventas"
      ? "solo ventas"
      : filters.tipo === "cortesias"
        ? "solo cortesías"
        : "ventas y cortesías",
  );
  const quien = quienLabel(filters.datos);
  partes.push(filters.datos === "compradores" ? "datos del comprador" : "datos del nominado");
  if (filters.contacto === "email") partes.push(`solo con email ${quien}`);
  if (filters.contacto === "telefono") partes.push(`solo con teléfono ${quien}`);
  partes.push(filters.modo === "ticket" ? "una fila por ticket" : "una fila por persona");
  return partes.join(" · ");
}

// ---------- Layout ----------

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main id="main-content" className="min-h-screen bg-[var(--surface-alt)]">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
        {children}
      </div>
    </main>
  );
}

function Heading() {
  return (
    <header className="flex flex-col gap-2">
      <p className="font-sans text-xs text-[var(--ink-muted)]">Marketing</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[var(--ink)]">
        Compradores
      </h1>
      <p className="max-w-3xl font-sans text-sm text-[var(--ink-muted)]">
        Lista de contacto de los asistentes (nominados en el ticket) o de los compradores: nombre, email y teléfono, por
        evento y por tipo (ventas o cortesías). Descarga el CSV con los filtros aplicados y revisa
        qué tan completa viene la data en cada evento.
      </p>
    </header>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[var(--divider)] bg-[var(--surface)] py-12 font-sans text-sm text-[var(--ink-subtle)]">
      <Inbox className="h-6 w-6" />
      {children}
    </div>
  );
}

function DownloadLink({
  href,
  filas,
  modo,
}: {
  href: string;
  filas: number;
  modo: CompradoresModo;
}) {
  const caption = `${fmtInt(filas)} ${filas === 1 ? "fila" : "filas"} · ${
    modo === "ticket" ? "una por ticket" : "una por persona"
  }`;
  const base =
    "inline-flex items-center gap-2 rounded-lg px-4 py-2 font-sans text-sm font-medium transition-colors";
  return (
    <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
      {filas > 0 ? (
        <a href={href} download className={`${base} bg-[#9F99F8] text-white hover:bg-[#8780F0]`}>
          <Download className="h-4 w-4" />
          Descargar CSV
        </a>
      ) : (
        <span
          aria-disabled="true"
          className={`${base} cursor-not-allowed bg-[#9F99F8] text-white opacity-60`}
        >
          <Download className="h-4 w-4" />
          Descargar CSV
        </span>
      )}
      <span className="font-sans text-xs text-[var(--ink-muted)]">
        {filas > 0 ? caption : "Sin filas con los filtros actuales"}
      </span>
    </div>
  );
}

// ---------- KPIs ----------

function KpiRow({ kpis, quien }: { kpis: CompradoresKpis; quien: string }) {
  const cards = [
    {
      label: "Contactos únicos",
      value: fmtInt(kpis.contactosUnicos),
      caption: `${fmtInt(kpis.emailsUnicos)} emails · ${fmtInt(kpis.telefonosUnicos)} teléfonos distintos`,
    },
    {
      label: "Tickets",
      value: fmtInt(kpis.tickets),
      caption: `${fmtInt(kpis.personas)} personas · ${fmtInt(kpis.ventas)} ventas · ${fmtInt(kpis.cortesias)} cortesías`,
    },
    {
      label: `Con email ${quien}`,
      value: fmtPct(kpis.conEmail, kpis.tickets),
      caption: `${fmtInt(kpis.conEmail)} de ${fmtInt(kpis.tickets)} tickets`,
    },
    {
      label: `Con teléfono ${quien}`,
      value: fmtPct(kpis.conTelefono, kpis.tickets),
      caption: `${fmtInt(kpis.conTelefono)} de ${fmtInt(kpis.tickets)} tickets`,
    },
  ];
  return (
    <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((k) => (
        <article
          key={k.label}
          className="flex flex-col rounded-lg border border-[var(--divider)] bg-[var(--surface)] p-6"
        >
          <p className="font-sans text-xs text-[var(--ink-muted)]">{k.label}</p>
          <p className="mt-2 font-display text-4xl font-bold leading-none tracking-tight text-[var(--ink)]">
            {k.value}
          </p>
          <p className="mt-3 truncate font-sans text-xs text-[var(--ink-muted)]" title={k.caption}>
            {k.caption}
          </p>
        </article>
      ))}
    </section>
  );
}

// ---------- Tablas ----------

const TH = "px-4 py-3 text-left font-sans text-xs font-medium text-[var(--ink-muted)]";
const TH_NUM = `${TH} text-right`;
const TD = "px-4 py-3 font-sans text-sm text-[var(--ink)]";
const TD_NUM = `${TD} text-right tabular-nums`;

function PanelHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="border-b border-[var(--divider)] px-6 py-4">
      <h2 className="font-display text-lg font-bold tracking-tight text-[var(--ink)]">{title}</h2>
      <p className="mt-1 font-sans text-sm text-[var(--ink-muted)]">{subtitle}</p>
    </header>
  );
}

function CoberturaEventos({ rows, quien }: { rows: CompradoresEventoRow[]; quien: string }) {
  return (
    <article className="overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] lg:col-span-8">
      <PanelHeader
        title="Cobertura por evento"
        subtitle={`Cuántos tickets de la selección traen email y teléfono ${quien}. Sirve para saber de qué eventos se puede sacar una lista de contacto útil.`}
      />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 font-sans text-sm text-[var(--ink-subtle)]">
          <Inbox className="h-6 w-6" />
          Sin tickets con los filtros actuales.
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--divider)] bg-[var(--surface-alt)]">
                <th className={`${TH} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Evento</th>
                <th className={`${TH} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Fecha</th>
                <th className={`${TH} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Ticketera</th>
                <th className={`${TH_NUM} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Tickets</th>
                <th className={`${TH_NUM} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Ventas</th>
                <th className={`${TH_NUM} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Cortesías</th>
                <th className={`${TH_NUM} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Con email</th>
                <th className={`${TH_NUM} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Con teléfono</th>
                <th className={`${TH_NUM} sticky top-0 z-10 bg-[var(--surface-alt)]`}>Emails únicos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.eventoId}
                  className="border-b border-[var(--divider)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--surface-alt)]"
                >
                  <td className={TD}>
                    <span className="flex flex-col">
                      <span className="truncate" title={r.nombre}>
                        {r.nombre}
                      </span>
                      <span className="font-sans text-xs text-[var(--ink-subtle)]">{r.eventoId}</span>
                    </span>
                  </td>
                  <td className={`${TD} text-[var(--ink-muted)]`}>{fmtFecha(r.fecha)}</td>
                  <td className={`${TD} text-[var(--ink-muted)]`}>{r.ticketera || "—"}</td>
                  <td className={TD_NUM}>{fmtInt(r.tickets)}</td>
                  <td className={`${TD_NUM} text-[var(--ink-muted)]`}>{fmtInt(r.ventas)}</td>
                  <td className={`${TD_NUM} text-[var(--ink-muted)]`}>{fmtInt(r.cortesias)}</td>
                  <td className={TD_NUM}>
                    <Cobertura parte={r.conEmail} total={r.tickets} />
                  </td>
                  <td className={TD_NUM}>
                    <Cobertura parte={r.conTelefono} total={r.tickets} />
                  </td>
                  <td className={TD_NUM}>{fmtInt(r.emailsUnicos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

/** Conteo + porcentaje con punto de estado: verde ≥ 70%, amarillo ≥ 30%, rosa bajo eso. */
function Cobertura({ parte, total }: { parte: number; total: number }) {
  const pct = total ? parte / total : 0;
  const dot = !total ? "var(--ink-subtle)" : pct >= 0.7 ? "#B1D750" : pct >= 0.3 ? "#F6C544" : "#ED75A0";
  return (
    <span className="inline-flex flex-col items-end">
      <span>{fmtInt(parte)}</span>
      <span className="inline-flex items-center gap-1.5 font-sans text-xs text-[var(--ink-muted)]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
        {fmtPct(parte, total)}
      </span>
    </span>
  );
}

function Composicion({
  rows,
  total,
  compradores,
}: {
  rows: CompradoresClaseRow[];
  total: number;
  compradores: boolean;
}) {
  const ventas = rows
    .filter((r) => r.clase === "VENTA" || r.clase === "PASE TEMPORADA")
    .reduce((a, r) => a + r.tickets, 0);
  const cortesias = total - ventas;
  return (
    <article className="flex flex-col rounded-lg border border-[var(--divider)] bg-[var(--surface)] lg:col-span-4">
      <PanelHeader
        title="Composición por tipo"
        subtitle="Tickets de la selección por clase, con la cobertura de email de cada una."
      />
      <div className="flex flex-1 flex-col gap-5 p-6">
        <div className="flex items-center gap-4 font-sans text-sm text-[var(--ink)]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
            Ventas <span className="tabular-nums text-[var(--ink-muted)]">{fmtInt(ventas)}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ED75A0]" />
            Cortesías <span className="tabular-nums text-[var(--ink-muted)]">{fmtInt(cortesias)}</span>
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="font-sans text-sm text-[var(--ink-subtle)]">Sin tickets con los filtros actuales.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {rows.map((r) => {
              const share = total ? (r.tickets / total) * 100 : 0;
              return (
                <li key={r.clase} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 font-sans text-sm">
                    <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: claseColor(r.clase) }}
                      />
                      {claseLabel(r.clase)}
                    </span>
                    <span className="tabular-nums text-[var(--ink)]">
                      {fmtInt(r.tickets)}{" "}
                      <span className="text-xs text-[var(--ink-muted)]">({fmtPct(r.tickets, total)})</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--grid)]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${share}%`, backgroundColor: claseColor(r.clase) }}
                    />
                  </div>
                  <p className="font-sans text-xs text-[var(--ink-muted)]">
                    {fmtPct(r.conEmail, r.tickets)} con email · {fmtPct(r.conTelefono, r.tickets)}{" "}
                    con teléfono · {fmtInt(r.personas)} personas
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-auto font-sans text-xs text-[var(--ink-subtle)]">
          {compradores
            ? "Las cortesías casi nunca traen comprador (no hubo compra). El teléfono del comprador solo lo entrega Fever: en PuntoTicket y TeleTicket viene vacío."
            : "Las cortesías sin canjear no tienen nominado: por eso su cobertura suele ser más baja. Fever (Perú y GRID PE) solo pide datos del asistente en eventos nominales."}
        </p>
      </div>
    </article>
  );
}

function Preview({
  cols,
  rows,
  filas,
  modo,
}: {
  cols: ExportColumn[];
  rows: ExportRow[];
  filas: number;
  modo: CompradoresModo;
}) {
  const subtitle =
    filas === 0
      ? "El CSV lleva exactamente estas columnas."
      : `Primeras ${fmtInt(Math.min(rows.length, PREVIEW_LIMIT))} de ${fmtInt(filas)} filas, con las mismas columnas y el mismo orden que el CSV (${
          modo === "ticket" ? "compras más recientes primero" : "última compra más reciente primero"
        }).`;
  return (
    <article className="overflow-hidden rounded-lg border border-[var(--divider)] bg-[var(--surface)] lg:col-span-12">
      <PanelHeader title="Vista previa del CSV" subtitle={subtitle} />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 font-sans text-sm text-[var(--ink-subtle)]">
          <Inbox className="h-6 w-6" />
          Sin filas con los filtros actuales.
        </div>
      ) : (
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full border-collapse whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--divider)] bg-[var(--surface-alt)]">
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={`${c.align === "right" ? TH_NUM : TH} sticky top-0 z-10 bg-[var(--surface-alt)]`}
                  >
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={i}
                  className="border-b border-[var(--divider)] transition-colors duration-150 last:border-b-0 hover:bg-[var(--surface-alt)]"
                >
                  {cols.map((c) => {
                    const text = formatCell(c, r[c.key]);
                    return (
                      <td
                        key={c.key}
                        className={`${c.align === "right" ? TD_NUM : TD} ${
                          text ? "" : "text-[var(--ink-subtle)]"
                        }`}
                      >
                        {text || "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
