"use client";

import { useEffect, useMemo, useState } from "react";
import { Controls } from "@/components/idr/Controls";
import { SummaryCards } from "@/components/idr/SummaryCards";
import { IdrLineChart } from "@/components/idr/IdrLineChart";
import { InfoDialogButton } from "@/components/idr/InfoDialogButton";
import type { Categoria, DashboardPayload } from "@/lib/idr/types";
import { CATEGORIA_LABELS } from "@/lib/idr/labels";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const [tab, setTab] = useState<"geral" | "tipo">("geral");
  const [categoria, setCategoria] = useState<Categoria>("praticaDesportiva");

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

  const chartDataPorTipo = useMemo(() => {
    if (!data) return [];
    return data.anos.map((year) => ({
      ano: year,
      estadual: data.porTipo[categoria][year]?.estadual?.idr ?? null,
      municipal: data.porTipo[categoria][year]?.municipal?.idr ?? null,
      particular: data.porTipo[categoria][year]?.particular?.idr ?? null,
      estadualVariacao: data.porTipo[categoria][year]?.estadual?.variacao ?? null,
      municipalVariacao: data.porTipo[categoria][year]?.municipal?.variacao ?? null,
      particularVariacao: data.porTipo[categoria][year]?.particular?.variacao ?? null,
    }));
  }, [data, categoria]);

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
        categoria={categoria}
        onCategoriaChange={setCategoria}
      />

      <div className="space-y-5">
        {tab === "geral" ? (
          <>
            <SummaryCards ano={ano} anoAnterior={anoAnterior} indicadores={data.geral[ano]} />
            <IdrLineChart data={chartData} />
          </>
        ) : (
          <>
            <SummaryCards ano={ano} anoAnterior={anoAnterior} indicadores={data.porTipo[categoria][ano]} />
            <IdrLineChart
              data={chartDataPorTipo}
              title={`Evolução do IDR por rede — ${CATEGORIA_LABELS[categoria]}`}
            />
          </>
        )}

        <div className="flex flex-wrap gap-3">
          <InfoDialogButton label="Fonte dos dados">
            <p>
              O Índice de Desempenho Reativo (IDR) será calculado por amostragem, considerando o
              quantitativo de ocorrências atendidas pelo Corpo de Bombeiros Militar de Mato Grosso do
              Sul (CBMMS) e o número de estudantes da capital do Estado. Para a composição do índice,
              serão consideradas as quatro categorias de ocorrências com maior incidência na capital,
              conforme os dados registrados pelo Centro Integrado de Operações de Segurança (CIOPS) da
              Secretaria de Estado de Justiça e Segurança Pública de Mato Grosso do Sul (SEJUSP/MS). O
              quantitativo de estudantes utilizado no cálculo é proveniente da plataforma GeoReDUS,
              desenvolvida em conjunto pela Frente Nacional de Prefeitas e Prefeitos (FNP), Centro de
              Estudos da Metrópole (CEM/USP), Instituto ORI:ORO e GIZ, no âmbito da Rede para
              Desenvolvimento Urbano Sustentável (ReDUS). A plataforma utiliza dados oficiais do
              Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (INEP) para a
              composição de seus indicadores.
            </p>
          </InfoDialogButton>

          <InfoDialogButton label="Descritivo do IDR">
            <p>
              O Índice de Desempenho Reativo (IDR) é um indicador calculado por amostragem que
              mensura a incidência de ocorrências em relação ao número de estudantes, sendo
              utilizado para avaliar os resultados das ações de segurança desenvolvidas pela CGC no
              ambiente escolar.
            </p>
            <p>
              O índice permite classificar os resultados em duas categorias: "favorável" e "não
              favorável", de acordo com os parâmetros estabelecidos para a avaliação.
            </p>
            <p>
              O IDR é calculado pela seguinte fórmula: IDR = (número de ocorrências ÷ número de
              estudantes) × 10.000.
            </p>
          </InfoDialogButton>
        </div>
      </div>

      {!data.syncOk && (
        <p className="mt-4 text-xs text-idr-municipal">
          Dados podem estar desatualizados: {data.syncError}
        </p>
      )}
    </main>
  );
}
