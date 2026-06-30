interface Props {
  currency: string;
  plataformas?: string[];
  accounts?: string[];
  campaigns?: string[];
  adsets?: string[];
  objectives?: string[];
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
  plataformas = [],
  accounts = [],
  campaigns = [],
  adsets = [],
  objectives = [],
  from,
  to,
}: Props) {
  const items: { label: string; value: string }[] = [];
  items.push({ label: "Moneda", value: currency });
  addSelection(items, "Plataforma", plataformas);
  addSelection(items, "Cuenta", accounts);
  addSelection(items, "Campaña", campaigns);
  addSelection(items, "Adset", adsets);
  addSelection(items, "Objetivo", objectives);
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

function addSelection(
  items: { label: string; value: string }[],
  label: string,
  values: string[],
) {
  if (values.length === 0) return;
  items.push({
    label,
    value: values.length === 1 ? values[0] : `${values.length} seleccionados`,
  });
}
