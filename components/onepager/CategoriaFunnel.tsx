"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  Tooltip,
  LabelList,
  Cell,
} from "recharts";
import type { OnepagerCategoriaRow } from "@/lib/queries/onepager";

type Props = {
  data: OnepagerCategoriaRow[];
};

const PALETTE = [
  "#FF0000",
  "#0000FF",
  "#FFFF00",
  "#00FF00",
  "#FF00FF",
  "#00FFFF",
  "#FF8800",
  "#8800FF",
  "#888888",
];

function fmtClp(value: number) {
  return "$" + Math.round(value).toLocaleString("es-CL");
}

type FunnelNode = {
  name: string;
  value: number;
  venta: number;
  qtty: number;
  pct: number;
  fill: string;
  textFill: string;
};

export default function CategoriaFunnel({ data }: Props) {
  const nodes = useMemo<FunnelNode[]>(() => {
    const filtered = data.filter((d) => d.venta > 0);
    const total = filtered.reduce((acc, d) => acc + d.venta, 0) || 1;
    return filtered
      .slice()
      .sort((a, b) => b.venta - a.venta)
      .map((d, i) => {
        const fill = PALETTE[i % PALETTE.length];
        const darkText =
          fill === "#FFFF00" || fill === "#00FFFF" || fill === "#00FF00";
        return {
          name: d.categoria || "Sin categoría",
          value: d.venta,
          venta: d.venta,
          qtty: d.qtty,
          pct: (d.venta / total) * 100,
          fill,
          textFill: darkText ? "#000" : "#fff",
        };
      });
  }, [data]);

  if (nodes.length === 0) {
    return <p className="font-mono-data text-sm text-black/50">Sin datos.</p>;
  }

  return (
    <div className="border-4 border-black bg-white">
      <ResponsiveContainer width="100%" height={Math.max(320, nodes.length * 60)}>
        <FunnelChart margin={{ top: 16, bottom: 16, left: 16, right: 16 }}>
          <Tooltip
            contentStyle={{
              backgroundColor: "#fff",
              border: "4px solid #000",
              borderRadius: 0,
              fontFamily: "var(--font-ibm-plex-mono)",
              fontSize: 12,
              padding: "8px 12px",
            }}
            formatter={(_v, _n, item) => {
              const p = item?.payload as FunnelNode | undefined;
              if (!p) return [String(_v), String(_n)];
              return [
                `${fmtClp(p.venta)} · ${p.qtty.toLocaleString("es-CL")} u · ${p.pct.toFixed(1)}%`,
                p.name,
              ];
            }}
          />
          <Funnel
            dataKey="value"
            data={nodes}
            isAnimationActive={false}
            stroke="#000"
            strokeWidth={3}
          >
            {nodes.map((node, i) => (
              <Cell key={i} fill={node.fill} />
            ))}
            <LabelList
              position="right"
              dataKey="name"
              fill="#000"
              stroke="none"
              style={{
                fontFamily: "var(--font-space-grotesk, var(--font-display))",
                fontSize: 13,
                fontWeight: 900,
                textTransform: "uppercase",
              }}
            />
            <LabelList
              position="center"
              fill="#fff"
              stroke="none"
              content={(props: {
                x?: number | string;
                y?: number | string;
                width?: number | string;
                height?: number | string;
                index?: number;
              }) => {
                const { x, y, width, height, index } = props;
                const node = index != null ? nodes[index] : undefined;
                if (
                  !node ||
                  x == null ||
                  y == null ||
                  width == null ||
                  height == null
                )
                  return null;
                const nx = Number(x);
                const ny = Number(y);
                const nw = Number(width);
                const nh = Number(height);
                if (nh < 24) return null;
                return (
                  <g>
                    <text
                      x={nx + nw / 2}
                      y={ny + nh / 2 - 4}
                      textAnchor="middle"
                      fill={node.textFill}
                      fontFamily="var(--font-ibm-plex-mono)"
                      fontSize={12}
                      fontWeight={700}
                    >
                      {fmtClp(node.venta)}
                    </text>
                    <text
                      x={nx + nw / 2}
                      y={ny + nh / 2 + 12}
                      textAnchor="middle"
                      fill={node.textFill}
                      fontFamily="var(--font-ibm-plex-mono)"
                      fontSize={11}
                    >
                      {node.pct.toFixed(1)}%
                    </text>
                  </g>
                );
              }}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
