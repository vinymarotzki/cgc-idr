"use client";

import { useEffect, useState } from "react";
import { REDE_LABELS } from "@/lib/idr/labels";
import { REDES, type Categoria, type DashboardPayload, type Rede } from "@/lib/idr/types";

const CAMPO_CATEGORIA_LABELS: Record<Categoria, string> = {
  praticaDesportiva: "Quantidade de Acidentes na Prática Desportiva",
  emergenciasClinicas: "Quantidade de Emergências Clínicas",
  quedas: "Quantidade de Quedas de Pessoas",
  acidentesDiversos: "Quantidade de Acidentes Diversos",
};

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

const REDE_OPTIONS: { value: Rede; label: string }[] = REDES.map((rede) => ({
  value: rede,
  label: REDE_LABELS[rede],
}));

interface Campo {
  label: string;
  value: number;
}

export default function DadosPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const [rede, setRede] = useState<Rede>("estadual");

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

  if (loadError) {
    return <main className="p-8 text-idr-text">{loadError}</main>;
  }

  if (!data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 text-center">
        <span className="h-14 w-14 sm:h-20 sm:w-20 rounded-full border-4 sm:border-[6px] border-idr-border border-t-idr-estadual animate-spin" />
        <h1 className="text-base sm:text-xl text-idr-text uppercase tracking-wide font-semibold">
          Carregando dados…
        </h1>
      </main>
    );
  }

  if (data.anos.length === 0 || ano === null) {
    return (
      <main className="p-4 sm:p-8 max-w-2xl mx-auto">
        <h1 className="text-sm text-idr-text-muted uppercase tracking-wide mb-4">
          Dados do IDR
        </h1>
        <p className="text-idr-text-muted">
          Nenhum dado sincronizado ainda do canal 36602.
          {data.syncError ? ` (${data.syncError})` : ""}
        </p>
      </main>
    );
  }

  const geralIndicador = data.geral[ano][rede];
  const campos: Campo[] = [
    { label: "Quantidade Total de Ocorrências", value: geralIndicador.ocorrencias },
    { label: "Quantidade de Estudantes da Capital", value: geralIndicador.estudantes },
    ...(Object.keys(CAMPO_CATEGORIA_LABELS) as Categoria[]).map((categoria) => ({
      label: CAMPO_CATEGORIA_LABELS[categoria],
      value: data.porTipo[categoria][ano][rede].ocorrencias,
    })),
  ];

  return (
    <main className="p-4 sm:p-8 max-w-2xl mx-auto">
      <h1 className="text-sm text-idr-text-muted uppercase tracking-wide mb-4">
        Dados do IDR
      </h1>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <select
          value={ano}
          onChange={(event) => setAno(Number(event.target.value))}
          className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
        >
          {data.anos.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>

        <select
          value={rede}
          onChange={(event) => setRede(event.target.value as Rede)}
          className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
        >
          {REDE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-idr-border bg-idr-card p-4 sm:p-5">
        <p className="text-sm text-idr-text mb-4 font-semibold">
          {REDE_LABELS[rede]} - {ano}
        </p>

        <div className="space-y-4">
          {campos.map((campo) => (
            <div key={campo.label}>
              <p className="text-xs text-idr-text-muted mb-1">{campo.label}</p>
              <p className="rounded-lg border border-idr-border bg-idr-bg px-4 py-3 text-base text-idr-text">
                {formatNumber(campo.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
