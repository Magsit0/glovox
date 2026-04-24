"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  Cell,

} from "recharts";
import type { Payload } from "recharts/types/component/DefaultTooltipContent";

import { useState } from "react";

// ─── AGGREGATED DATA ──────────────────────────────────────────────────────────

const DAILY_STACKED = [
  {
    date: "Feb 27",
    organic: 1475,
    direct: 1109,
    paid: 1432,
    social: 310,
    community: 443,
    other: 163,
  },
  {
    date: "Feb 28",
    organic: 2165,
    direct: 1340,
    paid: 1082,
    social: 670,
    community: 854,
    other: 344,
  },
  {
    date: "Mar 1",
    organic: 455,
    direct: 340,
    paid: 459,
    social: 35,
    community: 38,
    other: 51,
  },
  {
    date: "Mar 2",
    organic: 423,
    direct: 339,
    paid: 614,
    social: 22,
    community: 25,
    other: 37,
  },
  {
    date: "Mar 3",
    organic: 441,
    direct: 503,
    paid: 360,
    social: 58,
    community: 51,
    other: 76,
  },
  {
    date: "Mar 4",
    organic: 322,
    direct: 256,
    paid: 459,
    social: 17,
    community: 20,
    other: 45,
  },
  {
    date: "Mar 5",
    organic: 274,
    direct: 222,
    paid: 505,
    social: 18,
    community: 20,
    other: 23,
  },
];

const CHANNEL_DATA = [
  {
    channel: "Direct / Dark Social",
    sessions: 4109,
    eventsPerSession: 13.5,
    color: "#8888BB",
  },
  {
    channel: "Organic Search",
    sessions: 3521,
    eventsPerSession: 16.0,
    color: "#C6FF00",
  },
  {
    channel: "Meta Paid (all)",
    sessions: 3890,
    eventsPerSession: 6.2,
    color: "#FF2855",
  },
  {
    channel: "Linktree Bio",
    sessions: 1562,
    eventsPerSession: 17.0,
    color: "#FFB800",
  },
  {
    channel: "Glovox Community",
    sessions: 1346,
    eventsPerSession: 9.2,
    color: "#FF6B00",
  },
  {
    channel: "Instagram Referral",
    sessions: 1130,
    eventsPerSession: 13.5,
    color: "#E040FB",
  },
  {
    channel: "mt Paid Media",
    sessions: 1021,
    eventsPerSession: 8.6,
    color: "#FF4080",
  },
  {
    channel: "Influencer (inf)",
    sessions: 437,
    eventsPerSession: 8.1,
    color: "#00D4FF",
  },
  {
    channel: "Piknic Site Ref",
    sessions: 406,
    eventsPerSession: 20.0,
    color: "#00FF99",
  },
  {
    channel: "Friend Referral (ff)",
    sessions: 142,
    eventsPerSession: 8.7,
    color: "#40FFFF",
  },
  {
    channel: "Anjunadeep.co",
    sessions: 101,
    eventsPerSession: 12.0,
    color: "#BB88FF",
  },
  {
    channel: "TikTok Paid",
    sessions: 100,
    eventsPerSession: 6.3,
    color: "#FF0066",
  },
].sort((a, b) => b.sessions - a.sessions);

const CAMPAIGN_DATA = [
  { date: "Feb 27", feb28: 616, mar28: 469, apr18: 171 },
  { date: "Feb 28", feb28: 719, mar28: 292, apr18: 214 },
  { date: "Mar 1", feb28: 101, mar28: 265, apr18: 184 },
  { date: "Mar 2", feb28: 60, mar28: 388, apr18: 212 },
  { date: "Mar 3", feb28: 41, mar28: 309, apr18: 201 },
  { date: "Mar 4", feb28: 30, mar28: 299, apr18: 132 },
  { date: "Mar 5", feb28: 28, mar28: 328, apr18: 138 },
];

const REFERRAL_SOURCES = [
  { source: "Linktree", sessions: 1562, engmt: 17.0, type: "owned" },
  { source: "comunidad.glovox.io", sessions: 1346, engmt: 9.2, type: "owned" },
  { source: "l.instagram.com", sessions: 1022, engmt: 13.5, type: "social" },
  { source: "Influencer (inf)", sessions: 437, engmt: 8.1, type: "influencer" },
  {
    source: "piknicelectronik.cl",
    sessions: 406,
    engmt: 20.0,
    type: "partner",
  },
  { source: "Friend Referral", sessions: 142, engmt: 8.7, type: "viral" },
  { source: "anjunadeep.co", sessions: 101, engmt: 12.0, type: "partner" },
  { source: "m.facebook.com", sessions: 48, engmt: 7.8, type: "social" },
  { source: "youtube.com", sessions: 5, engmt: 9.2, type: "social" },
];

// ─── COLORS ───────────────────────────────────────────────────────────────────
const C = {
  bg: "#06060D",
  surface: "#0D0D1C",
  border: "#1A1A35",
  accent: "#C6FF00",
  red: "#FF2855",
  blue: "#00D4FF",
  orange: "#FF8C00",
  purple: "#9B59B6",
  textPri: "#E8E8FF",
  textSec: "#5A5A8A",
};

const STACK_COLORS = {
  organic: "#C6FF00",
  paid: "#FF2855",
  direct: "#6666AA",
  social: "#E040FB",
  community: "#FF8C00",
  other: "#334455",
};

// ─── CUSTOM TOOLTIP ───────────────────────────────────────────────────────────
const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Payload<number, string>[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "#111128",
        border: `1px solid ${C.accent}33`,
        padding: "10px 14px",
        borderRadius: 4,
        fontFamily: "'Share Tech Mono', monospace",
        fontSize: 12,
      }}
    >
      <div style={{ color: C.accent, fontWeight: 700, marginBottom: 6 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{ color: p.fill || p.color || C.textPri, margin: "2px 0" }}
        >
          {p.name}:{" "}
          <span style={{ color: "#fff" }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────────
const KpiCard = ({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderTop: `2px solid ${accent || C.accent}`,
      padding: "18px 20px",
      borderRadius: 6,
      flex: 1,
      minWidth: 140,
    }}
  >
    <div
      style={{
        color: C.textSec,
        fontSize: 10,
        letterSpacing: 2,
        textTransform: "uppercase",
        marginBottom: 8,
        fontFamily: "'Chakra Petch', sans-serif",
      }}
    >
      {label}
    </div>
    <div
      style={{
        color: accent || C.accent,
        fontSize: 26,
        fontWeight: 700,
        fontFamily: "'Share Tech Mono', monospace",
        lineHeight: 1,
      }}
    >
      {value}
    </div>
    {sub && (
      <div
        style={{
          color: C.textSec,
          fontSize: 11,
          marginTop: 6,
          fontFamily: "'Chakra Petch', sans-serif",
        }}
      >
        {sub}
      </div>
    )}
  </div>
);

const TabBtn = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    style={{
      background: "none",
      border: "none",
      cursor: "pointer",
      padding: "10px 20px",
      fontFamily: "'Chakra Petch', sans-serif",
      fontSize: 13,
      fontWeight: active ? 700 : 400,
      letterSpacing: 1,
      color: active ? C.accent : C.textSec,
      borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
      transition: "all 0.2s",
    }}
  >
    {label}
  </button>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      color: C.textSec,
      fontSize: 10,
      letterSpacing: 3,
      textTransform: "uppercase",
      fontFamily: "'Chakra Petch', sans-serif",
      marginBottom: 16,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}
  >
    <span
      style={{
        width: 24,
        height: 1,
        background: C.accent,
        display: "inline-block",
      }}
    />
    {children}
  </div>
);

// ─── TABS ─────────────────────────────────────────────────────────────────────

function OverviewTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <SectionTitle>Daily Sessions by Channel Group</SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={DAILY_STACKED}
            margin={{ top: 0, right: 10, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#1A1A35"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{
                fill: C.textSec,
                fontSize: 11,
                fontFamily: "'Chakra Petch',sans-serif",
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{
                fill: C.textSec,
                fontSize: 10,
                fontFamily: "'Share Tech Mono',monospace",
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(255,255,255,0.03)" }}
            />
            <Bar
              dataKey="organic"
              name="Organic"
              stackId="a"
              fill={STACK_COLORS.organic}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="paid"
              name="Paid"
              stackId="a"
              fill={STACK_COLORS.paid}
            />
            <Bar
              dataKey="social"
              name="Social"
              stackId="a"
              fill={STACK_COLORS.social}
            />
            <Bar
              dataKey="community"
              name="Community"
              stackId="a"
              fill={STACK_COLORS.community}
            />
            <Bar
              dataKey="direct"
              name="Direct/Unknown"
              stackId="a"
              fill={STACK_COLORS.direct}
            />
            <Bar
              dataKey="other"
              name="Other"
              stackId="a"
              fill={STACK_COLORS.other}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 16px",
            marginTop: 12,
          }}
        >
          {Object.entries(STACK_COLORS).map(([k, v]) => (
            <span
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: C.textSec,
                fontFamily: "'Chakra Petch',sans-serif",
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: v,
                  display: "inline-block",
                }}
              />
              {k.charAt(0).toUpperCase() + k.slice(1)}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
        }}
      >
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            padding: "16px 20px",
            borderRadius: 6,
          }}
        >
          <SectionTitle>Peak Day Breakdown</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(
              [
                ["Organic Search", 2165, C.accent],
                ["Direct / Dark Social", 1340, "#6666AA"],
                ["Meta Paid", 1082, C.red],
                ["Glovox Community", 854, C.orange],
                ["Instagram", 670, "#E040FB"],
                ["Linktree", 580, "#FFB800"],
              ] as [string, number, string][]
            ).map(([label, val, color]) => (
              <div key={label}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 3,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.textSec,
                      fontFamily: "'Chakra Petch',sans-serif",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color,
                      fontFamily: "'Share Tech Mono',monospace",
                    }}
                  >
                    {val.toLocaleString()}
                  </span>
                </div>
                <div
                  style={{ background: "#1A1A2E", borderRadius: 2, height: 3 }}
                >
                  <div
                    style={{
                      width: `${(val / 2165) * 100}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            padding: "16px 20px",
            borderRadius: 6,
          }}
        >
          <SectionTitle>Key Insights</SectionTitle>
          {[
            {
              icon: "◆",
              color: C.accent,
              text: "Feb 28 drove 36% of all 7-day traffic — event day organic intent is massive.",
            },
            {
              icon: "◆",
              color: C.blue,
              text: "~23% of traffic is unattributed — likely WhatsApp dark social in the Chilean market.",
            },
            {
              icon: "◆",
              color: C.orange,
              text: "Glovox Community sent 706 sessions on event day, rivaling Instagram.",
            },
            {
              icon: "◆",
              color: "#E040FB",
              text: "Instagram organic referral outperformed Meta paid on peak day (626 vs 246).",
            },
            {
              icon: "◆",
              color: "#FFB800",
              text: "Linktree is the #4 channel — bio links are critical conversion touchpoints.",
            },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 10,
                marginBottom: 10,
                alignItems: "flex-start",
              }}
            >
              <span
                style={{
                  color: item.color,
                  fontSize: 8,
                  marginTop: 4,
                  flexShrink: 0,
                }}
              >
                {item.icon}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: C.textSec,
                  fontFamily: "'Chakra Petch',sans-serif",
                  lineHeight: 1.6,
                }}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChannelsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: 20,
        }}
      >
        <div>
          <SectionTitle>Sessions by Channel</SectionTitle>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={CHANNEL_DATA.slice(0, 8)}
              layout="vertical"
              margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
            >
              <XAxis
                type="number"
                tick={{
                  fill: C.textSec,
                  fontSize: 10,
                  fontFamily: "'Share Tech Mono',monospace",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="channel"
                width={140}
                tick={{
                  fill: C.textSec,
                  fontSize: 10,
                  fontFamily: "'Chakra Petch',sans-serif",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="sessions" name="Sessions" radius={[0, 3, 3, 0]}>
                {CHANNEL_DATA.slice(0, 8).map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div>
          <SectionTitle>Engagement Efficiency (Events / Session)</SectionTitle>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingTop: 4,
            }}
          >
            {CHANNEL_DATA.map((ch, i) => (
              <div key={i}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: C.textSec,
                      fontFamily: "'Chakra Petch',sans-serif",
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ch.channel}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color:
                        ch.eventsPerSession >= 14
                          ? C.accent
                          : ch.eventsPerSession >= 10
                            ? "#FFB800"
                            : C.red,
                      fontFamily: "'Share Tech Mono',monospace",
                    }}
                  >
                    {ch.eventsPerSession.toFixed(1)} ▸
                  </span>
                </div>
                <div
                  style={{ background: "#1A1A2E", borderRadius: 2, height: 3 }}
                >
                  <div
                    style={{
                      width: `${(ch.eventsPerSession / 20) * 100}%`,
                      height: "100%",
                      background:
                        ch.eventsPerSession >= 14
                          ? C.accent
                          : ch.eventsPerSession >= 10
                            ? "#FFB800"
                            : C.red,
                      borderRadius: 2,
                      transition: "width 0.4s",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 16 }}>
            {[
              ["≥ 14", C.accent, "High intent"],
              ["10–14", "#FFB800", "Medium"],
              ["< 10", C.red, "Low intent"],
            ].map(([range, color, label]) => (
              <span
                key={range}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  color: C.textSec,
                  fontFamily: "'Chakra Petch',sans-serif",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 2,
                    background: color,
                    display: "inline-block",
                  }}
                />
                {range} {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <SectionTitle>Full Channel Breakdown</SectionTitle>
        </div>
        <div style={{ overflow: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontFamily: "'Chakra Petch',sans-serif",
              fontSize: 12,
            }}
          >
            <thead>
              <tr style={{ background: "#0A0A18" }}>
                {[
                  "Channel",
                  "Sessions",
                  "Share",
                  "Eng / Session",
                  "Verdict",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      color: C.textSec,
                      fontSize: 10,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                      textAlign: "left",
                      fontWeight: 600,
                      borderBottom: `1px solid ${C.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CHANNEL_DATA.map((ch, i) => {
                const share = ((ch.sessions / 17895) * 100).toFixed(1);
                const verdict =
                  ch.eventsPerSession >= 15
                    ? { label: "⬆ High Intent", color: C.accent }
                    : ch.eventsPerSession >= 10
                      ? { label: "→ Mid Intent", color: "#FFB800" }
                      : { label: "⬇ Low Intent", color: C.red };
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: `1px solid ${C.border}22`,
                      transition: "background 0.15s",
                    }}
                  >
                    <td
                      style={{
                        padding: "11px 16px",
                        color: C.textPri,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: ch.color,
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      {ch.channel}
                    </td>
                    <td
                      style={{
                        padding: "11px 16px",
                        color: "#fff",
                        fontFamily: "'Share Tech Mono',monospace",
                      }}
                    >
                      {ch.sessions.toLocaleString()}
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            background: "#1A1A2E",
                            borderRadius: 2,
                            height: 4,
                            width: 60,
                          }}
                        >
                          <div
                            style={{
                              width: `${share}%`,
                              height: "100%",
                              background: ch.color,
                              borderRadius: 2,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            color: C.textSec,
                            fontSize: 11,
                            fontFamily: "'Share Tech Mono',monospace",
                          }}
                        >
                          {share}%
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "11px 16px",
                        color: verdict.color,
                        fontFamily: "'Share Tech Mono',monospace",
                      }}
                    >
                      {ch.eventsPerSession.toFixed(1)}
                    </td>
                    <td
                      style={{
                        padding: "11px 16px",
                        fontSize: 11,
                        color: verdict.color,
                      }}
                    >
                      {verdict.label}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function CampaignsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div>
        <SectionTitle>Campaign Traffic Over Time</SectionTitle>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart
            data={CAMPAIGN_DATA}
            margin={{ top: 10, right: 30, left: -10, bottom: 0 }}
          >
            <CartesianGrid
              stroke="#1A1A35"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tick={{
                fill: C.textSec,
                fontSize: 11,
                fontFamily: "'Chakra Petch',sans-serif",
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{
                fill: C.textSec,
                fontSize: 10,
                fontFamily: "'Share Tech Mono',monospace",
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line
              type="monotone"
              dataKey="feb28"
              name="Event: Feb 28"
              stroke="#6666AA"
              strokeWidth={2}
              dot={{ fill: "#6666AA", r: 4 }}
              strokeDasharray="5 3"
            />
            <Line
              type="monotone"
              dataKey="mar28"
              name="Event: Mar 28"
              stroke={C.red}
              strokeWidth={2.5}
              dot={{ fill: C.red, r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="apr18"
              name="Event: Apr 18"
              stroke={C.accent}
              strokeWidth={2.5}
              dot={{ fill: C.accent, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
        <div style={{ display: "flex", gap: 24, marginTop: 12 }}>
          {[
            ["Feb 28 event (past)", "#6666AA"],
            ["Mar 28 event (active)", C.red],
            ["Apr 18 event (upcoming)", C.accent],
          ].map(([label, color]) => (
            <span
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 11,
                color: C.textSec,
                fontFamily: "'Chakra Petch',sans-serif",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 2,
                  background: color,
                  display: "inline-block",
                  borderRadius: 1,
                }}
              />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: 20,
        }}
      >
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            padding: "16px 20px",
            borderRadius: 6,
          }}
        >
          <SectionTitle>Meta: Conversion vs Reach (Mar 28)</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={[
                { date: "Feb 27", conv: 214, reach: 30 },
                { date: "Feb 28", conv: 246, reach: 23 },
                { date: "Mar 1", conv: 221, reach: 44 },
                { date: "Mar 2", conv: 298, reach: 90 },
                { date: "Mar 3", conv: 269, reach: 40 },
                { date: "Mar 4", conv: 274, reach: 25 },
                { date: "Mar 5", conv: 295, reach: 33 },
              ]}
              margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                stroke="#1A1A35"
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fill: C.textSec, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.textSec, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar
                dataKey="conv"
                name="Conversion"
                fill={C.red}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="reach"
                name="Reach"
                fill="#FF285544"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <p
            style={{
              fontSize: 11,
              color: C.textSec,
              fontFamily: "'Chakra Petch',sans-serif",
              marginTop: 8,
              lineHeight: 1.6,
            }}
          >
            Conversion outperforms Reach 7:1 on average. Budget reallocation
            recommended.
          </p>
        </div>

        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            padding: "16px 20px",
            borderRadius: 6,
          }}
        >
          <SectionTitle>Campaign Health Matrix</SectionTitle>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              marginTop: 4,
            }}
          >
            {[
              {
                name: "piknic_2026_02_28",
                status: "WINDING DOWN",
                total: 1574,
                color: "#6666AA",
                note: "Post-event, fading naturally",
              },
              {
                name: "piknic_2026_03_28",
                status: "ACTIVE ▲",
                total: 2190,
                color: C.red,
                note: "Mar 28 — in full swing, ramp up",
              },
              {
                name: "piknic_2026_04_18",
                status: "BUILDING ▲",
                total: 1061,
                color: C.accent,
                note: "Apr 18 — early warm-up traffic",
              },
            ].map((c) => (
              <div
                key={c.name}
                style={{
                  background: "#0A0A18",
                  border: `1px solid ${C.border}`,
                  borderLeft: `3px solid ${c.color}`,
                  padding: "12px 14px",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: C.textPri,
                      fontFamily: "'Share Tech Mono',monospace",
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: c.color,
                      fontFamily: "'Chakra Petch',sans-serif",
                      fontWeight: 700,
                      letterSpacing: 1,
                    }}
                  >
                    {c.status}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 18,
                    color: c.color,
                    fontFamily: "'Share Tech Mono',monospace",
                    fontWeight: 700,
                  }}
                >
                  {c.total.toLocaleString()} sessions
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: C.textSec,
                    fontFamily: "'Chakra Petch',sans-serif",
                    marginTop: 4,
                  }}
                >
                  {c.note}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SourcesTab() {
  const typeColors = {
    owned: C.accent,
    social: "#E040FB",
    influencer: C.blue,
    partner: "#00FF99",
    viral: "#FFB800",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
          gap: 20,
        }}
      >
        <div>
          <SectionTitle>Referral Volume vs Engagement Quality</SectionTitle>
          <div
            style={{
              position: "relative",
              height: 280,
              background: "#0A0A18",
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              padding: "10px 20px 20px 20px",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart
                margin={{ top: 10, right: 10, bottom: 20, left: -10 }}
              >
                <CartesianGrid stroke="#1A1A35" strokeDasharray="3 3" />
                <XAxis
                  dataKey="sessions"
                  name="Sessions"
                  type="number"
                  tick={{ fill: C.textSec, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Sessions →",
                    position: "insideBottom",
                    offset: -10,
                    fill: C.textSec,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  dataKey="engmt"
                  name="Eng/Session"
                  type="number"
                  domain={[5, 22]}
                  tick={{ fill: C.textSec, fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: "Engagement →",
                    angle: -90,
                    position: "insideLeft",
                    fill: C.textSec,
                    fontSize: 10,
                  }}
                />
                <ZAxis range={[40, 200]} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div
                        style={{
                          background: "#111128",
                          border: `1px solid ${C.accent}44`,
                          padding: "8px 12px",
                          borderRadius: 4,
                          fontFamily: "'Chakra Petch',sans-serif",
                          fontSize: 11,
                        }}
                      >
                        <div style={{ color: C.accent, fontWeight: 700 }}>
                          {d.source}
                        </div>
                        <div style={{ color: C.textSec }}>
                          Sessions:{" "}
                          <span style={{ color: "#fff" }}>
                            {d.sessions.toLocaleString()}
                          </span>
                        </div>
                        <div style={{ color: C.textSec }}>
                          Eng/Session:{" "}
                          <span style={{ color: "#fff" }}>{d.engmt}</span>
                        </div>
                      </div>
                    );
                  }}
                />
                <Scatter
                  data={REFERRAL_SOURCES}
                  shape={(props) => {
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined) return null;
                    const color =
                      typeColors[payload.type as keyof typeof typeColors] ||
                      C.textSec;
                    return (
                      <g>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill={color}
                          fillOpacity={0.85}
                          stroke={color}
                          strokeWidth={1}
                        />
                        <text
                          x={cx + 9}
                          y={cy + 4}
                          fill={color}
                          fontSize={9}
                          fontFamily="'Chakra Petch',sans-serif"
                        >
                          {payload.source.split(".")[0].slice(0, 10)}
                        </text>
                      </g>
                    );
                  }}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 16px",
              marginTop: 10,
            }}
          >
            {Object.entries(typeColors).map(([k, v]) => (
              <span
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  color: C.textSec,
                  fontFamily: "'Chakra Petch',sans-serif",
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: v,
                    display: "inline-block",
                  }}
                />
                {k}
              </span>
            ))}
          </div>
        </div>

        <div>
          <SectionTitle>Friend Referral Program (ff)</SectionTitle>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart
              data={[
                { date: "Feb 27", sessions: 15 },
                { date: "Feb 28", sessions: 22 },
                { date: "Mar 1", sessions: 8 },
                { date: "Mar 2", sessions: 14 },
                { date: "Mar 3", sessions: 52 },
                { date: "Mar 4", sessions: 28 },
                { date: "Mar 5", sessions: 10 },
              ]}
              margin={{ top: 0, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fill: C.textSec, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: C.textSec, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar
                dataKey="sessions"
                name="FF Sessions"
                fill="#40FFFF"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
          <div
            style={{
              background: "#0D0D1C",
              border: `1px solid ${C.border}`,
              borderLeft: `3px solid #40FFFF`,
              padding: "12px 14px",
              borderRadius: 4,
              marginTop: 12,
            }}
          >
            <div
              style={{
                fontSize: 11,
                color: "#40FFFF",
                fontFamily: "'Chakra Petch',sans-serif",
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              Mar 3 spike: lineup announcement drove viral sharing
            </div>
            <div
              style={{
                fontSize: 10,
                color: C.textSec,
                fontFamily: "'Chakra Petch',sans-serif",
                lineHeight: 1.7,
              }}
            >
              ~149 total friend-referred sessions this week. Infrastructure is
              live — incentivise referrers + referees to scale this channel
              significantly for Apr 18.
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <SectionTitle>Top Referral Domains</SectionTitle>
            {REFERRAL_SOURCES.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "7px 0",
                  borderBottom: `1px solid ${C.border}22`,
                }}
              >
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: typeColors[s.type as keyof typeof typeColors],
                      display: "inline-block",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      color: C.textPri,
                      fontFamily: "'Chakra Petch',sans-serif",
                    }}
                  >
                    {s.source}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: typeColors[s.type as keyof typeof typeColors],
                      background: `${
                        typeColors[s.type as keyof typeof typeColors]
                      }22`,
                      padding: "1px 6px",
                      borderRadius: 3,
                      letterSpacing: 1,
                    }}
                  >
                    {s.type}
                  </span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#fff",
                      fontFamily: "'Share Tech Mono',monospace",
                    }}
                  >
                    {s.sessions.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9, color: C.textSec }}>
                    {s.engmt} e/s
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function PiknicDashboard() {
  const [tab, setTab] = useState("overview");

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Chakra+Petch:ital,wght@0,400;0,600;0,700;1,400&family=Share+Tech+Mono&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: #0A0A18; }
        ::-webkit-scrollbar-thumb { background: #2A2A4A; border-radius: 4px; }
      `,
        }}
      />

      <div
        style={{
          background: C.bg,
          minHeight: "100vh",
          color: C.textPri,
          fontFamily: "'Chakra Petch', sans-serif",
          padding: "0 0 40px",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            background: `linear-gradient(180deg, #0E0E24 0%, ${C.bg} 100%)`,
            borderBottom: `1px solid ${C.border}`,
            padding: "20px 28px 0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 28,
                    background: C.accent,
                    borderRadius: 2,
                  }}
                />
                <div>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: 3,
                      color: C.textSec,
                      textTransform: "uppercase",
                    }}
                  >
                    Marketing Analytics
                  </div>
                  <div
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: C.textPri,
                      letterSpacing: 1,
                    }}
                  >
                    Piknic Electronik — Traffic Dashboard
                  </div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontSize: 10,
                  color: C.textSec,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                }}
              >
                Period
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: C.accent,
                  fontFamily: "'Share Tech Mono',monospace",
                }}
              >
                Feb 27 – Mar 05, 2026
              </div>
            </div>
          </div>

          {/* KPI STRIP */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <KpiCard label="Total Sessions" value="17,895" sub="7-day window" />
            <KpiCard
              label="Total Users"
              value="14,820"
              sub="~83% unique rate"
              accent={C.blue}
            />
            <KpiCard
              label="Peak Day Sessions"
              value="6,455"
              sub="Feb 28 — event day"
              accent={C.red}
            />
            <KpiCard
              label="Top Channel"
              value="Organic"
              sub="3,521 sessions"
              accent={C.accent}
            />
            <KpiCard
              label="Best Engagement"
              value="20.0 e/s"
              sub="piknicelectronik.cl"
              accent="#00FF99"
            />
            <KpiCard
              label="Paid Campaigns"
              value="3"
              sub="active simultaneously"
              accent={C.orange}
            />
          </div>

          {/* TABS */}
          <div
            style={{
              display: "flex",
              gap: 0,
              borderBottom: "none",
              marginBottom: -1,
            }}
          >
            {[
              ["overview", "Overview"],
              ["channels", "Channels"],
              ["campaigns", "Campaigns"],
              ["sources", "Referrals"],
            ].map(([id, label]) => (
              <TabBtn
                key={id}
                label={label}
                active={tab === id}
                onClick={() => setTab(id)}
              />
            ))}
          </div>
        </div>

        {/* CONTENT */}
        <div style={{ padding: "28px 28px 0" }}>
          {tab === "overview" && <OverviewTab />}
          {tab === "channels" && <ChannelsTab />}
          {tab === "campaigns" && <CampaignsTab />}
          {tab === "sources" && <SourcesTab />}
        </div>
      </div>
    </>
  );
}
