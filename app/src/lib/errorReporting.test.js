jest.mock("@/lib/firebase", () => ({
  auth: { currentUser: null },
  db: null,
}));

import { buildAppErrorReport, buildErrorId, buildTicketId } from "./errorReporting";

describe("errorReporting", () => {
  it("generates protocol-like ids", () => {
    expect(buildErrorId()).toMatch(/^ERR-\d{8}-[A-Z0-9]{6}$/);
    expect(buildTicketId()).toMatch(/^TKT-\d{8}-[A-Z0-9]{6}$/);
  });

  it("sanitizes sensitive reproduction context values", () => {
    const report = buildAppErrorReport({
      error: Object.assign(new Error("quota exceeded"), { status: 429 }),
      source: "add-item-modal",
      action: "IMAGE_EXTRACTION",
      user: { uid: "user-1", email: "user@example.com", role: "user" },
      context: {
        errorContext: "image",
        reproductionContext: {
          apiKey: "secret-key",
          authorization: "Bearer abc",
          imageBase64: "data:image/png;base64,AAAA",
          nested: {
            token: "secret-token",
            safeValue: "ok",
          },
          file: new File(["content"], "label.png", { type: "image/png" }),
        },
      },
      errorId: "ERR-20260319-TEST01",
    });

    expect(report.reproductionContext).toMatchObject({
      apiKey: "[redacted]",
      authorization: "[redacted]",
      imageBase64: "[redacted]",
      nested: {
        token: "[redacted]",
        safeValue: "ok",
      },
      file: {
        name: "label.png",
        type: "image/png",
        size: 7,
      },
    });
  });

  it("maps quota errors to human-friendly descriptions", () => {
    const report = buildAppErrorReport({
      error: Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 }),
      source: "voice-search",
      action: "VOICE_SEARCH",
      user: { uid: "user-1", email: "user@example.com", role: "user" },
      context: {
        errorContext: "audio-search",
      },
      errorId: "ERR-20260319-TEST02",
    });

    expect(report.humanMessage).toMatch(/limite de uso da api foi atingido/i);
    expect(report.knownReason).toMatch(/cota configurada/i);
    expect(report.category).toBe("ai_quota");
    expect(report.severity).toBe("high");
    expect(report.httpStatus).toBe(429);
  });
});
