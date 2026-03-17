import { db } from './firebase';
import { collection, addDoc, serverTimestamp, increment, doc, setDoc } from 'firebase/firestore';

/**
 * Log AI usage for telemetry and cost control
 * @param {string} userId 
 * @param {string} type - 'IMAGE_OCR' or 'VOICE_COMMAND'
 * @param {object} metadata - Any additional info (model, estimated tokens)
 */
export async function logAIUsage(userId, type, metadata = {}) {
  if (!db) return;

  try {
    // 1. Log detailed transaction
    await addDoc(collection(db, "telemetry"), {
      userId,
      type,
      metadata,
      timestamp: serverTimestamp()
    });

    // 2. Update aggregate usage for the user (for admin stats)
    const statsRef = doc(db, "usage_stats", userId);
    await setDoc(statsRef, {
      totalRequests: increment(1),
      lastActive: serverTimestamp(),
      [`usageBy_${type}`]: increment(1)
    }, { merge: true });

    // 3. Update global system health
    const systemRef = doc(db, "system", "health");
    await setDoc(systemRef, {
      totalAIRequests: increment(1),
      lastRequestAt: serverTimestamp()
    }, { merge: true });

  } catch (error) {
    console.error("Telemetry logging failed:", error);
  }
}
