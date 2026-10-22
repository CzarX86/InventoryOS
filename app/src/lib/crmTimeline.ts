export type ContactChannelLike = {
  id: string;
  isPrimary?: boolean | null;
  [key: string]: unknown;
};

export type ContactUpdateLike = {
  role?: string | null;
  sector?: string | null;
  locality?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  notesAppend?: string | null;
  [key: string]: unknown;
};

export type AppliedContactUpdate = {
  field: string;
  label: string;
  value: string;
};

const UPDATE_LABELS: Record<string, string> = {
  role: "Função",
  sector: "Setor",
  locality: "Localidade",
  email: "E-mail",
  phoneNumber: "Telefone",
  notesAppend: "Observação anexada",
};

const UPDATE_FIELD_ORDER = [
  "role",
  "sector",
  "locality",
  "email",
  "phoneNumber",
  "notesAppend",
];

const AI_STATUS_LABELS: Record<string, string> = {
  completed: "IA concluída",
  processing: "IA processando",
  failed: "IA falhou",
};

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function formatAudioSize(bytes: unknown): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) {
    return null;
  }
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) {
    const rounded = Math.round(kilobytes * 10) / 10;
    return `${String(rounded).replace(".", ",")} KB`;
  }
  const megabytes = kilobytes / 1024;
  const rounded = Math.round(megabytes * 10) / 10;
  return `${String(rounded).replace(".", ",")} MB`;
}

export function formatConfidence(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}%`;
}

export function appliedContactUpdates(
  updates: ContactUpdateLike | null | undefined,
): AppliedContactUpdate[] {
  if (!updates || typeof updates !== "object") return [];
  return UPDATE_FIELD_ORDER.filter((field) => hasText(updates[field])).map(
    (field) => ({
      field,
      label: UPDATE_LABELS[field],
      value: String(updates[field]).trim(),
    }),
  );
}

export function describeAiStatus(status: unknown): string | null {
  if (typeof status !== "string") return null;
  return AI_STATUS_LABELS[status] || null;
}

export function sortContactChannels<T extends ContactChannelLike>(
  channels: T[],
): T[] {
  return [...channels].sort((left, right) => {
    const leftPrimary = left.isPrimary === true ? 0 : 1;
    const rightPrimary = right.isPrimary === true ? 0 : 1;
    return leftPrimary - rightPrimary;
  });
}
