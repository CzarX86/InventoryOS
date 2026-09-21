export const CRM_AUDIO_MAX_BYTES = 5 * 1024 * 1024;

export type CrmAudioAttachment = {
  blob: Blob;
  name: string;
  mimeType: string;
};

type AudioLike = {
  size?: number;
  type?: string;
};

export function validateCrmAudio(file: AudioLike | null | undefined) {
  if (!file || !file.size) return "Escolha uma mensagem de áudio válida.";
  if (file.size > CRM_AUDIO_MAX_BYTES) return "O áudio deve ter no máximo 5 MB.";
  if (!String(file.type || "").toLowerCase().startsWith("audio/")) return "O arquivo escolhido precisa ser um áudio.";
  return null;
}

export function getCrmAudioExtension(mimeType: string, name = "") {
  const mimeExtension: Record<string, string> = {
    "audio/webm": "webm",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
  };
  if (mimeExtension[mimeType.toLowerCase()]) return mimeExtension[mimeType.toLowerCase()];

  const fileExtension = name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fileExtension && fileExtension.length <= 5 ? fileExtension : "audio";
}

export function mergeCrmNotes(existing: string | null | undefined, addition: string | null | undefined) {
  const current = String(existing || "").trim();
  const next = String(addition || "").trim();
  if (!current) return next || null;
  if (!next) return current;
  return `${current}\n\n${next}`;
}

export function readBlobAsBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",")[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error("Não foi possível ler o áudio."));
    reader.readAsDataURL(blob);
  });
}
