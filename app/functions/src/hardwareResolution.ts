import { db, FieldValue } from "./lib/firebase";
import { HARDWARE_COLLECTIONS, createInstalledBaseRecord } from "./hardwareDomain";
import * as logger from "./lib/logger";

/**
 * Resolves a natural language hardware mention to a specific catalog item.
 * Searches by model, part number, or brand.
 */
export async function resolveHardwareMention(mention: string, brandHint?: string) {
  if (!mention) return null;

  const normalizedMention = mention.trim().toUpperCase();
  const normalizedBrand = brandHint?.trim().toUpperCase();

  // 1. Try exact match by part number
  const pnSnap = await db.collection(HARDWARE_COLLECTIONS.catalogItems)
    .where("partNumber", "==", normalizedMention)
    .limit(1)
    .get();

  if (!pnSnap.empty) return { id: pnSnap.docs[0].id, ...pnSnap.docs[0].data(), matchType: "exact_pn" };

  // 2. Try exact match by model
  const modelSnap = await db.collection(HARDWARE_COLLECTIONS.catalogItems)
    .where("model", "==", normalizedMention)
    .limit(1)
    .get();

  if (!modelSnap.empty) return { id: modelSnap.docs[0].id, ...modelSnap.docs[0].data(), matchType: "exact_model" };

  // 3. Fuzzier match: Look for mentions containing the string
  // Note: Firestore doesn't support full-text search directly without indexes or 3rd party, 
  // but for small catalogs we can do prefix or wait for better implementation.
  // For now, we will stick to exact or specialized logic.
  
  return null; 
}

/**
 * Processes identified interests and updates the Installed Base (inferred assets).
 */
export async function processHardwareInterests(interests: any[], context: { remoteJid: string, aiRunId: string, ownership: any }) {
  if (!interests || interests.length === 0) return [];

  const results = [];
  const batch = db.batch();

  for (const interest of interests) {
    const resolved = await resolveHardwareMention(interest.name);
    
    if (resolved) {
      // Create an entry in the installed base (inferred)
      const installedRef = db.collection(HARDWARE_COLLECTIONS.installedBase).doc();
      const installedRecord = createInstalledBaseRecord({
        catalogItemId: resolved.id,
        crmContactId: context.remoteJid, // Link to whatsapp contact
        confidence: interest.confidence || 0.8,
        source: "ai_inferred",
        observedAt: FieldValue.serverTimestamp(),
        metadata: {
          aiRunId: context.aiRunId,
          originalMention: interest.name,
          matchType: resolved.matchType
        }
      }, context.ownership);

      batch.set(installedRef, installedRecord);
      results.push({ interest: interest.name, resolvedId: resolved.id });
    } else {
      logger.info("Could not resolve hardware interest to catalog", { mention: interest.name });
    }
  }

  if (results.length > 0) {
    await batch.commit();
  }

  return results;
}
