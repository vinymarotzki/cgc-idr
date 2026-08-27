import type { Categoria, Rede } from "./types";

export const REDE_LABELS: Record<Rede, string> = {
  estadual: "Rede Estadual de Ensino (REE)",
  municipal: "Rede Municipal de Ensino (REME)",
  particular: "Rede Particular de Ensino (RPE)",
};

export const REDE_SIGLA: Record<Rede, string> = {
  estadual: "REE",
  municipal: "REME",
  particular: "RPE",
};

export const CATEGORIA_LABELS: Record<Categoria, string> = {
  praticaDesportiva: "Prática desportiva",
  emergenciasClinicas: "Emergências clínicas",
  quedas: "Quedas de pessoas",
  acidentesDiversos: "Acidentes diversos",
};
