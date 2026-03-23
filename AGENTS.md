# AGENTS.md

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
