import { useState } from "react";
import { extractFromLabel } from "@/lib/ai";

function stripMetadata(result) {
  if (!result) return result;
  const { tokenUsage, tokenUsageCalls, aiModel, ...rest } = result;
  return rest;
}

export default function useAIExtraction({ onUsage } = {}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [hasPendingConfirmation, setHasPendingConfirmation] = useState(false);

  const emitUsage = (result, context) => {
    if (!onUsage || !result?.tokenUsage) return;
    onUsage({
      usage: result.tokenUsage,
      tokenUsage: result.tokenUsage,
      tokenUsageCalls: result.tokenUsageCalls || [],
      aiModel: result.aiModel || null,
      source: context.source,
      step: context.step,
    });
  };

  const processExtraction = async (file, lite = false) => {
    if (!file) return;

    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const extracted = await extractFromLabel(base64, lite);
      
      if (extracted) {
        emitUsage(extracted, { source: "label-image", step: "processExtraction" });
        setSuggestions(stripMetadata(extracted));
        setHasPendingConfirmation(true);
      }
    } catch (error) {
      console.error("Extraction error:", error);
    } finally {
      setLoading(false);
    }
  };

  const processAudioExtraction = async (blob, lite = false) => {
    if (!blob) return;

    setLoading(true);
    try {
      const base64 = await fileToBase64(blob);
      // need to import extractRegistrationFromAudio from lib/ai
      const { extractRegistrationFromAudio } = await import("@/lib/ai");
      const extracted = await extractRegistrationFromAudio(base64, blob.type || "audio/webm", lite);
      
      if (extracted) {
        emitUsage(extracted, { source: "voice-input", step: "processAudioExtraction" });
        setSuggestions(stripMetadata(extracted));
        setHasPendingConfirmation(true);
      }
    } catch (error) {
      console.error("Audio extraction error:", error);
    } finally {
      setLoading(false);
    }
  };

  const confirmSuggestions = () => {
    setSuggestions(null);
    setHasPendingConfirmation(false);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  return {
    loading,
    suggestions,
    hasPendingConfirmation,
    processExtraction,
    processAudioExtraction,
    confirmSuggestions
  };
}
