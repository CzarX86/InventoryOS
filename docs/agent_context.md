---
project: InventoryOS
active_branch: codex/expansion-foundation
stack: Next.js 15, Firebase, Gemini/DeepSeek, TypeScript (Migration)
release_channel: preview (expansion-track)
last_updated: 2026-03-25
---

# Agent Context Layer (Persistent)

## Project Overview
InventoryOS is an operational platform currently focused on inventory and item management, being evolved into an AI-powered system with CRM, WhatsApp integration, and automated procurement logic. It maintains a production-ready inventory system while building a new "Expansion Track" on parallel infrastructure.

## Project Goals
- **Maintain Stability**: Ensure the production inventory system remains functional (login, inventory, audit, deploy).
- **Expansion Track Implementation**: Evolve into an AI-driven platform with CRM modules, WhatsApp automation, and supplier management.
- **AI-Centric Operation**: Position AI as the primary operator for data ingestion (WhatsApp) and action suggestions (Action Inbox).
- **Financial Transparency (FinOps)**: Maintain real-time visibility into AI token usage, Cloud Function costs, and "free tier" run rates to prevent unexpected billing.
- **Infrastructure Scaling**: Stabilize a hybrid infra (Firebase + VPS-hosted Evolution API).

## Current State of Development (March 2026)
- **Production**: Active for inventory/items.
- **Staging**: Currently resolving deployment blocks after Milestone 1 & 2 integration.
- **Expansion Milestone 1 & 2**: Successfully integrated CRM (Action Inbox, Review Queue) and Hardware Intelligence (Resolution Logic).
- **Backend Architecture**: Migrated Cloud Functions to a clean TypeScript `src/` structure to resolve TSC nesting and build-time collisions.
- **WhatsApp Integration**: Stabilized with buffering of webhooks (Inbox Pattern), name resolution, and AI-driven classification.
- **Observability & FinOps**: Backend 100% industrialized with Structured Logging, Error Wrappers, and real-time cost tracking.

- **FinOps & Observability**: Implemented a real-time AI cost dashboard with MTD (Month-To-Date) tracking and run-rate projections. Added a background aggregator for cost summaries to minimize read costs.
- **UI Migration**: New features are using `shadcn/ui` components; legacy components coexist.
- **Development Flow**: Work is organized in the `codex/expansion-foundation` branch with PR-first workflow to `main`.

## Technologies in Use
- **Frontend**: Next.js 15 (App Router), React, PWA, Tailwind CSS.
- **UI Library**: `shadcn/ui` (default for new modules).
- **Backend/Functions**: Firebase Cloud Functions Gen 2 (Node.js 20).
- **Database/Storage**: Cloud Firestore, Firebase Storage.
- **Authentication**: Firebase Auth.
- **AI/LLM**: Google Generative AI (Gemini) SDK client-side, DeepSeek (proposed backend default).
- **Integrations**: Evolution API v2 (WhatsApp), FCM (Push Notifications).
- **Package Manager**: `pnpm`.

## Operational Constraints
- **Test-Driven Development (TDD)**: Mandatory for all Expansion Track features.
- **Code Review**: No direct pushes to `main`. Use `codex/` prefixed branches.
- **Feature Flags**: New features must be flagged and isolated until ready for staging/prod.
- **CI/CD**: ESLint runs ONLY on changed files (lint global debt exists).
- **Environment**: Sensitive configs must NOT be committed (use GitHub Secrets/Environments).

## Known Risks
- **AI Token Cost**: Need for strict governance and estimated-vs-actual cost tracking.
- **Production Regressions**: High risk of breaking inventory while refactoring for CRM.
- **Data Privacy**: Strict logic required to separate personal vs. professional WhatsApp messages.



## Next Recommended Steps
1. Integrate WhatsApp Group monitoring with the new Review Queue (STABILIZED).
2. Implement target-driven group name resolution (STABILIZED).
3. Build the `Review Queue` for contact segmentation (STABILIZED).
4. Implement `BigQuery Billing Export` to pull official GCP/Firebase costs into the FinOps dashboard.
5. Create structured CRM entities (Opportunities/Tasks) from extracted data (Story 2.1.2).


## Technical Reference
- **System Structure**: [architecture.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/architecture.md)
- **Decision Log**: [decisions.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/decisions.md)
- **Deep Evolution Plan**: [expansion-track-plan.md](file:///Users/juliocezar/Dev/personal/InventoryOS/docs/expansion-track-plan.md)
