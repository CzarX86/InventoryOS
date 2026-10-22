/**
 * Pure helpers for the Action Inbox (opportunities / tasks / review queue).
 *
 * Firestore rules deny client-side deletes on `opportunities` and `tasks`
 * (`allow delete: if false`), so the inbox archives records with an
 * update-based write instead of `deleteDoc`. These helpers keep that
 * policy and the display formatting in one tested place.
 */

export interface InboxItem {
  id?: string;
  kind?: string;
  stage?: string | null;
  status?: string | null;
  archived?: boolean | null;
  title?: string | null;
  description?: string | null;
  estimatedValue?: number | string | null;
  currency?: string | null;
  createdAt?: unknown;
  [key: string]: unknown;
}

export interface ItemLinkage {
  contactId: string | null;
  companyId: string | null;
  accountId: string | null;
  remoteJid: string | null;
  opportunityId: string | null;
  sourceMessageIds: string[];
}

export interface ReviewSource {
  remoteJid: string | null;
  contactId: string | null;
  companyId: string | null;
  sourceMessageIds: string[];
}

const OPPORTUNITY_DONE_STAGES = Object.freeze([
  "closed_won",
  "closed_lost",
  "completed",
  "won",
  "lost",
]);

const TASK_DONE_STATUSES = Object.freeze(["completed", "done", "resolved", "cancelled"]);

export function isArchived(item: InboxItem | null | undefined): boolean {
  return Boolean(item?.archived);
}

export function isCompletedItem(item: InboxItem | null | undefined): boolean {
  if (!item) return false;
  if (isArchived(item)) return true;
  if (item.kind === "opportunity") {
    return OPPORTUNITY_DONE_STAGES.includes(String(item.stage ?? ""));
  }
  return TASK_DONE_STATUSES.includes(String(item.status ?? ""));
}

export function getItemTitle(item: InboxItem | null | undefined): string {
  if (!item) return "Registro sem título";
  if (item.kind === "opportunity") return String(item.title || "Oportunidade sem título");
  return String(item.description || item.title || "Tarefa sem descrição");
}

const STATUS_LABELS: Record<string, string> = {
  new: "Nova",
  pending: "Pendente",
  in_progress: "Em andamento",
  qualified: "Qualificada",
  proposal: "Proposta",
  negotiation: "Negociação",
  won: "Ganha",
  lost: "Perdida",
  closed_won: "Concluída",
  closed_lost: "Encerrada",
  completed: "Resolvida",
  done: "Resolvida",
  resolved: "Resolvida",
  cancelled: "Cancelada",
};

export function formatStatusLabel(status: unknown): string {
  const key = String(status ?? "");
  return STATUS_LABELS[key] || key || "Sem status";
}

const TASK_TYPE_LABELS: Record<string, string> = {
  follow_up: "Follow-up",
  call: "Ligação",
  visit: "Visita",
  quote: "Cotação",
  support: "Suporte",
  other: "Outra",
};

export function formatTaskTypeLabel(taskType: unknown): string {
  const key = String(taskType ?? "");
  return TASK_TYPE_LABELS[key] || key || "Follow-up";
}

/**
 * Formats a monetary value with its record currency. Returns null when
 * there is no numeric value so callers can hide the badge honestly.
 */
export function formatMoney(
  value: number | string | null | undefined,
  currency: string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(numeric)) return null;
  const code = String(currency || "BRL").toUpperCase();
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }).format(numeric);
  } catch {
    return `${code} ${numeric}`;
  }
}

export function timestampValue(value: unknown): number {
  if (!value) return 0;
  if (typeof value === "object" && value !== null) {
    const candidate = value as { toMillis?: unknown; toDate?: unknown };
    if (typeof candidate.toMillis === "function") {
      return (candidate.toMillis as () => number)();
    }
    if (typeof candidate.toDate === "function") {
      return (candidate.toDate as () => Date)().getTime();
    }
  }
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

export function formatDateLabel(value: unknown): string {
  const timestamp = timestampValue(value);
  return timestamp ? new Date(timestamp).toLocaleDateString("pt-BR") : "Data não informada";
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

/**
 * Contact / company linkage carried by opportunities, tasks and review
 * suggestions so the inbox can show where each record came from.
 */
export function getItemLinkage(item: InboxItem | null | undefined): ItemLinkage {
  const source = (item ?? {}) as Record<string, unknown>;
  const rawIds = source.sourceMessageIds;
  return {
    contactId: asText(source.contactId),
    companyId: asText(source.companyId),
    accountId: asText(source.accountId),
    remoteJid: asText(source.remoteJid),
    opportunityId: asText(source.opportunityId),
    sourceMessageIds: Array.isArray(rawIds)
      ? rawIds.map((entry) => String(entry)).filter(Boolean)
      : [],
  };
}

/**
 * Origin linkage of an AI review suggestion (`crm_review_items`).
 * Suggestions are resolved by Cloud Functions; the inbox only reads them.
 */
export function getReviewSource(review: Record<string, unknown> | null | undefined): ReviewSource {
  const root = (review ?? {}) as Record<string, unknown>;
  const suggestion = (root.suggestion ?? {}) as Record<string, unknown>;
  const pick = (key: string): string | null => asText(root[key]) ?? asText(suggestion[key]);
  const rawIds = root.sourceMessageIds ?? suggestion.sourceMessageIds;
  return {
    remoteJid: pick("remoteJid"),
    contactId: pick("contactId"),
    companyId: pick("companyId"),
    sourceMessageIds: Array.isArray(rawIds)
      ? rawIds.map((entry) => String(entry)).filter(Boolean)
      : [],
  };
}

/**
 * Update payload that archives a record in place. Deletion is denied by
 * Firestore rules, so archiving keeps the audit trail while hiding the
 * record from the inbox.
 */
export function buildArchiveUpdate(now: Date = new Date()): {
  archived: boolean;
  archivedAt: Date;
  updatedAt: Date;
} {
  return { archived: true, archivedAt: now, updatedAt: now };
}
