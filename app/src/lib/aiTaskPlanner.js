import { createAiRunRecord, saveAiRun, updateAiRun } from "./aiRuns";
import { generateStructuredOutput } from "./ai";
import { routeTask, getModelPricing } from "./modelRouter";

/**
 * Plans an AI task with automatic routing and persistence.
 */
export async function planAiTask(taskType, targetId, options = {}, ownershipContext = {}) {
  const model = routeTask(taskType, options);
  const pricing = getModelPricing(model);
  
  const {
    estimatedInputTokens = 1000,
    estimatedOutputTokens = 500,
    requiresApproval = true,
  } = options;

  const runRecord = createAiRunRecord({
    taskType,
    targetType: options.targetType || "unknown",
    targetId,
    model,
    provider: "google",
    estimatedInputTokens,
    estimatedOutputTokens,
    pricing,
    requiresApproval,
    metadata: options.metadata || {},
  }, ownershipContext);

  // Save to Firestore
  return await saveAiRun(runRecord);
}

/**
 * Executes a planned task and updates Firestore.
 */
export async function executeAiTask(plan, prompt, parts = [], options = {}) {
  // If plan is a string (ID), we should load it here. 
  // For the library, we expect the object.
  
  if (!plan || !plan.id) {
    throw new Error("executeAiTask: Invalid plan object or missing plan.id");
  }

  if (plan.requiresApproval && plan.status === "pending_approval") {
    throw new Error("Cannot execute task: pending approval");
  }

  await updateAiRun(plan.id, { status: "executing" });
  const startTime = new Date().toISOString();
  
  try {
    const { output, usage, model } = await generateStructuredOutput(
      prompt, 
      plan.model || "gemini-2.0-flash", 
      parts, 
      { json: true, ...options }
    );

    const result = {
      status: "completed",
      actualUsage: usage,
      model,
      completedAt: new Date().toISOString(),
    };

    await updateAiRun(plan.id, result);

    return {
      runId: plan.id,
      ...result,
      output,
    };
  } catch (error) {
    const errorResult = {
      status: "failed",
      errorCode: error.code || "execution_error",
      errorMessage: error.message,
      failedAt: new Date().toISOString(),
    };

    await updateAiRun(plan.id, errorResult);

    return {
      runId: plan.id,
      ...errorResult,
    };
  }
}

/**
 * Logic for persisting results back to domain (Placeholders for now)
 */
export async function writeAiResult(runResult, domainWriter) {
  if (runResult.status !== "completed") {
    throw new Error("Cannot write result: task failed or incomplete");
  }
  
  // High-level orchestration for lineage
  const resultData = {
    ...runResult.output,
    _lineage: {
      aiRunId: runResult.runId,
      model: runResult.model,
      completedAt: runResult.completedAt,
    }
  };

  if (domainWriter && typeof domainWriter === 'function') {
    return await domainWriter(resultData);
  }

  return resultData;
}
