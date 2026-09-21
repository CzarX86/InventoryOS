import { onCall, HttpsError } from "firebase-functions/v2/https";
import { withCallErrorHandling } from "./lib/errors";
import { buildOwnershipContext } from "./ownership";
import { executeAiTask, planAiTask } from "./aiTaskPlanner";

const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;

export const runAiExtraction = onCall({
  // DeepSeek is optional: the router falls back to Gemini when it is not configured.
  // Do not bind an absent optional secret because Firebase rejects the whole deploy.
  secrets: ["GEMINI_API_KEY", "PLATFORM_WORKSPACE_ID"],
}, withCallErrorHandling(async (request: any, logger: any) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Faça login para usar a IA.");
  if (request.auth.token?.accessApproved !== true) throw new HttpsError("permission-denied", "Seu acesso ainda não está aprovado.");
  const prompt = String(request.data?.prompt || "");
  const model = String(request.data?.model || "gemini-2.0-flash");
  const taskType = String(request.data?.taskType || "client_ai_extraction");
  const parts = Array.isArray(request.data?.parts) ? request.data.parts : [];
  if (!prompt || prompt.length > 200_000) throw new HttpsError("invalid-argument", "Prompt inválido ou muito grande.");
  if (JSON.stringify({ prompt, parts }).length > MAX_PAYLOAD_BYTES) throw new HttpsError("invalid-argument", "O arquivo enviado excede o limite de 8 MB para processamento.");
  if (!/^(gemini-|deepseek-)/.test(model)) throw new HttpsError("invalid-argument", "Modelo de IA não permitido.");

  const ownership = buildOwnershipContext(request.auth);
  const plan = await planAiTask(taskType, `client_${request.auth.uid}`, {
    forceModel: model,
    targetType: "client_extraction",
    estimatedInputTokens: Number(request.data?.estimatedInputTokens || 2500),
    estimatedOutputTokens: Number(request.data?.estimatedOutputTokens || 1000),
    requiresApproval: false,
    metadata: { source: "client_gateway", media: parts.length > 0 },
  }, ownership);
  const result = await executeAiTask(plan, prompt, parts, { json: request.data?.json !== false, useSearch: request.data?.useSearch === true });
  if (result.status !== "completed") throw new HttpsError("resource-exhausted", result.errorMessage || "A IA não pôde concluir a operação.");
  logger.info("Client AI request completed", { runId: result.runId, taskType, model: result.model, totalTokens: result.actualTotalTokenCount, actualCostUsd: result.actualCostUsd });
  return { output: result.output, usage: { promptTokenCount: result.actualPromptTokenCount, candidatesTokenCount: result.actualCandidatesTokenCount, totalTokenCount: result.actualTotalTokenCount }, model: result.model, runId: result.runId, actualCostUsd: result.actualCostUsd };
}));
