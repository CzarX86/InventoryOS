import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createLogger } from "./logger";

export interface AuditEntry {
  action: string;
  category: "security" | "finops" | "data" | "system";
  actorId: string; // User ID or 'system'
  targetId?: string; // e.g. record ID
  details: any;
  severity: "info" | "warning" | "critical";
  timestamp?: any;
}

/**
 * Persists critical actions to an immutable audit trail.
 */
export async function logAudit(entry: AuditEntry) {
  const db = getFirestore();
  const logger = createLogger({ correlationId: `audit_${Date.now()}` });

  try {
    const auditRef = db.collection("system_audit_logs").doc();
    const fullEntry = {
      ...entry,
      timestamp: FieldValue.serverTimestamp(),
    };

    await auditRef.set(fullEntry);
    
    // Also mirror to structured logs for real-time monitoring
    if (entry.severity === "critical") {
      logger.error(`AUDIT [${entry.category.toUpperCase()}] ${entry.action}`, null, entry.details);
    } else {
      logger.info(`AUDIT [${entry.category.toUpperCase()}] ${entry.action}`, entry.details);
    }
  } catch (error: any) {
    logger.error("Audit logging failed", error);
  }
}
