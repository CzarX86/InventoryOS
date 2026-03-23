import { applyOwnershipContext } from "@/lib/ownership";

export const AI_RUN_COLLECTIONS = Object.freeze({
  aiRuns: "ai_runs",
  aiCostPolicies: "ai_cost_policies",
  promptTemplates: "prompt_templates",
  styleProfiles: "style_profiles",
});

import { db } from "./firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  increment 
} from "firebase/firestore";

export const AI_RUNS_COLLECTION = "ai_runs";
export const AI_STATS_COLLECTION = "ai_usage_stats";

/**
 * Saves a planned AI run to Firestore.
 */
export async function saveAiRun(runRecord) {
  if (!db) return runRecord;
  
  const runRef = doc(collection(db, AI_RUNS_COLLECTION));
  const recordWithId = { 
    ...runRecord, 
    id: runRef.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  await setDoc(runRef, recordWithId);
  return recordWithId;
}

/**
 * Updates an AI run (e.g. after execution).
 */
export async function updateAiRun(runId, updates) {
  if (!db) return;
  
  const runRef = doc(db, AI_RUNS_COLLECTION, runId);
  
  let finalUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  // Auto-calculate cost if usage and model are provided
  if (updates.actualUsage && updates.model) {
    const { getModelPricing } = await import("./modelRouter");
    const pricing = getModelPricing(updates.model);
    const costDetails = estimateAiRunCost({
      estimatedInputTokens: updates.actualUsage.promptTokenCount,
      estimatedOutputTokens: updates.actualUsage.candidatesTokenCount,
      estimatedCachedTokens: updates.actualUsage.cachedContentTokenCount,
      pricing
    });
    
    finalUpdates.actualCostUsd = costDetails.estimatedCostUsd;
    finalUpdates.actualPromptTokenCount = costDetails.estimatedInputTokens;
    finalUpdates.actualCandidatesTokenCount = costDetails.estimatedOutputTokens;
    finalUpdates.actualTotalTokenCount = costDetails.estimatedTotalTokens;
  }
  
  await updateDoc(runRef, finalUpdates);
  
  // If completed, update aggregate stats
  if (updates.status === "completed" && updates.actualUsage) {
    await updateAiStats(updates.ownerId || updates.accountId, updates.actualUsage, updates.model, finalUpdates.actualCostUsd);
  }
}

/**
 * Updates aggregate usage statistics for an account.
 */
async function updateAiStats(accountId, usage, modelName = "unknown", costUsd = 0) {
  if (!db || !accountId) return;
  
  const statsRef = doc(db, AI_STATS_COLLECTION, accountId);
  const safeModelName = modelName.replace(/\./g, "_"); // Firestore keys shouldn't have dots
  
  const statsUpdates = {
    totalTokens: increment(usage.totalTokenCount || 0),
    totalInputTokens: increment(usage.promptTokenCount || 0),
    totalOutputTokens: increment(usage.candidatesTokenCount || 0),
    totalCostUsd: increment(costUsd || 0),
    lastUpdatedAt: serverTimestamp(),
  };

  // Add per-model stats
  statsUpdates[`models.${safeModelName}.tokens`] = increment(usage.totalTokenCount || 0);
  statsUpdates[`models.${safeModelName}.costUsd`] = increment(costUsd || 0);
  statsUpdates[`models.${safeModelName}.calls`] = increment(1);

  await setDoc(statsRef, statsUpdates, { merge: true });
}

export const AI_RUN_STATUSES = Object.freeze([
  "pending_approval",
  "approved",
  "running",
  "completed",
  "failed",
  "cancelled",
  "skipped",
]);

export const AI_APPROVAL_POLICIES = Object.freeze([
  "approval_first",
  "policy_gated",
  "autonomous",
]);

function normalizeTokenCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return Math.round(numericValue);
}

function normalizeUsdAmount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < 0) return null;
  return Number(numericValue.toFixed(6));
}

function calculateTokenCostUsd(tokenCount, usdPer1M) {
  const normalizedTokens = normalizeTokenCount(tokenCount);
  const normalizedRate = Number(usdPer1M);

  if (!normalizedTokens || !Number.isFinite(normalizedRate) || normalizedRate < 0) {
    return 0;
  }

  return Number(((normalizedTokens / 1_000_000) * normalizedRate).toFixed(6));
}

export function estimateAiRunCost({
  estimatedInputTokens = 0,
  estimatedOutputTokens = 0,
  estimatedCachedTokens = 0,
  pricing = {},
} = {}) {
  const normalizedInputTokens = normalizeTokenCount(estimatedInputTokens);
  const normalizedOutputTokens = normalizeTokenCount(estimatedOutputTokens);
  const normalizedCachedTokens = normalizeTokenCount(estimatedCachedTokens);

  const estimatedInputCostUsd = calculateTokenCostUsd(
    normalizedInputTokens,
    pricing?.inputUsdPer1M,
  );
  const estimatedOutputCostUsd = calculateTokenCostUsd(
    normalizedOutputTokens,
    pricing?.outputUsdPer1M,
  );
  const estimatedCachedCostUsd = calculateTokenCostUsd(
    normalizedCachedTokens,
    pricing?.cachedInputUsdPer1M,
  );

  return {
    estimatedInputTokens: normalizedInputTokens,
    estimatedOutputTokens: normalizedOutputTokens,
    estimatedCachedTokens: normalizedCachedTokens,
    estimatedTotalTokens: normalizedInputTokens + normalizedOutputTokens + normalizedCachedTokens,
    estimatedInputCostUsd,
    estimatedOutputCostUsd,
    estimatedCachedCostUsd,
    estimatedCostUsd: Number(
      (estimatedInputCostUsd + estimatedOutputCostUsd + estimatedCachedCostUsd).toFixed(6),
    ),
  };
}

function buildBaseRecord(type, payload = {}, ownershipContext = {}) {
  return {
    type,
    ...applyOwnershipContext(payload, ownershipContext),
  };
}

export function createAiRunRecord(payload = {}, ownershipContext = {}) {
  const estimate = estimateAiRunCost({
    estimatedInputTokens: payload.estimatedInputTokens,
    estimatedOutputTokens: payload.estimatedOutputTokens,
    estimatedCachedTokens: payload.estimatedCachedTokens,
    pricing: payload.pricing,
  });

  return buildBaseRecord("ai_run", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    taskType: payload.taskType || "unknown",
    status: payload.status || "pending_approval",
    provider: payload.provider || null,
    model: payload.model || null,
    source: payload.source || "expansion-track",
    targetType: payload.targetType || null,
    targetId: payload.targetId || null,
    promptTemplateId: payload.promptTemplateId || null,
    promptTemplateVersion: payload.promptTemplateVersion || null,
    pipelineVersion: payload.pipelineVersion || 1,
    requiresApproval: payload.requiresApproval ?? true,
    approvedByUserId: payload.approvedByUserId || null,
    approvedAt: payload.approvedAt || null,
    reversible: payload.reversible ?? true,
    estimatedInputTokens: estimate.estimatedInputTokens,
    estimatedOutputTokens: estimate.estimatedOutputTokens,
    estimatedCachedTokens: estimate.estimatedCachedTokens,
    estimatedTotalTokens: estimate.estimatedTotalTokens,
    estimatedInputCostUsd: estimate.estimatedInputCostUsd,
    estimatedOutputCostUsd: estimate.estimatedOutputCostUsd,
    estimatedCachedCostUsd: estimate.estimatedCachedCostUsd,
    estimatedCostUsd:
      payload.estimatedCostUsd != null
        ? normalizeUsdAmount(payload.estimatedCostUsd)
        : estimate.estimatedCostUsd,
    actualPromptTokenCount: normalizeTokenCount(payload.actualPromptTokenCount),
    actualCandidatesTokenCount: normalizeTokenCount(payload.actualCandidatesTokenCount),
    actualCachedContentTokenCount: normalizeTokenCount(payload.actualCachedContentTokenCount),
    actualTotalTokenCount: normalizeTokenCount(payload.actualTotalTokenCount),
    actualCostUsd: normalizeUsdAmount(payload.actualCostUsd),
    usageCalls: payload.usageCalls || [],
    startedAt: payload.startedAt || null,
    completedAt: payload.completedAt || null,
    failedAt: payload.failedAt || null,
    errorCode: payload.errorCode || null,
    errorMessage: payload.errorMessage || null,
    metadata: payload.metadata || {},
  }, ownershipContext);
}

export function createAiCostPolicyRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("ai_cost_policy", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    provider: payload.provider || null,
    model: payload.model || null,
    currency: payload.currency || "USD",
    inputUsdPer1M: normalizeUsdAmount(payload.inputUsdPer1M),
    outputUsdPer1M: normalizeUsdAmount(payload.outputUsdPer1M),
    cachedInputUsdPer1M: normalizeUsdAmount(payload.cachedInputUsdPer1M),
    effectiveFrom: payload.effectiveFrom || null,
    effectiveTo: payload.effectiveTo || null,
    status: payload.status || "active",
  }, ownershipContext);
}

export function createPromptTemplateRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("prompt_template", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    taskType: payload.taskType || "unknown",
    version: Number(payload.version) > 0 ? Number(payload.version) : 1,
    requiredContext: payload.requiredContext || [],
    optionalContext: payload.optionalContext || [],
    toolAccess: payload.toolAccess || [],
    outputSchemaVersion: payload.outputSchemaVersion || 1,
    approvalPolicy: payload.approvalPolicy || "approval_first",
    writebackPolicy: payload.writebackPolicy || "validated_only",
    promptBody: payload.promptBody || null,
    status: payload.status || "draft",
  }, ownershipContext);
}

export function createStyleProfileRecord(payload = {}, ownershipContext = {}) {
  return buildBaseRecord("style_profile", {
    accountId: payload.accountId || ownershipContext?.defaultAccountId || null,
    profileType: payload.profileType || "seller",
    subjectId: payload.subjectId || ownershipContext?.ownerId || null,
    label: payload.label || null,
    toneTraits: payload.toneTraits || [],
    preferredGreeting: payload.preferredGreeting || null,
    preferredClosing: payload.preferredClosing || null,
    approvedExamples: payload.approvedExamples || [],
    status: payload.status || "active",
  }, ownershipContext);
}
