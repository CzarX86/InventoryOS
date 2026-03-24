/**
 * Logic to route tasks to the most appropriate model (CommonJS version for Functions).
 */
const MODEL_POLICIES = {
  LITE: "gemini-1.5-flash",
  BALANCED: "gemini-2.0-flash", 
  SRE: "gemini-flash-thinking-latest", 
  DEEPSEEK: "deepseek-chat", 
};

const TASK_ROUTING = {
  extract_contact: MODEL_POLICIES.LITE,
  summarize_thread: MODEL_POLICIES.LITE,
  rfq_analysis: MODEL_POLICIES.BALANCED,
  complex_reasoning: MODEL_POLICIES.SRE,
  whatsapp_extraction: MODEL_POLICIES.LITE, // Routing to high-speed Flash model
  default: MODEL_POLICIES.BALANCED,
};

/**
 * Selects the best model for a given task.
 */
function routeTask(taskType, options = {}) {
  if (options.forceModel) return options.forceModel;
  
  return TASK_ROUTING[taskType] || TASK_ROUTING.default;
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

module.exports = {
  MODEL_POLICIES,
  TASK_ROUTING,
  routeTask,
  getModelPricing,
};
