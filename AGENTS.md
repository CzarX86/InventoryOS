# AGENTS.md

# Agent Operating Instructions

Before performing any task or answering the user, follow these steps.

### 1. Load project context
Always read the **authoritative core** files first:
- [agent_context.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/agent_context.md) → Project status, goals, and constraints.
- [architecture.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/architecture.md) → System structure, data flow, and schemas.
- [decisions.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/decisions.md) → Architectural Decision Records (ADR) and FinOps.

#### Full Documentation Index
For specific tasks, refer to these specialized documents:
- **Product Evolution**: [expansion-track-plan.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/expansion-track-plan.md) | [expansion-track-backlog.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/expansion-track-backlog.md)
- **Integrations**: [whatsapp-integration.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/whatsapp-integration.md)
- **Infrastructure & Ops**: [release-pipeline.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/release-pipeline.md) | [branch-protection.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/branch-protection.md)

Do not rely on chat history as the primary source of information.

---

### 2. Interpret the context
Use the files to understand:
- Project goals
- Architectural constraints
- Prior technical decisions
- Current implementation state

If instructions from the user conflict with these files, ask for clarification before proceeding.

---

### 3. Updating context
If new durable knowledge is produced during the work, update the appropriate file:
- `agent_context.md` → Project status or goals
- `architecture.md` → System structure changes
- `decisions.md` → New architectural or technical decisions

Do not overwrite existing information unless it is clearly obsolete.

---

### 4. Avoid chat-only knowledge
Any important information must be persisted in the documentation files. Agents must not rely on conversation history to store important decisions.

---

### 5. Output discipline
When generating code or changes:
- Follow the architecture described in `architecture.md`
- Respect constraints documented in `agent_context.md`
- Record new decisions in `decisions.md` when relevant
- Use the format that maximizes clarity for an LLM (Markdown for descriptions, JSON/YAML for structured data).

---

# Informações Técnicas e Regras Localizadas

Instruções para agentes de código (Claude Code, Codex, etc.) trabalhando neste repositório.

## Estrutura do repositório

```
/
├── app/                  # Aplicação Next.js (todo o código da app está aqui)
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── hooks/        # Custom hooks
│   │   ├── lib/          # Utilitários (AI, Firebase, audit, erros)
│   │   └── app/          # App Router (páginas)
│   ├── functions/        # Cloud Functions Firebase (Node.js)
│   ├── public/           # Assets estáticos e service worker
│   └── .firebaserc       # Mapeamento de projetos Firebase (staging/production)
├── docs/                 # Documentação técnica
│   ├── release-pipeline.md  # CI/CD, Firebase, IAM setup
│   └── branch-protection.md
└── .github/workflows/    # GitHub Actions
    ├── ci.yml            # Test + Lint (changed files only) + Build
    ├── deploy-staging.yml    # Deploy automático após CI passar em main
    └── deploy-production.yml # Deploy manual com aprovação
```

## Ambientes Firebase

| Ambiente   | Projeto Firebase    | URL                               |
|------------|---------------------|-----------------------------------|
| Staging    | `inventoryos-effd5` | https://inventoryos-effd5.web.app |
| Production | `inventory-os-app`  | https://inventory-os-app.web.app  |

O mapeamento está em `app/.firebaserc`. As credenciais de cada ambiente vivem nos GitHub Environments `staging` e `production` — nunca em arquivos commitados.

## Fluxo de deploy

```
push/PR → CI (test + lint + build) → Deploy Staging (automático) → Deploy Production (manual)
```

1. Todo código vai para `main` via PR.
2. O CI roda `jest`, ESLint **apenas nos arquivos alterados** (não há lint global — existe dívida técnica legada), e `pnpm build`.
3. Após CI verde em `main`, o `Deploy Staging` dispara automaticamente.
4. Deploy para production é manual via GitHub Actions com aprovação do environment `production`.

## Comandos

```bash
cd app
pnpm install          # instalar dependências
pnpm dev              # servidor de desenvolvimento
pnpm build            # build de produção
pnpm exec jest        # rodar todos os testes
pnpm exec eslint src/ # lint completo (pode ter erros legados)
```

Para Cloud Functions:
```bash
cd app/functions
npm install
```

## Documentação de evolução

Para qualquer trabalho relacionado à evolução do produto além do inventário atual, os agentes devem ler estes documentos antes de planejar ou implementar:

- `docs/expansion-track-plan.md` — arquitetura-alvo, princípios, fases, governança de IA, branching e rollout do `Expansion Track`.
- `docs/expansion-track-backlog.md` — backlog técnico faseado com épicos, stories, prioridades, branches sugeridas e critérios de aceite.

Como usar:

- Se a tarefa fizer parte do novo módulo de CRM, WhatsApp, IA operadora, supplier RFQ, insights, action inbox ou analytics, **considere o `Expansion Track` como a fonte principal de verdade**.
- Use `docs/expansion-track-plan.md` para entender a arquitetura, os guardrails e a estratégia de rollout.
- Use `docs/expansion-track-backlog.md` para escolher a próxima unidade de trabalho e manter a ordem de implementação coerente.
- Não redefina arquitetura, fases ou conventions do `Expansion Track` sem atualizar esses documentos.
- Se um PR do `Expansion Track` alterar escopo, ordem ou decisões relevantes, atualize a documentação correspondente no mesmo trabalho.

## Regras para agentes

- **Todo código da aplicação fica em `app/`**. O working directory padrão dos workflows é `app`.
- **Não faça lint global** — o CI roda ESLint apenas em arquivos alterados. Não tente corrigir todos os erros de lint do repositório.
- **Não commite `.env*`** — estão no `.gitignore`. Variáveis de ambiente sensíveis ficam nos GitHub Environments.
- **Não faça push direto para `main`** — o branch está protegido. Crie uma branch e abra PR.
- **Branches de agente** devem seguir o padrão `codex/<descricao>` — o CI já está configurado para rodar nesse padrão.
- **Para o novo módulo de evolução**, trabalhe a partir da branch longa `codex/expansion-foundation` e abra PRs contra ela antes de qualquer merge futuro para `main`.
- **Cloud Functions** ficam em `app/functions/index.js`. São deployadas junto com hosting/firestore/storage via `firebase deploy --force`.
- **Não altere workflows sem necessidade** — especialmente o `deploy-production.yml`.
- **Todo desenvolvimento do `Expansion Track` deve seguir TDD**.
- **Toda UI nova do `Expansion Track` deve usar `shadcn/ui` por padrão**.
- **Todo código novo do `Expansion Track` deve ser escrito em TypeScript (`.ts`/`.tsx`)**.

## Stack

- **Frontend:** Next.js 15 (App Router), React, PWA
- **Database/Auth:** Firebase (Firestore, Auth, Storage, Hosting)
- **Functions:** Firebase Cloud Functions v2 (Node.js 20), trigger em `onDocumentCreated`
- **Push Notifications:** Firebase Cloud Messaging (FCM) + VAPID
- **AI:** Google Generative AI SDK (Gemini) — chamado do lado do cliente via `NEXT_PUBLIC_GEMINI_API_KEY`
- **Package manager:** pnpm
- **Testes:** Jest

## Observações importantes

- O ESLint só roda em arquivos `.js/.jsx/.mjs/.cjs` dentro de `app/`. Arquivos `.ts/.tsx` não são cobertos no CI atualmente.
- `firebase deploy` usa `--force` para configurar automaticamente a cleanup policy do Artifact Registry (necessário em modo não-interativo).
- Cloud Functions Gen 2 requer permissões IAM específicas no GCP — veja `docs/release-pipeline.md` para a lista completa.
