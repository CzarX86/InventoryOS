export type PhoneChannelEntry = {
  label: string;
  value: string;
  hasWhatsapp: boolean;
  [key: string]: unknown;
};

export type EmailChannelEntry = {
  label: string;
  value: string;
  [key: string]: unknown;
};

export type ParsedChannelValue = {
  values: string[];
  ambiguous: boolean;
  duplicatesRemoved: number;
};

export type NormalizedEntries<T> = {
  entries: T[];
  ambiguousValues: number;
  duplicatesRemoved: number;
};

const PHONE_PATTERN = /(?<![\p{L}\p{N}])(?:\+?55[\s./-]*)?(?:\(\d{2}\)|\d{2})?[\s./-]*\d{4,5}[\s./-]?\d{4}(?![\p{L}\p{N}])/gu;
const PHONE_DIGIT_LENGTHS = new Set([8, 9, 10, 11, 12, 13]);
const EMAIL_PART_PATTERN = /^[^\s@,;|<>]+@[^\s@,;|<>]+\.[^\s@,;|<>]+$/u;

export function normalizePhoneDigits(value: unknown = "") {
  return String(value ?? "").replace(/\D/g, "");
}

export function normalizePhoneForStorage(value: unknown = "") {
  const original = String(value ?? "").trim();
  if (!original || !/^\+?[\d\s()./-]+$/u.test(original)) return original;

  const digits = normalizePhoneDigits(original);
  if (original.startsWith("+")) {
    if (digits.startsWith("55") && digits.length !== 12 && digits.length !== 13) return original;
    return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : original;
  }

  const parsed = parsePhoneChannelValue(original);
  if (parsed.ambiguous || parsed.values.length !== 1 || !PHONE_DIGIT_LENGTHS.has(digits.length)) return original;
  if (digits.length === 10 || digits.length === 11) return `+55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `+${digits}`;
  return digits;
}

export function phoneDigitsForStorage(value: unknown = "") {
  const storedValue = normalizePhoneForStorage(value);
  const digits = normalizePhoneDigits(storedValue);
  if (storedValue.startsWith("+")) return digits.length >= 7 && digits.length <= 15 ? digits : "";
  return digits.length === 8 || digits.length === 9 ? digits : "";
}

export function formatPhoneForDisplay(value: unknown = "") {
  const original = String(value ?? "").trim();
  const digits = normalizePhoneDigits(original);
  if (!digits) return original;

  let nationalDigits = digits;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    nationalDigits = digits.slice(2);
  } else if (original.startsWith("+")) {
    return original;
  }

  if (nationalDigits.length === 11) {
    return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(2, 7)}-${nationalDigits.slice(7)}`;
  }
  if (nationalDigits.length === 10) {
    return `(${nationalDigits.slice(0, 2)}) ${nationalDigits.slice(2, 6)}-${nationalDigits.slice(6)}`;
  }
  if (nationalDigits.length === 9) {
    return `${nationalDigits.slice(0, 5)}-${nationalDigits.slice(5)}`;
  }
  if (nationalDigits.length === 8) {
    return `${nationalDigits.slice(0, 4)}-${nationalDigits.slice(4)}`;
  }
  return original;
}

export function canonicalPhoneKey(value: unknown = "") {
  const digits = normalizePhoneDigits(value);
  return digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
    ? digits.slice(2)
    : digits;
}

export function isValidEmailAddress(value: unknown) {
  return EMAIL_PART_PATTERN.test(String(value ?? "").trim());
}

export function parsePhoneChannelValue(value: unknown): ParsedChannelValue {
  const original = String(value ?? "").trim();
  if (!original) return { values: [], ambiguous: false, duplicatesRemoved: 0 };

  const matches = original.match(PHONE_PATTERN) || [];
  if (!matches.length) return { values: [original], ambiguous: true, duplicatesRemoved: 0 };

  const remainder = original.replace(PHONE_PATTERN, "");
  if (!/^[\s,;|/·•]*$/u.test(remainder)) {
    return { values: [original], ambiguous: true, duplicatesRemoved: 0 };
  }

  const candidates = matches.map((match) => match.trim());
  if (candidates.some((candidate) => !PHONE_DIGIT_LENGTHS.has(normalizePhoneDigits(candidate).length))) {
    return { values: [original], ambiguous: true, duplicatesRemoved: 0 };
  }

  const values: string[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;
  for (const candidate of candidates) {
    const key = canonicalPhoneKey(candidate);
    if (seen.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seen.add(key);
    values.push(candidate);
  }

  return { values, ambiguous: false, duplicatesRemoved };
}

export function parseEmailChannelValue(value: unknown): ParsedChannelValue {
  const original = String(value ?? "").trim();
  if (!original) return { values: [], ambiguous: false, duplicatesRemoved: 0 };

  const parts = original.split(/[\s,;|]+/u).filter(Boolean);
  const validParts = parts.filter(isValidEmailAddress);
  if (!validParts.length) return { values: [original], ambiguous: true, duplicatesRemoved: 0 };

  const values: string[] = [];
  const seenValid = new Set<string>();
  let duplicatesRemoved = 0;
  let ambiguous = false;
  for (const part of parts) {
    if (!isValidEmailAddress(part)) {
      values.push(part);
      ambiguous = true;
      continue;
    }
    const key = part.toLocaleLowerCase("pt-BR");
    if (seenValid.has(key)) {
      duplicatesRemoved += 1;
      continue;
    }
    seenValid.add(key);
    values.push(part);
  }

  return { values, ambiguous, duplicatesRemoved };
}

function asEntry(value: unknown, defaultLabel: string) {
  if (typeof value === "string") return { label: defaultLabel, value, hasWhatsapp: false };
  const entry = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    ...entry,
    label: String(entry.label || defaultLabel),
    value: String(entry.value ?? ""),
    hasWhatsapp: Boolean(entry.hasWhatsapp),
  };
}

export function normalizePhoneEntries(input: unknown, whatsappPhoneDigits: unknown = []): NormalizedEntries<PhoneChannelEntry> {
  const entries = Array.isArray(input) ? input : input == null ? [] : [input];
  const knownWhatsapp = new Set((Array.isArray(whatsappPhoneDigits) ? whatsappPhoneDigits : [whatsappPhoneDigits])
    .map(canonicalPhoneKey)
    .filter(Boolean));
  const result: PhoneChannelEntry[] = [];
  const positions = new Map<string, number>();
  let ambiguousValues = 0;
  let duplicatesRemoved = 0;

  for (const rawEntry of entries) {
    const entry = asEntry(rawEntry, "Telefone") as PhoneChannelEntry;
    const parsed = parsePhoneChannelValue(entry.value);
    if (parsed.ambiguous) ambiguousValues += 1;
    duplicatesRemoved += parsed.duplicatesRemoved;

    parsed.values.forEach((value, index) => {
      const key = canonicalPhoneKey(value) || value.trim().toLocaleLowerCase("pt-BR");
      const inheritedWhatsapp = entry.hasWhatsapp && (parsed.values.length === 1 || index === 0);
      const hasWhatsapp = inheritedWhatsapp || knownWhatsapp.has(canonicalPhoneKey(value));
      const existingIndex = positions.get(key);
      if (existingIndex !== undefined) {
        duplicatesRemoved += 1;
        result[existingIndex].hasWhatsapp ||= hasWhatsapp;
        return;
      }
      positions.set(key, result.length);
      result.push({ ...entry, value, hasWhatsapp });
    });
  }

  return { entries: result, ambiguousValues, duplicatesRemoved };
}

export function normalizeEmailEntries(input: unknown): NormalizedEntries<EmailChannelEntry> {
  const entries = Array.isArray(input) ? input : input == null ? [] : [input];
  const result: EmailChannelEntry[] = [];
  const positions = new Map<string, number>();
  let ambiguousValues = 0;
  let duplicatesRemoved = 0;

  for (const rawEntry of entries) {
    const entry = asEntry(rawEntry, "E-mail");
    const parsed = parseEmailChannelValue(entry.value);
    if (parsed.ambiguous) ambiguousValues += 1;
    duplicatesRemoved += parsed.duplicatesRemoved;

    parsed.values.forEach((value) => {
      const isValid = isValidEmailAddress(value);
      const key = isValid ? value.toLocaleLowerCase("pt-BR") : `ambiguous:${value}`;
      if (isValid && positions.has(key)) {
        duplicatesRemoved += 1;
        return;
      }
      if (isValid) positions.set(key, result.length);
      result.push({ ...entry, value });
    });
  }

  return { entries: result, ambiguousValues, duplicatesRemoved };
}
