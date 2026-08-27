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

function formatIdr(value: unknown): string {
  return typeof value === "number"
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : String(value ?? "—");
}

export function IdrLineChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="rounded-xl border border-idr-border bg-idr-card p-4 sm:p-5">
      <p className="text-sm text-idr-text-muted mb-4">Evolução do IDR por rede</p>

      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#232B41" vertical={false} />
            <XAxis dataKey="ano" stroke="#FFFFFF" tick={{ fontSize: 12, fill: "#FFFFFF" }} tickLine={false} axisLine={{ stroke: "#232B41" }} />
            <YAxis
              stroke="#FFFFFF"
              domain={["auto", "auto"]}
              tick={{ fontSize: 12, fill: "#FFFFFF" }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip
              contentStyle={{
                background: "#141A29",
                border: "1px solid #232B41",
                borderRadius: 8,
                color: "#FFFFFF",
                fontSize: 13,
              }}
              labelStyle={{ color: "#FFFFFF", marginBottom: 4 }}
              labelFormatter={(ano) => `Ano ${ano}`}
              formatter={(value, name) => [formatIdr(value), name]}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              iconSize={9}
              wrapperStyle={{ paddingTop: 16, fontSize: 13, color: "#FFFFFF" }}
            />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
