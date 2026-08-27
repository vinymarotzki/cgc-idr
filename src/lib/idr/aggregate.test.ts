import { describe, expect, it } from "vitest";
import { buildDashboardPayload } from "./aggregate";
import type { IdrSnapshotRow } from "./types";

function row(overrides: Partial<IdrSnapshotRow> & Pick<IdrSnapshotRow, "ano" | "rede">): IdrSnapshotRow {
  return {
    ocorrenciasTotal: 0,
    estudantes: 0,
    ocorrenciasPraticaDesportiva: 0,
    ocorrenciasEmergenciasClinicas: 0,
    ocorrenciasQuedas: 0,
    ocorrenciasAcidentesDiversos: 0,
    ...overrides,
  };
}

describe("buildDashboardPayload", () => {
  const rows: IdrSnapshotRow[] = [
    row({
      ano: 2024,
      rede: "estadual",
      ocorrenciasTotal: 1180,
      estudantes: 42200,
      ocorrenciasPraticaDesportiva: 90,
      ocorrenciasEmergenciasClinicas: 60,
      ocorrenciasQuedas: 40,
      ocorrenciasAcidentesDiversos: 30,
    }),
    row({
      ano: 2025,
      rede: "estadual",
      ocorrenciasTotal: 1073,
      estudantes: 42260,
      ocorrenciasPraticaDesportiva: 80,
      ocorrenciasEmergenciasClinicas: 55,
      ocorrenciasQuedas: 35,
      ocorrenciasAcidentesDiversos: 28,
    }),
  ];

  it("lists sorted unique anos", () => {
    const payload = buildDashboardPayload(rows);
    expect(payload.anos).toEqual([2024, 2025]);
  });

  it("computes IDR per ano/rede", () => {
    const payload = buildDashboardPayload(rows);
    expect(payload.geral[2024].estadual.idr).toBeCloseTo(279.62, 1);
    expect(payload.geral[2025].estadual.idr).toBeCloseTo(253.9, 1);
  });

  it("has null variacao/resultado on the first available ano", () => {
    const payload = buildDashboardPayload(rows);
    expect(payload.geral[2024].estadual.variacao).toBeNull();
    expect(payload.geral[2024].estadual.resultado).toBeNull();
  });

  it("computes variacao and resultado against the previous ano", () => {
    const payload = buildDashboardPayload(rows);
    const indicador = payload.geral[2025].estadual;
    expect(indicador.variacao).toBeCloseTo(-9.21, 1);
    expect(indicador.resultado).toBe("Favoravel");
  });

  it("returns null idr/variacao for a rede with no rows", () => {
    const payload = buildDashboardPayload(rows);
    expect(payload.geral[2024].municipal.idr).toBeNull();
    expect(payload.geral[2024].particular.idr).toBeNull();
  });

  it("computes por-tipo indicators using the same rede's estudantes", () => {
    const payload = buildDashboardPayload(rows);
    const praticaDesportiva2025 = payload.porTipo.praticaDesportiva[2025].estadual;
    expect(praticaDesportiva2025.ocorrencias).toBe(80);
    expect(praticaDesportiva2025.estudantes).toBe(42260);
    expect(praticaDesportiva2025.idr).toBeCloseTo((80 / 42260) * 10000, 5);
  });
});
