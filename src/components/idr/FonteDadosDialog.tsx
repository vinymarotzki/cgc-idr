"use client";

import { useRef } from "react";

export function FonteDadosDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <div>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
      >
        Fonte dos dados
      </button>

      <dialog
        ref={dialogRef}
        className="rounded-xl border border-idr-border bg-idr-card p-5 max-w-lg w-[90vw] text-idr-text-muted [&::backdrop]:bg-black/60"
      >
        <p className="text-xs sm:text-sm leading-relaxed">
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

        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="mt-4 rounded-full border border-idr-border px-4 py-2 text-sm"
        >
          Fechar
        </button>
      </dialog>
    </div>
  );
}
