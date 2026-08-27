// Dev-only: popula idr-local.db com dados fictícios pra testar a UI
// visualmente, já que o canal 36602 ainda não tem mensagens reais.
import { createClient } from "@libsql/client";

const client = createClient({ url: process.env.TURSO_DATABASE_URL || "file:./idr-local.db" });

await client.execute(`
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

const rows = [
  { ano: 2024, rede: "estadual", total: 1180, estudantes: 42200, pd: 90, ec: 60, q: 40, ad: 30 },
  { ano: 2024, rede: "municipal", total: 900, estudantes: 33000, pd: 70, ec: 40, q: 25, ad: 20 },
  { ano: 2024, rede: "particular", total: 400, estudantes: 15000, pd: 30, ec: 15, q: 10, ad: 8 },
  { ano: 2025, rede: "estadual", total: 1073, estudantes: 42260, pd: 80, ec: 55, q: 35, ad: 28 },
  { ano: 2025, rede: "municipal", total: 891, estudantes: 33000, pd: 68, ec: 38, q: 24, ad: 19 },
  { ano: 2025, rede: "particular", total: 405, estudantes: 15000, pd: 31, ec: 16, q: 10, ad: 8 },
];

for (const row of rows) {
  await client.execute({
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
    args: [row.ano, row.rede, row.total, row.estudantes, row.pd, row.ec, row.q, row.ad, new Date().toISOString()],
  });
}

console.log("Seed OK: %d linhas em idr_snapshots", rows.length);
