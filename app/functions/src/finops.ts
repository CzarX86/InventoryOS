import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";

interface AiRun {
  status: string;
  actualCostUsd?: number;
  estimatedCostUsd?: number;
  actualTotalTokenCount?: number;
  estimatedTotalTokens?: number;
  taskType?: string;
}

/**
 * Aggregates AI Usage into monthly summaries.
 * This makes the dashboard extremely cheap and fast.
 */
export const aggregateAiUsage = onDocumentWritten("ai_runs/{runId}", async (event: any) => {
  const db = getFirestore();
  const before = event.data?.before?.data() as AiRun | undefined;
  const after = event.data?.after?.data() as AiRun | undefined;

  // We only care if the run was completed just now
  if (!after || after.status !== "completed" || (before && before.status === "completed")) {
    return;
  }

  const cost = after.actualCostUsd || after.estimatedCostUsd || 0;
  const tokens = after.actualTotalTokenCount || after.estimatedTotalTokens || 0;
  
  // Use YYYYMM format for the summary document
  const date = new Date();
  const monthKey = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  const summaryRef = db.collection("system_usage").doc(`ai_usage_summary_${monthKey}`);

  try {
    const taskType = after.taskType || 'unknown';
    
    await summaryRef.set({
      month: monthKey,
      totalCostUsd: FieldValue.increment(cost),
      totalTokens: FieldValue.increment(tokens),
      totalRequests: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      lastRunId: event.params.runId,
      // Track top task type costs
      tasks: {
        [taskType]: {
            cost: FieldValue.increment(cost),
            count: FieldValue.increment(1)
        }
      }
    }, { merge: true });
    
    logger.info("Usage aggregated successfully", { monthKey, runId: event.params.runId });
  } catch (error: any) {
    logger.error("Usage aggregation failed", { error: error.message, runId: event.params.runId });
  }
});

/**
 * Checks if the AI budget for the current month has been exceeded.
 * Defaults to $10.00 USD if not configured in system/config.
 */
export async function checkAiBudget(): Promise<{ exceeded: boolean; currentCost: number; limit: number }> {
    const db = getFirestore();
    const date = new Date();
    const monthKey = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // 1. Get current month spend
    const summaryRef = db.collection("system_usage").doc(`ai_usage_summary_${monthKey}`);
    const summaryDoc = await summaryRef.get();
    const currentCost = summaryDoc.exists ? (summaryDoc.data()?.totalCostUsd || 0) : 0;

    // 2. Get budget limit from config
    const configRef = db.collection("system").doc("config");
    const configDoc = await configRef.get();
    const limit = configDoc.exists ? (configDoc.data()?.aiMonthlyBudgetLimitUsd || 10.0) : 10.0;

    return {
        exceeded: currentCost >= limit,
        currentCost,
        limit
    };
}
