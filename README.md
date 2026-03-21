# InventoryOS

Sistema de gestão de inventário com painel admin, rastreamento de erros e notificações push.

## Stack

- **Frontend:** Next.js (App Router, PWA)
- **Backend:** Firebase (Firestore, Storage, Cloud Functions, Hosting)
- **Push Notifications:** Firebase Cloud Messaging (FCM)
- **CI/CD:** GitHub Actions

## Ambientes

| Ambiente | Firebase Project | URL |
|----------|-----------------|-----|
| Staging  | `inventoryos-effd5` | https://inventoryos-effd5.web.app |
| Production | `inventory-os-app` | https://inventory-os-app.web.app |

A separação entre ambientes é feita via [app/.firebaserc](app/.firebaserc) e GitHub Environments (`staging` / `production`), cada um com suas próprias variáveis e secrets.

## Desenvolvimento local

```bash
nvm use
cd app
pnpm install
pnpm dev
```

Acesse [http://localhost:3000](http://localhost:3000).

Para manter paridade com o CI/CD e com as Cloud Functions, use Node 20.

Antes de enviar código, rode:

```bash
cd app
pnpm validate:changed
pnpm validate:local
```

## CI/CD

Veja [docs/release-pipeline.md](docs/release-pipeline.md) para o fluxo completo de deploy.

Resumo:
1. PR para `main` → CI roda (test, lint, build)
2. Merge em `main` → Deploy Staging automático
3. Deploy Production → manual via GitHub Actions com aprovação de ambiente
