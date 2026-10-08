# CRM contact channel normalization

Each phone number and e-mail address is stored as an individual entry in `contacts.phoneNumbers` / `contacts.emails` and as an individual active `contact_channels` document. The CRM editor splits recognizable multi-value input on load and save. Brazilian phone values with a DDD are stored in E.164 form (`+55` plus DDD and subscriber number); numbers with only a local subscriber number remain digits-only because a full international number cannot be derived without a DDD. `phoneDigits`, `phoneDigitsList`, and `whatsappPhoneDigits` are digits-only lookup fields. Repeated phones are compared by normalized digits (including Brazilian `55` country-code equivalence); e-mails are compared case-insensitively.

The interface applies the Brazilian national mask only for display: `(DD) 9XXXX-XXXX` for mobile numbers and `(DD) XXXX-XXXX` for landlines. E.164 values for other countries are preserved and are not forced into a Brazilian layout. Common phone/e-mail labels appear as suggestions in the same editable text field, so users can also enter custom labels directly.

The parser is conservative. A phone value is split only when every character belongs to recognized phone candidates and their separators. Recognized Brazilian national values of 10 or 11 digits receive the `+55` country code when saved; explicit international values are stored with `+` and digits only. E-mails are split on whitespace, commas, semicolons or vertical bars when at least one valid address is present. Unrecognized e-mail fragments are preserved as their own editable value; a value with no recognizable address stays unchanged. No text is discarded to make a field look valid.

## One-time production cleanup

Run commands from `app/` with an authenticated `gcloud` account that can read and write the production Firestore database:

```bash
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app --apply
```

The first command is read-only. The second is explicitly limited to `inventory-os-app`, re-reads the current database state, checks Firestore update-time preconditions, and writes a mode-0600 backup of affected documents to the system temporary directory before applying batched changes. Running it again is safe and makes no changes after successful normalization. Ambiguous values are counted in the summary and left available for manual correction. The migration updates contact profile fields and active `contact_channels`; it does not rewrite immutable `crm_events` snapshots.

Soft-deleted contacts keep their lifecycle status; their embedded phone and e-mail fields are normalized, but the migration does not create active `contact_channels` for them.
