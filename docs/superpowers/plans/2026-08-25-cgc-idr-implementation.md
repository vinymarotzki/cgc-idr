# cgc-idr Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the cgc-idr dashboard (IDR — Índice de Desempenho Reativo), fed by a new read endpoint added to cgc-atividades that surfaces channel-36602 occurrence data from the SASI API.

**Architecture:** Two repos. `cgc-atividades` gets a new authenticated read-only route (`GET /api/controle/cgc/idr`) that queries the SASI API for channel 36602 and returns normalized records. `cgc-idr` is a new Next.js + TypeScript + Turso project: on every dashboard load, a server route pulls from that endpoint, upserts into a local Turso table (cache/history), computes the IDR per rede/ano, and serves it to a client dashboard modeled on the reference screenshot.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 3 (both repos, matching existing `cgc-atividades` conventions). `@libsql/client` for Turso. Recharts for the line chart. Vitest for unit tests on pure logic (new dev dependency in both repos — neither has a test runner today).

**Spec:** `docs/superpowers/specs/2026-08-25-cgc-idr-design.md` (in this repo, `cgc-idr`)

## Global Constraints

- IDR formula: `IDR = (número de ocorrências ÷ número de estudantes) × 10.000`.
- Rede vocabulary is fixed: `estadual` = REE (Rede Estadual de Ensino), `municipal` = REME (Rede Municipal de Ensino), `particular` = RPE (Rede Particular de Ensino).
- Canal SASI 36602 `data_fields` names (exact, confirmed by the user — do not rename):
  `ano`, `quantidade_total_de_ocorrencia_rede_{estadual,municipal,particular}`, `quantidades_de_estudantes_rede_{estadual,municipal,particular}`, `quantidade_pratica_desportiva_rede_*`, `quantidade_de_emergencias_clinicas_rede_*`, `quantidade_de_quedas_pessoas_rede_*`, `quantidades_de_acidentes_diversos_rede_*`.
- `resultado = variação < 0 ? "Favorável" : "Desfavorável"` (variação ≥ 0, including exactly 0, is Desfavorável).
- No cron: cgc-idr syncs on demand, every time the dashboard route is hit — no scheduled job.
- cgc-idr dashboard has no login (decided: open to anyone with the URL).
- cgc-atividades → cgc-idr integration uses a dedicated shared secret `CGC_IDR_PROXY_SECRET` (header `x-idr-secret`), separate from `CONTROLE_PROXY_SECRET`, following the existing `/api/controle/cgc/*` pattern in `cgc-atividades/src/app/api/controle/cgc/route.ts`.
- All UI strings and code comments are pt-BR (matches both repos' convention); comments explain *why*, not *what*.
- Channel 36602 currently has zero messages (`{"count":0}` confirmed against the live SASI API on 2026-08-25) — no real payload exists yet. Every task that depends on real data must be verifiable with fixtures/mocks/seed data instead, per the spec's "Testes / verificação" section.

---

## Part A — cgc-atividades (existing repo: `C:\Users\SASI\cgc-atividades`)

### Task 1: Field map + pure message mapper (idr-mapper)

**Files:**
- Create: `src/lib/cgc/idr-field-map.ts`
- Create: `src/lib/cgc/idr-mapper.ts`
- Test: `src/lib/cgc/idr-mapper.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)

**Interfaces:**
- Produces: `IdrRede` (`"estadual" | "municipal" | "particular"`), `IdrCategoria` (`"praticaDesportiva" | "emergenciasClinicas" | "quedas" | "acidentesDiversos"`), `IDR_REDES: IdrRede[]`, `IDR_CATEGORIAS: IdrCategoria[]` from `idr-field-map.ts`.
- Produces: `IdrRedeMetrics`, `IdrRecord`, `mapMessageToIdrRecord(message: SasiProviderMessage): IdrRecord | null` from `idr-mapper.ts`. Task 2 imports `mapMessageToIdrRecord` and the types from `idr-mapper.ts`.
- Consumes: `SasiDataField`, `SasiProviderMessage` from `@/lib/sasi-api/types` (already exists, unmodified).

- [ ] **Step 1: Create the branch**

```bash
cd /c/Users/SASI/cgc-atividades
git checkout develop
git pull
git checkout -b FIX/add-idr-channel-endpoint
```

- [ ] **Step 2: Add vitest**

```bash
npm install -D vitest
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

Add to `package.json` `scripts`: `"test": "vitest run"`.

- [ ] **Step 3: Write `idr-field-map.ts`**

```ts
/**
 * Nomes dos campos do formulário do canal SASI 36602 (ocorrências pro IDR).
 * Confirmados pelo usuário — canal ainda sem mensagens no momento em que
 * este mapeamento foi escrito, mas o formulário já estava definido. Ao
 * contrário de field-map.ts (canal 33397), não há override por env var
 * aqui: o formulário do 36602 não foi observado em produção ainda, então
 * não há histórico de rename pra proteger.
 */

export type IdrRede = "estadual" | "municipal" | "particular";

export const IDR_REDES: IdrRede[] = ["estadual", "municipal", "particular"];

export type IdrCategoria =
  | "praticaDesportiva"
  | "emergenciasClinicas"
  | "quedas"
  | "acidentesDiversos";

export const IDR_CATEGORIAS: IdrCategoria[] = [
  "praticaDesportiva",
  "emergenciasClinicas",
  "quedas",
  "acidentesDiversos",
];

const CATEGORIA_FIELD_PREFIX: Record<IdrCategoria, string> = {
  praticaDesportiva: "quantidade_pratica_desportiva_rede",
  emergenciasClinicas: "quantidade_de_emergencias_clinicas_rede",
  quedas: "quantidade_de_quedas_pessoas_rede",
  acidentesDiversos: "quantidades_de_acidentes_diversos_rede",
};

export const IDR_FIELD_ANO = "ano";

export function fieldNameOcorrenciasTotal(rede: IdrRede): string {
  return `quantidade_total_de_ocorrencia_rede_${rede}`;
}

export function fieldNameEstudantes(rede: IdrRede): string {
  return `quantidades_de_estudantes_rede_${rede}`;
}

export function fieldNameCategoria(categoria: IdrCategoria, rede: IdrRede): string {
  return `${CATEGORIA_FIELD_PREFIX[categoria]}_${rede}`;
}
```

- [ ] **Step 4: Write the failing test for the mapper**

Create `src/lib/cgc/idr-mapper.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapMessageToIdrRecord } from "./idr-mapper";
import type { SasiDataField, SasiProviderMessage } from "@/lib/sasi-api/types";

function field(name: string, value: number | string): SasiDataField {
  return { name, value };
}

function buildMessage(fields: SasiDataField[], id = 1): SasiProviderMessage {
  return { id, data_fields: fields };
}

describe("mapMessageToIdrRecord", () => {
  it("maps a full message into an IdrRecord", () => {
    const message = buildMessage([
      field("ano", 2025),
      field("quantidade_total_de_ocorrencia_rede_estadual", 1073),
      field("quantidades_de_estudantes_rede_estadual", 42260),
      field("quantidade_pratica_desportiva_rede_estadual", 80),
      field("quantidade_de_emergencias_clinicas_rede_estadual", 55),
      field("quantidade_de_quedas_pessoas_rede_estadual", 35),
      field("quantidades_de_acidentes_diversos_rede_estadual", 28),
      field("quantidade_total_de_ocorrencia_rede_municipal", 891),
      field("quantidades_de_estudantes_rede_municipal", 33000),
      field("quantidade_total_de_ocorrencia_rede_particular", 405),
      field("quantidades_de_estudantes_rede_particular", 15000),
    ]);

    const record = mapMessageToIdrRecord(message);

    expect(record).not.toBeNull();
    expect(record?.messageId).toBe(1);
    expect(record?.ano).toBe(2025);
    expect(record?.redes.estadual).toEqual({
      ocorrencias: 1073,
      estudantes: 42260,
      praticaDesportiva: 80,
      emergenciasClinicas: 55,
      quedas: 35,
      acidentesDiversos: 28,
    });
    expect(record?.redes.municipal.ocorrencias).toBe(891);
    expect(record?.redes.municipal.praticaDesportiva).toBe(0);
    expect(record?.redes.particular.estudantes).toBe(15000);
  });

  it("returns null when the ano field is missing", () => {
    const message = buildMessage([
      field("quantidade_total_de_ocorrencia_rede_estadual", 100),
    ]);

    expect(mapMessageToIdrRecord(message)).toBeNull();
  });

  it("returns null when the message has no id", () => {
    const message = buildMessage([field("ano", 2025)]);
    delete (message as { id?: number }).id;

    expect(mapMessageToIdrRecord(message)).toBeNull();
  });

  it("parses formattedValue text when value is absent", () => {
    const message = buildMessage([
      { name: "ano", formattedValue: "2024" },
      { name: "quantidade_total_de_ocorrencia_rede_estadual", formattedValue: "1.180" },
    ]);

    const record = mapMessageToIdrRecord(message);

    expect(record?.ano).toBe(2024);
    expect(record?.redes.estadual.ocorrencias).toBe(1180);
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run src/lib/cgc/idr-mapper.test.ts`
Expected: FAIL — `Cannot find module './idr-mapper'` (file doesn't exist yet).

- [ ] **Step 6: Write `idr-mapper.ts`**

```ts
/**
 * Mapeamento puro de ProviderMessageComposed (API SASI, canal 36602) pros
 * números que alimentam o IDR. Nada aqui faz rede — só leitura de
 * data_fields. Regra geral herdada de mapper.ts: nunca lança por causa de
 * campo ausente ou tipo inesperado, vira 0/null.
 */

import type { SasiDataField, SasiProviderMessage } from "@/lib/sasi-api/types";
import {
  fieldNameCategoria,
  fieldNameEstudantes,
  fieldNameOcorrenciasTotal,
  IDR_CATEGORIAS,
  IDR_FIELD_ANO,
  IDR_REDES,
  type IdrCategoria,
  type IdrRede,
} from "./idr-field-map";

export interface IdrRedeMetrics {
  ocorrencias: number;
  estudantes: number;
  praticaDesportiva: number;
  emergenciasClinicas: number;
  quedas: number;
  acidentesDiversos: number;
}

export interface IdrRecord {
  messageId: number;
  ano: number;
  redes: Record<IdrRede, IdrRedeMetrics>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toDataFields(message: SasiProviderMessage): SasiDataField[] {
  const candidates: unknown[] = [message.data_fields, message.raw?.dataFields];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter(isRecord) as SasiDataField[];
    }
    if (isRecord(candidate)) {
      const values = Object.values(candidate).filter(isRecord);
      if (values.length > 0) return values as SasiDataField[];
    }
  }
  return [];
}

function findField(fields: SasiDataField[], wantedName: string): SasiDataField | null {
  const wanted = wantedName.trim().toLowerCase();
  for (const field of fields) {
    if (typeof field.name === "string" && field.name.trim().toLowerCase() === wanted) {
      return field;
    }
  }
  return null;
}

/**
 * Extrai um inteiro de um campo. Prioriza `value` numérico; cai pra
 * `value`/`formattedValue` como texto, descartando tudo que não é dígito ou
 * hífen — estes campos são sempre contagens inteiras, nunca decimais, então
 * não há ambiguidade de separador decimal/milhar a resolver.
 */
function toNumber(field: SasiDataField | null): number {
  if (!field) return 0;

  if (typeof field.value === "number" && Number.isFinite(field.value)) {
    return field.value;
  }
  if (typeof field.value === "string") {
    const parsed = Number.parseInt(field.value.replace(/[^\d-]/g, ""), 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  const formatted = Array.isArray(field.formattedValue)
    ? field.formattedValue[0]
    : field.formattedValue;
  if (typeof formatted === "string") {
    const parsed = Number.parseInt(formatted.replace(/[^\d-]/g, ""), 10);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function readRedeMetrics(fields: SasiDataField[], rede: IdrRede): IdrRedeMetrics {
  const categorias = {} as Record<IdrCategoria, number>;
  for (const categoria of IDR_CATEGORIAS) {
    categorias[categoria] = toNumber(findField(fields, fieldNameCategoria(categoria, rede)));
  }

  return {
    ocorrencias: toNumber(findField(fields, fieldNameOcorrenciasTotal(rede))),
    estudantes: toNumber(findField(fields, fieldNameEstudantes(rede))),
    praticaDesportiva: categorias.praticaDesportiva,
    emergenciasClinicas: categorias.emergenciasClinicas,
    quedas: categorias.quedas,
    acidentesDiversos: categorias.acidentesDiversos,
  };
}

/**
 * Converte uma mensagem do canal 36602 num IdrRecord. Retorna null se faltar
 * id ou "ano" válido — sem ano não dá pra decidir em que snapshot a mensagem
 * entra, então ela é descartada em vez de virar um registro incompleto.
 */
export function mapMessageToIdrRecord(message: SasiProviderMessage): IdrRecord | null {
  if (typeof message.id !== "number") return null;

  const fields = toDataFields(message);
  const ano = toNumber(findField(fields, IDR_FIELD_ANO));
  if (!ano) return null;

  const redes = {} as Record<IdrRede, IdrRedeMetrics>;
  for (const rede of IDR_REDES) {
    redes[rede] = readRedeMetrics(fields, rede);
  }

  return { messageId: message.id, ano, redes };
}
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npx vitest run src/lib/cgc/idr-mapper.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/cgc/idr-field-map.ts src/lib/cgc/idr-mapper.ts src/lib/cgc/idr-mapper.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: mapeia mensagens do canal 36602 para registros de IDR"
```

---

### Task 2: SASI fetch + read route `/api/controle/cgc/idr`

**Files:**
- Create: `src/lib/cgc/idr-client.ts`
- Create: `src/app/api/controle/cgc/idr/route.ts`
- Modify: `.env.example` (document `CGC_IDR_PROXY_SECRET`)

**Interfaces:**
- Consumes: `mapMessageToIdrRecord`, `IdrRecord` from `src/lib/cgc/idr-mapper.ts` (Task 1). `fetchProviderMessages`, `SASI_MESSAGES_MAX_LIMIT` from `@/lib/sasi-api/messages` (existing). `resolveSasiToken`, `SasiApiError` from `@/lib/sasi-api/client` (existing).
- Produces: `fetchIdrRecords(token: string): Promise<IdrRecord[]>` from `idr-client.ts` — this is what the route calls, and the shape `cgc-idr` (Part B) consumes over HTTP as `{ records: IdrRecord[] }`.

- [ ] **Step 1: Write `idr-client.ts`**

```ts
/**
 * Busca as mensagens do canal 36602 (formulário de ocorrências pro IDR) na
 * API SASI e mapeia pra IdrRecord. Único ponto que sabe o id do canal —
 * troque IDR_CHANNEL_ID aqui se o canal mudar.
 */

import { fetchProviderMessages, SASI_MESSAGES_MAX_LIMIT } from "@/lib/sasi-api/messages";
import { mapMessageToIdrRecord, type IdrRecord } from "./idr-mapper";

export const IDR_CHANNEL_ID = "36602";

const SCAN_CAP = Number(process.env.SASI_IDR_SCAN_CAP) > 0
  ? Number(process.env.SASI_IDR_SCAN_CAP)
  : 500;

/** Busca e mapeia todas as mensagens do canal 36602, paginando até SCAN_CAP. */
export async function fetchIdrRecords(token: string): Promise<IdrRecord[]> {
  const records: IdrRecord[] = [];
  let scanned = 0;
  let page = 1;

  while (scanned < SCAN_CAP) {
    const batch = await fetchProviderMessages(
      { channel_ids: IDR_CHANNEL_ID, page, limit: SASI_MESSAGES_MAX_LIMIT },
      { token }
    );
    scanned += batch.length;

    for (const message of batch) {
      const record = mapMessageToIdrRecord(message);
      if (record) records.push(record);
    }

    if (batch.length < SASI_MESSAGES_MAX_LIMIT) break;
    page += 1;
  }

  return records;
}
```

- [ ] **Step 2: Write the route**

Create `src/app/api/controle/cgc/idr/route.ts`:

```ts
/**
 * Dados de ocorrência do canal 36602 (SASI), pro cgc-idr calcular o IDR.
 *
 * Servidor-a-servidor, igual aos outros /controle routes: exige
 * x-idr-secret == CGC_IDR_PROXY_SECRET. Secret dedicado (não
 * CONTROLE_PROXY_SECRET) pra poder girar essa credencial sem afetar a
 * integração com o cgc-checklist. Sem sasi-token de usuário — não há sessão
 * pra encaminhar nessa chamada.
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveSasiToken, SasiApiError } from "@/lib/sasi-api/client";
import { fetchIdrRecords } from "@/lib/cgc/idr-client";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const idrProxySecret = process.env.CGC_IDR_PROXY_SECRET;
  if (!idrProxySecret || req.headers.get("x-idr-secret") !== idrProxySecret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const token = resolveSasiToken(null);
  if (!token) {
    return NextResponse.json({ error: "SASI_API_TOKEN não configurado." }, { status: 500 });
  }

  try {
    const records = await fetchIdrRecords(token);
    return NextResponse.json({ records });
  } catch (error) {
    if (error instanceof SasiApiError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Erro ao consultar a API SASI." }, { status: 502 });
  }
}
```

- [ ] **Step 3: Document the env var**

Add to `.env.example` (near the other `/controle` secret):

```
# GET /api/controle/cgc/idr (header x-idr-secret). Secret dedicado, separado
# de CONTROLE_PROXY_SECRET, usado pelo cgc-idr pra ler os dados do canal 36602.
CGC_IDR_PROXY_SECRET=
```

- [ ] **Step 4: Set the secret locally and start the dev server**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Append the generated value to `.env.local` as `CGC_IDR_PROXY_SECRET=<value>`, then:

```bash
npm run dev
```

- [ ] **Step 5: Verify unauthorized request is rejected**

Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/controle/cgc/idr`
Expected: `401`

- [ ] **Step 6: Verify authorized request succeeds**

```bash
curl -s http://localhost:3000/api/controle/cgc/idr -H "x-idr-secret: <value from step 4>"
```

Expected: `{"records":[]}` (channel 36602 has zero messages today — an empty array is the correct response, not an error).

- [ ] **Step 7: Commit**

```bash
git add src/lib/cgc/idr-client.ts src/app/api/controle/cgc/idr/route.ts .env.example
git commit -m "feat: expõe GET /api/controle/cgc/idr pro cgc-idr consumir"
```

- [ ] **Step 8: Push and open the PR**

```bash
git push -u origin FIX/add-idr-channel-endpoint
gh pr create --base develop --title "Expõe dados do canal 36602 (IDR) via /api/controle/cgc/idr" --body "## Summary
- Novo endpoint somente-leitura \`GET /api/controle/cgc/idr\`, protegido por \`CGC_IDR_PROXY_SECRET\`, que expõe as mensagens do canal 36602 mapeadas pro formato consumido pelo novo produto cgc-idr.
- Canal 36602 ainda não tem mensagens reais; mapeamento coberto por testes unitários com fixtures.

## Test plan
- [x] \`npx vitest run\`
- [x] 401 sem header \`x-idr-secret\`
- [x] 200 com header correto (retorna \`{\"records\":[]}\`, canal vazio hoje)"
```

Leave the PR open for review/merge (do not merge automatically). Note in chat that `CGC_IDR_PROXY_SECRET` still needs to be set on the Vercel project once this deploys — covered in Task 8.

---

## Part B — cgc-idr (new repo: `C:\Users\SASI\cgc-idr`)

Repo already exists locally (git initialized, spec committed). All paths below are relative to `C:\Users\SASI\cgc-idr`.

### Task 3: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, `postcss.config.js`, `tailwind.config.ts`, `eslint.config.mjs`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (placeholder)

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "cgc-idr",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "seed:dev": "node scripts/seed-dev.mjs"
  },
  "dependencies": {
    "@libsql/client": "^0.14.0",
    "next": "^16.2.9",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^3.10.1"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "autoprefixer": "^10",
    "eslint": "^9.39.4",
    "eslint-config-next": "^16.2.9",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "typescript": "^5",
    "vitest": "^4.1.11"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.js`**

```js
const nextConfig = {
  output: "standalone",
};

module.exports = nextConfig;
```

- [ ] **Step 4: Write `postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Write `tailwind.config.ts`**

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        idr: {
          bg: "#0B0E17",
          card: "#141A29",
          border: "#232B41",
          text: "#E8EAF0",
          "text-muted": "#7A82A0",
          estadual: "#22C55E",
          municipal: "#EF4444",
          particular: "#F5A623",
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

- [ ] **Step 6: Write `eslint.config.mjs`**

```js
import { globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  globalIgnores(["**/.next/**", "**/node_modules/**"]),
];

export default eslintConfig;
```

- [ ] **Step 7: Write `.gitignore`**

```
.next/
node_modules/
.env.local
.env
*.db
.DS_Store
dist/
.vercel/
*.tsbuildinfo
*.log
```

- [ ] **Step 8: Write `.env.example`**

```
# Turso (banco próprio do cgc-idr, cache/histórico dos snapshots de IDR).
# Sem valor, cai em file:./idr-local.db (SQLite embutido) — suficiente pra
# rodar localmente sem conta no Turso.
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=

# Endpoint de leitura do cgc-atividades (canal 36602) e o secret que ele exige.
CGC_ATIVIDADES_IDR_URL=https://cgc-atividades.vercel.app/api/controle/cgc/idr
CGC_IDR_PROXY_SECRET=
```

- [ ] **Step 9: Write the root layout**

Create `src/app/globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0B0E17;
  color: #E8EAF0;
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

Create `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDR — Índice de Desempenho Reativo",
  description: "Painel do Índice de Desempenho Reativo (IDR) do CGC",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx` (placeholder, replaced in Task 7):

```tsx
export default function DashboardPage() {
  return <main className="p-8 text-idr-text-muted">Carregando…</main>;
}
```

- [ ] **Step 10: Install and build**

```bash
cd /c/Users/SASI/cgc-idr
npm install
npm run build
```

Expected: build succeeds (placeholder page compiles).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold do projeto Next.js (cgc-idr)"
```

---

### Task 4: Turso schema + IDR calculation (pure)

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/idr/calc.ts`
- Test: `src/lib/idr/calc.test.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `getDb()`, `initDb(): Promise<void>` from `src/lib/db.ts` — Task 5's `repository.ts` imports both.
- Produces: `calculateIdr(ocorrencias: number, estudantes: number): number | null`, `calculateVariacao(atual: number | null, anterior: number | null): number | null`, `resultadoFromVariacao(variacao: number | null): "Favoravel" | "Desfavoravel" | null` from `src/lib/idr/calc.ts` — Task 5's `aggregate.ts` imports all three.

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: Write `src/lib/db.ts`**

```ts
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
```

- [ ] **Step 3: Write the failing test for calc.ts**

Create `src/lib/idr/calc.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { calculateIdr, calculateVariacao, resultadoFromVariacao } from "./calc";

describe("calculateIdr", () => {
  it("applies the IDR formula", () => {
    expect(calculateIdr(1073, 42260)).toBeCloseTo(253.9, 1);
  });

  it("returns null when estudantes is 0", () => {
    expect(calculateIdr(10, 0)).toBeNull();
  });
});

describe("calculateVariacao", () => {
  it("computes percentage change between two IDR values", () => {
    expect(calculateVariacao(22.5, 25)).toBeCloseTo(-10, 5);
  });

  it("returns null when there is no anterior value", () => {
    expect(calculateVariacao(25, null)).toBeNull();
  });

  it("returns null when atual is null", () => {
    expect(calculateVariacao(null, 25)).toBeNull();
  });

  it("returns null when anterior is 0 (division by zero)", () => {
    expect(calculateVariacao(10, 0)).toBeNull();
  });
});

describe("resultadoFromVariacao", () => {
  it("is Favoravel when variacao is negative", () => {
    expect(resultadoFromVariacao(-9.12)).toBe("Favoravel");
  });

  it("is Desfavoravel when variacao is positive", () => {
    expect(resultadoFromVariacao(5)).toBe("Desfavoravel");
  });

  it("is Desfavoravel when variacao is exactly 0", () => {
    expect(resultadoFromVariacao(0)).toBe("Desfavoravel");
  });

  it("is null when variacao is null", () => {
    expect(resultadoFromVariacao(null)).toBeNull();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run src/lib/idr/calc.test.ts`
Expected: FAIL — `Cannot find module './calc'`.

- [ ] **Step 5: Write `src/lib/idr/calc.ts`**

```ts
/**
 * IDR = (ocorrências ÷ estudantes) × 10.000. Puro — sem rede, sem banco —
 * pra poder testar a fórmula e as regras de variação/resultado isoladas do
 * resto do sistema.
 */

export function calculateIdr(ocorrencias: number, estudantes: number): number | null {
  if (!estudantes) return null;
  return (ocorrencias / estudantes) * 10000;
}

export function calculateVariacao(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export type Resultado = "Favoravel" | "Desfavoravel";

/** IDR menor é melhor (menos ocorrência por estudante) — variação negativa é favorável. */
export function resultadoFromVariacao(variacao: number | null): Resultado | null {
  if (variacao === null) return null;
  return variacao < 0 ? "Favoravel" : "Desfavoravel";
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `npx vitest run src/lib/idr/calc.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 7: Commit**

```bash
git add src/lib/db.ts src/lib/idr/calc.ts src/lib/idr/calc.test.ts vitest.config.ts
git commit -m "feat: schema Turso e cálculo puro do IDR"
```

---

### Task 5: Types, repository, remote sync, aggregation

**Files:**
- Create: `src/lib/idr/types.ts`
- Create: `src/lib/idr/repository.ts`
- Create: `src/lib/idr/sync.ts`
- Create: `src/lib/idr/aggregate.ts`
- Test: `src/lib/idr/aggregate.test.ts`

**Interfaces:**
- Consumes: `getDb`, `initDb` from `src/lib/db.ts` (Task 4). `calculateIdr`, `calculateVariacao`, `resultadoFromVariacao` from `src/lib/idr/calc.ts` (Task 4).
- Produces: `Rede`, `REDES`, `Categoria`, `CATEGORIAS`, `IdrSnapshotRow`, `RedeIndicador`, `DashboardPayload`, `RemoteIdrRecord` from `types.ts`. Task 6 and Task 7 both import these.
- Produces: `upsertSnapshotsFromRemote(records: RemoteIdrRecord[]): Promise<void>`, `listSnapshots(): Promise<IdrSnapshotRow[]>` from `repository.ts`. Task 6 calls both.
- Produces: `fetchRemoteIdrRecords(): Promise<RemoteIdrRecord[]>` from `sync.ts`. Task 6 calls it.
- Produces: `buildDashboardPayload(rows: IdrSnapshotRow[]): Omit<DashboardPayload, "syncOk" | "syncError">` from `aggregate.ts`. Task 6 calls it.

- [ ] **Step 1: Write `types.ts`**

```ts
export type Rede = "estadual" | "municipal" | "particular";

export const REDES: Rede[] = ["estadual", "municipal", "particular"];

export type Categoria =
  | "praticaDesportiva"
  | "emergenciasClinicas"
  | "quedas"
  | "acidentesDiversos";

export const CATEGORIAS: Categoria[] = [
  "praticaDesportiva",
  "emergenciasClinicas",
  "quedas",
  "acidentesDiversos",
];

/** Uma linha da tabela idr_snapshots (já com número, não texto). */
export interface IdrSnapshotRow {
  ano: number;
  rede: Rede;
  ocorrenciasTotal: number;
  estudantes: number;
  ocorrenciasPraticaDesportiva: number;
  ocorrenciasEmergenciasClinicas: number;
  ocorrenciasQuedas: number;
  ocorrenciasAcidentesDiversos: number;
}

/** Formato retornado por GET /api/controle/cgc/idr no cgc-atividades. */
export interface RemoteIdrRecord {
  messageId: number;
  ano: number;
  redes: Record<
    Rede,
    {
      ocorrencias: number;
      estudantes: number;
      praticaDesportiva: number;
      emergenciasClinicas: number;
      quedas: number;
      acidentesDiversos: number;
    }
  >;
}

export interface RedeIndicador {
  ocorrencias: number;
  estudantes: number;
  idr: number | null;
  variacao: number | null;
  resultado: "Favoravel" | "Desfavoravel" | null;
}

export interface DashboardPayload {
  syncOk: boolean;
  syncError: string | null;
  anos: number[];
  geral: Record<number, Record<Rede, RedeIndicador>>;
  porTipo: Record<Categoria, Record<number, Record<Rede, RedeIndicador>>>;
}
```

- [ ] **Step 2: Write `repository.ts`**

```ts
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
```

- [ ] **Step 3: Write `sync.ts`**

```ts
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
```

- [ ] **Step 4: Write the failing test for aggregate.ts**

Create `src/lib/idr/aggregate.test.ts`:

```ts
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
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run src/lib/idr/aggregate.test.ts`
Expected: FAIL — `Cannot find module './aggregate'`.

- [ ] **Step 6: Write `aggregate.ts`**

```ts
/**
 * Combina as linhas do Turso com calc.ts pra montar o payload que a rota
 * /api/idr/dashboard devolve pro front. Puro — recebe as linhas já lidas,
 * não fala com o banco.
 *
 * Variação/resultado comparam cada ano com o ano imediatamente anterior na
 * lista de anos presentes, por rede — não com "ano - 1" literal, caso algum
 * ano fique sem nenhum snapshot.
 */

import { calculateIdr, calculateVariacao, resultadoFromVariacao } from "./calc";
import { CATEGORIAS, REDES, type Categoria, type DashboardPayload, type IdrSnapshotRow, type Rede, type RedeIndicador } from "./types";

function buildIndicador(ocorrencias: number, estudantes: number, idrAnterior: number | null): RedeIndicador {
  const idr = calculateIdr(ocorrencias, estudantes);
  const variacao = calculateVariacao(idr, idrAnterior);
  return {
    ocorrencias,
    estudantes,
    idr,
    variacao,
    resultado: resultadoFromVariacao(variacao),
  };
}

function categoriaOcorrencias(row: IdrSnapshotRow, categoria: Categoria): number {
  switch (categoria) {
    case "praticaDesportiva":
      return row.ocorrenciasPraticaDesportiva;
    case "emergenciasClinicas":
      return row.ocorrenciasEmergenciasClinicas;
    case "quedas":
      return row.ocorrenciasQuedas;
    case "acidentesDiversos":
      return row.ocorrenciasAcidentesDiversos;
  }
}

export function buildDashboardPayload(
  rows: IdrSnapshotRow[]
): Omit<DashboardPayload, "syncOk" | "syncError"> {
  const anos = [...new Set(rows.map((row) => row.ano))].sort((a, b) => a - b);

  const byAnoRede = new Map<string, IdrSnapshotRow>();
  for (const row of rows) {
    byAnoRede.set(`${row.ano}:${row.rede}`, row);
  }

  const geral: DashboardPayload["geral"] = {};
  const porTipo: DashboardPayload["porTipo"] = {
    praticaDesportiva: {},
    emergenciasClinicas: {},
    quedas: {},
    acidentesDiversos: {},
  };

  const idrGeralAnterior: Partial<Record<Rede, number | null>> = {};
  const idrTipoAnterior: Record<Categoria, Partial<Record<Rede, number | null>>> = {
    praticaDesportiva: {},
    emergenciasClinicas: {},
    quedas: {},
    acidentesDiversos: {},
  };

  for (const ano of anos) {
    geral[ano] = {} as Record<Rede, RedeIndicador>;
    for (const categoria of CATEGORIAS) {
      porTipo[categoria][ano] = {} as Record<Rede, RedeIndicador>;
    }

    for (const rede of REDES) {
      const row = byAnoRede.get(`${ano}:${rede}`);

      const geralIndicador = buildIndicador(
        row?.ocorrenciasTotal ?? 0,
        row?.estudantes ?? 0,
        idrGeralAnterior[rede] ?? null
      );
      geral[ano][rede] = geralIndicador;
      idrGeralAnterior[rede] = geralIndicador.idr;

      for (const categoria of CATEGORIAS) {
        const ocorrencias = row ? categoriaOcorrencias(row, categoria) : 0;
        const indicador = buildIndicador(
          ocorrencias,
          row?.estudantes ?? 0,
          idrTipoAnterior[categoria][rede] ?? null
        );
        porTipo[categoria][ano][rede] = indicador;
        idrTipoAnterior[categoria][rede] = indicador.idr;
      }
    }
  }

  return { anos, geral, porTipo };
}
```

- [ ] **Step 7: Run it to verify it passes**

Run: `npx vitest run src/lib/idr/aggregate.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all tests from Task 4 and Task 5).

- [ ] **Step 9: Commit**

```bash
git add src/lib/idr/types.ts src/lib/idr/repository.ts src/lib/idr/sync.ts src/lib/idr/aggregate.ts src/lib/idr/aggregate.test.ts
git commit -m "feat: sync remoto, repositório Turso e agregação do IDR"
```

---

### Task 6: Dashboard API route

**Files:**
- Create: `src/app/api/idr/dashboard/route.ts`

**Interfaces:**
- Consumes: `fetchRemoteIdrRecords` (`sync.ts`), `upsertSnapshotsFromRemote` + `listSnapshots` (`repository.ts`), `buildDashboardPayload` (`aggregate.ts`) — all from Task 5.
- Produces: `GET /api/idr/dashboard` → JSON body matching `DashboardPayload` (Task 5's `types.ts`). Task 7's frontend fetches this route directly.

- [ ] **Step 1: Write the route**

```ts
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

export const maxDuration = 30;

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
```

- [ ] **Step 2: Verify against a clean local DB (no env vars set)**

```bash
rm -f idr-local.db
npm run dev
```

In another terminal:

```bash
curl -s http://localhost:3000/api/idr/dashboard
```

Expected: `{"syncOk":false,"syncError":"CGC_ATIVIDADES_IDR_URL ou CGC_IDR_PROXY_SECRET não configurados.","anos":[],"geral":{},"porTipo":{"praticaDesportiva":{},"emergenciasClinicas":{},"quedas":{},"acidentesDiversos":{}}}` — 200 status, no crash, graceful empty state.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/idr/dashboard/route.ts
git commit -m "feat: rota /api/idr/dashboard (sync sob demanda + cálculo)"
```

---

### Task 7: Dashboard UI

**Files:**
- Create: `src/components/idr/Controls.tsx`
- Create: `src/components/idr/SummaryCards.tsx`
- Create: `src/components/idr/IdrLineChart.tsx`
- Modify: `src/app/page.tsx`
- Create: `scripts/seed-dev.mjs` (dev-only fixture data, since channel 36602 has no real messages yet)

**Interfaces:**
- Consumes: `DashboardPayload`, `Rede`, `Categoria`, `RedeIndicador` from `src/lib/idr/types.ts` (Task 5).

- [ ] **Step 1: Write `Controls.tsx`**

```tsx
"use client";

import type { Rede } from "@/lib/idr/types";

const REDE_OPTIONS: { value: Rede; label: string }[] = [
  { value: "estadual", label: "REE" },
  { value: "municipal", label: "REME" },
  { value: "particular", label: "RPE" },
];

interface ControlsProps {
  anos: number[];
  ano: number;
  onAnoChange: (ano: number) => void;
  rede: Rede;
  onRedeChange: (rede: Rede) => void;
  tab: "geral" | "tipo";
  onTabChange: (tab: "geral" | "tipo") => void;
}

export function Controls({ anos, ano, onAnoChange, rede, onRedeChange, tab, onTabChange }: ControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <select
        value={ano}
        onChange={(event) => onAnoChange(Number(event.target.value))}
        className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
      >
        {anos.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <select
        value={rede}
        onChange={(event) => onRedeChange(event.target.value as Rede)}
        className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
      >
        {REDE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => onTabChange(tab === "geral" ? "tipo" : "geral")}
        className="rounded-full border border-idr-border bg-idr-card px-4 py-2 text-sm"
      >
        {tab === "geral" ? "IDR por tipo de ocorrência" : "IDR geral"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write `SummaryCards.tsx`**

```tsx
import type { Rede, RedeIndicador } from "@/lib/idr/types";

const REDE_LABELS: Record<Rede, string> = {
  estadual: "Rede Estadual de Ensino (REE)",
  municipal: "Rede Municipal de Ensino (REME)",
  particular: "Rede Particular de Ensino (RPE)",
};

const REDE_SIGLA: Record<Rede, string> = {
  estadual: "REE",
  municipal: "REME",
  particular: "RPE",
};

function formatNumber(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatNumber(value)}%`;
}

export function SummaryCards({ rede, ano, indicador }: { rede: Rede; ano: number; indicador: RedeIndicador }) {
  const favoravel = indicador.resultado === "Favoravel";
  const corResultado = favoravel ? "text-idr-estadual" : "text-idr-municipal";

  return (
    <div className="rounded-xl border border-idr-border bg-idr-card p-5">
      <p className="text-sm text-idr-text-muted mb-4">
        {REDE_LABELS[rede]} - {ano}
      </p>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-idr-border p-4">
          <p className="text-xs text-idr-text-muted mb-1">IDR Geral / {REDE_SIGLA[rede]}</p>
          <p className="text-2xl font-semibold">{formatNumber(indicador.idr)}</p>
        </div>
        <div className="rounded-lg border border-idr-border p-4">
          <p className="text-xs text-idr-text-muted mb-1">Variação</p>
          <p className={`text-2xl font-semibold ${corResultado}`}>{formatPercent(indicador.variacao)}</p>
        </div>
      </div>
      <div className="rounded-lg border border-idr-border p-4">
        <p className="text-xs text-idr-text-muted mb-1">Resultado / {REDE_SIGLA[rede]}</p>
        <p className={`text-xl font-semibold ${corResultado}`}>
          {indicador.resultado === null ? "—" : favoravel ? "Favorável" : "Desfavorável"}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `IdrLineChart.tsx`**

```tsx
"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Rede } from "@/lib/idr/types";

interface ChartPoint {
  ano: number;
  estadual: number | null;
  municipal: number | null;
  particular: number | null;
}

const SERIES: { key: Rede; label: string; color: string }[] = [
  { key: "estadual", label: "REE", color: "#22C55E" },
  { key: "municipal", label: "REME", color: "#EF4444" },
  { key: "particular", label: "RPE", color: "#F5A623" },
];

export function IdrLineChart({ data }: { data: ChartPoint[] }) {
  return (
    <div className="rounded-xl border border-idr-border bg-idr-card p-5 h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#232B41" />
          <XAxis dataKey="ano" stroke="#7A82A0" />
          <YAxis stroke="#7A82A0" domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#141A29", border: "1px solid #232B41", color: "#E8EAF0" }}
            formatter={(value: number) => value.toFixed(2)}
          />
          <Legend />
          {SERIES.map((series) => (
            <Line
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Write `src/app/page.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Controls } from "@/components/idr/Controls";
import { SummaryCards } from "@/components/idr/SummaryCards";
import { IdrLineChart } from "@/components/idr/IdrLineChart";
import type { Categoria, DashboardPayload, Rede } from "@/lib/idr/types";

const CATEGORIA_LABELS: Record<Categoria, string> = {
  praticaDesportiva: "Prática desportiva",
  emergenciasClinicas: "Emergências clínicas",
  quedas: "Quedas de pessoas",
  acidentesDiversos: "Acidentes diversos",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ano, setAno] = useState<number | null>(null);
  const [rede, setRede] = useState<Rede>("estadual");
  const [tab, setTab] = useState<"geral" | "tipo">("geral");

  useEffect(() => {
    fetch("/api/idr/dashboard")
      .then((response) => response.json())
      .then((payload: DashboardPayload) => {
        setData(payload);
        if (payload.anos.length > 0) {
          setAno(payload.anos[payload.anos.length - 1]);
        }
      })
      .catch(() => setLoadError("Não foi possível carregar os dados do IDR."));
  }, []);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.anos.map((year) => ({
      ano: year,
      estadual: data.geral[year]?.estadual?.idr ?? null,
      municipal: data.geral[year]?.municipal?.idr ?? null,
      particular: data.geral[year]?.particular?.idr ?? null,
    }));
  }, [data]);

  if (loadError) {
    return <main className="p-8 text-idr-text">{loadError}</main>;
  }

  if (!data) {
    return <main className="p-8 text-idr-text-muted">Carregando…</main>;
  }

  if (data.anos.length === 0 || ano === null) {
    return (
      <main className="p-8 max-w-4xl mx-auto">
        <h1 className="text-sm text-idr-text-muted uppercase tracking-wide mb-4">
          Índice de Desempenho Reativo (IDR)
        </h1>
        <p className="text-idr-text-muted">
          Nenhum dado sincronizado ainda do canal 36602.
          {data.syncError ? ` (${data.syncError})` : ""}
        </p>
      </main>
    );
  }

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-sm text-idr-text-muted uppercase tracking-wide mb-4">
        Índice de Desempenho Reativo (IDR)
      </h1>

      <Controls
        anos={data.anos}
        ano={ano}
        onAnoChange={setAno}
        rede={rede}
        onRedeChange={setRede}
        tab={tab}
        onTabChange={setTab}
      />

      <div className="space-y-5">
        {tab === "geral" ? (
          <SummaryCards rede={rede} ano={ano} indicador={data.geral[ano][rede]} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(Object.keys(CATEGORIA_LABELS) as Categoria[]).map((categoria) => (
              <div key={categoria}>
                <p className="text-xs text-idr-text-muted mb-2">{CATEGORIA_LABELS[categoria]}</p>
                <SummaryCards rede={rede} ano={ano} indicador={data.porTipo[categoria][ano][rede]} />
              </div>
            ))}
          </div>
        )}

        <IdrLineChart data={chartData} />
      </div>

      {!data.syncOk && (
        <p className="mt-4 text-xs text-idr-municipal">
          Dados podem estar desatualizados: {data.syncError}
        </p>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Write the dev seed script**

Channel 36602 has zero real messages today, so visual QA against the reference screenshot needs fixture data. `scripts/seed-dev.mjs` writes directly to the local Turso file — dev-only, never run against the real Turso database in production.

```js
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
```

- [ ] **Step 6: Seed and visually verify in the browser**

```bash
rm -f idr-local.db
npm run seed:dev
npm run dev
```

Open `http://localhost:3000` in a browser. Verify against the reference screenshot:
- Card shows "Rede Estadual de Ensino (REE) - 2025", IDR Geral/REE ≈ `253,90` (note: the reference screenshot's own numbers, e.g. `25,39`, imply the source `estudantes` figures are roughly 10× the fixture values here — the fixture is illustrative, not a real calibration target).
- Variação and Resultado render with red/green matching sign.
- Switching the ano selector to 2024 shows Variação/Resultado as `—` (no ano anterior).
- Switching rede to REME/RPE updates the card.
- Toggling to "IDR por tipo de ocorrência" shows the 4 category cards.
- Line chart renders 3 colored series across 2024/2025.

Fix any rendering issues found (e.g. spacing, color contrast against `dataviz` skill guidance) before proceeding.

- [ ] **Step 7: Verify the Turso-cache fallback (spec requirement)**

With the seeded data still in `idr-local.db` from Step 6, temporarily comment out `CGC_ATIVIDADES_IDR_URL` in `.env.local` and restart `npm run dev`. Reload the dashboard.

Expected: the page still renders the seeded 2024/2025 cards and chart (read from `idr_snapshots`, not from the failed remote fetch), plus the red "Dados podem estar desatualizados: CGC_ATIVIDADES_IDR_URL ou CGC_IDR_PROXY_SECRET não configurados." banner at the bottom — confirms the cache-fallback behavior from `route.ts` (Task 6) actually keeps the dashboard usable when `cgc-atividades` is unreachable. Restore `CGC_ATIVIDADES_IDR_URL` in `.env.local` afterward.

- [ ] **Step 8: Clean up the local seeded DB before committing**

```bash
rm -f idr-local.db
```

(Already covered by `.gitignore`'s `*.db`, but confirm it's not staged.)

- [ ] **Step 9: Commit**

```bash
git add src/components/idr/Controls.tsx src/components/idr/SummaryCards.tsx src/components/idr/IdrLineChart.tsx src/app/page.tsx scripts/seed-dev.mjs
git commit -m "feat: dashboard do IDR (cards, gráfico, seletor de ano/rede)"
```

---

### Task 8: Deploy (requires interactive login — run with the user present)

This task needs `gh`, `vercel`, and `turso` CLI sessions logged in as the user's own accounts. Do not attempt to run these non-interactively; walk through them with the user watching, confirming each side-effecting step (repo creation, secret values, production deploy) before it runs, per the "risky actions" guidance — creating a public GitHub repo, writing secrets to Vercel, and deploying to production are all visible/hard-to-reverse actions.

- [ ] **Step 1: Create the GitHub repo and push**

```bash
cd /c/Users/SASI/cgc-idr
gh repo create cgc-idr --private --source=. --remote=origin
git push -u origin main
```

- [ ] **Step 2: Create the Turso database**

```bash
turso db create cgc-idr
turso db show cgc-idr --url
turso db tokens create cgc-idr
```

Save the URL and token — needed in Step 4.

- [ ] **Step 3: Link the Vercel project**

```bash
vercel link
```

Follow the prompts to create/link the `cgc-idr` project under the correct Vercel team.

- [ ] **Step 4: Set environment variables on Vercel**

```bash
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add CGC_ATIVIDADES_IDR_URL production
vercel env add CGC_IDR_PROXY_SECRET production
```

Use the same `CGC_IDR_PROXY_SECRET` value generated in Part A, Task 2, Step 4 — it must match on both sides.

- [ ] **Step 5: Set `CGC_IDR_PROXY_SECRET` on the cgc-atividades Vercel project**

```bash
cd /c/Users/SASI/cgc-atividades
vercel env add CGC_IDR_PROXY_SECRET production
```

Same value as Step 4. Without this, the deployed `cgc-atividades` route 401s every request from `cgc-idr`.

- [ ] **Step 6: Deploy cgc-idr to production**

```bash
cd /c/Users/SASI/cgc-idr
vercel --prod
```

- [ ] **Step 7: Verify the deployed dashboard**

Open the production URL. With channel 36602 still empty, expect the "Nenhum dado sincronizado ainda" empty state — that's correct, not a bug. Confirm `syncOk: true` in the JSON response (`/api/idr/dashboard`), meaning the connection to `cgc-atividades` itself is working end-to-end; only the underlying channel data is pending.

- [ ] **Step 8: Merge the cgc-atividades PR**

Once `cgc-atividades` has redeployed with `CGC_IDR_PROXY_SECRET` set (Step 5 triggers a redeploy on Vercel), merge the PR opened in Part A, Task 2, Step 8 (`develop` ← `FIX/add-idr-channel-endpoint`), then promote `develop` to `main` following that repo's existing workflow (separate, deliberate step per its `CLAUDE.md`).
