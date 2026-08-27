"use client";

interface ControlsProps {
  anos: number[];
  ano: number;
  onAnoChange: (ano: number) => void;
  tab: "geral" | "tipo";
  onTabChange: (tab: "geral" | "tipo") => void;
}

export function Controls({ anos, ano, onAnoChange, tab, onTabChange }: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <select
        value={ano}
        onChange={(event) => onAnoChange(Number(event.target.value))}
        className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
      >
        {anos.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onTabChange(tab === "geral" ? "tipo" : "geral")}
        className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
      >
        {tab === "geral" ? "IDR por tipo de ocorrência" : "IDR geral"}
      </button>
    </div>
  );
}
