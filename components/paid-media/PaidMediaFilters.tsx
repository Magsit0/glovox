"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type {
  AccountOption,
  CampaignOption,
  AdsetOption,
  CurrencyOption,
  PlataformaOption,
} from "@/lib/queries/paidMedia";
import { compactMoney, formatInt, plataformaLabel } from "@/components/paid-media/format";

interface Props {
  currencies: CurrencyOption[];
  platforms: PlataformaOption[];
  accounts: AccountOption[];
  campaigns: CampaignOption[];
  adsets: AdsetOption[];
  objectives: string[];

  currency: string;
  plataforma: string;
  accountId: string;
  campaignId: string;
  adsetId: string;
  objective: string;
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
  plataforma,
  accountId,
  campaignId,
  adsetId,
  objective,
  from,
  to,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    const qs = params.toString();
    router.push(`/paid-media${qs ? `?${qs}` : ""}`);
  }

  const hasActiveFilters =
    Boolean(plataforma) ||
    Boolean(accountId) ||
    Boolean(campaignId) ||
    Boolean(adsetId) ||
    Boolean(objective) ||
    Boolean(from) ||
    Boolean(to);

  // Cuentas filtradas por la plataforma seleccionada (si hay).
  const filteredAccounts = plataforma
    ? accounts.filter((a) => a.plataforma === plataforma)
    : accounts;

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
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Plataforma</span>
        <div className="relative inline-flex items-center">
          <select
            className={SELECT_CLS}
            value={plataforma}
            onChange={(e) =>
              update({
                plataforma: e.target.value || null,
                account: null,
                campaign: null,
                adset: null,
                objective: null,
              })
            }
            aria-label="Plataforma"
          >
            <option value="">Todas</option>
            {platforms.map((p) => (
              <option key={p.plataforma} value={p.plataforma}>
                {plataformaLabel(p.plataforma)} · {formatInt(p.rows)}
              </option>
            ))}
          </select>
          <SelectCaret />
        </div>
      </label>

      {/* Cuenta */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Cuenta</span>
        <div className="relative inline-flex items-center">
          <select
            className={`${SELECT_CLS} max-w-[280px]`}
            value={accountId}
            onChange={(e) =>
              update({ account: e.target.value || null, campaign: null, adset: null })
            }
            aria-label="Cuenta"
          >
            <option value="">Todas las cuentas</option>
            {filteredAccounts.map((a) => (
              <option key={a.accountId} value={a.accountId}>
                {a.accountName || a.accountId}
              </option>
            ))}
          </select>
          <SelectCaret />
        </div>
      </label>

      {/* Campaña */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Campaña</span>
        <div className="relative inline-flex items-center">
          <select
            className={`${SELECT_CLS} max-w-[280px]`}
            value={campaignId}
            onChange={(e) =>
              update({ campaign: e.target.value || null, adset: null })
            }
            aria-label="Campaña"
            disabled={campaigns.length === 0}
          >
            <option value="">
              {campaigns.length === 0
                ? "Sin campañas"
                : "Todas las campañas"}
            </option>
            {campaigns.map((c) => (
              <option key={c.campaignId} value={c.campaignId}>
                {c.campaignName || c.campaignId}
              </option>
            ))}
          </select>
          <SelectCaret />
        </div>
      </label>

      {/* Adset */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Adset</span>
        <div className="relative inline-flex items-center">
          <select
            className={`${SELECT_CLS} max-w-[260px]`}
            value={adsetId}
            onChange={(e) => update({ adset: e.target.value || null })}
            aria-label="Adset"
            disabled={adsets.length === 0}
          >
            <option value="">
              {adsets.length === 0 ? "Sin adsets" : "Todos los adsets"}
            </option>
            {adsets.map((a) => (
              <option key={a.adsetId} value={a.adsetId}>
                {a.adsetName || a.adsetId}
              </option>
            ))}
          </select>
          <SelectCaret />
        </div>
      </label>

      {/* Objetivo */}
      <label className="flex flex-col gap-1">
        <span className="font-sans text-xs text-[#666666]">Objetivo</span>
        <div className="relative inline-flex items-center">
          <select
            className={SELECT_CLS}
            value={objective}
            onChange={(e) => update({ objective: e.target.value || null })}
            aria-label="Objetivo"
          >
            <option value="">Todos</option>
            {objectives.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
          <SelectCaret />
        </div>
      </label>

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
