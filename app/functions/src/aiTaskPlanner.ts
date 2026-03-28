import { createAiRunRecord, saveAiRun, updateAiRun } from "./aiRuns";
import { generateStructuredOutput } from "./ai";
import { routeTask, getModelPricing } from "./modelRouter";
import { checkAiBudget } from "./finops";
import { logAudit } from "./lib/audit";

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
  
  // -- FinOps Kill Switch --
  const budget = await checkAiBudget();
  if (budget.exceeded) {
    const errorResult = {
      status: "failed" as const,
      errorCode: "budget_exceeded",
      errorMessage: `Monthly AI budget limit reached ($${budget.limit}). Current spend: $${budget.currentCost.toFixed(2)}`,
      failedAt: new Date().toISOString(),
    };

    await logAudit({
      category: "finops",
      action: "budget_limit_reached",
      severity: "critical",
      actorId: "system",
      targetId: plan.id,
      details: {
        currentSpend: budget.currentCost,
        limit: budget.limit,
        taskType: plan.taskType
      }
    });

    await updateAiRun(plan.id, errorResult);
    return { runId: plan.id, ...errorResult };
  }
  
  try {
    const { output, usage, model } = await generateStructuredOutput(
      prompt, 
      plan.model, 
      parts, 
      { json: true, ...options }
    );

    const isShadow = options.shadow === true;

    const result = {
      status: "completed" as const,
      actualPromptTokenCount: usage?.promptTokenCount || 0,
      actualCandidatesTokenCount: usage?.candidatesTokenCount || 0,
      actualTotalTokenCount: usage?.totalTokenCount || 0,
      model,
      completedAt: new Date().toISOString(),
      metadata: { ...plan.metadata, shadow: isShadow }
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
