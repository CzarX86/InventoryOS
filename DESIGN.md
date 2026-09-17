# InventoryOS Design Context

## Product surface

InventoryOS is an operational workspace for inventory, customer relationships, and WhatsApp-assisted workflows. The access-control and CRM surfaces must feel like one product with the existing inventory console.

## Visual language

- Dark, restrained, industrial interface with high legibility and compact information density.
- Existing palette is preserved: near-black surfaces, warm light text, muted gray metadata, indigo for navigation/action emphasis, blue-gray for confirmation, and red only for blocking or destructive states.
- New UI uses the existing `shadcn/ui` primitives and keeps square/low-radius geometry, monospace metadata labels, and uppercase section markers.
- Prefer progressive disclosure: list and status first, details and actions in the selected record.

## Interaction principles

- Access state is explicit: pending and revoked users see only the access gate; approved users see the workspace.
- Approvals and revocations are reversible in data, but require an accessible confirmation dialog.
- CRM records are grouped by company, with role and locality visible before opening a contact.
- Every interaction has a channel, date, summary, and next-contact signal. Manual dates take precedence over AI suggestions.
- The CRM uses tabs as a task boundary: overview, new contact, company/contact directory, and history/actions. The selected contact remains the working context when moving into history.
- Audio capture is a deliberate blue-gray action rail inside the interaction composer. It supports microphone recording and file upload, keeps a playable original, and exposes transcription and AI suggestions progressively in the timeline.
- Loading, empty, error, and disabled states are visible and do not use browser alerts.

## Language

- All user-facing copy, statuses, empty states, errors, tooltips, and accessibility labels use Brazilian Portuguese (`pt-BR`).
- Technical identifiers, API names, collection names, and persisted status codes remain unchanged internally; when shown in the interface, known values receive a Portuguese display label.
