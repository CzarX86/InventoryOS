const CRM_SAVE_ERROR_MESSAGES: Record<string, string> = {
  "permission-denied":
    "Sua conta não tem permissão para editar este cadastro. Confira se está conectada ao workspace correto ou peça ao administrador para revisar seu acesso.",
  unauthenticated:
    "Sua sessão expirou. Entre novamente e tente salvar o cadastro.",
  unavailable:
    "O banco de dados está temporariamente indisponível. Verifique sua conexão e tente novamente.",
  "network-request-failed":
    "Não foi possível conectar ao banco de dados. Verifique sua internet e tente novamente.",
  "deadline-exceeded":
    "O salvamento demorou mais que o esperado e não foi confirmado. Verifique sua conexão, atualize o cadastro e tente novamente.",
  "not-found":
    "O contato ou a empresa não foi encontrado. Atualize a tela e abra o cadastro novamente.",
  "failed-precondition":
    "O banco de dados recusou o salvamento por uma configuração pendente. Peça ao administrador para revisar a configuração do Firestore.",
  "invalid-argument":
    "O banco de dados recusou algum dado preenchido. Revise os campos do cadastro e tente novamente.",
  "resource-exhausted":
    "O limite de gravações foi atingido temporariamente. Aguarde alguns minutos e tente novamente.",
  aborted:
    "A gravação foi interrompida porque o cadastro mudou durante o salvamento. Atualize a tela e tente novamente.",
};

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";

  const errorWithCode = error as { code?: unknown; cause?: unknown };
  const cause = errorWithCode.cause && typeof errorWithCode.cause === "object"
    ? errorWithCode.cause as { code?: unknown }
    : null;
  const rawCode = typeof errorWithCode.code === "string"
    ? errorWithCode.code
    : typeof cause?.code === "string"
      ? cause.code
      : "";

  return rawCode.trim().toLowerCase().split("/").pop() || "";
}

export function getCrmSaveErrorMessage(error: unknown): string {
  const code = getErrorCode(error);
  const message = CRM_SAVE_ERROR_MESSAGES[code];
  if (message) return message;

  if (/^[a-z0-9-]{1,64}$/.test(code)) {
    return `Ocorreu um erro inesperado ao salvar o contato (código: ${code}). Tente novamente; se persistir, informe esse código ao suporte.`;
  }

  return "Ocorreu um erro inesperado ao salvar o contato. Atualize a tela e tente novamente; se persistir, avise o suporte.";
}
