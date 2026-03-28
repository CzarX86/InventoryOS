import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { planAiTask, executeAiTask } from "./aiTaskPlanner";
import { CONTACT_CLASSIFICATION_PROMPT } from "./contactClassificationPrompt";

/**
 * Strategy to classify pending WhatsApp contacts/groups.
 * Picks contacts in 'pending_review' status with recent messages and runs AI classification.
 */
export async function processPendingContactClassifications() {
  const db = getFirestore();
  
  // 1. Fetch contacts/groups in 'pending_review' status
  // We'll check both collections
  const contactsSnap = await db.collection("whatsapp_contacts")
    .where("monitoringStatus", "==", "pending_review")
    .orderBy("lastMessageAt", "desc")
    .limit(10)
    .get();
    
  const groupsSnap = await db.collection("whatsapp_groups")
    .where("monitoringStatus", "==", "pending_review")
    .orderBy("lastMessageAt", "desc")
    .limit(10)
    .get();

  const allPending = [
    ...contactsSnap.docs.map(doc => ({ id: doc.id, collection: "whatsapp_contacts", ...doc.data() })),
    ...groupsSnap.docs.map(doc => ({ id: doc.id, collection: "whatsapp_groups", ...doc.data() }))
  ].sort((a: any, b: any) => {
    const timeA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
    const timeB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
    return timeB - timeA;
  }).slice(0, 10);

  if (allPending.length === 0) {
    logger.info("No pending contacts for AI classification");
    return { count: 0 };
  }

  let processedCount = 0;

  for (const item of allPending) {
    try {
      // 2. Fetch the last 10 messages for context
      const messagesSnap = await db.collection("whatsapp_messages")
        .where("remoteJid", "==", item.id)
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      if (messagesSnap.empty) {
        logger.info("Skipping classification: No messages found for contact", { contactId: item.id });
        continue;
      }

      const messages = messagesSnap.docs.map(doc => doc.data()).reverse();
      const combinedText = messages.map(m => `[${m.pushName || 'User'}]: ${m.text}`).join("\n");

      // 3. Plan and Execute AI Task
      const plan = await planAiTask(
        "contact_classification",
        item.id,
        {
          targetType: item.collection === "whatsapp_groups" ? "whatsapp_group" : "whatsapp_contact",
          metadata: { messageCount: messages.length, combinedText }
        }
      );

      const prompt = CONTACT_CLASSIFICATION_PROMPT.replace("{{messageText}}", combinedText);
      const runResult = await executeAiTask(plan, prompt);

      if (runResult.status !== "completed") {
        throw new Error(runResult.errorMessage || "Classification AI failed");
      }

      const result = runResult.output; // { classification, confidence, summary }

      // 4. Update the contact/group with the insight
      await db.collection(item.collection).doc(item.id).update({
        aiClassification: result.classification || "unknown",
        confidenceScore: result.confidence || 0,
        aiInsightSummary: result.summary || null,
        classificationRunId: runResult.runId,
        updatedAt: FieldValue.serverTimestamp()
      });

      processedCount++;
      logger.info("Contact classified successfully", { 
        contactId: item.id, 
        classification: result.classification,
        confidence: result.confidence
      });

    } catch (error: any) {
      logger.error("Error classifying contact", { contactId: item.id, error: error.message });
    }
  }

  return { count: processedCount };
}
