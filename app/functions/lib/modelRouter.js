"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TASK_ROUTING = exports.MODEL_POLICIES = void 0;
exports.routeTask = routeTask;
exports.getModelPricing = getModelPricing;
/**
 * Logic to route tasks to the most appropriate model.
 */
exports.MODEL_POLICIES = {
    LITE: "gemini-1.5-flash",
    BALANCED: "gemini-2.0-flash",
    SRE: "gemini-flash-thinking-latest",
    DEEPSEEK: "deepseek-chat",
};
exports.TASK_ROUTING = {
    extract_contact: exports.MODEL_POLICIES.LITE,
    summarize_thread: exports.MODEL_POLICIES.LITE,
    rfq_analysis: exports.MODEL_POLICIES.BALANCED,
    complex_reasoning: exports.MODEL_POLICIES.SRE,
    whatsapp_extraction: exports.MODEL_POLICIES.DEEPSEEK,
    whatsapp_batch_extraction: exports.MODEL_POLICIES.DEEPSEEK,
    default: exports.MODEL_POLICIES.DEEPSEEK,
};
/**
 * Selects the best model for a given task.
 */
function routeTask(taskType, options = {}) {
    if (options.forceModel)
        return options.forceModel;
    return exports.TASK_ROUTING[taskType] || exports.TASK_ROUTING.default;
}
/**
 * Returns model-specific pricing (Example prices in USD per 1M tokens)
 */
function getModelPricing(model) {
    const catalog = {
        "gemini-2.0-flash": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
        "gemini-1.5-flash": { inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
        "gemini-2.0-flash-thinking": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
        "deepseek-chat": { inputUsdPer1M: 0.1, outputUsdPer1M: 0.2 },
    };
    return catalog[model] || catalog["gemini-2.0-flash"];
}
//# sourceMappingURL=modelRouter.js.map