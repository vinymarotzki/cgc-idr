"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Rede } from "@/lib/idr/types";

interface ChartPoint {
  ano: number;
  estadual: number | null;
  municipal: number | null;
  particular: number | null;
}

const SERIES: { key: Rede; label: string; color: string }[] = [
  { key: "estadual", label: "REE", color: "#22C55E" },
  { key: "municipal", label: "REME", color: "#EF4444" },
  { key: "particular", label: "RPE", color: "#F5A623" },
];

export function IdrLineChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="rounded-xl border border-idr-border bg-idr-card p-5 h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232B41" />
          <XAxis dataKey="ano" stroke="#7A82A0" />
          <YAxis stroke="#7A82A0" domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#141A29", border: "1px solid #232B41", color: "#E8EAF0" }}
            formatter={(value) => (typeof value === "number" ? value.toFixed(2) : value)}
          />
          <Legend />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
