import type { AccountOption, CampaignOption, AdsetOption } from "@/lib/queries/paidMedia";
import { plataformaLabel } from "@/components/paid-media/format";

interface Props {
  currency: string;
  plataforma: string;
  account?: AccountOption;
  campaign?: CampaignOption;
  adset?: AdsetOption;
  objective: string;
  from: string;
  to: string;
}

/**
 * Tira de contexto sobre los filtros activos — la idea es que el lector
 * entienda de un vistazo qué moneda/cuenta/campaña está mirando sin tener
 * que volver al filtro arriba.
 */
export default function ActiveContext({
  currency,
  plataforma,
  account,
  campaign,
  adset,
  objective,
  from,
  to,
}: Props) {
  const items: { label: string; value: string }[] = [];
  items.push({ label: "Moneda", value: currency });
  if (plataforma) items.push({ label: "Plataforma", value: plataformaLabel(plataforma) });
  if (account) items.push({ label: "Cuenta", value: account.accountName || account.accountId });
  if (campaign) items.push({ label: "Campaña", value: campaign.campaignName || campaign.campaignId });
  if (adset) items.push({ label: "Adset", value: adset.adsetName || adset.adsetId });
  if (objective) items.push({ label: "Objetivo", value: objective });
  if (from || to) {
    items.push({
      label: "Rango",
      value: from && to ? `${from} → ${to}` : from ? `desde ${from}` : `hasta ${to}`,
    });
  }

  return (
    <section className="flex flex-wrap items-center gap-2">
      {items.map((i) => (
        <span
          key={`${i.label}-${i.value}`}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]"
        >
          <span className="text-[#666666]">{i.label}</span>
          <span>·</span>
          <span title={i.value} className="max-w-[260px] truncate">
            {i.value}
          </span>
        </span>
      ))}
    </section>
  );
}
