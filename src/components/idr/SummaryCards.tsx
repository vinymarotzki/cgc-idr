import type { Rede, RedeIndicador } from "@/lib/idr/types";
import { REDE_LABELS, REDE_SIGLA } from "@/lib/idr/labels";

const REDE_ORDER: Rede[] = ["estadual", "municipal", "particular"];

function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

export function SummaryCards({
  ano,
  anoAnterior,
  indicadores,
}: {
  ano: number;
  anoAnterior: number | null;
  indicadores: Record<Rede, RedeIndicador>;
}) {
  return (
    <div className="rounded-xl border border-idr-border bg-idr-card p-4 sm:p-5 w-full">
      <p className="text-sm text-idr-text-muted mb-4">Ano {ano}</p>

      <div className="max-h-72 sm:max-h-80 overflow-y-auto pr-1 space-y-3 sm:space-y-4">
        {REDE_ORDER.map((rede) => {
          const indicador = indicadores[rede];
          const favoravel = indicador.resultado === "Favoravel";
          const corResultado =
            indicador.resultado === null
              ? "text-idr-text-muted"
              : favoravel
                ? "text-idr-estadual"
                : "text-idr-municipal";
          const corBorda =
            indicador.resultado === null
              ? "border-idr-border"
              : favoravel
                ? "border-idr-estadual"
                : "border-idr-municipal";

          return (
            <div key={rede} className={`rounded-lg border-2 ${corBorda} p-3 sm:p-4`}>
              <p className="text-sm text-idr-text mb-3">{REDE_LABELS[rede]}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-xs text-idr-text-muted mb-1">
                    IDR / {REDE_SIGLA[rede]} {anoAnterior !== null ? `(${anoAnterior} → ${ano})` : ""}
                  </p>
                  <p className="text-base sm:text-lg font-semibold">{formatNumber(indicador.idr)}</p>
                </div>
                <div>
                  <p className="text-xs text-idr-text-muted mb-1">
                    Variação {anoAnterior !== null ? `(${anoAnterior} → ${ano})` : ""}
                  </p>
                  <p className={`text-base sm:text-lg font-semibold ${corResultado}`}>
                    {formatPercent(indicador.variacao)}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className="text-xs text-idr-text-muted mb-1">Resultado</p>
                  <p className={`text-base sm:text-lg font-semibold ${corResultado}`}>
                    {indicador.resultado === null ? "—" : favoravel ? "Favorável" : "Desfavorável"}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
