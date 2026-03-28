/**
 * Expanded Unified Prompt for extracting all CRM entities and inventory transactions from WhatsApp.
 * Handles Conversations -> Opportunities, Tasks, Events, and Transactions.
 */
export const UNIFIED_BUSINESS_EXTRACTION_PROMPT = `
Analyze the following WhatsApp conversation chunk and extract all relevant business entities.
Extract data for:
1. Inventory Transactions (BUY/SELL of items).
2. CRM Opportunities (new sales potential, quotes requested, projects).
3. Tasks (follow-ups, send files, schedule meetings, delivery).
4. CRM Events (milestones reached, confirmations, cancellations).
5. Hardware Interests (specific products or categories the contact is interested in).

Rules:
- "Quanto custa o sensor X?" -> CRM Opportunity ("Project: Sensor X Query"), Interest ("Sensor X"), Task ("Follow up with pricing").
- "Vendi 10 unidades." -> Inventory Transaction (SELL).
- "Mando o orçamento amanhã." -> Task ("Send quote").
- "O orçamento foi aprovado." -> CRM Event ("Quote approved"), Opportunity stage update.

Return ONLY a JSON object with this structure:
{
  "isConversationComplete": boolean,
  "completenessReason": "string",
  "summary": "Short overview of the interaction",
  "confidence": number (0-1),
  
  "inventoryTransactions": [
    {
      "operation": "BUY" | "SELL",
      "items": [{ "name": "string", "quantity": number, "unitPrice": number, "total": number }],
      "grandTotal": number
    }
  ],
  
  "opportunities": [
    {
      "title": "string",
      "stage": "new" | "negotiation" | "won" | "lost",
      "estimatedValue": number | null,
      "currency": "BRL"
    }
  ],
  
  "tasks": [
    {
      "title": "string",
      "taskType": "follow_up" | "quote" | "delivery" | "other",
      "status": "pending",
      "dueDaysFromNow": number | null
    }
  ],
  
  "events": [
    {
      "eventType": "confirmation" | "cancellation" | "milestone" | "other",
      "summary": "string"
    }
  ],

  "interests": [
    {
      "catalogItemId": "string (name of item)",
      "interestType": "hardware",
      "confidence": number
    }
  ]
}

Conversation Chunk:
"{{messageText}}"
`;
