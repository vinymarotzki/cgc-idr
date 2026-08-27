import { describe, expect, it } from "vitest";
import { calculateIdr, calculateVariacao, resultadoFromVariacao } from "./calc";

describe("calculateIdr", () => {
  it("applies the IDR formula", () => {
    expect(calculateIdr(1073, 42260)).toBeCloseTo(2539.0, 1);
  });

  it("returns null when estudantes is 0", () => {
    expect(calculateIdr(10, 0)).toBeNull();
  });
});

describe("calculateVariacao", () => {
  it("computes percentage change between two IDR values", () => {
    expect(calculateVariacao(22.5, 25)).toBeCloseTo(11.11, 1);
  });

  it("returns null when there is no anterior value", () => {
    expect(calculateVariacao(25, null)).toBeNull();
  });

  it("returns null when atual is null", () => {
    expect(calculateVariacao(null, 25)).toBeNull();
  });

  it("returns null when atual is 0 (division by zero)", () => {
    expect(calculateVariacao(0, 10)).toBeNull();
  });
});

describe("resultadoFromVariacao", () => {
  it("is Favoravel when variacao is positive", () => {
    expect(resultadoFromVariacao(9.12)).toBe("Favoravel");
  });

  it("is Desfavoravel when variacao is negative", () => {
    expect(resultadoFromVariacao(-5)).toBe("Desfavoravel");
  });

  it("is Desfavoravel when variacao is exactly 0", () => {
    expect(resultadoFromVariacao(0)).toBe("Desfavoravel");
  });

  it("is null when variacao is null", () => {
    expect(resultadoFromVariacao(null)).toBeNull();
  });
});
