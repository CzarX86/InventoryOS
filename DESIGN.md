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
- Loading, empty, error, and disabled states are visible and do not use browser alerts.
