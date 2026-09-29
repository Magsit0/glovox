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
import { FUNNEL_PASO_COMPRA } from "@/lib/marketing/atribucion";

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
  // Solo en modo "Desde medición GA4" (FUNNEL_PASO_COMPRA): órdenes, no usuarios.
  [FUNNEL_PASO_COMPRA.step]: "Compran (órdenes GA4)",
};
const PASO_COMPRA: string = FUNNEL_PASO_COMPRA.step;

type Props = {
  data: FunnelRow[];
  // Aclaración de alcance bajo el gráfico (p. ej. funnel de toda la propiedad).
  nota?: string;
  // Modo "Desde medición GA4": reemplaza la última frase del "Cómo leer".
  lecturaGa4?: string;
};

type Col = {
  name: string;
  base: number; // relleno invisible bajo la barra (efecto cascada)
  valor: number; // alto visible de la barra
  tipo: "nivel" | "caida";
  pctInicio: number | null; // niveles: % del primer paso
  pctPerdida: number | null; // caídas: % perdido respecto al paso anterior
  label: string; // etiqueta sobre la barra
  compra: boolean; // nivel del paso Compran, o la caída que llega a él
  pasoPrevio: string; // caídas: paso del que salen (step crudo); "" en los niveles
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
      compra: d.step === PASO_COMPRA,
      pasoPrevio: "",
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
        compra: next.step === PASO_COMPRA,
        pasoPrevio: d.step,
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
          ? // La caída hacia Compran resta órdenes a usuarios: no lleva unidad.
            `−${fmtNum(col.valor)} ${col.compra ? "sin orden GA4" : "usuarios"}` +
            (col.pctPerdida != null
              ? ` (${fmtPct(col.pctPerdida)} del paso anterior)`
              : "")
          : `${fmtNum(col.valor)} ${col.compra ? "órdenes GA4" : "usuarios"}` +
            (col.pctInicio != null
              ? ` · ${fmtPct(col.pctInicio)} del inicio`
              : "")}
      </div>
      {col.tipo === "caida" && col.compra && (
        <div style={{ opacity: 0.6 }}>
          {`«${STEP_LABELS[col.pasoPrevio] ?? col.pasoPrevio}» (usuarios) menos las órdenes que GA4 registró: ` +
            (col.pasoPrevio === "confirmar"
              ? "pagos no completados o compras que GA4 no ve."
              : "visitas que no compran, pagos no completados o compras que GA4 no ve.")}
        </div>
      )}
    </div>
  );
}

const TICK = { fontFamily: "var(--font-ibm-plex-mono)", fontSize: 10, fill: "#000" };

// Tick en dos líneas para el modo GA4: "Compran (órdenes GA4)" no cabe en una
// columna. Solo se usa cuando el paso Compran está presente; el modo de siempre
// conserva el tick por defecto.
function PasoTick({ x, y, payload }: { x?: number; y?: number; payload?: { value?: unknown } }) {
  const v = String(payload?.value ?? "");
  const texto = v.startsWith("fuga_") ? "↘" : v;
  const corte = texto.indexOf(" (");
  const lineas = corte > 0 ? [texto.slice(0, corte), texto.slice(corte + 1)] : [texto];
  return (
    <text x={x} y={y} textAnchor="middle" {...TICK}>
      {lineas.map((l, k) => (
        <tspan key={k} x={x} dy={k === 0 ? "0.71em" : "1.2em"}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export default function FunnelChart({ data, nota, lecturaGa4 }: Props) {
  const cols = buildCols(data);
  const conCompra = data.some((d) => d.step === PASO_COMPRA);
  return (
    <div>
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={cols} margin={{ top: 24, right: 8 }}>
        <CartesianGrid stroke="#000" strokeDasharray="3 3" strokeOpacity={0.2} />
        <XAxis
          dataKey="name"
          interval={0}
          tickFormatter={(v: string) => (v.startsWith("fuga_") ? "↘" : v)}
          tick={conCompra ? <PasoTick /> : TICK}
          {...(conCompra ? { height: 42 } : {})}
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
    {nota && (
      <p className="font-mono-data text-xs text-black/70 mt-2">{nota}</p>
    )}
    {lecturaGa4 ? (
      <p className="font-mono-data text-xs text-black/50 mt-2">
        Cómo leer: azul = personas que alcanzan cada paso del checkout (y su % de
        los que llegaron); rojo = las que se fugan antes del paso siguiente.{" "}
        {lecturaGa4}
      </p>
    ) : (
    <p className="font-mono-data text-xs text-black/50 mt-2">
      Cómo leer: azul = personas que alcanzan cada paso del checkout (y su % de
      los que llegaron); rojo = las que se fugan antes del paso siguiente.
      Cuenta visitas al sitio del evento en su período de venta — las compras
      por otros canales (portal PuntoTicket, día de estreno) no aparecen aquí.
    </p>
    )}
    </div>
  );
}
