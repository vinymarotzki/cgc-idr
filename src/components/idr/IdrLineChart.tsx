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
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";
import type { Rede } from "@/lib/idr/types";

interface ChartPoint {
  ano: number;
  estadual: number | null;
  municipal: number | null;
  particular: number | null;
  estadualVariacao: number | null;
  municipalVariacao: number | null;
  particularVariacao: number | null;
  meta: number;
}

const SERIES: { key: Rede; variacaoKey: keyof ChartPoint; label: string; color: string }[] = [
  { key: "estadual", variacaoKey: "estadualVariacao", label: "REE", color: "#22C55E" },
  { key: "municipal", variacaoKey: "municipalVariacao", label: "REME", color: "#EF4444" },
  { key: "particular", variacaoKey: "particularVariacao", label: "RPE", color: "#F5A623" },
];

function formatIdr(value: unknown): string {
  return typeof value === "number"
    ? value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
}

function formatVariacao(value: unknown): string {
  if (typeof value !== "number") return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatIdr(value)}%`;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: number | string;
  payload?: { dataKey?: string | number; name?: NameType; value?: ValueType; color?: string; payload: ChartPoint }[];
}

function ChartTooltip({ active, label, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-idr-border bg-idr-card p-3 text-sm">
      <p className="text-idr-text-muted mb-2">Ano {label}</p>
      <div className="space-y-1.5">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: series.color }} />
            <span className="text-idr-text">{series.label}:</span>
            <span className="text-idr-text font-medium">{formatIdr(point[series.key])}</span>
            <span className="text-idr-text-muted">({formatVariacao(point[series.variacaoKey])})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IdrLineChart({
  data,
  title = "Evolução do IDR por rede",
}: {
  data: ChartPoint[];
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-idr-border bg-idr-card p-4 sm:p-5">
      <p className="text-sm text-idr-text-muted mb-4">{title}</p>

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
            <Tooltip content={<ChartTooltip />} />
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
