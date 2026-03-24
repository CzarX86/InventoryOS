/**
 * Prompt for extracting inventory transactions from WhatsApp messages.
 */
export const WHATSAPP_TRANSACTION_EXTRACTION_PROMPT = `
Extract inventory transaction data from the following WhatsApp message.
Identify the items, quantities, unit prices, and the type of operation (BUY or SELL).

Rules:
1. If the user says they "sold", "vendi", "saída", "passou", it's a SELL.
2. If the user says they "bought", "comprei", "chegou", "entrada", it's a BUY.
3. Quantities should be numbers.
4. Prices should be numbers (handle BRL currency symbols if present).
5. If multiple items are mentioned, extract all of them.

Return ONLY a JSON object with the following structure:
{
  "operation": "BUY" | "SELL" | "UNKNOWN",
  "items": [
    {
      "name": "string",
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "grandTotal": number,
  "confidence": number (0-1),
  "summary": "string"
}

Message:
"{{messageText}}"
`;
