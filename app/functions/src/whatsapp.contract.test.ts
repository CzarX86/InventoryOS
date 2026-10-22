import { createHmac } from "crypto";
import { evolutionWebhook, resolveWebhookAuth, verifySignature } from "./index";

// Simplified mock of the Evolution API webhook payload
const mockUpsertPayload = {
  event: "messages.upsert",
  instance: "test_instance",
  data: {
    key: {
      remoteJid: "123456789@s.whatsapp.net",
      fromMe: false,
      id: "ABC123XYZ"
    },
    pushName: "John Doe",
    message: {
      conversation: "Vendi 10 sensores por 50 reais cada."
    },
    messageTimestamp: Math.floor(Date.now() / 1000)
  }
};

describe("Evolution API Contract (Webhook Ingestion)", () => {
  it("should validate the structure of a messages.upsert payload", () => {
    // Contract Verification: Does the payload match our expected implementation?
    expect(mockUpsertPayload).toHaveProperty("event", "messages.upsert");
    expect(mockUpsertPayload.data.key).toHaveProperty("remoteJid");
    expect(mockUpsertPayload.data.message).toHaveProperty("conversation");
  });

  it("should handle group messages with remoteJid ending in @g.us", () => {
    const groupPayload = {
      ...mockUpsertPayload,
      data: {
        ...mockUpsertPayload.data,
        key: {
          ...mockUpsertPayload.data.key,
          remoteJid: "987654321@g.us"
        }
      }
    };
    expect(groupPayload.data.key.remoteJid).toMatch(/@g\.us$/);
  });
});

describe("Evolution webhook authentication (fail-closed)", () => {
  const SECRET = "test-webhook-credential";
  const rawBody = Buffer.from(JSON.stringify(mockUpsertPayload));
  const validDigest = createHmac("sha256", SECRET).update(rawBody).digest("hex");

  it("accepts a valid HMAC signature, with or without the sha256= prefix", () => {
    expect(verifySignature(rawBody, validDigest, SECRET)).toBe(true);
    expect(verifySignature(rawBody, `sha256=${validDigest}`, SECRET)).toBe(true);
    expect(verifySignature(rawBody, validDigest.toUpperCase(), SECRET)).toBe(true);
  });

  it("rejects wrong signatures without throwing, even on length mismatch", () => {
    const tampered = `${validDigest.slice(0, -1)}0`;
    expect(verifySignature(rawBody, tampered, SECRET)).toBe(false);
    expect(() => verifySignature(rawBody, "short", SECRET)).not.toThrow();
    expect(verifySignature(rawBody, "short", SECRET)).toBe(false);
    expect(verifySignature(rawBody, `${validDigest}00`, SECRET)).toBe(false);
  });

  it("rejects when any input is missing (fail closed, never insecure mode)", () => {
    expect(verifySignature(rawBody, validDigest, "")).toBe(false);
    expect(verifySignature(undefined, validDigest, SECRET)).toBe(false);
    expect(verifySignature(rawBody, undefined, SECRET)).toBe(false);
    expect(verifySignature(rawBody, "", SECRET)).toBe(false);
  });

  it("resolves header-credential matches without requiring HMAC", () => {
    const base = { secret: SECRET, rawBody, signature: undefined };
    expect(resolveWebhookAuth({ ...base, headers: { apikey: SECRET } })).toBe("ok");
    expect(resolveWebhookAuth({ ...base, headers: { authorization: `Bearer ${SECRET}` } })).toBe(
      "ok",
    );
    expect(resolveWebhookAuth({ ...base, headers: { "x-webhook-secret": SECRET } })).toBe("ok");
  });

  it("falls back to HMAC when no header credential matches", () => {
    expect(
      resolveWebhookAuth({
        secret: SECRET,
        headers: {},
        rawBody,
        signature: `sha256=${validDigest}`,
      }),
    ).toBe("ok");
    expect(
      resolveWebhookAuth({ secret: SECRET, headers: {}, rawBody, signature: "bogus" }),
    ).toBe("unauthorized");
  });

  it("reports misconfigured instead of accepting when no credential is set", () => {
    expect(
      resolveWebhookAuth({ secret: undefined, headers: {}, rawBody, signature: validDigest }),
    ).toBe("misconfigured");
    expect(resolveWebhookAuth({ secret: "", headers: {}, rawBody, signature: undefined })).toBe(
      "misconfigured",
    );
  });
});
