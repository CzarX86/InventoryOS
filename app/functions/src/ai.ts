import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * AI Core for Cloud Functions.
 */

export function getAiModelConfig(modelName: string, options: any = {}) {
  const config: any = { model: modelName };
  if (options.json) {
    config.generationConfig = { response_mime_type: "application/json" };
  }
  return config;
}

export async function generateStructuredOutput(prompt: string, modelName = "gemini-2.0-flash", parts: any[] = [], options: any = {}) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

  if (modelName.startsWith("deepseek-")) {
    return generateDeepSeekStructuredOutput(prompt, modelName, parts, { ...options, deepseekApiKey });
  }
  return generateGeminiStructuredOutput(prompt, modelName, parts, { ...options, geminiApiKey });
}

async function generateGeminiStructuredOutput(prompt: string, modelName: string, parts: any[], options: any) {
  if (!options.geminiApiKey) throw new Error("Gemini API Key missing");
  const genAI = new GoogleGenerativeAI(options.geminiApiKey);
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
  } catch (error) {
    console.error(`Gemini execution failed on ${modelName}:`, error);
    throw error;
  }
}

async function generateDeepSeekStructuredOutput(prompt: string, modelName: string, _parts: any[], options: any) {
  try {
    if (!options.deepseekApiKey) throw new Error("DeepSeek API Key missing");

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

    const data: any = await response.json();
    if (data.error) throw new Error(`DeepSeek Error: ${data.error.message}`);

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
  } catch (error) {
    console.error(`DeepSeek execution failed on ${modelName}:`, error);
    throw error;
  }
}

export function parseStructuredText(text: string, options: any = {}) {
  try {
    // 1. Try to extract from within markdown JSON blocks first
    const mdMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const candidate = mdMatch ? mdMatch[1] : text;

    // 2. Fallback to extracting everything between the first { and the last }
    const jsonMatch = candidate.match(/\{[\s\S]*\}/);
    const finalCandidate = jsonMatch ? jsonMatch[0] : candidate;

    return JSON.parse(finalCandidate);
  } catch (e) {
    // 3. Last resort fallback for multi-block text or raw garbage
    if (options.strictJson) throw e;
    
    try {
        // Try one more time with the greedy match on the ORIGINAL text 
        // in case markdown parsing failed wrongly
        const fallbackMatch = text.match(/\{[\s\S]*\}/);
        if (fallbackMatch) return JSON.parse(fallbackMatch[0]);
    } catch (innerError) {
        // Ignore inner error, proceed to rawOutput
    }

    return { rawOutput: text };
  }
}
