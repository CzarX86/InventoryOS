"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAiModelConfig = getAiModelConfig;
exports.generateStructuredOutput = generateStructuredOutput;
const generative_ai_1 = require("@google/generative-ai");
/**
 * AI Core for Cloud Functions.
 */
function getAiModelConfig(modelName, options = {}) {
    const config = { model: modelName };
    if (options.json) {
        config.generationConfig = { response_mime_type: "application/json" };
    }
    return config;
}
async function generateStructuredOutput(prompt, modelName = "gemini-2.0-flash", parts = [], options = {}) {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (modelName.startsWith("deepseek-")) {
        return generateDeepSeekStructuredOutput(prompt, modelName, parts, { ...options, deepseekApiKey });
    }
    return generateGeminiStructuredOutput(prompt, modelName, parts, { ...options, geminiApiKey });
}
async function generateGeminiStructuredOutput(prompt, modelName, parts, options) {
    if (!options.geminiApiKey)
        throw new Error("Gemini API Key missing");
    const genAI = new generative_ai_1.GoogleGenerativeAI(options.geminiApiKey);
    try {
        const config = getAiModelConfig(modelName, options);
        const model = genAI.getGenerativeModel(config, { apiVersion: "v1beta" });
        const contentParts = [prompt, ...parts];
        const result = await model.generateContent(contentParts);
        const response = await result.response;
        const text = response.text();
        const usage = response.usageMetadata ? {
            promptTokenCount: response.usageMetadata.promptTokenCount,
            candidatesTokenCount: response.usageMetadata.candidatesTokenCount,
            totalTokenCount: response.usageMetadata.totalTokenCount,
            cachedContentTokenCount: response.usageMetadata.cachedContentTokenCount || 0
        } : null;
        return {
            output: parseStructuredText(text, options),
            usage,
            model: modelName,
        };
    }
    catch (error) {
        console.error(`Gemini execution failed on ${modelName}:`, error);
        throw error;
    }
}
async function generateDeepSeekStructuredOutput(prompt, modelName, _parts, options) {
    try {
        if (!options.deepseekApiKey)
            throw new Error("DeepSeek API Key missing");
        const messages = [
            { role: "system", content: "You are a specialized industrial inventory assistant. Always output valid JSON." },
            { role: "user", content: prompt }
        ];
        const response = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${options.deepseekApiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                messages,
                response_format: { type: "json_object" },
                temperature: options.temperature || 0.1
            })
        });
        const data = await response.json();
        if (data.error)
            throw new Error(`DeepSeek Error: ${data.error.message}`);
        const text = data.choices[0].message.content;
        const usage = {
            promptTokenCount: data.usage.prompt_tokens,
            candidatesTokenCount: data.usage.completion_tokens,
            totalTokenCount: data.usage.total_tokens
        };
        return {
            output: parseStructuredText(text, options),
            usage,
            model: modelName,
        };
    }
    catch (error) {
        console.error(`DeepSeek execution failed on ${modelName}:`, error);
        throw error;
    }
}
function parseStructuredText(text, options = {}) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    }
    catch (e) {
        if (options.strictJson)
            throw e;
        return { rawOutput: text };
    }
}
//# sourceMappingURL=ai.js.map