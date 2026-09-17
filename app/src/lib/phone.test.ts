import { buildWhatsappRemoteJid, normalizePhoneDigits } from "./phone";

describe("phone helpers", () => {
  it("normalizes Brazilian numbers with or without country code", () => {
    expect(normalizePhoneDigits("(11) 99999-9999")).toBe("5511999999999");
    expect(normalizePhoneDigits("+55 11 99999-9999")).toBe("5511999999999");
    expect(normalizePhoneDigits("0055 11 99999-9999")).toBe("5511999999999");
  });

  it("builds the internal WhatsApp identifier without exposing it in the form", () => {
    expect(buildWhatsappRemoteJid("(11) 99999-9999")).toBe("5511999999999@s.whatsapp.net");
    expect(buildWhatsappRemoteJid("")).toBeNull();
  });
});
