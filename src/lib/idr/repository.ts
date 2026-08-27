/**
 * Persistência dos snapshots de IDR no Turso. upsertSnapshotsFromRemote
 * sobrescreve por (ano, rede) — cada sync reflete o estado mais recente do
 * canal 36602, sem acumular histórico de revisões dentro do mesmo ano.
 */

import { getDb, initDb } from "@/lib/db";
import { REDES, type IdrSnapshotRow, type RemoteIdrRecord } from "./types";

export async function upsertSnapshotsFromRemote(records: RemoteIdrRecord[]): Promise<void> {
  if (records.length === 0) return;

  await initDb();
  const db = getDb();
  const syncedAt = new Date().toISOString();

  // Ordena por messageId: se duas mensagens cobrirem o mesmo ano (resubmissão),
  // a mais nova (maior id) escreve por último e vence.
  const sorted = [...records].sort((a, b) => a.messageId - b.messageId);

  for (const record of sorted) {
    for (const rede of REDES) {
      const metrics = record.redes[rede];
      if (!metrics) continue;

      await db.execute({
        sql: `
          INSERT INTO idr_snapshots (
            ano, rede, ocorrencias_total, estudantes,
            ocorrencias_pratica_desportiva, ocorrencias_emergencias_clinicas,
            ocorrencias_quedas, ocorrencias_acidentes_diversos, synced_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (ano, rede) DO UPDATE SET
            ocorrencias_total = excluded.ocorrencias_total,
            estudantes = excluded.estudantes,
            ocorrencias_pratica_desportiva = excluded.ocorrencias_pratica_desportiva,
            ocorrencias_emergencias_clinicas = excluded.ocorrencias_emergencias_clinicas,
            ocorrencias_quedas = excluded.ocorrencias_quedas,
            ocorrencias_acidentes_diversos = excluded.ocorrencias_acidentes_diversos,
            synced_at = excluded.synced_at
        `,
        args: [
          record.ano,
          rede,
          metrics.ocorrencias,
          metrics.estudantes,
          metrics.praticaDesportiva,
          metrics.emergenciasClinicas,
          metrics.quedas,
          metrics.acidentesDiversos,
          syncedAt,
        ],
      });
    }
  }
}

export async function listSnapshots(): Promise<IdrSnapshotRow[]> {
  await initDb();
  const db = getDb();
  const result = await db.execute(`SELECT * FROM idr_snapshots ORDER BY ano ASC`);

  return (result.rows as unknown as Array<Record<string, unknown>>).map((row) => ({
    ano: Number(row.ano),
    rede: row.rede as IdrSnapshotRow["rede"],
    ocorrenciasTotal: Number(row.ocorrencias_total),
    estudantes: Number(row.estudantes),
    ocorrenciasPraticaDesportiva: Number(row.ocorrencias_pratica_desportiva),
    ocorrenciasEmergenciasClinicas: Number(row.ocorrencias_emergencias_clinicas),
    ocorrenciasQuedas: Number(row.ocorrencias_quedas),
    ocorrenciasAcidentesDiversos: Number(row.ocorrencias_acidentes_diversos),
  }));
}
