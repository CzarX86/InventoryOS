import { createAiRunRecord, saveAiRun, updateAiRun } from "./aiRuns";
import { generateStructuredOutput } from "./ai";
import { routeTask, getModelPricing } from "./modelRouter";

export interface AiTaskResult {
  runId: string;
  status: "completed" | "failed";
  output?: any;
  model?: string;
  completedAt?: string;
  errorCode?: string;
  errorMessage?: string;
  failedAt?: string;
  actualPromptTokenCount?: number;
  actualCandidatesTokenCount?: number;
  actualTotalTokenCount?: number;
}

/**
 * Plans an AI task.
 */
export async function planAiTask(taskType: string, targetId: string, options: any = {}, ownershipContext: any = {}) {
  const model = routeTask(taskType, options);
  const pricing = getModelPricing(model);
  
  const {
    estimatedInputTokens = 1000,
    estimatedOutputTokens = 500,
    requiresApproval = false,
  } = options;

  const runRecord = createAiRunRecord({
    taskType,
    targetType: options.targetType || "unknown",
    targetId,
    model,
    provider: model.startsWith("deepseek") ? "deepseek" : "google",
    estimatedInputTokens,
    estimatedOutputTokens,
    pricing,
    requiresApproval,
    metadata: options.metadata || {},
  }, ownershipContext);

  return await saveAiRun(runRecord);
}

/**
 * Executes a planned task.
 */
export async function executeAiTask(plan: any, prompt: string, parts: any[] = [], options: any = {}): Promise<AiTaskResult> {
  if (!plan || !plan.id) {
    throw new Error("executeAiTask: Invalid plan object or missing plan.id");
  }

  await updateAiRun(plan.id, { status: "running", startedAt: new Date().toISOString() });
  
  try {
    const { output, usage, model } = await generateStructuredOutput(
      prompt, 
      plan.model, 
      parts, 
      { json: true, ...options }
    );

    const result = {
      status: "completed" as const,
      actualPromptTokenCount: usage?.promptTokenCount || 0,
      actualCandidatesTokenCount: usage?.candidatesTokenCount || 0,
      actualTotalTokenCount: usage?.totalTokenCount || 0,
      model,
      completedAt: new Date().toISOString(),
    };

    await updateAiRun(plan.id, result);

    return {
      runId: plan.id,
      ...result,
      output,
    };
  } catch (error: any) {
    const errorResult = {
      status: "failed" as const,
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
 * Logic for persisting results back to domain with lineage.
 */
export async function writeAiResult(runResult: AiTaskResult, domainWriter: (data: any) => Promise<any>) {
  if (runResult.status !== "completed") {
    throw new Error("Cannot write result: task failed or incomplete");
  }
  
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
