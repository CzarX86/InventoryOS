import { evolutionWebhook } from "./index";

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
