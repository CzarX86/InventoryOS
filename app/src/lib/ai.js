import { GoogleGenerativeAI } from "@google/generative-ai";

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
  const models = ["gemini-2.5-flash-lite", "gemini-3.1-flash-lite"];
  let lastError = null;

  for (const modelName of models) {
    try {
      const modelConfig = { 
        model: modelName,
        generationConfig: {
          response_mime_type: "application/json",
        }
      };
      
      // Enable Google Search Grounding for market research
      if (useSearch) {
        modelConfig.tools = [{ googleSearch: {} }];
      }

      const model = genAI.getGenerativeModel(modelConfig);
      
      const parts = [prompt];
      if (visualData) parts.push(visualData);

      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();
      
      // Attempt to parse JSON
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text);
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

export async function extractFromLabel(base64Image, lite = false) {
  // Resize to save ~50-70% tokens on high-res photos
  const optimizedImage = await resizeImage(base64Image);
  
  const prompt = `
    Analise esta etiqueta de equipamento industrial/elétrico e extraia os campos em formato JSON:
    - type: (ex: "INVERSOR DE FREQUÊNCIA", "MOTOR", "CONTATOR")
    - brand: (Fabricante, ex: "WEG", "SIEMENS")
    - model: (Série/Nome principal do modelo)
    - partNumber: (Código alfanumérico específico)
    - specifications: (CRÍTICO: Extraia TODAS as potências, tensões, correntes, frequências, fases, IP, etc. Concatene em uma string.)
    ${!lite ? `
    - estimatedMarketValue: (Estimativa numérica realista do preço de mercado para este item usado/semi-novo em BRL/R$. Use ferramentas de busca se necessário.)
    - marketJustification: (Breve justificativa baseada em referências atuais.)
    ` : ''}
    
    IMPORTANTE: Retorne APENAS o JSON bruto. Use null para campos não encontrados.
  `;

  const imageData = {
    inlineData: {
      data: optimizedImage,
      mimeType: "image/jpeg",
    },
  };

  try {
    return await callWithFallback(prompt, imageData, !lite);
  } catch (e) {
    console.error("AI Label Extraction failed after all attempts", e);
    return null;
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
    return null;
  }
}

export async function extractRegistrationFromAudio(base64Audio, mimeType = "audio/webm", lite = false) {
  const prompt = `
    O usuário está ditando informações de um equipamento elétrico.
    Extraia as informações e estruture no seguinte JSON:
    - type, brand, model, partNumber, specifications.
    ${!lite ? `
    - estimatedMarketValue: (Estimativa numérica realista de preço de mercado "semi-novo" em BRL/R$)
    - marketJustification: (Breve justificativa)
    ` : ''}
    
    Apenas retorne o JSON válido.
  `;

  const audioData = {
    inlineData: {
      data: base64Audio,
      mimeType: mimeType,
    },
  };

  try {
    return await callWithFallback(prompt, audioData, !lite);
  } catch (e) {
    console.error("Audio Registration Extraction failed", e);
    return null;
  }
}
