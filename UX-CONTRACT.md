# InventoryOS UX Contract

## Access control

- Google sign-in creates or refreshes a server-owned access profile.
- New users enter `pending` and cannot read inventory or Expansion Track data.
- Approved users receive the workspace claim and can use shared data.
- Admins approve or revoke users from the platform and receive in-app access-request notifications.
- The platform owner is approved automatically through the server-configured owner email and is excluded from user lists and identity surfaces.

## CRM

- A contact belongs to a company and may carry multiple responsible people with distinct roles.
- CRM is organized as a contact list plus a dedicated contact detail view. “Novo contato” opens a modal; after saving, the new contact is selected automatically so the user can immediately register an interaction.
- Company autocomplete is intentionally progressive: it stays empty on focus and only searches the workspace-backed company list after at least two typed characters.
- Contact creation supports company, sector, locality, full company address, multiple labeled e-mails, and multiple labeled phones. WhatsApp is a checkbox on each phone; the backend derives normalized phone matching and the UI never asks for a WhatsApp remote ID.
- An interaction creates an immutable timeline event and updates last/next contact fields.
- Equipment can be linked as commercial interest or installed base using catalog type/brand/model or a pending free-text description.
- WhatsApp batches link automatically by WhatsApp remote ID, the primary normalized phone, or any additional phone stored on the contact when a matching CRM contact exists.

## Employee home

- Approved users land on the home dashboard before the inventory list.
- The dashboard shows only personal CRM interactions attributed to the current user, grouped into the last seven days and today's activity list.
- When there is no activity, the empty state explains how to register an interaction and links to the CRM workflow.
- Performance values are source-backed; the UI must not imply conversion, revenue, or quality metrics that are not captured by the CRM schema.

## WhatsApp module discovery and access request

- The WhatsApp navigation entry opens a product-facing overview before technical configuration. The page explains the module's benefits, the CRM/IA workflow, and the fact that access is released on request.
- “Solicitar liberação” opens a short accessible dialog and creates one workspace-scoped `module_requests/{requesterUserId}_whatsapp` record with `status: pending`. The requester sees an explicit pending state and cannot submit duplicate requests while the request is pending or approved.
- The instance manager and contact review queue remain available behind progressive disclosure for users who already have access or need to inspect the connection.

## Action inbox

- The administrative action inbox is presented as “Central de ações” and explains its source: opportunities and tasks extracted from conversations that still need a human decision or follow-up.
- The central defaults to open records, supports search and category filters, and uses explicit empty states. Completing an opportunity or task removes it from the open view while preserving the underlying record in Firestore.
- Destructive removal requires an accessible confirmation dialog; browser-native confirmation prompts are not used.

## Administrative workspace

- Admin is presented as the operational control center: access management, module requests, integrations, system health, AI usage, errors, and activity history are grouped under plain-language sections.
- Customer-facing copy describes the access workflow and workspace permissions without exposing internal bootstrap, ownership, or infrastructure details.
- Authenticated people are represented with their Google account avatar when available. Initials are the fallback for local development or accounts without a profile photo.

## Visual theme and responsive shell

- The default product theme is light and uses the shared tokens in `DESIGN.md`.
- Desktop uses a persistent sidebar; mobile uses a horizontally scrollable bottom navigation with visible labels and touch targets of at least 44px.
- The document remains scrollable on narrow screens; the shell must not lock the body or rely on `100vh` for content height.

## Safety and feedback

- Client reads and writes are constrained by Firebase claims and workspace membership; admin mutations use callable functions.
- Destructive access changes require a confirmation dialog.
- User-facing failures use inline alerts or status regions with recovery actions.
