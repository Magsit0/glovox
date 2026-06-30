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
  getByObjective,
  getByPlatform,
  getCampaignOptions,
  getCurrencyOptions,
  getDaily,
  getDateRange,
  getKpis,
  getObjectiveOptions,
  getPlatformOptions,
  getByEvento,
  getOtrasCampanias,
  getEventoPrefixes,
  type PaidMediaFilters,
  type Plataforma,
  type CurrencyOption,
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
import { compactMoney, plataformaLabel } from "@/components/paid-media/format";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    tab?: string;
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

  // Las monedas viven separadas: el resto del dashboard no tiene sentido sin
  // una elegida. Si no viene en la URL, agarro la de mayor gasto.
  const currencies = await getCurrencyOptions();
  if (currencies.length === 0) {
    return (
      <Shell>
        <Heading />
        <EmptyState message="La tabla paidMedia.ads_performance está vacía." />
      </Shell>
    );
  }

  const currency =
    (params.currency && currencies.some((c) => c.currency === params.currency)
      ? params.currency
      : null) ?? currencies[0].currency;

  const from = params.from || undefined;
  const to = params.to || undefined;
  const plataformas = parsePlataformaList(params.plataforma);
  const plataforma = plataformas[0];

  // ── Tab Overall: resumen transversal por evento ──────────────────
  if (tab === "overall") {
    // El tab Overall es mono-plataforma (se elige con las PlatformPills) y sus
    // queries usan `plataforma` escalar. Si la URL llega con varias plataformas
    // (p. ej. al volver desde el Detalle multi-select), canonicalizamos a la
    // primera para que URL, datos y pill resaltada queden consistentes.
    if (plataformas.length > 1) {
      const qs = new URLSearchParams();
      qs.set("tab", "overall");
      qs.set("currency", currency);
      qs.set("plataforma", plataformas[0]);
      if (params.prefix) qs.set("prefix", params.prefix);
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      redirect(`/paid-media?${qs.toString()}`);
    }
    let dateRange;
    let platforms;
    let prefixes: string[];
    let prefix: string | undefined;
    let eventos;
    let otras;
    try {
      [dateRange, platforms, prefixes] = await Promise.all([
        getDateRange(currency),
        getPlatformOptions(),
        getEventoPrefixes({ currency, plataforma, from, to }),
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
        getByEvento({ currency, plataforma, prefix, from, to }),
        getOtrasCampanias({ currency, plataforma, from, to }),
      ]);
    } catch (err) {
      return (
        <Shell>
          <Heading />
          <PaidMediaTabs
            active="overall"
            currency={currency}
            plataforma={plataforma}
            from={from}
            to={to}
          />
          <ErrorView message={errorMessage(err)} />
        </Shell>
      );
    }
    return (
      <Shell>
        <Heading dateRange={dateRange} />
        <PaidMediaTabs
          active="overall"
          currency={currency}
          plataforma={plataforma}
          prefix={prefix}
          from={from}
          to={to}
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-3">
            <CurrencyPills
              currencies={currencies}
              active={currency}
              plataforma={plataforma}
              prefix={prefix}
              from={from}
              to={to}
            />
            <PlatformPills
              platforms={platforms}
              active={plataforma}
              currency={currency}
              prefix={prefix}
              from={from}
              to={to}
            />
          </div>
          <PrefixPills
            prefixes={prefixes}
            active={prefix}
            currency={currency}
            plataforma={plataforma}
            from={from}
            to={to}
          />
        </div>
        <OverallTable rows={eventos} currency={currency} />
        <BreakdownTable
          title="Otras campañas"
          subtitle="Campañas cuyo nombre no arranca con un EventoID reconocible — gasto que no quedó atribuido a un evento. Una fila por campaña. No se ve afectada por el filtro de familia."
          columnLabel="Campaña"
          rows={otras}
          currency={currency}
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
    currency,
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
      daily,
      byPlatform,
      byObjective,
      byAccount,
      byCampaign,
      byAdset,
    ] = await Promise.all([
      getPlatformOptions(),
      getAccountOptions(currency, plataformas),
      getCampaignOptions(currency, accountIds),
      getAdsetOptions(currency, campaignIds),
      getObjectiveOptions(currency, plataformas),
      getDateRange(currency),
      getKpis(filters),
      getDaily(filters),
      // El donut de plataformas solo aporta si hay 0 o 2+ plataformas: con
      // exactamente UNA seleccionada queda un único slice y no aporta nada.
      plataformas.length === 1 ? Promise.resolve([]) : getByPlatform(filters),
      getByObjective(filters),
      getByAccount(filters),
      getByCampaign(filters),
      getByAdset(filters),
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
    currency,
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
        currency={currency}
        plataforma={plataformas}
        from={from}
        to={to}
      />

      <PaidMediaFilters_
        currencies={currencies}
        platforms={platforms}
        accounts={accounts}
        campaigns={campaignOptions}
        adsets={adsetOptions}
        objectives={objectiveOptions}
        currency={currency}
        plataformas={plataformas}
        accountIds={accountIds}
        campaignIds={campaignIds}
        adsetIds={adsetIds}
        selectedObjectives={objectives}
        from={from ?? ""}
        to={to ?? ""}
      />

      <ActiveContext
        currency={currency}
        plataformas={plataformas.map(plataformaLabel)}
        accounts={selectedAccounts}
        campaigns={selectedCampaigns}
        adsets={selectedAdsets}
        objectives={objectives}
        from={from ?? ""}
        to={to ?? ""}
      />

      <KpiRow kpis={kpis} currency={currency} />

      <EvolucionChart rows={daily} currency={currency} />

      {byPlatform.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <MixDonut
            title="Mix por plataforma"
            subtitle="Distribución del gasto entre Meta y Google."
            rows={byPlatform}
            currency={currency}
            labelIsPlataforma
          />
          <MixDonut
            title="Mix por objetivo"
            subtitle="Distribución del gasto por objetivo de campaña."
            rows={byObjective}
            currency={currency}
          />
        </div>
      )}

      {byPlatform.length === 0 && (
        <MixDonut
          title="Mix por objetivo"
          subtitle="Distribución del gasto por objetivo de campaña en la plataforma activa."
          rows={byObjective}
          currency={currency}
        />
      )}

      <BreakdownTable
        title="Cuentas"
        subtitle="Una fila por cuenta publicitaria, ordenada por gasto. Click para acotar el dashboard a esa cuenta."
        columnLabel="Cuenta"
        rows={byAccount}
        currency={currency}
        drillParam="account"
        baseSearchParams={baseQuery}
        extraIsPlataforma
      />

      <BreakdownTable
        title="Campañas"
        subtitle="Top 50 campañas dentro del scope actual. Click para acotar a esa campaña."
        columnLabel="Campaña"
        rows={byCampaign}
        currency={currency}
        drillParam="campaign"
        baseSearchParams={baseQuery}
      />

      <BreakdownTable
        title="Adsets"
        subtitle="Top 50 adsets dentro del scope actual. Click para acotar a ese adset."
        columnLabel="Adset"
        rows={byAdset}
        currency={currency}
        drillParam="adset"
        baseSearchParams={baseQuery}
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

function Heading({ dateRange }: { dateRange?: { min: string; max: string } }) {
  return (
    <header className="flex flex-col gap-2">
      <p className="font-sans text-xs text-[#666666]">Paid media</p>
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-[#333333]">
        Social media ads
      </h1>
      <p className="font-sans text-sm text-[#666666]">
        Rendimiento de campañas pagadas en Meta y Google: gasto, alcance, CTR,
        CPC, CPM, conversiones y ROAS desglosado por plataforma, cuenta,
        campaña y adset.
      </p>
      {dateRange?.min && dateRange?.max && (
        <p className="font-sans text-xs text-[#999999]">
          Datos disponibles entre {dateRange.min} y {dateRange.max}.
        </p>
      )}
    </header>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <section className="rounded-lg border border-[#E5E5E5] bg-white p-8">
      <p className="font-display text-lg font-bold text-[#333333]">
        Sin datos disponibles
      </p>
      <p className="mt-2 font-sans text-sm text-[#666666]">{message}</p>
    </section>
  );
}

/** Construye un href del tab Overall preservando el scope global. */
function overallHref(next: {
  currency?: string;
  plataforma?: string;
  prefix?: string;
  from?: string;
  to?: string;
}): string {
  const params = new URLSearchParams();
  if (next.currency) params.set("currency", next.currency);
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

function CurrencyPills({
  currencies,
  active,
  plataforma,
  prefix,
  from,
  to,
}: {
  currencies: CurrencyOption[];
  active: string;
  plataforma?: string;
  prefix?: string;
  from?: string;
  to?: string;
}) {
  if (currencies.length <= 1) return null;

  return (
    <section className="flex flex-wrap items-center gap-2">
      <span className="w-16 font-sans text-xs text-[#666666]">Moneda</span>
      {currencies.map((c) => {
        const isActive = c.currency === active;
        return (
          <Link
            key={c.currency}
            // Cambiar de moneda mantiene plataforma/familia/fechas pero la moneda
            // nueva manda — el scope de evento es por moneda.
            href={overallHref({ currency: c.currency, plataforma, prefix, from, to })}
            aria-current={isActive ? "true" : undefined}
            className={`${PILL_BASE} ${isActive ? PILL_ACTIVE : PILL_IDLE}`}
          >
            {c.currency}
            <span className="text-[#999999]">·</span>
            <span className={isActive ? "text-[#9F99F8]" : "text-[#666666]"}>
              {compactMoney(c.gasto, c.currency)}
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function PlatformPills({
  platforms,
  active,
  currency,
  prefix,
  from,
  to,
}: {
  platforms: PlataformaOption[];
  active?: string;
  currency: string;
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
        href={overallHref({ currency, prefix, from, to })}
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
            href={overallHref({ currency, plataforma: p.plataforma, prefix, from, to })}
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
  currency,
  plataforma,
  from,
  to,
}: {
  prefixes: string[];
  active?: string;
  currency: string;
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
            href={overallHref({ currency, plataforma, prefix: p, from, to })}
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
