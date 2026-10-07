# CGC IDR — Índice de Desempenho Reativo

Painel web que calcula e exibe o **Índice de Desempenho Reativo (IDR)** a partir das ocorrências registradas no ambiente escolar, comparando as redes de ensino Estadual, Municipal e Particular ao longo dos anos.

> **Projeto de demonstração.** Este repositório apresenta o produto e a sua arquitetura. Os dados de exemplo (`npm run seed:dev`) são fictícios.

<!-- Adicione aqui uma captura de tela do painel, por exemplo:
![Painel do IDR](docs/img/dashboard.png)
-->

---

## O que é o IDR

O IDR mede a incidência de ocorrências em relação ao número de estudantes. Ele ajuda a avaliar o resultado das ações de segurança desenvolvidas pela CGC no ambiente escolar.

```
IDR = (número de ocorrências ÷ número de estudantes) × 10.000
```

- **Quanto menor o IDR, melhor.** Menos ocorrências por estudante indicam um cenário mais seguro.
- **Variação** compara o IDR do ano selecionado com o do ano anterior disponível, na mesma rede.
- **Resultado** classifica a variação: negativa é **Favorável**, igual ou positiva é **Desfavorável**.

Os dados vêm de uma amostragem que considera:

- ocorrências atendidas pelo Corpo de Bombeiros Militar de Mato Grosso do Sul (CBMMS) nas quatro categorias de maior incidência na capital, conforme o CIOPS/SEJUSP-MS;
- número de estudantes da capital, obtido na plataforma GeoReDUS, que usa dados oficiais do INEP.

## Funcionalidades

- **Cards de resumo** com IDR, variação e resultado (verde para favorável, laranja/vermelho para desfavorável).
- **Gráfico de linhas** com a evolução do IDR das três redes (REE, REME e RPE) e a linha de meta anual.
- **Visão geral e por tipo de ocorrência**, com abas para as quatro categorias:
  - Prática desportiva
  - Emergências clínicas
  - Quedas de pessoas
  - Acidentes diversos
- **Seletor de ano** para consultar qualquer período sincronizado.
- **Página `/dados`** com os números brutos de cada rede e ano (total de ocorrências, estudantes e ocorrências por categoria).
- **Resiliência:** se a fonte de dados ficar fora do ar, o painel continua exibindo o último dado sincronizado e avisa que ele pode estar desatualizado.
- **Tema escuro**, layout responsivo e tela de carregamento animada.
- **Acesso aberto e somente leitura**, sem login e sem edição manual de dados.

## Como funciona

```
Canal SASI 36602
   │
   ▼
API SASI ──► cgc-atividades  (GET /api/controle/cgc/idr, protegido por secret)
                   │
                   ▼
            cgc-idr  (GET /api/idr/dashboard, server-side)
              1. busca os dados na fonte
              2. grava (upsert) no Turso, que serve de cache e histórico
              3. lê do Turso e calcula IDR, variação e resultado
              4. responde ao painel
                   │
                   ▼
            Painel Next.js
```

Não há agendamento automático. A sincronização acontece a cada carregamento do painel. Como o Turso guarda o histórico, o painel segue funcionando mesmo se a fonte estiver temporariamente indisponível.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) e React 19 |
| Linguagem | TypeScript (strict) |
| Estilo | Tailwind CSS |
| Gráficos | Recharts |
| Banco de dados | [Turso](https://turso.tech/) (libSQL), com SQLite local como alternativa |
| Testes | Vitest |
| Hospedagem | Vercel |

## Como rodar localmente

### Pré-requisitos

- Node.js 20.9 ou superior
- npm

### Passo a passo

```bash
# 1. Instale as dependências
npm install

# 2. Crie o arquivo de ambiente
cp .env.example .env.local

# 3. (Opcional) Popule um banco local com dados fictícios
npm run seed:dev

# 4. Inicie o servidor de desenvolvimento
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Sem `TURSO_DATABASE_URL`, o projeto usa um arquivo SQLite local (`file:./idr-local.db`). Você não precisa de conta no Turso para a demonstração.

### Variáveis de ambiente

| Variável | Descrição | Obrigatória |
|---|---|---|
| `TURSO_DATABASE_URL` | URL do banco Turso. Sem valor, usa `file:./idr-local.db`. | Não |
| `TURSO_AUTH_TOKEN` | Token de acesso ao banco Turso. | Só com Turso |
| `CGC_ATIVIDADES_IDR_URL` | Endpoint de leitura do `cgc-atividades` (canal 36602). | Para sincronizar |
| `CGC_IDR_PROXY_SECRET` | Secret compartilhado exigido pelo endpoint acima. | Para sincronizar |

Todas as variáveis são usadas apenas no servidor e nunca são expostas ao navegador.

> **Segurança:** nunca faça commit de tokens ou secrets. Mantenha os valores reais em `.env.local` ou nas variáveis de ambiente da Vercel.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Gera o build de produção |
| `npm start` | Executa o build de produção |
| `npm run lint` | Executa o ESLint |
| `npm test` | Executa os testes (Vitest) |
| `npm run seed:dev` | Popula o banco local com dados fictícios |

## Estrutura do projeto

```
src/
├─ app/
│  ├─ page.tsx                  # Painel principal
│  ├─ dados/page.tsx            # Dados brutos por rede e ano
│  └─ api/idr/dashboard/        # Sincronização e cálculo (server-side)
├─ components/
│  ├─ Loading.tsx               # Tela de carregamento
│  └─ idr/                      # Cards, gráfico, controles e diálogos
└─ lib/
   ├─ db.ts                     # Conexão e criação da tabela no Turso
   └─ idr/
      ├─ calc.ts                # Fórmula do IDR, variação e resultado
      ├─ aggregate.ts           # Agregação por rede, ano e categoria
      ├─ repository.ts          # Leitura e escrita no banco
      └─ sync.ts                # Busca de dados na fonte
scripts/
└─ seed-dev.mjs                 # Dados fictícios para desenvolvimento
docs/                           # Design e plano de implementação
```

## Qualidade

- Os cálculos de IDR e de agregação ficam em funções puras, com testes automatizados.
- Os casos de borda são tratados: ano único (sem variação) e número de estudantes igual a zero aparecem como indisponíveis, não como erro.

## Documentação

- [Design do produto](docs/superpowers/specs/2026-08-25-cgc-idr-design.md)
- [Plano de implementação](docs/superpowers/plans/2026-08-25-cgc-idr-implementation.md)
