# CRM contact channel normalization

Each phone number and e-mail address is stored as an individual entry in `contacts.phoneNumbers` / `contacts.emails` and as an individual active `contact_channels` document. The CRM editor splits recognizable multi-value input on load and save. Repeated phones are compared by normalized digits (including Brazilian `55` country-code equivalence); e-mails are compared case-insensitively.

The parser is conservative. A phone value is split only when every character belongs to recognized phone candidates and their separators. E-mails are split on whitespace, commas, semicolons or vertical bars when at least one valid address is present. Unrecognized e-mail fragments are preserved as their own editable value; a value with no recognizable address stays unchanged. No text is discarded to make a field look valid.

## One-time production cleanup

Run commands from `app/` with an authenticated `gcloud` account that can read and write the production Firestore database:

```bash
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app
node --experimental-strip-types scripts/normalize-crm-contact-channels.mjs --project inventory-os-app --apply
```

The first command is read-only. The second is explicitly limited to `inventory-os-app`, re-reads the current database state, checks Firestore update-time preconditions, and writes a mode-0600 backup of affected documents to the system temporary directory before applying batched changes. Running it again is safe and makes no changes after successful normalization. Ambiguous values are counted in the summary and left available for manual correction.

Soft-deleted contacts keep their lifecycle status; their embedded phone and e-mail fields are normalized, but the migration does not create active `contact_channels` for them.
