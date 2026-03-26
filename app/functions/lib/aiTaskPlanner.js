"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planAiTask = planAiTask;
exports.executeAiTask = executeAiTask;
exports.writeAiResult = writeAiResult;
const aiRuns_1 = require("./aiRuns");
const ai_1 = require("./ai");
const modelRouter_1 = require("./modelRouter");
/**
 * Plans an AI task.
 */
async function planAiTask(taskType, targetId, options = {}, ownershipContext = {}) {
    const model = (0, modelRouter_1.routeTask)(taskType, options);
    const pricing = (0, modelRouter_1.getModelPricing)(model);
    const { estimatedInputTokens = 1000, estimatedOutputTokens = 500, requiresApproval = false, } = options;
    const runRecord = (0, aiRuns_1.createAiRunRecord)({
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
    return await (0, aiRuns_1.saveAiRun)(runRecord);
}
/**
 * Executes a planned task.
 */
async function executeAiTask(plan, prompt, parts = [], options = {}) {
    if (!plan || !plan.id) {
        throw new Error("executeAiTask: Invalid plan object or missing plan.id");
    }
    await (0, aiRuns_1.updateAiRun)(plan.id, { status: "running", startedAt: new Date().toISOString() });
    try {
        const { output, usage, model } = await (0, ai_1.generateStructuredOutput)(prompt, plan.model, parts, { json: true, ...options });
        const result = {
            status: "completed",
            actualPromptTokenCount: usage?.promptTokenCount || 0,
            actualCandidatesTokenCount: usage?.candidatesTokenCount || 0,
            actualTotalTokenCount: usage?.totalTokenCount || 0,
            model,
            completedAt: new Date().toISOString(),
        };
        await (0, aiRuns_1.updateAiRun)(plan.id, result);
        return {
            runId: plan.id,
            ...result,
            output,
        };
    }
    catch (error) {
        const errorResult = {
            status: "failed",
            errorCode: error.code || "execution_error",
            errorMessage: error.message,
            failedAt: new Date().toISOString(),
        };
        await (0, aiRuns_1.updateAiRun)(plan.id, errorResult);
        return {
            runId: plan.id,
            ...errorResult,
        };
    }
}
/**
 * Logic for persisting results back to domain with lineage.
 */
async function writeAiResult(runResult, domainWriter) {
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
//# sourceMappingURL=aiTaskPlanner.js.map