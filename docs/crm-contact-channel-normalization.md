# CRM contact channel normalization

Each phone number and e-mail address is stored as an individual entry in `contacts.phoneNumbers` / `contacts.emails` and as an individual active `contact_channels` document. The CRM editor splits recognizable multi-value input on load and save. Brazilian phone values with a DDD are stored in E.164 form (`+55` plus DDD and subscriber number); numbers with only a local subscriber number remain digits-only because a full international number cannot be derived without a DDD. `phoneDigits`, `phoneDigitsList`, and `whatsappPhoneDigits` are digits-only lookup fields. Repeated phones are compared by normalized digits (including Brazilian `55` country-code equivalence); e-mails are compared case-insensitively.

The interface applies the Brazilian national mask only for display: `(DD) 9XXXX-XXXX` for mobile numbers and `(DD) XXXX-XXXX` for landlines. E.164 values for other countries are preserved and are not forced into a Brazilian layout. Common phone/e-mail labels appear as suggestions in the same editable text field, so users can also enter custom labels directly.

The parser is conservative. A phone value is split only when every character belongs to recognized phone candidates and their separators. Recognized Brazilian national values of 10 or 11 digits receive the `+55` country code when saved; explicit international values are stored with `+` and digits only. E-mails are split on whitespace, commas, semicolons or vertical bars when at least one valid address is present. Unrecognized e-mail fragments are preserved as their own editable value; a value with no recognizable address stays unchanged. No text is discarded to make a field look valid.

The one-time cleanup also repairs legacy phone labels only when a label is clearly corrupted: a phone-like number followed by `Celular`/`elular`, or a label made entirely of a phone-like number. For Brazilian numbers with a recognizable national format, the subscriber prefix determines `Celular` versus the generic `Telefone`; it does not guess whether a fixed line is commercial or residential. If the number format is inconclusive, a surviving `Celular` suffix is retained as `Celular`, while a numeric-only label becomes `Telefone`. Other custom labels are preserved. Anatel documents the current `9XXXX-XXXX` mobile format and identifies 9 as mobile and 2–5 as fixed-line prefixes ([numbering guidance](https://www.gov.br/anatel/pt-br/regulado/numeracao/perguntas-frequentes), [ninth-digit guidance](https://www.gov.br/anatel/pt-br/regulado/numeracao/codigos-nacionais/nono-digito)).

## One-time production cleanup

Run commands from `app/` with an authenticated `gcloud` account that can read and write the production Firestore database:

```bash
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app --apply
```

To repair only clearly corrupted phone labels, use the narrower mode first and then apply it after reviewing the summary:

```bash
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app --labels-only
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app --labels-only --apply
```

Commands without `--apply` are read-only. Both apply modes are limited to `inventory-os-app`, read the current database state, use Firestore update-time preconditions, and write a mode-0600 backup of affected documents to the system temporary directory before applying batched changes. The `--labels-only` mode changes only phone labels in contact profiles and active `contact_channels`. The general normalization mode also repairs legacy channel values. Neither mode rewrites immutable `crm_events` snapshots, and a repeated run makes no further changes after successful cleanup. Ambiguous phone and e-mail values remain available for manual correction.

Soft-deleted contacts keep their lifecycle status; their embedded phone and e-mail fields are normalized, but the migration does not create active `contact_channels` for them.
