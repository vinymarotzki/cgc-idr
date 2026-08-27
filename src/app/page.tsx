"use client";

import { useEffect, useMemo, useState } from "react";
import { Controls } from "@/components/idr/Controls";
import { SummaryCards } from "@/components/idr/SummaryCards";
import { IdrLineChart } from "@/components/idr/IdrLineChart";
import { FonteDadosDialog } from "@/components/idr/FonteDadosDialog";
import type { Categoria, DashboardPayload } from "@/lib/idr/types";
import { CATEGORIA_LABELS } from "@/lib/idr/labels";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const [tab, setTab] = useState<"geral" | "tipo">("geral");

  useEffect(() => {
    fetch("/api/idr/dashboard")
      .then((response) => response.json())
      .then((payload: DashboardPayload) => {
        setData(payload);
        if (payload.anos.length > 0) {
          setAno(payload.anos[payload.anos.length - 1]);
        }
      })
      .catch(() => setLoadError("Não foi possível carregar os dados do IDR."));
  }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.anos.map((year) => ({
      ano: year,
      estadual: data.geral[year]?.estadual?.idr ?? null,
      municipal: data.geral[year]?.municipal?.idr ?? null,
      particular: data.geral[year]?.particular?.idr ?? null,
      estadualVariacao: data.geral[year]?.estadual?.variacao ?? null,
      municipalVariacao: data.geral[year]?.municipal?.variacao ?? null,
      particularVariacao: data.geral[year]?.particular?.variacao ?? null,
    }));
  }, [data]);

  if (loadError) {
    return <main className="p-8 text-idr-text">{loadError}</main>;
  }

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
        <span className="h-14 w-14 sm:h-20 sm:w-20 rounded-full border-4 sm:border-[6px] border-idr-border border-t-idr-estadual animate-spin" />
        <h1 className="text-base sm:text-xl text-idr-text uppercase tracking-wide font-semibold">
          Carregando IDR…
        </h1>
      </main>
    );
  }

  if (data.anos.length === 0 || ano === null) {
    return (
      <main className="p-8 max-w-4xl mx-auto">
        <h1 className="text-sm text-idr-text-muted uppercase tracking-wide mb-4">
          Índice de Desempenho Reativo (IDR)
        </h1>
        <p className="text-idr-text-muted">
          Nenhum dado sincronizado ainda do canal 36602.
          {data.syncError ? ` (${data.syncError})` : ""}
        </p>
      </main>
    );
  }

  const anoIndex = data.anos.indexOf(ano);
  const anoAnterior = anoIndex > 0 ? data.anos[anoIndex - 1] : null;

  return (
    <main className="p-4 sm:p-8 max-w-4xl mx-auto">
      <h1 className="text-sm text-idr-text-muted uppercase tracking-wide mb-4">
        Índice de Desempenho Reativo (IDR)
      </h1>

      <Controls
        anos={data.anos}
        ano={ano}
        onAnoChange={setAno}
        tab={tab}
        onTabChange={setTab}
      />

      <div className="space-y-5">
        {tab === "geral" ? (
          <SummaryCards ano={ano} anoAnterior={anoAnterior} indicadores={data.geral[ano]} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(CATEGORIA_LABELS) as Categoria[]).map((categoria) => (
              <div key={categoria}>
                <p className="text-xs text-idr-text-muted mb-2">{CATEGORIA_LABELS[categoria]}</p>
                <SummaryCards ano={ano} anoAnterior={anoAnterior} indicadores={data.porTipo[categoria][ano]} />
              </div>
            ))}
          </div>
        )}

        <IdrLineChart data={chartData} />

        <FonteDadosDialog />
      </div>

      {!data.syncOk && (
        <p className="mt-4 text-xs text-idr-municipal">
          Dados podem estar desatualizados: {data.syncError}
        </p>
      )}
    </main>
  );
}
