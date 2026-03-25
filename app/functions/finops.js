const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

/**
 * Aggregates AI Usage into monthly summaries.
 * This makes the dashboard extremely cheap and fast.
 */
exports.aggregateAiUsage = onDocumentWritten("ai_runs/{runId}", async (event) => {
  const db = getFirestore();
  const before = event.data.before?.data();
  const after = event.data.after?.data();

  // We only care if the run was completed just now
  if (after?.status !== "completed" || before?.status === "completed") {
    return;
  }

  const cost = after.actualCostUsd || after.estimatedCostUsd || 0;
  const tokens = after.actualTotalTokenCount || after.estimatedTotalTokens || 0;
  
  // Use YYYYMM format for the summary document
  const date = new Date();
  const monthKey = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  const summaryRef = db.collection("system_usage").doc(`ai_usage_summary_${monthKey}`);

  try {
    await summaryRef.set({
      month: monthKey,
      totalCostUsd: FieldValue.increment(cost),
      totalTokens: FieldValue.increment(tokens),
      totalRequests: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
      lastRunId: event.params.runId,
      // Track top task type costs
      [`tasks.${after.taskType || 'unknown'}.cost`]: FieldValue.increment(cost),
      [`tasks.${after.taskType || 'unknown'}.count`]: FieldValue.increment(1),
    }, { merge: true });
    
    logger.info("Usage aggregated successfully", { monthKey, runId: event.params.runId });
  } catch (error) {
    logger.error("Usage aggregation failed", { error: error.message, runId: event.params.runId });
  }
});
