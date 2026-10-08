import { getCrmSaveErrorMessage } from "./crmSaveErrors";

describe("getCrmSaveErrorMessage", () => {
  it("explains permission failures and gives the user a next step", () => {
    expect(getCrmSaveErrorMessage({ code: "permission-denied" })).toBe(
      "Sua conta não tem permissão para editar este cadastro. Confira se está conectada ao workspace correto ou peça ao administrador para revisar seu acesso.",
    );
  });

  it("normalizes Firebase product prefixes", () => {
    expect(getCrmSaveErrorMessage({ code: "firestore/unavailable" })).toBe(
      "O banco de dados está temporariamente indisponível. Verifique sua conexão e tente novamente.",
    );
  });

  it("gives actionable guidance for missing Firestore configuration", () => {
    expect(getCrmSaveErrorMessage({ code: "failed-precondition" })).toBe(
      "O banco de dados recusou o salvamento por uma configuração pendente. Peça ao administrador para revisar a configuração do Firestore.",
    );
  });

  it("does not expose raw internal messages and includes a safe code for unknown failures", () => {
    expect(getCrmSaveErrorMessage({ code: "internal", message: "private database detail" })).toBe(
      "Ocorreu um erro inesperado ao salvar o contato (código: internal). Tente novamente; se persistir, informe esse código ao suporte.",
    );
  });

  it("uses a safe fallback when no Firebase code is available", () => {
    expect(getCrmSaveErrorMessage(new Error("private database detail"))).toBe(
      "Ocorreu um erro inesperado ao salvar o contato. Atualize a tela e tente novamente; se persistir, avise o suporte.",
    );
  });
});
