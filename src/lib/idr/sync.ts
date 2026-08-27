/**
 * Busca os registros de IDR no endpoint do cgc-atividades
 * (GET /api/controle/cgc/idr, protegido por x-idr-secret).
 */

import type { RemoteIdrRecord } from "./types";

export async function fetchRemoteIdrRecords(): Promise<RemoteIdrRecord[]> {
  const url = process.env.CGC_ATIVIDADES_IDR_URL;
  const secret = process.env.CGC_IDR_PROXY_SECRET;
  if (!url || !secret) {
    throw new Error("CGC_ATIVIDADES_IDR_URL ou CGC_IDR_PROXY_SECRET não configurados.");
  }

  const response = await fetch(url, {
    headers: { "x-idr-secret": secret },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Endpoint do cgc-atividades respondeu ${response.status}.`);
  }

  const body = (await response.json()) as { records?: RemoteIdrRecord[] };
  return Array.isArray(body.records) ? body.records : [];
}
