/**
 * Logic to route tasks to the most appropriate model.
 */
export const MODEL_POLICIES = {
  LITE: "gemini-1.5-flash",
  BALANCED: "gemini-2.0-flash", 
  SRE: "gemini-flash-thinking-latest", 
  DEEPSEEK: "deepseek-chat", 
} as const;

export type ModelPolicy = typeof MODEL_POLICIES[keyof typeof MODEL_POLICIES];

export const TASK_ROUTING: Record<string, string> = {
  extract_contact: MODEL_POLICIES.LITE,
  summarize_thread: MODEL_POLICIES.LITE,
  rfq_analysis: MODEL_POLICIES.BALANCED,
  complex_reasoning: MODEL_POLICIES.SRE,
  whatsapp_extraction: MODEL_POLICIES.DEEPSEEK, 
  whatsapp_batch_extraction: MODEL_POLICIES.DEEPSEEK, 
  default: MODEL_POLICIES.DEEPSEEK,
};

interface RouteOptions {
  forceModel?: string;
}

/**
 * Selects the best model for a given task.
 */
export function routeTask(taskType: string, options: RouteOptions = {}): string {
  if (options.forceModel) return options.forceModel;
  
  return TASK_ROUTING[taskType] || TASK_ROUTING.default;
}

interface Pricing {
  inputUsdPer1M: number;
  outputUsdPer1M: number;
}

/**
 * Returns model-specific pricing (Example prices in USD per 1M tokens)
 */
export function getModelPricing(model: string): Pricing {
  const catalog: Record<string, Pricing> = {
    "gemini-2.0-flash": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
    "gemini-1.5-flash": { inputUsdPer1M: 0.075, outputUsdPer1M: 0.3 },
    "gemini-2.0-flash-thinking": { inputUsdPer1M: 0.15, outputUsdPer1M: 0.6 },
    "deepseek-chat": { inputUsdPer1M: 0.1, outputUsdPer1M: 0.2 },
  };
  
  return catalog[model] || catalog["gemini-2.0-flash"];
}
