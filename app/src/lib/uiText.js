export const INVENTORY_STATUS_LABELS = {
  "IN STOCK": "EM ESTOQUE",
  SOLD: "VENDIDO",
  REPAIR: "EM REPARO",
  RESERVED: "RESERVADO",
};

export const ACTION_STAGE_LABELS = {
  new: "NOVA",
  qualified: "QUALIFICADA",
  proposal: "PROPOSTA",
  negotiation: "NEGOCIAÇÃO",
  closed_won: "GANHA",
  closed_lost: "PERDIDA",
};

export const ACTION_STATUS_LABELS = {
  pending: "PENDENTE",
  in_progress: "EM ANDAMENTO",
  completed: "CONCLUÍDA",
  cancelled: "CANCELADA",
};

export const CRM_CHANNEL_LABELS = {
  phone: "LIGAÇÃO",
  whatsapp: "WHATSAPP",
  email: "E-MAIL",
  meeting: "REUNIÃO",
  other: "OUTRO",
};

export const CRM_RELATION_LABELS = {
  installed: "INSTALADO",
  interest: "INTERESSE",
};

export const WHATSAPP_EVENT_STATUS_LABELS = {
  processed: "PROCESSADO",
  failed: "FALHOU",
  received: "RECEBIDO",
};

export const AI_STATUS_LABELS = {
  processed: "PROCESSADO",
  failed: "FALHOU",
  unprocessed: "NÃO PROCESSADO",
  extracted: "EXTRAÍDO",
  queue_active: "NA FILA",
  professional: "COMERCIAL",
  personal: "PESSOAL",
};

export const TASK_TYPE_LABELS = {
  NEW_PRODUCT: "NOVO_ITEM",
  IMAGE_OCR: "LEITURA_OCR",
  VOICE_SEARCH: "BUSCA_POR_VOZ",
  VOICE_SEARCH_CAPTURE: "CAPTURA_DE_BUSCA_POR_VOZ",
  contact_digest: "RESUMO_DE_CONTATO",
};

export const ERROR_ACTION_LABELS = {
  IMAGE_EXTRACTION: "EXTRAÇÃO_DE_IMAGEM",
  AUDIO_REGISTRATION_CAPTURE: "CAPTURA_DE_ÁUDIO",
  SAVE_ITEM: "SALVAR_ITEM",
  UPDATE_ITEM: "ATUALIZAR_ITEM",
  DELETE_ITEM: "EXCLUIR_ITEM",
};

export function uiLabel(value, labels = {}) {
  if (value == null || value === "") return "—";
  const key = String(value);
  return labels[key] || labels[key.toLowerCase()] || key.replaceAll("_", " ").toUpperCase();
}
