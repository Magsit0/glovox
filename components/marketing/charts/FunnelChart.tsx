"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";
import type { FunnelRow } from "@/lib/queries/marketing";

// Cascada: columnas azules = usuarios que alcanzan cada paso; columnas rojas
// flotantes = los que se fugan entre un paso y el siguiente. El valor del
// funnel está en VER la fuga, no en los totales.
const NIVEL = "#0000FF";
const CAIDA = "#FF0000";

const STEP_LABELS: Record<string, string> = {
  landing_page: "Llegan",
  seleccion_entradas: "Eligen entradas",
  metodo_pago: "Al pago",
  confirmar: "Confirman",
};

type Props = {
  data: FunnelRow[];
};

type Col = {
  name: string;
  base: number; // relleno invisible bajo la barra (efecto cascada)
  valor: number; // alto visible de la barra
  tipo: "nivel" | "caida";
  pctInicio: number | null; // niveles: % del primer paso
  pctPerdida: number | null; // caídas: % perdido respecto al paso anterior
  label: string; // etiqueta sobre la barra
};

const fmtNum = (v: number) => v.toLocaleString("es-CL");
const fmtPct = (v: number) =>
  `${v.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`;

function buildCols(data: FunnelRow[]): Col[] {
  const first = data[0]?.users ?? 0;
  const cols: Col[] = [];
  data.forEach((d, i) => {
    const pctInicio = first > 0 ? (d.users / first) * 100 : null;
    cols.push({
      name: STEP_LABELS[d.step] ?? d.step,
      base: 0,
      valor: d.users,
      tipo: "nivel",
      pctInicio,
      pctPerdida: null,
      label:
        i === 0 || pctInicio == null
          ? fmtNum(d.users)
          : `${fmtNum(d.users)} (${fmtPct(pctInicio)})`,
    });
    const next = data[i + 1];
    if (next) {
      const perdida = Math.max(d.users - next.users, 0);
      const pctPerdida = d.users > 0 ? (perdida / d.users) * 100 : null;
      cols.push({
        name: `fuga_${i + 1}`,
        base: next.users,
        valor: perdida,
        tipo: "caida",
        pctInicio: null,
        pctPerdida,
        label: pctPerdida == null ? "" : `−${fmtPct(pctPerdida)}`,
      });
    }
  });
  return cols;
}

function CascadaTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Col }>;
}) {
  if (!active || !payload?.length) return null;
  const col = payload[0].payload;
  return (
    <div
      style={{
        backgroundColor: "#fff",
        border: "4px solid #000",
        borderRadius: 0,
        fontFamily: "var(--font-ibm-plex-mono)",
        fontSize: 12,
        padding: "6px 10px",
      }}
    >
      <div style={{ fontWeight: 700 }}>
        {col.tipo === "caida" ? "Se fugan" : col.name}
      </div>
      <div>
        {col.tipo === "caida"
          ? `−${fmtNum(col.valor)} usuarios` +
            (col.pctPerdida != null
              ? ` (${fmtPct(col.pctPerdida)} del paso anterior)`
              : "")
          : `${fmtNum(col.valor)} usuarios` +
            (col.pctInicio != null
              ? ` · ${fmtPct(col.pctInicio)} del inicio`
              : "")}
      </div>
    </div>
  );
}

export default function FunnelChart({ data }: Props) {
  const cols = buildCols(data);
  return (
    <div>
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={cols} margin={{ top: 24, right: 8 }}>
        <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="name"
          interval={0}
          tickFormatter={(v: string) => (v.startsWith("fuga_") ? "↘" : v)}
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          stroke="#000"
        />
        <YAxis
          tick={{ fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" }}
          stroke="#000"
        />
        <Tooltip content={<CascadaTooltip />} cursor={{ fill: "#000", fillOpacity: 0.05 }} />
        <Bar dataKey="base" stackId="cascada" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="valor" stackId="cascada">
          {cols.map((c, i) => (
            <Cell key={i} fill={c.tipo === "caida" ? CAIDA : NIVEL} />
          ))}
          <LabelList
            dataKey="label"
            position="top"
            style={{
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 10,
              fill: "#000",
            }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
    <p className="font-mono-data text-xs text-black/50 mt-2">
      Cómo leer: azul = personas que alcanzan cada paso del checkout (y su % de
      los que llegaron); rojo = las que se fugan antes del paso siguiente.
      Cuenta visitas al sitio del evento en su período de venta — las compras
      por otros canales (portal PuntoTicket, día de estreno) no aparecen aquí.
    </p>
    </div>
  );
}
