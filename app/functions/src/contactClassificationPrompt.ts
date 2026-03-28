/**
 * Prompt for classifying a WhatsApp contact based on message history.
 * Helps determine if a contact is Professional (Commercial) or Personal.
 */
export const CONTACT_CLASSIFICATION_PROMPT = `
Analyze the following WhatsApp message history for a single contact/group.
Classify whether this contact is Professional/Commercial (related to business, orders, technical support, inventory, or sales) or Personal (friends, family, casual talk, off-topic).

Rules:
1. Professional: Mentions of items, quantities, prices, orders, technical specifications, "vendi", "comprei", "chegou", "orçamento", "cliente", "serviço".
2. Personal: Daily life, family, jokes, purely social greetings without business context, explicit personal relationship markers.
3. Unknown: Initial greetings only (e.g., just "Oi", "Tudo bem?") or insufficient context to decide.

Return ONLY a JSON object with the following structure:
{
  "classification": "professional" | "personal" | "unknown",
  "confidence": number (0-1),
  "summary": "Short explanation of why it was classified this way (e.g., 'Discussing hardware prices', 'Casual greeting only', 'Family matter')"
}

Message History:
"{{messageText}}"
`;
