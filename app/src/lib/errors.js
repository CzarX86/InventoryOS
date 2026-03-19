function normalizeMessage(error) {
  return String(
    error?.userMessage ||
    error?.message ||
    error?.statusText ||
    error?.details ||
    error?.cause?.message ||
    ""
  ).toLowerCase();
}

function normalizeStatus(error) {
  return Number(error?.status || error?.httpStatus || 0) || 0;
}

function normalizeCode(error) {
  return String(error?.code || error?.cause?.code || "").toLowerCase();
}

function buildDescription({
  humanMessage,
  knownReason = null,
  userActions = [],
  category = "internal",
  severity = "error",
  errorCode = null,
  httpStatus = null,
}) {
  return {
    humanMessage,
    knownReason,
    userActions,
    category,
    severity,
    errorCode,
    httpStatus,
  };
}

export function describeAppError(error, context = "generic") {
  const message = normalizeMessage(error);
  const status = normalizeStatus(error);
  const code = normalizeCode(error) || null;

  if (
    status === 429 ||
    message.includes("resource_exhausted") ||
    message.includes("quota") ||
    message.includes("credit") ||
    message.includes("billing") ||
    message.includes("rate limit")
  ) {
    return buildDescription({
      humanMessage: "A IA esta indisponivel no momento porque o limite de uso da API foi atingido.",
      knownReason: "O servico de IA ficou sem credito ou atingiu a cota configurada.",
      userActions: [
        "Tente novamente mais tarde.",
        "Se o problema continuar, envie o log para o suporte tecnico.",
      ],
      category: "ai_quota",
      severity: "high",
      errorCode: code || "resource_exhausted",
      httpStatus: status || 429,
    });
  }

  if (
    status === 401 ||
    status === 403 ||
    message.includes("api key") ||
    message.includes("permission denied") ||
    message.includes("unauthorized") ||
    message.includes("forbidden")
  ) {
    return buildDescription({
      humanMessage: "A integracao da IA nao esta autorizada no momento.",
      knownReason: "A chave da API ou as permissoes do servico parecem invalidas.",
      userActions: [
        "Tente novamente mais tarde.",
        "Avise o administrador ou envie o log para suporte.",
      ],
      category: "ai_auth",
      severity: "high",
      errorCode: code || "unauthorized",
      httpStatus: status || null,
    });
  }

  if (
    message.includes("network") ||
    message.includes("fetch") ||
    message.includes("timeout") ||
    message.includes("offline")
  ) {
    return buildDescription({
      humanMessage: "Nao foi possivel conectar ao servico agora.",
      knownReason: "Falha de rede ou indisponibilidade temporaria da conexao.",
      userActions: [
        "Verifique sua conexao com a internet.",
        "Tente novamente em alguns instantes.",
      ],
      category: "network",
      severity: "medium",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (
    message.includes("notallowederror") ||
    message.includes("permission denied") ||
    message.includes("microphone")
  ) {
    return buildDescription({
      humanMessage: "O acesso ao microfone foi bloqueado.",
      knownReason: "O navegador nao liberou a permissao de uso do microfone.",
      userActions: [
        "Libere a permissao do microfone no navegador.",
        "Recarregue a pagina e tente novamente.",
      ],
      category: "permission",
      severity: "medium",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (
    message.includes("notfounderror") ||
    message.includes("no device found") ||
    message.includes("device not found")
  ) {
    return buildDescription({
      humanMessage: "Nenhum microfone foi encontrado neste dispositivo.",
      knownReason: "O navegador nao encontrou um dispositivo de audio disponivel.",
      userActions: [
        "Conecte um microfone e tente novamente.",
        "Verifique se o microfone esta reconhecido pelo sistema operacional.",
      ],
      category: "device",
      severity: "medium",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (context === "image") {
    return buildDescription({
      humanMessage: "Nao foi possivel extrair os dados da imagem.",
      knownReason: "A IA nao conseguiu interpretar a foto enviada.",
      userActions: [
        "Tente outra foto mais nitida, reta e com boa iluminacao.",
        "Se preferir, preencha os campos manualmente.",
      ],
      category: "ai_extraction",
      severity: "medium",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (context === "audio-registration") {
    return buildDescription({
      humanMessage: "Nao foi possivel interpretar o audio do cadastro.",
      knownReason: "A IA nao conseguiu transformar o audio em dados estruturados.",
      userActions: [
        "Grave novamente falando mais pausadamente.",
        "Se preferir, preencha os dados manualmente.",
      ],
      category: "ai_extraction",
      severity: "medium",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (context === "audio-search") {
    return buildDescription({
      humanMessage: "Nao foi possivel processar sua busca por voz agora.",
      knownReason: "A fala nao foi convertida em uma busca valida.",
      userActions: [
        "Tente novamente falando modelo, marca ou part number.",
        "Se preferir, use a busca digitada.",
      ],
      category: "ai_extraction",
      severity: "medium",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (context === "save-item") {
    return buildDescription({
      humanMessage: "Nao foi possivel salvar o item agora.",
      knownReason: "O cadastro falhou durante o envio de dados ou arquivos.",
      userActions: [
        "Tente novamente em alguns instantes.",
        "Verifique se sua conexao esta estavel.",
      ],
      category: "persistence",
      severity: "high",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (context === "delete-item") {
    return buildDescription({
      humanMessage: "Nao foi possivel excluir o item agora.",
      knownReason: "A exclusao falhou ao sincronizar com o banco de dados.",
      userActions: [
        "Tente novamente em alguns instantes.",
        "Atualize a tela se o item ficar inconsistente.",
      ],
      category: "persistence",
      severity: "medium",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  if (context === "inventory-sync") {
    return buildDescription({
      humanMessage: "Nao foi possivel sincronizar o inventario agora.",
      knownReason: "A aplicacao perdeu a sincronizacao com o Firebase.",
      userActions: [
        "Verifique sua conexao com a internet.",
        "Atualize a pagina para restabelecer a sincronizacao.",
      ],
      category: "sync",
      severity: "high",
      errorCode: code || null,
      httpStatus: status || null,
    });
  }

  return buildDescription({
    humanMessage: "Ocorreu um erro interno ao processar a solicitacao.",
    knownReason: "O sistema encontrou uma falha inesperada.",
    userActions: [
      "Tente novamente em alguns instantes.",
      "Se o erro persistir, envie o log para suporte.",
    ],
    category: "internal",
    severity: "medium",
    errorCode: code || null,
    httpStatus: status || null,
  });
}

export function humanizeAIError(error, context = "generic") {
  return describeAppError(error, context).humanMessage;
}

export function humanizeMicrophoneError(error) {
  return describeAppError(error, "microphone").humanMessage;
}
