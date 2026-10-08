import { countDuplicateCandidates, normalizeImportDate, normalizeImportRows, normalizePhoneForStorage, normalizePhoneKey, parseCrmWorkbook } from "./crmImport";

describe("CRM import normalization", () => {
  it("accepts the reference CRM headers and normalizes contact fields", () => {
    const rows = normalizeImportRows(
      ["CLIENTE", "RESPONSÁVEL", "E-MAIL", "TELEFONE", "Tem WhatsApp?", "ÚLTIMO CONTATO"],
      [[" Acme  Ltda ", " Ana Silva ", "ANA@ACME.COM ", "(11) 99999-0000", "sim", "18/09/2026"]],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      rowNumber: 2,
      companyName: "Acme Ltda",
      contactName: "Ana Silva",
      email: "ana@acme.com",
      phone: "(11) 99999-0000",
      hasWhatsapp: true,
      errors: [],
    });
    expect(rows[0].lastContactAt).toBe("2026-09-18T03:00:00.000Z");
  });

  it("reports actionable row errors without discarding the row", () => {
    const [row] = normalizeImportRows(
      ["Empresa", "Nome do contato", "E-mail", "Telefone"],
      [["", "", "not-an-email", "123"]],
    );

    expect(row.errors).toEqual(expect.arrayContaining([
      "Empresa não informada",
      "Nome do contato não informado",
      "E-mail inválido",
      "Telefone inválido",
    ]));
  });

  it("parses a CSV workbook through the same path used for Excel files", () => {
    const workbook = parseCrmWorkbook(Buffer.from("Empresa,Nome do contato,E-mail\nAcme,Ana,ana@acme.com\n"), "contatos.csv");
    expect(workbook.rows[0]).toMatchObject({ companyName: "Acme", contactName: "Ana", email: "ana@acme.com" });
  });

  it("supports Excel serial dates", () => {
    expect(normalizeImportDate(45918)).toBe("2025-09-18T00:00:00.000Z");
  });

  it("stores imported Brazilian numbers canonically and matches country-code variants", () => {
    expect(normalizePhoneForStorage("(47) 3301.8038")).toBe("+554733018038");
    expect(normalizePhoneForStorage("+55 (31) 98744-5452")).toBe("+5531987445452");
    expect(normalizePhoneKey("+55 (31) 98744-5452")).toBe(normalizePhoneKey("31 98744-5452"));
  });

  it("counts repeated contact identities while preserving source row numbers", () => {
    const rows = normalizeImportRows(
      ["Empresa", "Nome do contato", "E-mail"],
      [["", "", ""], ["Acme", "Ana", "ana@acme.com"], ["Acme", "Ana", "ana@acme.com"]],
    );
    expect(rows.map((row) => row.rowNumber)).toEqual([3, 4]);
    expect(countDuplicateCandidates(rows)).toBe(1);
  });
});
