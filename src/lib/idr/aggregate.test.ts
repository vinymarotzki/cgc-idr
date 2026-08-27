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

  it("preserves rede's anterior IDR when skipping a gap ano with no data", () => {
    // Simulate: estadual has data in 2024 and 2026, but NOT 2025
    //          municipal has data in 2025 (so 2025 stays in anos list)
    const testRows: IdrSnapshotRow[] = [
      row({
        ano: 2024,
        rede: "estadual",
        ocorrenciasTotal: 100,
        estudantes: 1000,
      }),
      row({
        ano: 2025,
        rede: "municipal",
        ocorrenciasTotal: 50,
        estudantes: 500,
      }),
      row({
        ano: 2026,
        rede: "estadual",
        ocorrenciasTotal: 120,
        estudantes: 1000,
      }),
    ];

    const payload = buildDashboardPayload(testRows);

    // Confirm anos list includes all three years
    expect(payload.anos).toEqual([2024, 2025, 2026]);

    // At ano 2024, estadual should have a real idr
    const estadual2024 = payload.geral[2024].estadual;
    expect(estadual2024.idr).not.toBeNull();
    const idr2024 = estadual2024.idr;

    // At ano 2025, estadual has no data -> idr should be null, variacao should be null
    const estadual2025 = payload.geral[2025].estadual;
    expect(estadual2025.idr).toBeNull();
    expect(estadual2025.variacao).toBeNull();

    // At ano 2026, estadual should have a real idr AND variacao computed against 2024 (NOT null)
    const estadual2026 = payload.geral[2026].estadual;
    expect(estadual2026.idr).not.toBeNull();
    expect(estadual2026.variacao).not.toBeNull();
    // Verify variacao is computed against 2024's idr, not null
    const expected2026Variacao = ((estadual2026.idr! - idr2024!) / idr2024!) * 100;
    expect(estadual2026.variacao).toBeCloseTo(expected2026Variacao, 2);
  });
});
