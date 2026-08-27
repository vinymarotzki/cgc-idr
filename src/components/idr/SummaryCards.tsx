import type { Rede, RedeIndicador } from "@/lib/idr/types";

const REDE_LABELS: Record<Rede, string> = {
  estadual: "Rede Estadual de Ensino (REE)",
  municipal: "Rede Municipal de Ensino (REME)",
  particular: "Rede Particular de Ensino (RPE)",
};

const REDE_SIGLA: Record<Rede, string> = {
  estadual: "REE",
  municipal: "REME",
  particular: "RPE",
};

function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

export function SummaryCards({ rede, ano, indicador }: { rede: Rede; ano: number; indicador: RedeIndicador }) {
  const favoravel = indicador.resultado === "Favoravel";
  const corResultado =
    indicador.resultado === null
      ? "text-idr-text-muted"
      : indicador.resultado === "Favoravel"
        ? "text-idr-estadual"
        : "text-idr-municipal";

  return (
    <div className="rounded-xl border border-idr-border bg-idr-card p-5">
      <p className="text-sm text-idr-text-muted mb-4">
        {REDE_LABELS[rede]} - {ano}
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-idr-border p-4">
          <p className="text-xs text-idr-text-muted mb-1">IDR Geral / {REDE_SIGLA[rede]}</p>
          <p className="text-2xl font-semibold">{formatNumber(indicador.idr)}</p>
        </div>
        <div className="rounded-lg border border-idr-border p-4">
          <p className="text-xs text-idr-text-muted mb-1">Variação</p>
          <p className={`text-2xl font-semibold ${corResultado}`}>{formatPercent(indicador.variacao)}</p>
        </div>
      </div>
      <div className="rounded-lg border border-idr-border p-4">
        <p className="text-xs text-idr-text-muted mb-1">Resultado / {REDE_SIGLA[rede]}</p>
        <p className={`text-xl font-semibold ${corResultado}`}>
          {indicador.resultado === null ? "—" : favoravel ? "Favorável" : "Desfavorável"}
        </p>
      </div>
    </div>
  );
}
