/**
 * Sincroniza com o cgc-atividades a cada carregamento (sem cron — ver spec)
 * e devolve o payload já calculado pro front. Se o fetch remoto falhar, ainda
 * responde com o último estado persistido no Turso (syncOk: false avisa o
 * front que os dados podem estar desatualizados, mas não derruba a página).
 */

import { NextResponse } from "next/server";
import { fetchRemoteIdrRecords } from "@/lib/idr/sync";
import { listSnapshots, upsertSnapshotsFromRemote } from "@/lib/idr/repository";
import { buildDashboardPayload } from "@/lib/idr/aggregate";

export const maxDuration = 60;

export async function GET() {
  let syncOk = true;
  let syncError: string | null = null;

  try {
    const records = await fetchRemoteIdrRecords();
    await upsertSnapshotsFromRemote(records);
  } catch (error) {
    syncOk = false;
    syncError = error instanceof Error ? error.message : "Falha ao sincronizar com o cgc-atividades.";
  }

  const rows = await listSnapshots();
  const payload = buildDashboardPayload(rows);

  return NextResponse.json({ syncOk, syncError, ...payload });
}
