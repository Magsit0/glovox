"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type {
  AccountOption,
  CampaignOption,
  AdsetOption,
  CurrencyOption,
  PlataformaOption,
} from "@/lib/queries/paidMedia";
import StandardMultiFilter from "@/components/filters/StandardMultiFilter";
import { compactMoney, formatInt, plataformaLabel } from "@/components/paid-media/format";

interface Props {
  currencies: CurrencyOption[];
  platforms: PlataformaOption[];
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  adsets: AdsetOption[];
  objectives: string[];

  currency: string;
  plataformas: string[];
  accountIds: string[];
  campaignIds: string[];
  adsetIds: string[];
  selectedObjectives: string[];
  from: string;
  to: string;
}

const SelectCaret = () => (
  <svg
    viewBox="0 0 12 12"
    className="pointer-events-none absolute right-3 h-3 w-3 text-[#999999]"
    aria-hidden="true"
  >
    <path
      d="M2 4l4 4 4-4"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SELECT_CLS =
  "appearance-none rounded-lg border border-[#E5E5E5] bg-white py-2 pl-3 pr-9 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

const INPUT_CLS =
  "rounded-lg border border-[#E5E5E5] bg-white py-2 px-3 font-sans text-sm text-[#333333] transition-colors hover:border-[#333333] focus:border-[#9F99F8] focus:outline-none focus:ring-1 focus:ring-[#9F99F8]";

export default function PaidMediaFilters({
  currencies,
  platforms,
  accounts,
  campaigns,
  adsets,
  objectives,
  currency,
  plataformas,
  accountIds,
  campaignIds,
  adsetIds,
  selectedObjectives,
  from,
  to,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(patch: Record<string, string | string[] | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.delete(key);
        for (const item of value) params.append(key, item);
      } else {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    router.push(`/paid-media${qs ? `?${qs}` : ""}`);
  }

  const hasActiveFilters =
    plataformas.length > 0 ||
    accountIds.length > 0 ||
    campaignIds.length > 0 ||
    adsetIds.length > 0 ||
    selectedObjectives.length > 0 ||
    Boolean(from) ||
    Boolean(to);

  const platformOptions = platforms.map((p) => ({
    value: p.plataforma,
    label: `${plataformaLabel(p.plataforma)} · ${formatInt(p.rows)}`,
  }));
  const accountOptions = accounts.map((a) => ({
    value: a.accountId,
    label: a.accountName || a.accountId,
    meta: plataformaLabel(a.plataforma),
  }));
  const campaignOptions = campaigns.map((c) => ({
    value: c.campaignId,
    label: c.campaignName || c.campaignId,
    meta: c.objective,
  }));
  const adsetOptions = adsets.map((a) => ({
    value: a.adsetId,
    label: a.adsetName || a.adsetId,
  }));
  const objectiveOptions = objectives.map((o) => ({ value: o, label: o }));

  return (
    <section className="flex flex-wrap items-end gap-3">
      {/* Moneda */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Moneda</span>
        <div className="relative inline-flex items-center">
          <select
            className={SELECT_CLS}
            value={currency}
            onChange={(e) =>
              // Cambiar de moneda invalida el resto del scope (cuentas/campañas
              // viven dentro de su moneda) — reseteamos los filtros dependientes.
              update({
                currency: e.target.value,
                account: null,
                campaign: null,
                adset: null,
                objective: null,
              })
            }
            aria-label="Moneda"
          >
            {currencies.map((c) => (
              <option key={c.currency} value={c.currency}>
                {c.currency} · {compactMoney(c.gasto, c.currency)}
              </option>
            ))}
          </select>
          <SelectCaret />
        </div>
      </label>

      {/* Plataforma */}
      <StandardMultiFilter
        label="Plataforma"
        options={platformOptions}
        selected={new Set(plataformas)}
        onChange={(next) =>
          update({
            plataforma: Array.from(next),
            account: null,
            campaign: null,
            adset: null,
            objective: null,
          })
        }
        allLabel="Todas"
        searchPlaceholder="Buscar plataforma..."
      />

      {/* Cuenta */}
      <StandardMultiFilter
        label="Cuenta"
        options={accountOptions}
        selected={new Set(accountIds)}
        onChange={(next) =>
          update({ account: Array.from(next), campaign: null, adset: null })
        }
        allLabel="Todas las cuentas"
        searchPlaceholder="Buscar cuenta..."
      />

      {/* Campaña */}
      <StandardMultiFilter
        label="Campaña"
        options={campaignOptions}
        selected={new Set(campaignIds)}
        onChange={(next) => update({ campaign: Array.from(next), adset: null })}
        allLabel={campaigns.length === 0 ? "Sin campañas" : "Todas las campañas"}
        searchPlaceholder="Buscar campaña..."
        disabled={campaigns.length === 0}
      />

      {/* Adset */}
      <StandardMultiFilter
        label="Adset"
        options={adsetOptions}
        selected={new Set(adsetIds)}
        onChange={(next) => update({ adset: Array.from(next) })}
        allLabel={adsets.length === 0 ? "Sin adsets" : "Todos los adsets"}
        searchPlaceholder="Buscar adset..."
        disabled={adsets.length === 0}
      />

      {/* Objetivo */}
      <StandardMultiFilter
        label="Objetivo"
        options={objectiveOptions}
        selected={new Set(selectedObjectives)}
        onChange={(next) => update({ objective: Array.from(next) })}
        allLabel="Todos"
        searchPlaceholder="Buscar objetivo..."
      />

      {/* Rango de fechas */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Desde</span>
        <input
          type="date"
          className={INPUT_CLS}
          value={from}
          onChange={(e) => update({ from: e.target.value || null })}
          aria-label="Fecha desde"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Hasta</span>
        <input
          type="date"
          className={INPUT_CLS}
          value={to}
          onChange={(e) => update({ to: e.target.value || null })}
          aria-label="Fecha hasta"
        />
      </label>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={() => {
            // Limpia todos los filtros menos la moneda — siempre necesitamos una.
            // Preserva el tab activo para no rebotar de Detalle a Overall.
            const next = new URLSearchParams();
            next.set("currency", currency);
            const tab = searchParams.get("tab");
            if (tab) next.set("tab", tab);
            router.push(`/paid-media?${next.toString()}`);
          }}
          className="flex items-center gap-1 px-2 py-2 font-sans text-sm text-[#666666] transition-colors hover:text-[#333333]"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Limpiar
        </button>
      )}
    </section>
  );
}
