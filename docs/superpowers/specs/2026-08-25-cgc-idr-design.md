# cgc-idr — Design

Data: 2026-08-25

## Objetivo

Novo produto **cgc-idr**, calculando e exibindo o Índice de Desempenho Reativo
(IDR) a partir das ocorrências reportadas no canal SASI **36602**, replicando o
dashboard de referência (cards de IDR Geral, Variação, Resultado, mais gráfico
de linha comparando as três redes por ano).

Fórmula: `IDR = (número de ocorrências ÷ número de estudantes) × 10.000`,
calculado por rede (REE/REME/RPE) e por ano.

## Contexto / dados de origem

O canal 36602 ainda não tem mensagens (`count: 0` na API SASI no momento
deste design), mas o formulário já está definido. Cada mensagem carrega,
em `data_fields`, os seguintes campos (nomes internos confirmados pelo
usuário):

- `ano` — ano de referência do registro.
- `quantidade_total_de_ocorrencia_rede_{estadual,municipal,particular}`
- `quantidades_de_estudantes_rede_{estadual,municipal,particular}`
- Por categoria de ocorrência, cada uma com sufixo `_rede_{estadual,municipal,particular}`:
  - `quantidade_pratica_desportiva_rede_*`
  - `quantidade_de_emergencias_clinicas_rede_*`
  - `quantidade_de_quedas_pessoas_rede_*`
  - `quantidades_de_acidentes_diversos_rede_*`

"Rede" mapeia para as siglas do dashboard: `estadual` = REE, `municipal` =
REME, `particular` = RPE.

## Arquitetura

```
Canal SASI 36602
  → API SASI (api.bone.sasi.io, GET /provider/messages?channel_ids=36602)
  → cgc-atividades: GET /api/controle/cgc/idr  (novo endpoint, leitura)
  → cgc-idr: rota de sync (server-side, sob demanda)
      → upsert em Turso (cgc-idr, banco próprio)
      → cálculo do IDR
  → cgc-idr: dashboard (Next.js, sem login)
```

Nenhum cron: a sincronização acontece a cada carregamento do dashboard
(fetch no endpoint do cgc-atividades → upsert no Turso → calcula → responde
ao front). O Turso funciona como cache/histórico, garantindo que o
dashboard continue de pé mesmo se o cgc-atividades ou a API SASI estiverem
temporariamente fora do ar (serve o último dado sincronizado).

## Mudança em cgc-atividades

Novo endpoint **`GET /api/controle/cgc/idr`**, seguindo o padrão já
existente de `/api/controle/cgc/*` (protegido por secret compartilhado
dedicado — env var nova `CGC_IDR_PROXY_SECRET`, sem `sasi-token` de usuário,
porque é uma chamada servidor-a-servidor do cgc-idr, igual ao motivo dos
outros `/controle` routes: não tem sessão de usuário pra encaminhar).

Responsabilidades da rota:
1. Autenticar via `CGC_IDR_PROXY_SECRET` (header, mesmo padrão dos outros
   `/controle` routes).
2. Buscar mensagens do canal 36602 via `sasiApiGet("/provider/messages", {
   channel_ids: "36602", ... })`, paginando com `SASI_API_TOKEN` (reaproveita
   `src/lib/sasi-api/client.ts` sem alteração).
3. Mapear `data_fields` de cada mensagem pros nomes internos listados acima
   (novo arquivo `src/lib/cgc/idr-field-map.ts`, no mesmo espírito de
   `field-map.ts`).
4. Responder JSON normalizado:

```json
[
  {
    "messageId": 123,
    "ano": 2025,
    "redes": {
      "estadual": {
        "ocorrencias": 120,
        "estudantes": 47262,
        "praticaDesportiva": 10,
        "emergenciasClinicas": 5,
        "quedas": 3,
        "acidentesDiversos": 2
      },
      "municipal": { "...": "..." },
      "particular": { "...": "..." }
    }
  }
]
```

Rota fica read-only e sem dado sensível (mesma regra dos outros `/controle`
routes) — não expõe `profileFields` nem token bruto.

## Novo projeto cgc-idr

**Stack**: Next.js 16 (App Router) + TypeScript strict + Tailwind, mesmo
padrão de `cgc-atividades`. Banco próprio no Turso (`@libsql/client`).
Deploy no Vercel.

**Schema Turso** — tabela `idr_snapshots`, uma linha por `(ano, rede)`:

| coluna | tipo |
|---|---|
| `ano` | integer |
| `rede` | text (`estadual`\|`municipal`\|`particular`) |
| `ocorrencias_total` | integer |
| `estudantes` | integer |
| `ocorrencias_pratica_desportiva` | integer |
| `ocorrencias_emergencias_clinicas` | integer |
| `ocorrencias_quedas` | integer |
| `ocorrencias_acidentes_diversos` | integer |
| `synced_at` | text (ISO timestamp) |

Chave única `(ano, rede)`; upsert a cada sync. Tabela criada via
`CREATE TABLE IF NOT EXISTS` num `initDb()`, no mesmo estilo de
`cgc-atividades/src/lib/db.ts` (sem ferramenta de migração).

**Rota de sync + leitura**: `GET /api/idr/dashboard` (server-side):
1. Chama `GET {CGC_ATIVIDADES_IDR_URL}` com `CGC_IDR_PROXY_SECRET`.
2. Faz upsert de cada `(ano, rede)` retornado em `idr_snapshots`.
3. Lê todas as linhas do Turso (fonte de verdade pro cálculo, não a resposta
   crua da API — garante que o dashboard sempre mostra o último estado
   persistido, mesmo se o fetch externo falhar parcialmente).
4. Calcula, por rede/ano:
   - `idr = (ocorrencias_total / estudantes) * 10000`
   - `variacao = (idr_ano_atual - idr_ano_anterior) / idr_ano_anterior * 100` (comparado ao ano anterior disponível na mesma rede)
   - `resultado = variacao < 0 ? "Favorável" : "Desfavorável"`
   - mesmas contas por categoria de ocorrência, pra aba "IDR por tipo de ocorrência"
5. Se o fetch ao cgc-atividades falhar, ainda responde com os dados já
   persistidos no Turso (cache serve como fallback) e sinaliza no payload
   que o sync falhou (pro front avisar "dados podem estar desatualizados").

**Frontend**: página única `/`, sem autenticação. Tema escuro batendo com o
print de referência:
- Seletor de ano.
- Abas "IDR" (geral) / "IDR por tipo de ocorrência".
- Cards: IDR Geral/REE, Variação, Resultado (cores: verde favorável,
  vermelho/laranja desfavorável).
- Gráfico de linha comparando REE (verde) / REME (vermelho) / RPE (amarelo)
  por ano — biblioteca Recharts. Seguir a skill `dataviz` na implementação
  pra paleta/acessibilidade/tema claro-escuro.

**Env vars**: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`,
`CGC_ATIVIDADES_IDR_URL`, `CGC_IDR_PROXY_SECRET`.

## Testes / verificação

- Sem mensagens reais ainda no canal 36602: implementação inicial testada
  com fixtures/mocks do payload da API SASI (formato confirmado acima).
  Antes de considerar concluído, validar contra uma mensagem real assim que
  o canal começar a receber envios.
- Testar cálculo do IDR/variação/resultado com casos de borda: só um ano
  disponível (sem "ano anterior" pra variação), `estudantes = 0` (divisão
  por zero — resultado deve ser tratado como indisponível, não erro/NaN na
  UI).
- Testar fallback: resposta do dashboard quando o endpoint do
  cgc-atividades está fora do ar mas já existe cache no Turso.

## Fora de escopo

- Login/autenticação no cgc-idr (decidido: dashboard aberto).
- Cron/agendamento automático (decidido: sync sob demanda, a cada
  carregamento).
- Edição manual de dados — o dashboard é somente leitura, refletindo o que
  vem do canal 36602.
