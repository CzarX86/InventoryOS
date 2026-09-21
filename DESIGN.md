# InventoryOS Design Context

## Product surface

InventoryOS is an operational workspace for inventory, customer relationships, and WhatsApp-assisted workflows. The access-control and CRM surfaces must feel like one product with the existing inventory console.

## Visual language

- Light, calm business SaaS interface for industrial operations: soft blue-gray canvas, white surfaces, dark navy text, and restrained shadows.
- Primary palette: `#F5F7FB` canvas, `#FFFFFF` surface, `#172033` ink, `#64748B` metadata, `#2F5DCE` action/active state, `#0F766E` positive state, and `#C2413F` destructive state.
- The home dashboard borrows the reference's soft productivity language: rounded cards, generous spacing, compact metric chips, a small lime highlight for positive momentum, and simple charts that remain readable on narrow screens.
- New UI uses the existing `shadcn/ui` primitives with medium corner radii, sentence-case copy, readable 14–16px body text, and monospace only for IDs or technical values.
- Avoid glow, blur-heavy decoration, all-caps system labels, black full-bleed surfaces, and sci-fi display typography. Visual emphasis comes from hierarchy, whitespace, status color, and a quiet blue active rail.
- Prefer progressive disclosure: summary and next action first, details and secondary actions in the selected record.
- Expansion modules use a two-layer presentation: a plain-language value overview first, then the operational console behind an explicit configuration/review action. This keeps technical integration details from becoming the first impression for customers.
- Use Google profile avatars in account, access-management, and request-review surfaces when available; use readable initials as the fallback. Avatars should reinforce identity without becoming a decorative focal point.

## Interaction principles

- Access state is explicit: pending and revoked users see only the access gate; approved users see the workspace.
- Approvals and revocations are reversible in data, but require an accessible confirmation dialog.
- CRM records are grouped by company, with role and locality visible before opening a contact.
- Every interaction has a channel, date, summary, and next-contact signal. Manual dates take precedence over AI suggestions.
- Loading, empty, error, and disabled states are visible and do not use browser alerts.
- The default authenticated landing surface is the employee home: recent personal CRM performance and today's activities are shown before the inventory list.
- Mobile navigation remains horizontally reachable, uses minimum 44px touch targets, and keeps labels visible rather than relying on icon-only controls.
