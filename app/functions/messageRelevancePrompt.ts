/**
 * Prompt for classifying message relevance in a business context.
 * Used to filter noise from professional interaction streams.
 */
export const MESSAGE_RELEVANCE_PROMPT = `
Analyze the following WhatsApp conversation chunk.
Classify each chunk or the entire sequence as one of:
- COMMERCIAL: Directly related to sales, quotes, inventory, or item availability.
- OPERATIONAL: Related to logistics, technical support, payment confirmation, or scheduled service.
- PERSONAL: Casual conversation, family topics, jokes, or non-business social interaction.
- IRRELEVANT: Pure greetings (e.g. "Oi", "Tudo bem?") without further context, spam, or one-word messages without meaning.

Rules:
1. "Quanto custa o sensor X?" -> COMMERCIAL
2. "Preciso de 10 unidades para amanhã." -> COMMERCIAL
3. "O técnico já saiu para a entrega?" -> OPERATIONAL
4. "O boleto já foi pago." -> OPERATIONAL
5. "Como foi seu final de semana?" -> PERSONAL
6. "Oi" (isolated) -> IRRELEVANT

Return ONLY a JSON object with the following structure:
{
  "relevance": "commercial" | "operational" | "personal" | "irrelevant",
  "confidence": number (0-1),
  "summary": "Short explanation (e.g., 'Discussing stock availability', 'Casual greeting only')"
}

Conversation Chunk:
"{{messageText}}"
`;
