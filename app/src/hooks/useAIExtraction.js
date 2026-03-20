import { useState } from "react";
import { extractFromLabel, extractRegistrationFromAudio } from "@/lib/ai";
import { recordAppError, toUserFacingError } from "@/lib/errorReporting";

function stripMetadata(result) {
  if (!result) return result;
  const { tokenUsage, tokenUsageCalls, aiModel, ...rest } = result;
  return rest;
}

export default function useAIExtraction({ onUsage, userContext = null } = {}) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [hasPendingConfirmation, setHasPendingConfirmation] = useState(false);
  const [error, setError] = useState(null);

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
    setError(null);
    try {
      const base64 = await fileToBase64(file);
      const extracted = await extractFromLabel(base64, lite);

      if (extracted) {
        emitUsage(extracted, { source: "label-image", step: "processExtraction" });
        setSuggestions(stripMetadata(extracted));
        setHasPendingConfirmation(true);
        return;
      }

      setSuggestions(null);
      setHasPendingConfirmation(false);
      const report = await recordAppError({
        error: new Error("AI extraction returned no structured data"),
        source: "add-item-modal",
        action: "IMAGE_EXTRACTION",
        user: userContext,
        context: {
          errorContext: "image",
          reproductionContext: {
            lite,
            file,
          },
        },
      });
      setError(toUserFacingError(report));
    } catch (err) {
      console.error("Extraction error:", err);
      setSuggestions(null);
      setHasPendingConfirmation(false);
      const report = await recordAppError({
        error: err,
        source: "add-item-modal",
        action: "IMAGE_EXTRACTION",
        user: userContext,
        context: {
          errorContext: err.errorContext || "image",
          reproductionContext: {
            lite,
            file,
          },
        },
      });
      setError(toUserFacingError(report));
    } finally {
      setLoading(false);
    }
  };

  const processAudioExtraction = async (blob, lite = false) => {
    if (!blob) return;

    setLoading(true);
    setError(null);
    try {
      const base64 = await fileToBase64(blob);
      const extracted = await extractRegistrationFromAudio(base64, blob.type || "audio/webm", lite);

      if (extracted) {
        emitUsage(extracted, { source: "voice-input", step: "processAudioExtraction" });
        setSuggestions(stripMetadata(extracted));
        setHasPendingConfirmation(true);
        return;
      }

      setSuggestions(null);
      setHasPendingConfirmation(false);
      const report = await recordAppError({
        error: new Error("AI registration extraction returned no structured data"),
        source: "add-item-modal",
        action: "AUDIO_REGISTRATION_EXTRACTION",
        user: userContext,
        context: {
          errorContext: "audio-registration",
          reproductionContext: {
            lite,
            blob,
            mimeType: blob.type || "audio/webm",
          },
        },
      });
      setError(toUserFacingError(report));
    } catch (err) {
      console.error("Audio extraction error:", err);
      setSuggestions(null);
      setHasPendingConfirmation(false);
      const report = await recordAppError({
        error: err,
        source: "add-item-modal",
        action: "AUDIO_REGISTRATION_EXTRACTION",
        user: userContext,
        context: {
          errorContext: err.errorContext || "audio-registration",
          reproductionContext: {
            lite,
            blob,
            mimeType: blob.type || "audio/webm",
          },
        },
      });
      setError(toUserFacingError(report));
    } finally {
      setLoading(false);
    }
  };

  const confirmSuggestions = () => {
    setError(null);
    setSuggestions(null);
    setHasPendingConfirmation(false);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = e => reject(e);
    });
  };

  return {
    loading,
    suggestions,
    hasPendingConfirmation,
    error,
    processExtraction,
    processAudioExtraction,
    confirmSuggestions
  };
}
