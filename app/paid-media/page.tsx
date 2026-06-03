import Image from "next/image";
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
  type PaidMediaFilters,
  type Plataforma,
} from "@/lib/queries/paidMedia";
import PaidMediaFilters_ from "@/components/paid-media/PaidMediaFilters";
import KpiRow from "@/components/paid-media/KpiRow";
import EvolucionChart from "@/components/paid-media/EvolucionChart";
import BreakdownTable from "@/components/paid-media/BreakdownTable";
import MixDonut from "@/components/paid-media/MixDonut";
import ActiveContext from "@/components/paid-media/ActiveContext";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    currency?: string;
    plataforma?: string;
    account?: string;
    campaign?: string;
    adset?: string;
    objective?: string;
    from?: string;
    to?: string;
  }>;
}

function parsePlataforma(v?: string): Plataforma | undefined {
  return v === "meta" || v === "google" ? v : undefined;
}

export default async function PaidMediaPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  const permissions = session.user.permissions ?? [];
  if (!canAccessPath(permissions, "/paid-media")) {
    redirect("/?unauthorized=1");
  }

  const params = await searchParams;

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

  const plataforma = parsePlataforma(params.plataforma);
  const accountId = params.account || undefined;
  const campaignId = params.campaign || undefined;
  const adsetId = params.adset || undefined;
  const objective = params.objective || undefined;
  const from = params.from || undefined;
  const to = params.to || undefined;

  const filters: PaidMediaFilters = {
    currency,
    plataforma,
    accountId,
    campaignId,
    adsetId,
    objective,
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
      getAccountOptions(currency, plataforma),
      getCampaignOptions(currency, accountId),
      getAdsetOptions(currency, campaignId),
      getObjectiveOptions(currency, plataforma),
      getDateRange(currency),
      getKpis(filters),
      getDaily(filters),
      // Solo nos sirve el donut de plataformas si NO hay filtro activo: si ya
      // se eligió Meta o Google, queda un único slice y no aporta nada.
      plataforma ? Promise.resolve([]) : getByPlatform(filters),
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

  const selectedAccount = accountId
    ? accounts.find((a) => a.accountId === accountId)
    : undefined;
  const selectedCampaign = campaignId
    ? campaignOptions.find((c) => c.campaignId === campaignId)
    : undefined;
  const selectedAdset = adsetId
    ? adsetOptions.find((a) => a.adsetId === adsetId)
    : undefined;

  // searchParams que se pasan a los links de drill-down — no incluyen el
  // valor que el link mismo va a setear (lo agrega BreakdownTable).
  const baseQuery: Record<string, string | undefined> = {
    currency,
    plataforma: plataforma ?? undefined,
    account: accountId,
    campaign: campaignId,
    adset: adsetId,
    objective,
    from,
    to,
  };

  return (
    <Shell>
      <Heading dateRange={dateRange} />

      <PaidMediaFilters_
        currencies={currencies}
        platforms={platforms}
        accounts={accounts}
        campaigns={campaignOptions}
        adsets={adsetOptions}
        objectives={objectiveOptions}
        currency={currency}
        plataforma={plataforma ?? ""}
        accountId={accountId ?? ""}
        campaignId={campaignId ?? ""}
        adsetId={adsetId ?? ""}
        objective={objective ?? ""}
        from={from ?? ""}
        to={to ?? ""}
      />

      <ActiveContext
        currency={currency}
        plataforma={plataforma ?? ""}
        account={selectedAccount}
        campaign={selectedCampaign}
        adset={selectedAdset}
        objective={objective ?? ""}
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
      <Link
        href="/"
        aria-label="Volver al menú principal"
        className="inline-flex w-fit items-center justify-center rounded-full border border-[#E5E5E5] bg-white p-1.5 transition-colors hover:bg-[#FAFAFA]"
      >
        <Image src="/glovox_logo_gvx_black.svg" alt="Glovox" width={18} height={18} />
      </Link>
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
