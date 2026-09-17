# Architecture Overview (System Technical Structure)

## System Components
### 1. Frontend: Next.js 15 (App Router)
- **Framework**: `Next.js 15` with `React`.
- **Styling**: `Tailwind CSS`, `shadcn/ui` for new components.
- **PWA**: PWA integration for mobile-first operational access. The app shell uses `100dvh`, `viewport-fit=cover`, and a safe-area-aware bottom navigation so Safari browser chrome does not cover mobile actions.
- **State Management**: React Context, Firebase Hooks.
- **AI Integration**: Client-side Gemini SDK for immediate interaction.

### 2. Backend / Infrastructure: Firebase (Google Cloud)
- **Auth**: Firebase Authentication (Email/Password, Google).
- **Database**: `Cloud Firestore` (NoSQL).
- **Functions**: `Firebase Cloud Functions v2` (Node.js 20), `onDocumentCreated` triggers.
- **Storage**: `Firebase Storage` (for image uploads and WhatsApp text exports).
- **Hosting**: Firebase Hosting (Staging/Production).
- **Push**: `Firebase Cloud Messaging (FCM)` for notifications.

### 3. WhatsApp Integration: Evolution API (VPS Hosted)
- **Engine**: Evolution API (via Baileys/WhatsApp connectivity).
- **Host**: VPS instance, logically isolated from other projects.
- **Webhook Store**: External webhook receiver sends data to Firestore via Firebase Cloud Functions.

## Folder Structure
```markdown
/
├── app/                  # Next.js Application
│   ├── src/
│   │   ├── components/   # UI components (AddItemModal, AdminDashboard)
│   │   │   └── ui/       # shadcn/ui components
│   │   ├── hooks/        # Custom React hooks (AI, Firebase integration)
│   │   ├── lib/          # Code utilities (AI clients, Firebase SDK)
│   │   └── app/          # Next.js App Router (pages/routes)
│   ├── functions/        # Firebase Cloud Functions (Node.js)
│   ├── public/           # Static assets, Service Workers
│   └── .firebaserc       # Multi-project config (Staging/Production)
├── docs/                 # Documentation (MD files)
└── .github/workflows/    # CI/CD (GitHub Actions)
```

## Data Flow
```mermaid
graph TD
    WA[WhatsApp User] -->|Message| EVO[Evolution API - VPS]
    EVO -->|Webhook Callback| CF_IN[Firebase Cloud Functions - Webhook]
    CF_IN -->|Inbox Store| DB_WEB[Firestore - whatsapp_webhook_events]
    DB_WEB -->|Trigger| CF_MSG[Firebase Cloud Functions - Ingestion]
    CF_MSG -->|Store & Cache| DB_MSG[Firestore - whatsapp_messages]
    DB_MSG -->|Trigger| CF_AI[Firebase Cloud Functions - AI Orchestrator]
    CF_AI -->|Analyze| AI[LLM: Gemini / DeepSeek]
    AI -->|Structured Result| CF_AI
    CF_AI -->|Update Domain| DB_DOM[Firestore - Contacts/Tasks/Events]
    DB_DOM -->|Snapshot Subscription| FE[Next.js Frontend]
    FE -->|User Action| CF_ACT[Firebase Cloud Functions - User Logic]
    CF_ACT -->|Final Commit| DB_DOM
    DB_AI[Firestore - AI Runs] -->|Trigger| CF_FIN[Firebase Cloud Functions - FinOps Aggregator]
    CF_FIN -->|Monthly Summary| DB_FIN[Firestore - Monthly Usage]
    DB_FIN --> FE
```

1. **WhatsApp Webhook**: Incoming message from WhatsApp -> Evolution API (VPS) -> Webhook Endpoint (Cloud Functions).
2. **Message Ingestion**: Cloud Functions -> Save to Firestore (`webhooks` / `messages` collections).
3. **AI Processing (Async)**: Document trigger -> AI Orchestration -> Analyze content/context -> Update `contacts`/`tasks`/`events` collections.
4. **Frontend Update**: Firestore Snapshot Listener -> Real-time UI update in Next.js.
5. **Direct User Action**: User interacts on UI (e.g., approve action) -> Request to Cloud Functions -> Final database update.

## Key Architectural Patterns
- **Expansion Track Separation**: Strict adherence to logically separating new modules from legacy inventory.
- **AI Orchestrator**: Logic to `plan`, `execute`, `query context`, and `write results` to ensure trackability.
- **Approval-First AI**: Human-in-the-loop requirement for tasks with high cost or business impact.
- **Tenant Isolation**: Currently single-tenant with logical account separation (preparatory for future multi-tenancy).
- **TDD (Test-Driven Development)**: All expansion features must be verified by `Jest` tests before PR.

## Access Control and Workspace Isolation

- Firebase Auth remains the identity provider; Google sign-in is not sufficient to unlock data.
- The callable `initializeAccessProfile` creates a server-owned profile with `accessStatus: pending` for new users. Only an approved admin can approve or revoke another user through `approveAccessRequest` or `revokeAccess`.
- Approved status, admin role, and `workspaceId` are mirrored into Firebase custom claims. Firestore rules require `accessApproved == true` and the same workspace for shared Expansion Track data.
- `/system/access_control` is server-only. The platform owner is resolved from the `PLATFORM_OWNER_EMAIL` secret, stored server-side, and omitted from access-management responses and visible identity surfaces. The initial visible administrator is resolved from the `PLATFORM_ADMIN_EMAIL` secret and receives the same approved workspace boundary.
- `in_app_notifications` is recipient-scoped and used to notify admins about requests and users about approval/revocation.
- Firebase Storage follows the same `accessApproved` claim gate; unauthenticated and pending/revoked users cannot read or upload files.

## CRM v1 Data Flow

The CRM uses `accounts` as companies and `contacts` as people. Each record carries `workspaceId`; contacts also carry `companyId`, role, locality, normalized phone digits, and optional `whatsappRemoteJid`.

1. Approved user creates a company/contact from the CRM screen.
2. A manual interaction writes an immutable `crm_events` record and updates the contact's last/next contact fields.
3. Equipment links write to `interests` or `installed_base`, referencing catalog type/brand/model when available.
4. After the asynchronous WhatsApp Inbox/AI pipeline completes, the backend resolves a CRM contact by remote ID or normalized phone. A match creates a WhatsApp timeline event, links extracted opportunities/tasks/events, and applies an AI next-contact date only if no manual next-contact date exists.

## Integration Points
- **Gemini API**: Used for complex extraction, summaries, and multimodal reasoning.
- **DeepSeek API**: Proposed backend logic for high-volume, low-cost extraction.
- **Evolution API (WhatsApp)**: Dedicated WhatsApp instance management and message stream.
- **Metadata Caching**: Dedicated `whatsapp_groups` collection and Evolution API `/group/findGroupInfos` endpoint used to resolve JIDs to human-readable names.

## Core Schemas (AI Orchestrator)
The AI Orchestrator follows a structured "Plan-Execute" pattern.

### AI Task Plan Schema
```json
{
  "taskType": "string (e.g., 'extract_crm_events')",
  "targetId": "string (document ID)",
  "status": "pending | approved | executing | completed | failed",
  "costEstimation": {
    "model": "string",
    "inputTokens": "number",
    "outputTokens": "number",
    "costUSD": "number"
  },
  "context": {
    "sources": ["array of source IDs"],
    "promptVersion": "string"
  }
}
```

### AI Run Ledger Schema
```json
{
  "taskId": "string (plan ID)",
  "actualCost": {
    "inputTokens": "number",
    "outputTokens": "number",
    "costUSD": "number"
  },
  "lineage": {
    "rawInput": "string (path or ID)",
    "piiRedacted": "boolean"
  },
  "result": "object (structured output)"
}
```

### Monthly Usage Summary Schema (FinOps)
Location: `system_usage/ai_usage_summary_{YYYYMM}`
```json
{
  "month": "YYYYMM",
  "totalCostUsd": "number (incremented)",
  "totalTokens": "number (incremented)",
  "totalRequests": "number (incremented)",
  "tasks": {
    "whatsapp_extraction": {
      "cost": "number",
      "count": "number"
    }
  },
  "updatedAt": "serverTimestamp"
}
```

### System Audit Log Schema
Location: `system_audit_logs/{id}`
```json
{
  "category": "security | finops | data | system",
  "action": "string (action identifier)",
  "actorId": "string (uid or 'system')",
  "severity": "info | warning | critical",
  "details": "object (contextual data)",
  "timestamp": "serverTimestamp"
}
```

## Technical Reference
- **Project Context**: [agent_context.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/agent_context.md)
- **Decision Log**: [decisions.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/decisions.md)
- **WhatsApp Integration Details**: [whatsapp-integration.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/whatsapp-integration.md)
- **Evolution Plan**: [expansion-track-plan.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/expansion-track-plan.md)
