/**
 * Logic to route tasks to the most appropriate model.
 */
export const MODEL_POLICIES = {
  CHEAP: "deepseek-chat",
  BALANCED: "gemini-1.5-flash", 
  SRE: "gemini-flash-thinking-latest", 
  DEEPSEEK: "deepseek-chat", 
};

export const TASK_ROUTING = {
  extract_contact: MODEL_POLICIES.CHEAP,
  summarize_thread: MODEL_POLICIES.BALANCED,
  rfq_analysis: MODEL_POLICIES.BALANCED,
  complex_reasoning: MODEL_POLICIES.SRE,
  default: MODEL_POLICIES.BALANCED,
};

/**
 * Selects the best model for a given task.
 */
export function routeTask(taskType, options = {}) {
  if (options.forceModel) return options.forceModel;
  
  return TASK_ROUTING[taskType] || TASK_ROUTING.default;
}

/**
 * Returns model-specific pricing (Example prices in USD per 1M tokens)
 */
export function getModelPricing(model) {
  const catalog = {
    "gemini-2.0-flash": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
    "gemini-1.5-flash": { inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
    "gemini-2.0-flash-thinking": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 }, // Hypothetical
    "deepseek-chat": { inputUsdPer1M: 0.1, outputUsdPer1M: 0.2 },
  };
  
  return catalog[model] || catalog["gemini-2.0-flash"];
}
