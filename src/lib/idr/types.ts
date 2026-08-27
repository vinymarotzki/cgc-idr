export type Rede = "estadual" | "municipal" | "particular";

export const REDES: Rede[] = ["estadual", "municipal", "particular"];

export type Categoria =
  | "praticaDesportiva"
  | "emergenciasClinicas"
  | "quedas"
  | "acidentesDiversos";

export const CATEGORIAS: Categoria[] = [
  "praticaDesportiva",
  "emergenciasClinicas",
  "quedas",
  "acidentesDiversos",
];

/** Uma linha da tabela idr_snapshots (já com número, não texto). */
export interface IdrSnapshotRow {
  ano: number;
  rede: Rede;
  ocorrenciasTotal: number;
  estudantes: number;
  ocorrenciasPraticaDesportiva: number;
  ocorrenciasEmergenciasClinicas: number;
  ocorrenciasQuedas: number;
  ocorrenciasAcidentesDiversos: number;
}

/** Formato retornado por GET /api/controle/cgc/idr no cgc-atividades. */
export interface RemoteIdrRecord {
  messageId: number;
  ano: number;
  redes: Record<
    Rede,
    {
      ocorrencias: number;
      estudantes: number;
      praticaDesportiva: number;
      emergenciasClinicas: number;
      quedas: number;
      acidentesDiversos: number;
    }
  >;
}

export interface RedeIndicador {
  ocorrencias: number;
  estudantes: number;
  idr: number | null;
  variacao: number | null;
  resultado: "Favoravel" | "Desfavoravel" | null;
}

export interface DashboardPayload {
  syncOk: boolean;
  syncError: string | null;
  anos: number[];
  geral: Record<number, Record<Rede, RedeIndicador>>;
  porTipo: Record<Categoria, Record<number, Record<Rede, RedeIndicador>>>;
}
