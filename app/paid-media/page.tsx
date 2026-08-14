import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/permissions";
import {
  getAccountOptions,
  getAdsetOptions,
  getByAccount,
  getByAdset,
  getByCampaign,
  getByCurrency,
  getByObjective,
  getByPlatform,
  getCampaignOptions,
  getDaily,
  getDateRange,
  getKpis,
  getObjectiveOptions,
  getPlatformOptions,
  getByEvento,
  getOtrasCampanias,
  getEventoPrefixes,
  parseDisplayCurrency,
  type DisplayCurrency,
  type PaidMediaFilters,
  type Plataforma,
  type PlataformaOption,
} from "@/lib/queries/paidMedia";
import PaidMediaFilters_ from "@/components/paid-media/PaidMediaFilters";
import KpiRow from "@/components/paid-media/KpiRow";
import EvolucionChart from "@/components/paid-media/EvolucionChart";
import BreakdownTable from "@/components/paid-media/BreakdownTable";
import MixDonut from "@/components/paid-media/MixDonut";
import ActiveContext from "@/components/paid-media/ActiveContext";
import PaidMediaTabs, {
  type PaidMediaTabKey,
} from "@/components/paid-media/PaidMediaTabs";
import OverallTable from "@/components/paid-media/OverallTable";
import CurrencySwitch from "@/components/paid-media/CurrencySwitch";
import { formatDate, plataformaLabel } from "@/components/paid-media/format";

// La ruta NO debe cachearse mientras el mart pueda devolver `gasto_usd` NULL o
// un tipo de cambio provisional: un `use cache` con `cacheLife` de horas
// congelaría el número del día en curso y la corrección del pipeline de FX no
// se propagaría hasta que expire. Si alguna vez se cachea, el `cacheLife` tiene
// que ser menor que la distancia hasta la publicación del tipo de cambio, con
// `cacheTag` invalidado cuando cambie MAX(fecha) de referencia.tipo_cambio.
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
    moneda?: string;
    currency?: string;
    plataforma?: string | string[];
    prefix?: string;
    account?: string | string[];
    campaign?: string | string[];
    adset?: string | string[];
    objective?: string | string[];
    from?: string;
    to?: string;
  }>;
}

function parsePlataforma(v?: string): Plataforma | undefined {
  return v === "meta" || v === "google" || v === "tiktok" ? v : undefined;
}

function parseStringList(v: string | string[] | undefined): string[] {
  const values = Array.isArray(v) ? v : v ? [v] : [];
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

function parsePlataformaList(v: string | string[] | undefined): Plataforma[] {
  return parseStringList(v).flatMap((item) => {
    const plataforma = parsePlataforma(item);
    return plataforma ? [plataforma] : [];
  });
}

export default async function PaidMediaPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/paid-media")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;
  const tab: PaidMediaTabKey = params.tab === "detalle" ? "detalle" : "overall";

  const from = params.from || undefined;
  const to = params.to || undefined;
  const plataformas = parsePlataformaList(params.plataforma);
  // Moneda de DESPLIEGUE (no filtra datos, solo cambia la unidad). USD por
  // defecto: es la unidad canónica del mart y la que compara cuentas de países
  // distintos.
  const moneda = parseDisplayCurrency(params.moneda);

  // ── Canonicalización de la URL ───────────────────────────────────
  // Va ANTES de cualquier query y FUERA de los try/catch de abajo: `redirect()`
  // funciona lanzando un NEXT_REDIRECT, y esos catch lo tratarían como un error
  // del dashboard, mostrando "NEXT_REDIRECT" en la pantalla de error en vez de
  // navegar. Se resuelven las dos canonicalizaciones en un solo salto, porque
  // con force-dynamic cada redirect vuelve a pagar auth() y todas las queries.
  //
  // `currency` es un parámetro MUERTO: el dashboard ya no filtra por moneda.
  // Sigue viniendo en links compartidos por Slack y en bookmarks, así que se
  // limpia de la URL en vez de ignorarse en silencio.
  const sobraCurrency = params.currency != null;
  const sobranPlataformas = tab === "overall" && plataformas.length > 1;
  if (sobraCurrency || sobranPlataformas) {
    const qs = new URLSearchParams();
    if (tab === "detalle") qs.set("tab", "detalle");
    if (moneda !== "USD") qs.set("moneda", moneda);
    // El tab Overall es mono-plataforma (se elige con las PlatformPills): si la
    // URL trae varias, canonicalizamos a la primera para que URL, datos y pill
    // resaltada queden consistentes.
    const platsCanon = tab === "overall" ? plataformas.slice(0, 1) : plataformas;
    for (const p of platsCanon) qs.append("plataforma", p);
    if (params.prefix) qs.set("prefix", params.prefix);
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    for (const p of parseStringList(params.account)) qs.append("account", p);
    for (const p of parseStringList(params.campaign)) qs.append("campaign", p);
    for (const p of parseStringList(params.adset)) qs.append("adset", p);
    for (const p of parseStringList(params.objective)) qs.append("objective", p);
    const s = qs.toString();
    redirect(`/paid-media${s ? `?${s}` : ""}`);
  }

  const plataforma = plataformas[0];

  // ── Tab Overall: resumen transversal por evento ──────────────────
  if (tab === "overall") {
    let dateRange;
    let platforms;
    let prefixes: string[];
    let prefix: string | undefined;
    let eventos;
    let otras;
    try {
      [dateRange, platforms, prefixes] = await Promise.all([
        getDateRange(),
        getPlatformOptions(),
        getEventoPrefixes({ plataforma, from, to }, moneda),
      ]);
      // Familia de evento: default GLO (Chile). Si la URL trae una válida, manda;
      // si GLO no existe en el scope, cae a la de mayor gasto.
      prefix =
        params.prefix && prefixes.includes(params.prefix)
          ? params.prefix
          : prefixes.includes("GLO")
            ? "GLO"
            : prefixes[0];
      [eventos, otras] = await Promise.all([
        getByEvento({ plataforma, prefix, from, to }, moneda),
        getOtrasCampanias({ plataforma, from, to }, moneda),
      ]);
    } catch (err) {
      return (
        <Shell>
          <Heading />
          <PaidMediaTabs active="overall" moneda={moneda} plataforma={plataforma} from={from} to={to} />
          <ErrorView message={errorMessage(err)} />
        </Shell>
      );
    }
    return (
      <Shell>
        <Heading dateRange={dateRange} />
        <PaidMediaTabs
          active="overall"
          moneda={moneda}
          plataforma={plataforma}
          prefix={prefix}
          from={from}
          to={to}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-3">
            <CurrencySwitch
              active={moneda}
              hrefFor={(m) =>
                overallHref({ moneda: m, plataforma, prefix, from, to })
              }
            />
            <PlatformPills
              platforms={platforms}
              active={plataforma}
              moneda={moneda}
              prefix={prefix}
              from={from}
              to={to}
            />
          </div>
          <PrefixPills
            prefixes={prefixes}
            active={prefix}
            moneda={moneda}
            plataforma={plataforma}
            from={from}
            to={to}
          />
        </div>
        <OverallTable rows={eventos} moneda={moneda} />
        <BreakdownTable
          title="Otras campañas"
          subtitle="Campañas cuyo evento no mapea a ningún registro del catálogo — gasto que no quedó atribuido. Una fila por campaña. No responde al filtro de familia: por definición estas campañas no tienen familia conocida."
          columnLabel="Campaña"
          rows={otras.rows}
          moneda={moneda}
          total={otras.total}
          scrollable
          emptyText="No hay campañas sin evento en este scope."
        />
      </Shell>
    );
  }

  // ── Tab Detalle: dashboard completo con filtros y drill-down ─────
  const accountIds = parseStringList(params.account);
  const campaignIds = parseStringList(params.campaign);
  const adsetIds = parseStringList(params.adset);
  const objectives = parseStringList(params.objective);

  const filters: PaidMediaFilters = {
    plataformas,
    accountIds,
    campaignIds,
    adsetIds,
    objectives,
    from,
    to,
  };

  let platforms;
  let accounts;
  let campaignOptions;
  let adsetOptions;
  let objectiveOptions;
  let dateRange;
  let kpis;
  let porMoneda;
  let daily;
  let byPlatform;
  let byObjective;
  let byAccount;
  let byCampaign;
  let byAdset;
  try {
    [
      platforms,
      accounts,
      campaignOptions,
      adsetOptions,
      objectiveOptions,
      dateRange,
      kpis,
      porMoneda,
      daily,
      byPlatform,
      byObjective,
      byAccount,
      byCampaign,
      byAdset,
    ] = await Promise.all([
      getPlatformOptions(),
      getAccountOptions(plataformas),
      getCampaignOptions(accountIds),
      getAdsetOptions(campaignIds),
      getObjectiveOptions(plataformas),
      getDateRange(),
      getKpis(filters, moneda),
      getByCurrency(filters, moneda),
      getDaily(filters, moneda),
      // El donut de plataformas solo aporta si hay 0 o 2+ plataformas: con
      // exactamente UNA seleccionada queda un único slice y no aporta nada.
      plataformas.length === 1
        ? Promise.resolve({ rows: [], total: 0 })
        : getByPlatform(filters, moneda),
      getByObjective(filters, moneda),
      getByAccount(filters, moneda),
      getByCampaign(filters, moneda),
      getByAdset(filters, moneda),
    ]);
  } catch (err) {
    return (
      <Shell>
        <Heading />
        <ErrorView message={errorMessage(err)} />
      </Shell>
    );
  }

  // Resolvemos cada id seleccionado a su nombre; si el id no está en la lista
  // de opciones (en cascada) caemos al id crudo para no perder filtros que sí
  // están aplicados en baseCte — así el contador de ActiveContext nunca miente.
  const selectedAccounts = accountIds.map(
    (id) => accounts.find((a) => a.accountId === id)?.accountName || id,
  );
  const selectedCampaigns = campaignIds.map(
    (id) =>
      campaignOptions.find((c) => c.campaignId === id)?.campaignName || id,
  );
  const selectedAdsets = adsetIds.map(
    (id) => adsetOptions.find((a) => a.adsetId === id)?.adsetName || id,
  );

  // searchParams que se pasan a los links de drill-down — no incluyen el
  // valor que el link mismo va a setear (lo agrega BreakdownTable).
  const baseQuery: Record<string, string | string[] | undefined> = {
    tab: "detalle",
    moneda: moneda === "USD" ? undefined : moneda,
    plataforma: plataformas,
    account: accountIds,
    campaign: campaignIds,
    adset: adsetIds,
    objective: objectives,
    from,
    to,
  };

  return (
    <Shell>
      <Heading dateRange={dateRange} />

      <PaidMediaTabs
        active="detalle"
        moneda={moneda}
        plataforma={plataformas}
        from={from}
        to={to}
      />

      <CurrencySwitch
        active={moneda}
        hrefFor={(m) => detalleHref(m, params)}
      />

      <PaidMediaFilters_
        platforms={platforms}
        accounts={accounts}
        campaigns={campaignOptions}
        adsets={adsetOptions}
        objectives={objectiveOptions}
        plataformas={plataformas}
        accountIds={accountIds}
        campaignIds={campaignIds}
        adsetIds={adsetIds}
        selectedObjectives={objectives}
        from={from ?? ""}
        to={to ?? ""}
      />

      <ActiveContext
        plataformas={plataformas.map(plataformaLabel)}
        accounts={selectedAccounts}
        campaigns={selectedCampaigns}
        adsets={selectedAdsets}
        objectives={objectives}
        from={from ?? ""}
        to={to ?? ""}
      />

      <KpiRow kpis={kpis} porMoneda={porMoneda} moneda={moneda} />

      <EvolucionChart rows={daily} moneda={moneda} />

      {byPlatform.rows.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MixDonut
            title="Mix por plataforma"
            subtitle="Distribución del gasto en dólares entre Meta, Google y TikTok."
            rows={byPlatform.rows}
            moneda={moneda}
            labelIsPlataforma
          />
          <MixDonut
            title="Mix por objetivo"
            subtitle="Distribución del gasto en dólares por objetivo de campaña."
            rows={byObjective.rows}
            moneda={moneda}
          />
        </div>
      )}

      {byPlatform.rows.length === 0 && (
        <MixDonut
          title="Mix por objetivo"
          subtitle="Distribución del gasto en dólares por objetivo de campaña en la plataforma activa."
          rows={byObjective.rows}
          moneda={moneda}
        />
      )}

      <BreakdownTable
        title="Cuentas"
        subtitle="Una fila por cuenta publicitaria, ordenada por gasto en dólares. Cada cuenta factura en una sola moneda. Click para acotar el dashboard a esa cuenta."
        columnLabel="Cuenta"
        rows={byAccount.rows}
        moneda={moneda}
        total={byAccount.total}
        drillParam="account"
        baseSearchParams={baseQuery}
        extraIsPlataforma
      />

      <BreakdownTable
        title="Campañas"
        subtitle="Campañas dentro del scope actual, ordenadas por gasto en dólares. Click para acotar a esa campaña."
        columnLabel="Campaña"
        rows={byCampaign.rows}
        moneda={moneda}
        total={byCampaign.total}
        drillParam="campaign"
        baseSearchParams={baseQuery}
        scrollable
      />

      <BreakdownTable
        title="Adsets"
        subtitle="Adsets dentro del scope actual, ordenados por gasto en dólares. Click para acotar a ese adset."
        columnLabel="Adset"
        rows={byAdset.rows}
        moneda={moneda}
        total={byAdset.total}
        drillParam="adset"
        baseSearchParams={baseQuery}
        scrollable
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-10 sm:px-8">
      {children}
    </div>
  );
}

function Heading({
  dateRange,
}: {
  dateRange?: { min: string; max: string; maxFx: string };
}) {
  // Si el tipo de cambio va por detrás de los datos de ads, el encabezado lo
  // dice: prometer cobertura hasta `max` cuando la conversión solo llega hasta
  // `maxFx` es exactamente lo que hace que el lector deje de confiar en el panel.
  const fxAtrasado =
    dateRange?.maxFx && dateRange?.max && dateRange.maxFx < dateRange.max;

  return (
    <header className="flex flex-col gap-2">
      <p className="font-sans text-xs text-[#666666]">Paid media</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Social media ads
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Rendimiento de campañas pagadas en Meta, Google y TikTok, consolidado en
        dólares: gasto, alcance, CTR, CPC, CPM, conversiones y ROAS desglosado
        por plataforma, cuenta, campaña y adset.
      </p>
      {dateRange?.min && dateRange?.max && (
        <p className="font-sans text-xs text-[#999999]">
          Datos entre {formatDate(dateRange.min)} y {formatDate(dateRange.max)}.
          {fxAtrasado ? (
            <> Conversión a dólares disponible hasta {formatDate(dateRange.maxFx)}.</>
          ) : null}{" "}
          Cada día se convierte con el tipo de cambio de esa fecha, publicado por
          el banco central de cada país; una vez publicado no vuelve a cambiar,
          así que los totales de días cerrados quedan fijos.
        </p>
      )}
    </header>
  );
}

/**
 * Href del tab Detalle cambiando solo la moneda. A diferencia del Overall, acá
 * hay que preservar los drill-downs (cuenta/campaña/adset/objetivo), así que se
 * reconstruye desde los searchParams crudos en vez de enumerar campos.
 */
function detalleHref(
  moneda: DisplayCurrency,
  params: Record<string, string | string[] | undefined>,
): string {
  const qs = new URLSearchParams();
  qs.set("tab", "detalle");
  // USD es el default: se omite de la URL para que los links queden limpios.
  if (moneda !== "USD") qs.set("moneda", moneda);
  for (const key of ["plataforma", "account", "campaign", "adset", "objective"]) {
    const v = params[key];
    for (const item of Array.isArray(v) ? v : v ? [v] : []) qs.append(key, item);
  }
  for (const key of ["from", "to"]) {
    const v = params[key];
    if (typeof v === "string" && v) qs.set(key, v);
  }
  return `/paid-media?${qs.toString()}`;
}

/** Construye un href del tab Overall preservando el scope global. */
function overallHref(next: {
  moneda?: DisplayCurrency;
  plataforma?: string;
  prefix?: string;
  from?: string;
  to?: string;
}): string {
  const params = new URLSearchParams();
  // USD es el default: se omite de la URL para que los links queden limpios.
  if (next.moneda && next.moneda !== "USD") params.set("moneda", next.moneda);
  if (next.plataforma) params.set("plataforma", next.plataforma);
  if (next.prefix) params.set("prefix", next.prefix);
  if (next.from) params.set("from", next.from);
  if (next.to) params.set("to", next.to);
  const qs = params.toString();
  return `/paid-media${qs ? `?${qs}` : ""}`;
}

const PILL_BASE =
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-xs font-medium transition-colors";
const PILL_ACTIVE = "border-[#9F99F8] bg-[#F0EFFE] text-[#9F99F8]";
const PILL_IDLE = "border-[#E5E5E5] bg-white text-[#333333] hover:border-[#333333]";

function PlatformPills({
  platforms,
  active,
  moneda,
  prefix,
  from,
  to,
}: {
  platforms: PlataformaOption[];
  active?: string;
  moneda: DisplayCurrency;
  prefix?: string;
  from?: string;
  to?: string;
}) {
  if (platforms.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center gap-2">
      <span className="w-16 font-sans text-xs text-[#666666]">Plataforma</span>
      {/* "Todas" limpia el filtro de plataforma. */}
      <Link
        href={overallHref({ moneda, prefix, from, to })}
        aria-current={!active ? "true" : undefined}
        className={`${PILL_BASE} ${!active ? PILL_ACTIVE : PILL_IDLE}`}
      >
        Todas
      </Link>
      {platforms.map((p) => {
        const isActive = p.plataforma === active;
        return (
          <Link
            key={p.plataforma}
            href={overallHref({ moneda, plataforma: p.plataforma, prefix, from, to })}
            aria-current={isActive ? "true" : undefined}
            className={`${PILL_BASE} ${isActive ? PILL_ACTIVE : PILL_IDLE}`}
          >
            {plataformaLabel(p.plataforma)}
          </Link>
        );
      })}
    </section>
  );
}

/** Bandera sutil de fondo para las familias con país conocido (GLO=Chile,
 *  GLP=Perú). El resto de familias no llevan bandera. */
function PrefixFlagBg({ prefix }: { prefix: string }) {
  if (prefix === "GLO") {
    return (
      <svg
        viewBox="0 0 9 6"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
      >
        <rect width="9" height="3" fill="#FFFFFF" />
        <rect y="3" width="9" height="3" fill="#D52B1E" />
        <rect width="3" height="3" fill="#0039A6" />
        <path
          d="M1.5 0.95 L1.69 1.51 L2.28 1.51 L1.8 1.86 L1.99 2.42 L1.5 2.07 L1.01 2.42 L1.2 1.86 L0.72 1.51 L1.31 1.51 Z"
          fill="#FFFFFF"
        />
      </svg>
    );
  }
  if (prefix === "GLP") {
    return (
      <svg
        viewBox="0 0 9 6"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
      >
        <rect width="3" height="6" fill="#D91023" />
        <rect x="3" width="3" height="6" fill="#FFFFFF" />
        <rect x="6" width="3" height="6" fill="#D91023" />
      </svg>
    );
  }
  return null;
}

function PrefixPills({
  prefixes,
  active,
  moneda,
  plataforma,
  from,
  to,
}: {
  prefixes: string[];
  active?: string;
  moneda: DisplayCurrency;
  plataforma?: string;
  from?: string;
  to?: string;
}) {
  if (prefixes.length === 0) return null;

  return (
    <section className="flex flex-wrap items-center justify-end gap-2">
      <span className="font-sans text-xs text-[#666666]">Familia</span>
      {prefixes.map((p) => {
        const isActive = p === active;
        return (
          <Link
            key={p}
            href={overallHref({ moneda, plataforma, prefix: p, from, to })}
            aria-current={isActive ? "true" : undefined}
            className={`relative overflow-hidden ${PILL_BASE} ${
              isActive ? PILL_ACTIVE : PILL_IDLE
            }`}
          >
            <PrefixFlagBg prefix={p} />
            <span className="relative">{p}</span>
          </Link>
        );
      })}
    </section>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#ED75A0] bg-white p-6">
      <span className="mt-1.5 inline-block h-2 w-2 rounded-full bg-[#ED75A0]" />
      <p className="flex-1 font-sans text-sm text-[#333333]">{message}</p>
    </div>
  );
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Error al cargar el dashboard de paid media.";
}
