/**
 * Combina as linhas do Turso com calc.ts pra montar o payload que a rota
 * /api/idr/dashboard devolve pro front. Puro — recebe as linhas já lidas,
 * não fala com o banco.
 *
 * Variação/resultado comparam cada ano com o ano imediatamente anterior na
 * lista de anos presentes, por rede — não com "ano - 1" literal, caso algum
 * ano fique sem nenhum snapshot.
 */

import { calculateIdr, calculateVariacao, resultadoFromVariacao } from "./calc";
import { CATEGORIAS, REDES, type Categoria, type DashboardPayload, type IdrSnapshotRow, type Rede, type RedeIndicador } from "./types";

function buildIndicador(ocorrencias: number, estudantes: number, idrAnterior: number | null): RedeIndicador {
  const idr = calculateIdr(ocorrencias, estudantes);
  const variacao = calculateVariacao(idr, idrAnterior);
  return {
    ocorrencias,
    estudantes,
    idr,
    variacao,
    resultado: resultadoFromVariacao(variacao),
  };
}

function categoriaOcorrencias(row: IdrSnapshotRow, categoria: Categoria): number {
  switch (categoria) {
    case "praticaDesportiva":
      return row.ocorrenciasPraticaDesportiva;
    case "emergenciasClinicas":
      return row.ocorrenciasEmergenciasClinicas;
    case "quedas":
      return row.ocorrenciasQuedas;
    case "acidentesDiversos":
      return row.ocorrenciasAcidentesDiversos;
  }
}

export function buildDashboardPayload(
  rows: IdrSnapshotRow[]
): Omit<DashboardPayload, "syncOk" | "syncError"> {
  const anos = [...new Set(rows.map((row) => row.ano))].sort((a, b) => a - b);

  const byAnoRede = new Map<string, IdrSnapshotRow>();
  for (const row of rows) {
    byAnoRede.set(`${row.ano}:${row.rede}`, row);
  }

  const geral: DashboardPayload["geral"] = {};
  const porTipo: DashboardPayload["porTipo"] = {
    praticaDesportiva: {},
    emergenciasClinicas: {},
    quedas: {},
    acidentesDiversos: {},
  };

  const idrGeralAnterior: Partial<Record<Rede, number | null>> = {};
  const idrTipoAnterior: Record<Categoria, Partial<Record<Rede, number | null>>> = {
    praticaDesportiva: {},
    emergenciasClinicas: {},
    quedas: {},
    acidentesDiversos: {},
  };

  for (const ano of anos) {
    geral[ano] = {} as Record<Rede, RedeIndicador>;
    for (const categoria of CATEGORIAS) {
      porTipo[categoria][ano] = {} as Record<Rede, RedeIndicador>;
    }

    for (const rede of REDES) {
      const row = byAnoRede.get(`${ano}:${rede}`);

      const geralIndicador = buildIndicador(
        row?.ocorrenciasTotal ?? 0,
        row?.estudantes ?? 0,
        idrGeralAnterior[rede] ?? null
      );
      geral[ano][rede] = geralIndicador;
      idrGeralAnterior[rede] = geralIndicador.idr;

      for (const categoria of CATEGORIAS) {
        const ocorrencias = row ? categoriaOcorrencias(row, categoria) : 0;
        const indicador = buildIndicador(
          ocorrencias,
          row?.estudantes ?? 0,
          idrTipoAnterior[categoria][rede] ?? null
        );
        porTipo[categoria][ano][rede] = indicador;
        idrTipoAnterior[categoria][rede] = indicador.idr;
      }
    }
  }

  return { anos, geral, porTipo };
}
