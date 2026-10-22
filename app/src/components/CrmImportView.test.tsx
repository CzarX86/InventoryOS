import { formatJobStatus, visibleImportErrors } from "./CrmImportView";

function makeRow(rowNumber: number) {
  return {
    rowNumber,
    companyName: `Empresa ${rowNumber}`,
    contactName: `Contato ${rowNumber}`,
    email: "",
    phone: "",
    errors: [`Erro ${rowNumber}`],
  };
}

describe("formatJobStatus", () => {
  it("labels known import job states in Portuguese", () => {
    expect(formatJobStatus("completed")).toBe("Concluída");
    expect(formatJobStatus("partial")).toBe("Parcial");
    expect(formatJobStatus("awaiting_upload")).toBe("Aguardando");
  });

  it("falls back to a generic label for unknown states", () => {
    expect(formatJobStatus("mysterious")).toBe("Em análise");
    expect(formatJobStatus(undefined)).toBe("Em análise");
  });
});

describe("visibleImportErrors", () => {
  it("shows only the first rows while collapsed and reports the remainder", () => {
    const errors = [1, 2, 3, 4, 5, 6, 7].map(makeRow);
    const result = visibleImportErrors(errors, false);
    expect(result.visible.map((row) => row.rowNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(result.remaining).toBe(2);
    expect(result.total).toBe(7);
  });

  it("shows the full error list once expanded", () => {
    const errors = [1, 2, 3, 4, 5, 6, 7].map(makeRow);
    const result = visibleImportErrors(errors, true);
    expect(result.visible).toHaveLength(7);
    expect(result.remaining).toBe(0);
    expect(result.total).toBe(7);
  });

  it("handles short lists without a remainder", () => {
    const errors = [1, 2].map(makeRow);
    const result = visibleImportErrors(errors, false);
    expect(result.visible).toHaveLength(2);
    expect(result.remaining).toBe(0);
  });
});
