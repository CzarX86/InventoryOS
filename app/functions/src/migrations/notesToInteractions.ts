export type NoteInteractionKind = "proposal" | "quotation";

export interface ParsedNoteInteraction {
  kind: NoteInteractionKind;
  /** ISO calendar date (YYYY-MM-DD) taken from the note. */
  occurredAtIsoDate: string;
  /** Equipment / subject text between the keyword and the value. */
  description: string;
  /** Value in BRL parsed from the trailing `1.234,56` amount. */
  estimatedValue: number;
}

const NOTE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})\s*-?\s*(PROPOSTA|COTAÇÃO)\b\s*(.*)$/;
const REPEATED_DATE_PREFIX = /^(\d{2}\/\d{2}\/\d{4})\s+/;
const TRAILING_VALUE = /([\d.]+,\d{2})\s*$/;

function toIsoDate(day: string, month: string, year: string): string | null {
  const normalized = `${year}-${month}-${day}`;
  const parsed = new Date(`${normalized}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  const [y, m, d] = [parsed.getUTCFullYear(), parsed.getUTCMonth() + 1, parsed.getUTCDate()];
  if (y !== Number(year) || m !== Number(month) || d !== Number(day)) return null;
  return normalized;
}

function parseBrlAmount(raw: string): number | null {
  const normalized = raw.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parses legacy contact notes such as
 * `09/04/2025-PROPOSTA INVERSOR ALLEN BRADLEY 23.828,04`
 * into a structured proposal/quotation interaction.
 * Returns null when the note does not follow the pattern.
 */
export function parseNoteInteraction(note: string | null | undefined): ParsedNoteInteraction | null {
  if (typeof note !== "string") return null;
  const match = note.trim().match(NOTE_PATTERN);
  if (!match) return null;
  const [, day, month, year, keyword, rest] = match;
  const occurredAtIsoDate = toIsoDate(day, month, year);
  if (!occurredAtIsoDate) return null;

  const body = (rest || "").replace(REPEATED_DATE_PREFIX, "").trim();
  const valueMatch = body.match(TRAILING_VALUE);
  if (!valueMatch) return null;
  const estimatedValue = parseBrlAmount(valueMatch[1]);
  if (estimatedValue === null) return null;
  const description = body.slice(0, valueMatch.index).trim().replace(/\s+/g, " ");
  if (!description) return null;

  return {
    kind: keyword === "COTAÇÃO" ? "quotation" : "proposal",
    occurredAtIsoDate,
    description,
    estimatedValue,
  };
}

/** Human summary stored on the migrated interaction, e.g. `Proposta — X — R$ 1.234,56`. */
export function buildMigratedSummary(parsed: ParsedNoteInteraction): string {
  const kindLabel = parsed.kind === "quotation" ? "Cotação" : "Proposta";
  const formattedValue = parsed.estimatedValue.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  return `${kindLabel} — ${parsed.description} — ${formattedValue}`;
}
