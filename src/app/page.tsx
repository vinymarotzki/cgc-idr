"use client";

import { useEffect, useMemo, useState } from "react";
import { Controls } from "@/components/idr/Controls";
import { SummaryCards } from "@/components/idr/SummaryCards";
import { IdrLineChart } from "@/components/idr/IdrLineChart";
import type { Categoria, DashboardPayload, Rede } from "@/lib/idr/types";

const CATEGORIA_LABELS: Record<Categoria, string> = {
  praticaDesportiva: "Prática desportiva",
  emergenciasClinicas: "Emergências clínicas",
  quedas: "Quedas de pessoas",
  acidentesDiversos: "Acidentes diversos",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const [rede, setRede] = useState<Rede>("estadual");
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
    }));
  }, [data]);

  if (loadError) {
    return <main className="p-8 text-idr-text">{loadError}</main>;
  }

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
        <span className="h-14 w-14 sm:h-20 sm:w-20 rounded-full border-4 sm:border-[6px] border-idr-border border-t-idr-estadual animate-spin" />
        <div className="space-y-2">
          <h1 className="text-base sm:text-xl text-idr-text uppercase tracking-wide font-semibold">
            Carregando IDR…
          </h1>
          <p className="text-xs sm:text-sm text-idr-text-muted">
            Sincronizando dados do canal 36602
          </p>
        </div>
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

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-sm text-idr-text-muted uppercase tracking-wide mb-4">
        Índice de Desempenho Reativo (IDR)
      </h1>

      <Controls
        anos={data.anos}
        ano={ano}
        onAnoChange={setAno}
        rede={rede}
        onRedeChange={setRede}
        tab={tab}
        onTabChange={setTab}
      />

      <div className="space-y-5">
        {tab === "geral" ? (
          <SummaryCards rede={rede} ano={ano} indicador={data.geral[ano][rede]} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(CATEGORIA_LABELS) as Categoria[]).map((categoria) => (
              <div key={categoria}>
                <p className="text-xs text-idr-text-muted mb-2">{CATEGORIA_LABELS[categoria]}</p>
                <SummaryCards rede={rede} ano={ano} indicador={data.porTipo[categoria][ano][rede]} />
              </div>
            ))}
          </div>
        )}

        <IdrLineChart data={chartData} />
      </div>

      {!data.syncOk && (
        <p className="mt-4 text-xs text-idr-municipal">
          Dados podem estar desatualizados: {data.syncError}
        </p>
      )}
    </main>
  );
}
