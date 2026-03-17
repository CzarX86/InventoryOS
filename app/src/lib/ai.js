import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY);

export async function extractFromLabel(base64Image, lite = false) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = `
    Analyze this equipment label (usually from industrial or electrical components) and extract these fields in JSON format:
    - type: (e.g., "INVERSOR DE FREQUÊNCIA", "MOTOR", "CONTATOR")
    - brand: (The manufacturer name, e.g., "WEG", "SIEMENS")
    - model: (The primary model series/name)
    - partNumber: (The specific alphanumeric code for the item)
    - specifications: (CRITICAL: Extract ALL technical ratings. Include Voltage [V], Current [A], Power [kW/HP], Frequency [Hz], Phase [Ph], Weight, Degree of Protection [IP], etc. Concatenate into a single descriptive string.)
    ${!lite ? `
    - estimatedMarketValue: (A numeric estimation of the current market price for this specific item as "used/semi-novo" in BRL/R$. Be realistic.)
    - marketJustification: (A brief justification for the estimated price.)
    ` : ''}
    
    IMPORTANT: 
    1. Even if the text is partially obscured, try to infer the values.
    2. Ensure the field names match exactly as specified.
    3. If a field is missing, use null.
    4. Return ONLY a valid, raw JSON object. Do not include markdown block markers like \`\`\`json.
  `;

  const imageData = {
    inlineData: {
      data: base64Image,
      mimeType: "image/jpeg",
    },
  };

  const result = await model.generateContent([prompt, imageData]);
  const response = await result.response;
  const text = response.text();
  
  try {
    // Clean potential markdown code blocks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error("AI Extraction failed", e);
    return null;
  }
}

export async function extractFromAudio(base64Audio, mimeType = "audio/webm") {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = `
    O usuário está ditando um item de estoque ou buscando por ele.
    Transcreva o que o usuário disse e identifique se é uma busca ou um cadastro novo.
    Extraia o texto exatamente e também separe num JSON no seguinte formato:
    {
      "text": "O que o usuário disse transcrito",
      "intent": "SEARCH" // ou "ADD"
    }
    
    Apenas retorne o JSON válido, sem aspas de markdown \`\`\`.
  `;

  const audioData = {
    inlineData: {
      data: base64Audio,
      mimeType: mimeType,
    },
  };

  try {
    const result = await model.generateContent([prompt, audioData]);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error("Audio Extraction failed", e);
    return null;
  }
}

export async function extractRegistrationFromAudio(base64Audio, mimeType = "audio/webm", lite = false) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = `
    O usuário está ditando informações de um equipamento elétrico de estoque.
    Extraia as informações e estruture no seguinte JSON:
    - type (e.g., Inversor de Frequência, Motor, Soft-starter)
    - brand (e.g., WEG, Siemens, ABB, Schneider)
    - model (The main model name/series)
    - partNumber (The specific code used for identification)
    - specifications (CRITICAL: Extraia TODOS os detalhes técnicos ditados, como Tensão [V], Corrente [A], Potência [kW/HP], Frequência [Hz], Fases [Ph], Grau de Proteção [IP], etc. Concatene em uma única string descritiva.)
    ${!lite ? `
    - estimatedMarketValue (A numeric estimation of the current market price for this item as "semi-novo" in BRL/R$)
    - marketJustification (A brief justification or list of references for price estimation.)
    ` : ''}
    
    Se não encontrar uma das informações, deixe como null.
    Apenas retorne o JSON válido, sem tags de markdown.
  `;

  const audioData = {
    inlineData: {
      data: base64Audio,
      mimeType: mimeType,
    },
  };

  try {
    const result = await model.generateContent([prompt, audioData]);
    const response = await result.response;
    const text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch (e) {
    console.error("Audio Registration Extraction failed", e);
    return null;
  }
}
