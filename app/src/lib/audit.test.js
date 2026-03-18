import {
  appendTaskUsageCall,
  buildActivityEvent,
  buildUndoDescriptor,
  createTaskLedger,
  isActivityUndone,
  normalizeUsageMetadata,
  sumUsageMetadata,
} from "./audit";

jest.mock("firebase/firestore", () => ({
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
}));

describe("audit helpers", () => {
  it("normalizes and sums usage metadata across multiple calls", () => {
    const totals = sumUsageMetadata([
      { model: "gemini-2.5-flash", source: "scan", step: "label", usage: { promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 } },
      { model: "gemini-2.5-flash-lite", source: "scan", step: "retry", usage: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7, cachedContentTokenCount: 1 } },
    ]);

    expect(totals).toEqual({
      promptTokenCount: 14,
      candidatesTokenCount: 8,
      totalTokenCount: 22,
      cachedContentTokenCount: 1,
      calls: [
        {
          model: "gemini-2.5-flash",
          source: "scan",
          step: "label",
          usage: normalizeUsageMetadata({ promptTokenCount: 10, candidatesTokenCount: 5, totalTokenCount: 15 }),
        },
        {
          model: "gemini-2.5-flash-lite",
          source: "scan",
          step: "retry",
          usage: normalizeUsageMetadata({ promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7, cachedContentTokenCount: 1 }),
        },
      ],
    });
  });

  it("accumulates a per-task ledger without mutating the prior object", () => {
    const ledger = createTaskLedger({ taskId: "task-1", actorId: "user-1" });
    const next = appendTaskUsageCall(ledger, {
      model: "gemini-2.5-flash",
      source: "image",
      step: "extraction",
      usage: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
    });

    expect(ledger.totalTokenCount).toBe(0);
    expect(next.totalTokenCount).toBe(5);
    expect(next.calls).toHaveLength(1);
    expect(next.calls[0].usage.totalTokenCount).toBe(5);
  });

  it("accepts tokenUsage-shaped payloads from the extraction hook", () => {
    const ledger = createTaskLedger({ taskId: "task-2", actorId: "user-1" });
    const next = appendTaskUsageCall(ledger, {
      model: "gemini-2.5-flash",
      source: "voice-input",
      step: "processAudioExtraction",
      tokenUsage: { promptTokenCount: 4, candidatesTokenCount: 3, totalTokenCount: 7 },
    });

    expect(next.totalTokenCount).toBe(7);
    expect(next.calls[0]).toMatchObject({
      source: "voice-input",
      step: "processAudioExtraction",
    });
  });

  it("builds reversible descriptors for inventory actions", () => {
    expect(buildUndoDescriptor({ actionType: "CREATE_ITEM", reversible: true, targetId: "a1" })).toEqual({
      actionType: "DELETE_ITEM",
      targetPath: ["inventory", "a1"],
      payload: null,
    });

    expect(buildUndoDescriptor({ actionType: "DELETE_ITEM", reversible: true, targetId: "a2", before: { model: "X" } })).toEqual({
      actionType: "RESTORE_ITEM",
      targetPath: ["inventory", "a2"],
      payload: { model: "X" },
    });
  });

  it("builds activity events with immutable timestamps and reversibility metadata", () => {
    const event = buildActivityEvent({
      actionType: "UPDATE_ITEM",
      actorId: "user-1",
      targetType: "inventory",
      targetId: "item-1",
      before: { model: "A" },
      after: { model: "B" },
      reversible: true,
      metadata: { reason: "edit" },
    });

    expect(event).toMatchObject({
      actionType: "UPDATE_ITEM",
      actorId: "user-1",
      targetType: "inventory",
      targetId: "item-1",
      before: { model: "A" },
      after: { model: "B" },
      reversible: true,
      metadata: { reason: "edit" },
    });
    expect(event.createdAt).toBe("SERVER_TIMESTAMP");
  });

  it("detects whether a target activity has been undone", () => {
    expect(isActivityUndone("evt-1", [
      { actionType: "UNDO_ACTION", metadata: { targetActivityId: "evt-1" } },
    ])).toBe(true);
    expect(isActivityUndone("evt-1", [])).toBe(false);
  });
});
