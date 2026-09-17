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
- Equipment can be linked as commercial interest or installed base using catalog type/brand/model or a pending free-text description.
- WhatsApp batches link automatically by WhatsApp remote ID or normalized phone when a matching CRM contact exists.

## Safety and feedback

- Client reads and writes are constrained by Firebase claims and workspace membership; admin mutations use callable functions.
- Destructive access changes require a confirmation dialog.
- User-facing failures use inline alerts or status regions with recovery actions.

## Localization

- The interface is presented in Brazilian Portuguese, including operational labels, dynamic status values, onboarding/update prompts, and accessibility labels.
- Localization never changes persisted values or protocol identifiers; translations are applied at the presentation boundary.
