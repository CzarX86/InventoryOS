/* global process, Image, document, fetch */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeUsageMetadata } from "./audit";

const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const deepseekApiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;

if (!geminiApiKey) {
  console.warn("AI: NEXT_PUBLIC_GEMINI_API_KEY is missing!");
}
if (!deepseekApiKey) {
  console.warn("AI: NEXT_PUBLIC_DEEPSEEK_API_KEY is missing! DeepSeek models will fail.");
}

const genAI = new GoogleGenerativeAI(geminiApiKey);

// Utility to resize image to save tokens and improve performance
const resizeImage = async (base64Str, maxWidth = 1024) => {
  if (typeof window === "undefined") return base64Str; // Skip if SSR
  
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64Str}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      resolve(resizedBase64);
    };
    img.onerror = () => resolve(base64Str);
  });
};

/**
 * Generic configuration resolver for models
 */
export function getAiModelConfig(modelName, options = {}) {
  const config = { model: modelName };
  
  if (options.json) {
    config.generationConfig = { response_mime_type: "application/json" };
  }
  
  if (options.useSearch) {
    config.tools = [{ googleSearch: {} }];
    // Search Grounding cannot be used with JSON mime type in Gemini
    delete config.generationConfig;
  }
  
  return config;
}

/**
 * Core execution function for structured output
 */
export async function generateStructuredOutput(prompt, modelName = "gemini-2.0-flash", parts = [], options = {}) {
  if (modelName.startsWith("deepseek-")) {
    return generateDeepSeekStructuredOutput(prompt, modelName, parts, options);
  }
  return generateGeminiStructuredOutput(prompt, modelName, parts, options);
}

async function generateGeminiStructuredOutput(prompt, modelName, parts, options) {
  try {
    const config = getAiModelConfig(modelName, options);
    const model = genAI.getGenerativeModel(config, { apiVersion: "v1beta" });
    
    const contentParts = [prompt, ...parts];
    const result = await model.generateContent(contentParts);
    const response = await result.response;
    const text = response.text();
    const usage = normalizeUsageMetadata(response.usageMetadata);
    
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

async function generateDeepSeekStructuredOutput(prompt, modelName, parts, options) {
  try {
    if (!deepseekApiKey) throw new Error("DeepSeek API Key missing");

    const messages = [
      { role: "system", content: "You are a specialized industrial inventory assistant. Always output valid JSON." },
      { role: "user", content: prompt }
    ];

    // Simple implementation: DeepSeek doesn't support multimodal parts as easily as Gemini via simple fetch/OpenAI format here
    // But for Task Planning and generic extractions, text prompts are enough.
    
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify({
        model: modelName,
        messages,
        response_format: { type: "json_object" },
        temperature: options.temperature || 0.1
      })
    });

    const data = await response.json();
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

function parseStructuredText(text, options = {}) {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    if (options.strictJson) throw e;
    return { rawOutput: text };
  }
}

// Legacy helpers (refactored to use new core)
async function callWithFallback(prompt, visualData = null, useSearch = false) {
  const models = ["gemini-2.0-flash", "gemini-1.5-flash"];
  let lastError = null;
  const calls = [];

  for (const modelName of models) {
    try {
      const parts = visualData ? [visualData] : [];
      const { output, usage } = await generateStructuredOutput(prompt, modelName, parts, { useSearch, json: true });
      
      const call = {
        model: modelName,
        source: "direct",
        step: "generateContent",
        usage,
      };
      calls.push(call);

      return {
        ...output,
        tokenUsage: { ...usage, calls },
        aiModel: modelName,
      };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

export async function extractFromLabel(base64Image) {
  const optimizedImage = await resizeImage(base64Image);
  const prompt = `Analise esta etiqueta industrial e retorne JSON: type, brand, model, partNumber, specifications.`;
  const imageData = { inlineData: { data: optimizedImage, mimeType: "image/jpeg" } };
  return callWithFallback(prompt, imageData, false);
}

export async function extractFromAudio(base64Audio, mimeType = "audio/webm") {
  const prompt = `Transcreva e identifique intenção (SEARCH/ADD) em JSON: { text, intent }.`;
  const audioData = { inlineData: { data: base64Audio, mimeType } };
  return callWithFallback(prompt, audioData);
}

export async function extractRegistrationFromAudio(base64Audio, mimeType = "audio/webm") {
  const prompt = `Extraia informações de equipamento industrial em JSON: type, brand, model, partNumber, specifications.`;
  const audioData = { inlineData: { data: base64Audio, mimeType } };
  return callWithFallback(prompt, audioData);
}
