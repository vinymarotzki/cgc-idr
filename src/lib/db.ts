import { createClient } from "@libsql/client";

let client: ReturnType<typeof createClient> | null = null;

/**
 * Sem TURSO_DATABASE_URL, usa um arquivo SQLite local (file:./idr-local.db)
 * — permite rodar `npm run dev`/testes de integração sem precisar de conta
 * no Turso. Em produção (Vercel), a env var sempre aponta pro banco real.
 */
export function getDb() {
  if (!client) {
    const url = process.env.TURSO_DATABASE_URL || "file:./idr-local.db";
    const authToken = process.env.TURSO_AUTH_TOKEN;
    client = createClient({ url, authToken: authToken || undefined });
  }
  return client;
}

async function runMigrations() {
  const db = getDb();

  // Um snapshot por (ano, rede) — upsert sobrescreve com o último valor
  // sincronizado do canal 36602. Não guarda histórico de mudanças dentro do
  // mesmo ano/rede, só o estado mais recente.
  await db.execute(`
    CREATE TABLE IF NOT EXISTS idr_snapshots (
      ano INTEGER NOT NULL,
      rede TEXT NOT NULL,
      ocorrencias_total INTEGER NOT NULL DEFAULT 0,
      estudantes INTEGER NOT NULL DEFAULT 0,
      ocorrencias_pratica_desportiva INTEGER NOT NULL DEFAULT 0,
      ocorrencias_emergencias_clinicas INTEGER NOT NULL DEFAULT 0,
      ocorrencias_quedas INTEGER NOT NULL DEFAULT 0,
      ocorrencias_acidentes_diversos INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (ano, rede)
    )
  `);
}

let dbReadyPromise: Promise<void> | null = null;

export function initDb(): Promise<void> {
  if (!dbReadyPromise) {
    dbReadyPromise = runMigrations().catch((error) => {
      dbReadyPromise = null;
      throw error;
    });
  }
  return dbReadyPromise;
}
