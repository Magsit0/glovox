import type { NegocioOption } from "@/lib/unabase/types";

interface Props {
  negocio: NegocioOption | null;
  externalId: string;
}

function asStr(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function pillFor(estadocierre: string): { dot: string; label: string } {
  const v = estadocierre.toLowerCase();
  if (v === "true") return { dot: "#B1D750", label: "Cerrado para compras" };
  if (v === "false") return { dot: "#F6C544", label: "Abierto para compras" };
  if (v.includes("cerrado")) return { dot: "#B1D750", label: estadocierre };
  if (v.includes("abierto") || v.includes("ejecu")) return { dot: "#F6C544", label: estadocierre };
  if (v.includes("anul") || v.includes("cancel")) return { dot: "#ED75A0", label: estadocierre };
  if (estadocierre) return { dot: "#999999", label: estadocierre };
  return { dot: "#999999", label: "Sin estado de cierre" };
}

export default function NegocioHeader({ negocio, externalId }: Props) {
  const referencia = asStr(negocio?.referencia) || `Negocio ${externalId}`;
  const area = asStr(negocio?.area_negocio);
  const estado = asStr(negocio?.estado);
  const estadocierre = asStr(negocio?.estadocierre);
  const pill = pillFor(estadocierre);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-sans text-xs uppercase tracking-wide text-[#999999]">
          Negocio · {externalId}
        </span>
        {area && (
          <span className="font-sans text-xs text-[#666666]">{area}</span>
        )}
      </div>
      <h2 className="font-display text-xl font-bold leading-tight tracking-tight text-[#333333]">
        {referencia}
      </h2>
      <div className="flex flex-wrap items-center gap-2">
        {estado && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9F99F8]" />
            {estado}
          </span>
        )}
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 py-1 font-sans text-xs font-medium text-[#333333]"
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: pill.dot }}
          />
          {pill.label}
        </span>
      </div>
    </section>
  );
}
