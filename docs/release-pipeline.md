# Release Pipeline

## Ambientes Firebase

| Ambiente   | Projeto Firebase    | URL                                    |
|------------|---------------------|----------------------------------------|
| Staging    | `inventoryos-effd5` | https://inventoryos-effd5.web.app      |
| Production | `inventory-os-app`  | https://inventory-os-app.web.app       |

A configuração dos projetos está em [app/.firebaserc](../app/.firebaserc).

## Fluxo de Deploy

1. Abra ou atualize um PR para `main`.
2. Aguarde os checks `Test`, `Lint Changed Files` e `Build` passarem.
3. Após o merge, o `Deploy Staging` dispara automaticamente e publica no projeto Firebase de staging.
4. Teste manualmente a URL de staging exibida no resumo do workflow.
5. Quando validado, execute `Deploy Production` manualmente via GitHub Actions e aprove o environment `production` quando solicitado.

## Workflows

| Workflow | Trigger | Ambiente |
|---|---|---|
| `CI` | push/PR em `main` e `codex/**` | — |
| `Deploy Staging` | após CI com sucesso em `main` | `staging` |
| `Deploy Production` | manual (`workflow_dispatch`) | `production` |

O CI roda ESLint apenas nos arquivos alterados para não bloquear em dívida técnica de lint legado.

## GitHub Environments

Crie dois environments no repositório: `staging` e `production`.

### Variáveis (em cada environment)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | API key do projeto Firebase |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID do projeto |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID para FCM |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Chave VAPID para push notifications |

### Secrets (em cada environment)

| Secret | Descrição |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | JSON completo da service account com permissão para deploy de Hosting, Firestore, Storage e Functions |
| `NEXT_PUBLIC_GEMINI_API_KEY` | API key do Gemini |

## Configuração inicial do GCP (uma vez por projeto Firebase)

Ao configurar um novo projeto Firebase para deploy de Cloud Functions Gen 2, é necessário:

### 1. Habilitar APIs manualmente no GCP Console

As APIs abaixo não são habilitadas automaticamente pela service account de deploy:

- [Cloud Billing API](https://console.developers.google.com/apis/api/cloudbilling.googleapis.com/overview)
- [Eventarc API](https://console.cloud.google.com/apis/library/eventarc.googleapis.com)
- [Firebase Extensions API](https://console.cloud.google.com/apis/library/firebaseextensions.googleapis.com)

### 2. Conceder permissões IAM

Execute os comandos abaixo substituindo `PROJECT_ID` e `PROJECT_NUMBER` pelos valores do projeto:

```bash
# Permite que o Pub/Sub crie tokens de autenticação
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:service-PROJECT_NUMBER@gcp-sa-pubsub.iam.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator \
  --condition=None

# Permite que o Compute invocar serviços Cloud Run
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/run.invoker \
  --condition=None

# Permite que o Compute receber eventos do Eventarc
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --role=roles/eventarc.eventReceiver \
  --condition=None

# Permite que a service account de deploy aja como a Compute SA (necessário para Functions Gen 2)
gcloud iam service-accounts add-iam-policy-binding \
  PROJECT_NUMBER-compute@developer.gserviceaccount.com \
  --member=serviceAccount:firebase-adminsdk-fbsvc@PROJECT_ID.iam.gserviceaccount.com \
  --role=roles/iam.serviceAccountUser \
  --project=PROJECT_ID
```

Para o projeto staging (`inventoryos-effd5`, número `836596473888`) esses passos já foram executados.

### 3. Flag `--force` no deploy

O comando `firebase deploy` inclui `--force` para que o CLI configure automaticamente a cleanup policy do Artifact Registry sem solicitar confirmação interativa. Sem essa flag o deploy falha em ambiente não-interativo (CI) mesmo com as Functions deployadas com sucesso.

## Branch Protection

Configurações recomendadas para `main`:

- 1 review aprovado obrigatório
- Dismiss de reviews obsoletos ao fazer push
- Checks obrigatórios: `Test`, `Lint Changed Files`, `Build`
- Branch deve estar atualizada antes do merge
- Bloquear push direto para `main`

> Se o repositório for privado, branch protection com required checks exige plano pago no GitHub.
