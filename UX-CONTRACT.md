# InventoryOS UX Contract

## Access control

- Google sign-in creates or refreshes a server-owned access profile.
- New users enter `pending` and cannot read inventory or Expansion Track data.
- Approved users receive the workspace claim and can use shared data.
- Admins approve or revoke users from the platform and receive in-app access-request notifications.
- The platform owner is approved automatically through the server-configured owner email and is excluded from user lists and identity surfaces.

## CRM

- A contact belongs to a company and may carry multiple responsible people with distinct roles.
- Contact creation supports company, sector, locality, email, phone, WhatsApp remote ID, and notes.
- An interaction creates an immutable timeline event and updates last/next contact fields.
- CRM navigation is separated into tabs for overview, new contact, company/contact directory, and history/actions; selecting a contact preserves that context for the history tab.
- Audio interactions may be recorded from the current device microphone or uploaded as an audio file. The original audio, transcript, metadata, and AI analysis are stored with the immutable event; explicit contact fields may be updated, while opportunities, tasks, and equipment remain reviewable suggestions.
- Equipment can be linked as commercial interest or installed base using catalog type/brand/model or a pending free-text description.
- WhatsApp batches link automatically by WhatsApp remote ID or normalized phone when a matching CRM contact exists.

## Safety and feedback

- Client reads and writes are constrained by Firebase claims and workspace membership; admin mutations use callable functions.
- Destructive access changes require a confirmation dialog.
- User-facing failures use inline alerts or status regions with recovery actions.

## Localization

- The interface is presented in Brazilian Portuguese, including operational labels, dynamic status values, onboarding/update prompts, and accessibility labels.
- Localization never changes persisted values or protocol identifiers; translations are applied at the presentation boundary.

## Canonical UI map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | Native select for the current Firebase-backed operational forms | This contract and `premium-ui.json` | Native | Keyboard and browser verification in the affected flow |
| Date | Native `datetime-local` for the current CRM follow-up forms | This contract and `premium-ui.json` | Native | Locale, keyboard, and browser verification in the affected flow |
| Form | `shadcn/ui` field primitives plus screen-level domain validation | This contract and the CRM component | Create and interaction capture | Jest/build plus browser verification |
| Toast | Inline alert/status region while the shared notification provider is not available | This contract and existing application behavior | Error and recovery status | Live-region verification |
| CRUD | Firestore writes scoped to the approved workspace | `architecture.md` and this contract | Create and return to the relevant CRM tab | Unit/build plus browser verification |
