import {
  buildArchiveUpdate,
  formatDateLabel,
  formatMoney,
  formatStatusLabel,
  formatTaskTypeLabel,
  getItemLinkage,
  getItemTitle,
  getReviewSource,
  isArchived,
  isCompletedItem,
  timestampValue,
} from "@/lib/actionInbox";

describe("actionInbox helpers", () => {
  test("archived records count as completed so they leave the inbox", () => {
    expect(isArchived({ archived: true })).toBe(true);
    expect(isCompletedItem({ kind: "opportunity", stage: "new", archived: true })).toBe(true);
    expect(isCompletedItem({ kind: "task", status: "pending", archived: true })).toBe(true);
    expect(isCompletedItem({ kind: "opportunity", stage: "new" })).toBe(false);
    expect(isCompletedItem({ kind: "task", status: "pending" })).toBe(false);
  });

  test("terminal stages and statuses count as completed", () => {
    expect(isCompletedItem({ kind: "opportunity", stage: "closed_won" })).toBe(true);
    expect(isCompletedItem({ kind: "opportunity", stage: "lost" })).toBe(true);
    expect(isCompletedItem({ kind: "task", status: "completed" })).toBe(true);
    expect(isCompletedItem({ kind: "task", status: "cancelled" })).toBe(true);
    expect(isCompletedItem(null)).toBe(false);
  });

  test("titles fall back honestly", () => {
    expect(getItemTitle({ kind: "opportunity", title: "Deal" })).toBe("Deal");
    expect(getItemTitle({ kind: "opportunity" })).toBe("Oportunidade sem título");
    expect(getItemTitle({ kind: "task", description: "Call back" })).toBe("Call back");
    expect(getItemTitle({ kind: "task" })).toBe("Tarefa sem descrição");
  });

  test("money uses the record currency and hides non-numeric values", () => {
    expect(formatMoney(1500, "BRL")).toContain("1.500");
    expect(formatMoney("250.5", "USD")).toContain("250");
    expect(formatMoney(null, "BRL")).toBeNull();
    expect(formatMoney("", "BRL")).toBeNull();
    expect(formatMoney("abc", "BRL")).toBeNull();
    expect(formatMoney(100, null)).toContain("100");
  });

  test("status and task type labels cover the domain values", () => {
    expect(formatStatusLabel("closed_won")).toBe("Concluída");
    expect(formatStatusLabel("in_progress")).toBe("Em andamento");
    expect(formatStatusLabel("mystery")).toBe("mystery");
    expect(formatTaskTypeLabel("follow_up")).toBe("Follow-up");
    expect(formatTaskTypeLabel("visit")).toBe("Visita");
    expect(formatTaskTypeLabel(undefined)).toBe("Follow-up");
  });

  test("timestamps accept Firestore-like and ISO values", () => {
    expect(timestampValue({ toMillis: () => 1700000000000 })).toBe(1700000000000);
    expect(timestampValue({ toDate: () => new Date(1700000000000) })).toBe(1700000000000);
    expect(timestampValue("2024-01-01T00:00:00.000Z")).toBe(Date.parse("2024-01-01T00:00:00.000Z"));
    expect(timestampValue(null)).toBe(0);
    expect(formatDateLabel(null)).toBe("Data não informada");
    expect(formatDateLabel("2024-01-01T00:00:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  test("linkage surfaces contact, company and source messages", () => {
    expect(
      getItemLinkage({
        contactId: "c1",
        companyId: "co1",
        accountId: "a1",
        remoteJid: "5511@s.whatsapp.net",
        opportunityId: "o1",
        sourceMessageIds: ["m1", "m2"],
      }),
    ).toEqual({
      contactId: "c1",
      companyId: "co1",
      accountId: "a1",
      remoteJid: "5511@s.whatsapp.net",
      opportunityId: "o1",
      sourceMessageIds: ["m1", "m2"],
    });
    expect(getItemLinkage({})).toEqual({
      contactId: null,
      companyId: null,
      accountId: null,
      remoteJid: null,
      opportunityId: null,
      sourceMessageIds: [],
    });
  });

  test("review source merges root and suggestion linkage", () => {
    expect(
      getReviewSource({
        remoteJid: "5511@s.whatsapp.net",
        suggestion: { contactId: "c1", companyId: "co1", sourceMessageIds: ["m9"] },
      }),
    ).toEqual({
      remoteJid: "5511@s.whatsapp.net",
      contactId: "c1",
      companyId: "co1",
      sourceMessageIds: ["m9"],
    });
    expect(getReviewSource(null)).toEqual({
      remoteJid: null,
      contactId: null,
      companyId: null,
      sourceMessageIds: [],
    });
  });

  test("archive update marks the record without deleting it", () => {
    const now = new Date("2024-05-01T10:00:00.000Z");
    expect(buildArchiveUpdate(now)).toEqual({ archived: true, archivedAt: now, updatedAt: now });
  });
});
