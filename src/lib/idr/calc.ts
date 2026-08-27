/**
 * IDR = (ocorrências ÷ estudantes) × 100.000. Puro — sem rede, sem banco —
 * pra poder testar a fórmula e as regras de variação/resultado isoladas do
 * resto do sistema.
 */

export function calculateIdr(ocorrencias: number, estudantes: number): number | null {
  if (!estudantes) return null;
  return (ocorrencias / estudantes) * 100000;
}

export function calculateVariacao(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null || atual === 0) return null;
  return (anterior / atual - 1) * 100;
}

export type Resultado = "Favoravel" | "Desfavoravel";

/** IDR menor é melhor (menos ocorrência por estudante) — variação positiva é favorável. */
export function resultadoFromVariacao(variacao: number | null): Resultado | null {
  if (variacao === null) return null;
  return variacao > 0 ? "Favoravel" : "Desfavoravel";
}
