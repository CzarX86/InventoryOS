/* global process, Image, document, fetch */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { sumUsageMetadata, normalizeUsageMetadata } from "./audit";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

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
      
      // Get base64 without the prefix
      const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
      resolve(resizedBase64);
    };
    img.onerror = () => resolve(base64Str); // Fallback to original
  });
};

// Unified call with fallback from 2.5-flash-lite to 3.1-flash-lite
async function callWithFallback(prompt, visualData = null, useSearch = false) {
  const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
  let lastError = null;
  const usageAttempts = [];

  for (const modelName of models) {
    try {
      // Basic configuration without tools
      const modelConfig = { 
        model: modelName,
      };

      // Add options carefully based on rules
      // For basic JSON extraction we force JSON output. But if using Search Grounding,
      // the Gemini API throws 400 when combining tools with response_mime_type 'application/json'
      if (!useSearch) {
         modelConfig.generationConfig = { response_mime_type: "application/json" };
      }
      
      // Google Search Grounding for real-time market research
      if (useSearch) {
        modelConfig.tools = [{ googleSearch: {} }];
      }

      const model = genAI.getGenerativeModel(modelConfig);
      
      const parts = [prompt];
      if (visualData) parts.push(visualData);

      // Using the simpler array format, the Gemini JS SDK automatically
      // handles the formatting of text and inlineData objects properly.
      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      const usage = normalizeUsageMetadata(response.usageMetadata);
      if (usage) {
        usageAttempts.push({
          model: modelName,
          source: useSearch ? "search" : "direct",
          step: "generateContent",
          usage,
        });
      }
      
      // Attempt to parse JSON
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
        const tokenUsage = sumUsageMetadata(usageAttempts);
        return {
          ...parsed,
          tokenUsage: tokenUsage.totalTokenCount > 0 ? tokenUsage : null,
          tokenUsageCalls: usageAttempts,
          aiModel: modelName,
        };
      } catch (e) {
        // If JSON fails but we have output, maybe retry with next model
        if (modelName === models[0]) continue;
        throw e;
      }
    } catch (error) {
      console.warn(`Model ${modelName} failed or insufficient:`, error);
      lastError = error;
    }
  }

  throw lastError || new Error("All AI models failed");
}

export async function extractFromLabel(base64Image) {
  // Resize to save ~50-70% tokens on high-res photos
  const optimizedImage = await resizeImage(base64Image);
  
  const prompt = `
    Analise esta etiqueta de equipamento industrial/elétrico e extraia os campos em formato JSON:
    - type: (ex: "INVERSOR DE FREQUÊNCIA", "MOTOR", "CONTATOR")
    - brand: (Fabricante, ex: "WEG", "SIEMENS")
    - model: (Série/Nome principal do modelo)
    - partNumber: (Código alfanumérico específico)
    - specifications: (CRÍTICO: Extraia TODAS as potências, tensões, correntes, frequências, fases, IP, etc. Concatene em uma string.)
    
    IMPORTANTE: Retorne APENAS o JSON bruto. Use null para campos não encontrados.
  `;

  const imageData = {
    inlineData: {
      data: optimizedImage,
      mimeType: "image/jpeg",
    },
  };

  try {
    // Image + Search Grounding cannot be combined in the same Gemini API call.
    // Always extract from image without search for consistent JSON extraction.
    return await callWithFallback(prompt, imageData, false);
  } catch (e) {
    console.error("AI Label Extraction failed after all attempts", e);
    e.errorContext = "image";
    throw e;
  }
}

export async function extractFromAudio(base64Audio, mimeType = "audio/webm") {
  const prompt = `
    O usuário está ditando um item de estoque ou buscando por ele.
    Transcreva e identifique a intenção no formato JSON:
    {
      "text": "Transcrição exata",
      "intent": "SEARCH" // ou "ADD"
    }
    Apenas retorne o JSON válido.
  `;

  const audioData = {
    inlineData: {
      data: base64Audio,
      mimeType: mimeType,
    },
  };

  try {
    return await callWithFallback(prompt, audioData);
  } catch (e) {
    console.error("Audio Extraction failed", e);
    e.errorContext = "audio-search";
    throw e;
  }
}

export async function extractRegistrationFromAudio(base64Audio, mimeType = "audio/webm") {
  const prompt = `
    O usuário está ditando informações de um equipamento elétrico/industrial.
    Sua tarefa é transcrever e extrair as informações EXATAS ditadas no áudio e estruturá-las no formato JSON abaixo.
    CRÍTICO: NÃO invente ou assuma informações. Se o usuário não mencionar um campo explicitamente (como o part number ou modelo), defina o valor dele estritamente como null.
    
    Campos para extração JSON:
    - type: (Tipo do equipamento. Ex: INVERSOR DE FREQUÊNCIA, MOTOR)
    - brand: (Fabricante/Marca. Ex: WEG, SIEMENS)
    - model: (Modelo do equipamento)
    - partNumber: (Part number / código do produto)
    - specifications: (Qualquer outra especificação citada, como potência, tensão, estado, etc.)
    
    Apenas retorne o JSON puro e válido, e certifique-se de ser EXTREMAMENTE FIEL ao áudio original, retornando null as chaves que faltarem.
  `;

  const audioData = {
    inlineData: {
      data: base64Audio,
      mimeType: mimeType,
    },
  };

  try {
    return await callWithFallback(prompt, audioData, false);
  } catch (e) {
    console.error("Audio Registration Extraction failed", e);
    e.errorContext = "audio-registration";
    throw e;
  }
}
