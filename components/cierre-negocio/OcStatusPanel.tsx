"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { seriesColor } from "@/lib/chart-colors";
import { formatNumber } from "@/lib/unabase/formatting";
import type { OcStatusCounts } from "@/lib/unabase/cierreNegocio";

interface Props {
  ocStatus: OcStatusCounts;
}

interface PieDatum {
  name: string;
  value: number;
  color: string;
}

interface TooltipPayload {
  value: number;
  name: string;
  payload: PieDatum;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2 font-sans text-sm text-[#333333] shadow-md">
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: p.payload.color }}
        />
        <span className="text-[#666666]">{p.name}</span>
        <span className="ml-auto tabular-nums">{formatNumber(p.value)}</span>
      </div>
    </div>
  );
}

function buildPieData(record: Record<string, number>): PieDatum[] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({
      name,
      value,
      color: seriesColor(i),
    }));
}

export default function OcStatusPanel({ ocStatus }: Props) {
  const total = ocStatus.totalDocs;
  if (total === 0) {
    return (
      <article className="rounded-lg border border-[#E5E5E5] bg-white p-6">
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Estado de OCs
        </h2>
        <p className="mt-3 font-sans text-sm text-[#999999]">Sin documentos registrados.</p>
      </article>
    );
  }

  const estadoData = buildPieData(ocStatus.porEstado);
  const validadoPct = total > 0 ? ocStatus.validados / total : 0;
  const justificadoPct = total > 0 ? ocStatus.justificados / total : 0;

  return (
    <article className="flex flex-col gap-6 rounded-lg border border-[#E5E5E5] bg-white p-6">
      <header>
        <h2 className="font-display text-lg font-bold tracking-tight text-[#333333]">
          Estado de OCs
        </h2>
        <p className="mt-1 font-sans text-sm text-[#666666]">
          Distribución de los documentos asociados al negocio.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[180px_1fr]">
        <div className="relative h-44 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={estadoData}
                dataKey="value"
                nameKey="name"
                innerRadius="60%"
                outerRadius="90%"
                stroke="none"
              >
                {estadoData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-bold leading-none text-[#333333]">
              {formatNumber(total)}
            </span>
            <span className="mt-1 font-sans text-xs text-[#666666]">documentos</span>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {estadoData.map((d) => {
            const pct = total > 0 ? d.value / total : 0;
            return (
              <li
                key={d.name}
                className="flex items-center gap-3 border-b border-[#E5E5E5] py-1.5 last:border-b-0"
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="font-sans text-sm text-[#333333]">{d.name}</span>
                <span className="ml-auto font-sans text-sm tabular-nums text-[#666666]">
                  {formatNumber(d.value)}
                </span>
                <span className="w-12 text-right font-sans text-xs tabular-nums text-[#999999]">
                  {(pct * 100).toFixed(0)}%
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Mini
          label="Validados"
          value={`${(validadoPct * 100).toFixed(0)}%`}
          caption={`${formatNumber(ocStatus.validados)} de ${formatNumber(total)}`}
          dot={validadoPct >= 0.9 ? "#B1D750" : validadoPct >= 0.5 ? "#F6C544" : "#ED75A0"}
        />
        <Mini
          label="Justificados"
          value={`${(justificadoPct * 100).toFixed(0)}%`}
          caption={`${formatNumber(ocStatus.justificados)} de ${formatNumber(total)}`}
          dot={justificadoPct >= 0.9 ? "#B1D750" : justificadoPct >= 0.5 ? "#F6C544" : "#ED75A0"}
        />
      </div>

      <div>
        <p className="font-sans text-xs uppercase tracking-wide text-[#666666]">
          Por tipo de documento
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {Object.entries(ocStatus.porTipoDoc)
            .sort((a, b) => b[1] - a[1])
            .map(([name, count]) => (
              <li key={name} className="flex items-center gap-3 font-sans text-sm">
                <span className="text-[#333333]">{name}</span>
                <span className="ml-auto tabular-nums text-[#666666]">
                  {formatNumber(count)}
                </span>
              </li>
            ))}
        </ul>
      </div>
    </article>
  );
}

function Mini({
  label,
  value,
  caption,
  dot,
}: {
  label: string;
  value: string;
  caption: string;
  dot: string;
}) {
  return (
    <div className="rounded-lg border border-[#E5E5E5] p-4">
      <p className="font-sans text-xs text-[#666666]">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold leading-none text-[#333333]">
        {value}
      </p>
      <p className="mt-2 inline-flex items-center gap-1.5 font-sans text-xs text-[#666666]">
        <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
        {caption}
      </p>
    </div>
  );
}
