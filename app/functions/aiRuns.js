const AI_RUN_COLLECTIONS = Object.freeze({
  aiRuns: "ai_runs",
  aiCostPolicies: "ai_cost_policies",
  promptTemplates: "prompt_templates",
  styleProfiles: "style_profiles",
});

const AI_RUN_STATUSES = Object.freeze([
  "pending_approval",
  "approved",
  "running",
  "completed",
  "failed",
  "cancelled",
  "skipped",
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

function estimateAiRunCost({
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

function applyOwnershipContext(payload = {}, context = {}) {
  return {
    ...payload,
    ownerId: context?.ownerId || null,
    accountId: payload?.accountId || context?.defaultAccountId || null,
  };
}

function buildBaseRecord(type, payload = {}, ownershipContext = {}) {
  return {
    type,
    ...applyOwnershipContext(payload, ownershipContext),
  };
}

function createAiRunRecord(payload = {}, ownershipContext = {}) {
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

function createAiCostPolicyRecord(payload = {}, ownershipContext = {}) {
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

function createPromptTemplateRecord(payload = {}, ownershipContext = {}) {
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

function createStyleProfileRecord(payload = {}, ownershipContext = {}) {
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

const { getFirestore, Timestamp } = require("firebase-admin/firestore");

async function saveAiRun(record) {
  const db = getFirestore();
  const docRef = db.collection(AI_RUN_COLLECTIONS.aiRuns).doc();
  const data = {
    ...record,
    id: docRef.id,
    createdAt: Timestamp.now(),
  };
  await docRef.set(data);
  return data;
}

async function updateAiRun(id, updates) {
  const db = getFirestore();
  const docRef = db.collection(AI_RUN_COLLECTIONS.aiRuns).doc(id);
  const data = {
    ...updates,
    updatedAt: Timestamp.now(),
  };
  await docRef.update(data);
  return data;
}

module.exports = {
  AI_RUN_COLLECTIONS,
  AI_RUN_STATUSES,
  createAiRunRecord,
  createAiCostPolicyRecord,
  createPromptTemplateRecord,
  createStyleProfileRecord,
  estimateAiRunCost,
  saveAiRun,
  updateAiRun,
};
