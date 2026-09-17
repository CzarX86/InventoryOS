"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Check, FileAudio, Mic, Square, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CRM_AUDIO_MAX_BYTES, type CrmAudioAttachment, getCrmAudioExtension, validateCrmAudio } from "@/lib/crmAudio";

type CrmAudioCaptureProps = {
  onAudioReady: (attachment: CrmAudioAttachment | null) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  processing?: boolean;
};

function recordingMimeType() {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "audio/webm";
}

export default function CrmAudioCapture({
  onAudioReady,
  onError,
  disabled = false,
  processing = false,
}: CrmAudioCaptureProps) {
  const [attachment, setAttachment] = useState<CrmAudioAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mountedRef = useRef(true);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const reportError = (message: string) => {
    setError(message);
    onError?.(message);
  };

  const publishAudio = (blob: Blob, name: string, mimeType: string) => {
    const validationError = validateCrmAudio({ size: blob.size, type: mimeType });
    if (validationError) {
      reportError(validationError);
      return;
    }
    const nextAttachment = { blob, name, mimeType } satisfies CrmAudioAttachment;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const nextPreviewUrl = URL.createObjectURL(blob);
    previewUrlRef.current = nextPreviewUrl;
    setAttachment(nextAttachment);
    setPreviewUrl(nextPreviewUrl);
    setError(null);
    onAudioReady(nextAttachment);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateCrmAudio(file);
    if (validationError) {
      reportError(validationError);
      return;
    }
    publishAudio(file, file.name, file.type || "audio/octet-stream");
  };

  const startRecording = async () => {
    if (recording || disabled || processing) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      reportError("Seu navegador não permite gravar áudio. Escolha um arquivo de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = recordingMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (!mountedRef.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || mimeType });
        publishAudio(blob, `gravacao-${new Date().toISOString().replace(/[:.]/g, "-")}.${getCrmAudioExtension(blob.type, "gravacao.webm")}`, blob.type || mimeType);
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.onerror = () => reportError("Não foi possível concluir a gravação. Tente novamente.");
      recorder.start();
      setError(null);
      setRecording(true);
    } catch {
      reportError("Não foi possível acessar o microfone. Verifique a permissão ou escolha um arquivo de áudio.");
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  };

  const removeAudio = () => {
    if (recording) stopRecording();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setAttachment(null);
    setPreviewUrl(null);
    setError(null);
    onAudioReady(null);
  };

  return (
    <div className="border border-[#484848]/25 bg-[#0e0e0e] p-3" data-testid="crm-audio-capture">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <AudioLines size={16} className="mt-0.5 shrink-0 text-[#97a5ff]" />
          <div>
            <p className="text-xs text-[#e7e5e5]">Mensagem de áudio</p>
            <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-[#acabaa]/55">
              Grave a ligação, uma reunião ou a conversa feita em outro telefone. O áudio será transcrito e analisado para este contato.
            </p>
          </div>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Até {CRM_AUDIO_MAX_BYTES / (1024 * 1024)} MB</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="sr-only"
        onChange={handleFileChange}
        aria-label="Escolher arquivo de áudio"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {recording ? (
          <Button type="button" onClick={stopRecording} disabled={disabled || processing} className="h-8 rounded-none bg-[#ee7d77] px-3 text-[#0e0e0e] hover:bg-[#f39b96]">
            <Square size={13} fill="currentColor" /> Parar gravação
          </Button>
        ) : (
          <Button type="button" onClick={startRecording} disabled={disabled || processing} variant="outline" className="h-8 rounded-none border-[#97a5ff]/40 bg-transparent px-3 text-[#e7e5e5] hover:bg-[#97a5ff]/10">
            <Mic size={13} /> Gravar áudio
          </Button>
        )}
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || processing || recording} variant="outline" className="h-8 rounded-none border-[#484848]/50 bg-transparent px-3 text-[#e7e5e5] hover:bg-[#1a1a1a]">
          <Upload size={13} /> Escolher áudio
        </Button>
        {attachment && !recording && (
          <Button type="button" onClick={removeAudio} disabled={disabled || processing} variant="ghost" className="h-8 rounded-none px-3 text-[#ee7d77] hover:bg-[#7f2927]/20 hover:text-[#f39b96]">
            <Trash2 size={13} /> Remover
          </Button>
        )}
      </div>

      {attachment && previewUrl && (
        <div className="mt-3 border border-[#acc3ce]/25 bg-[#293e48]/20 p-3">
          <div className="flex items-center gap-2 text-xs text-[#acc3ce]"><FileAudio size={14} /><span className="min-w-0 truncate">{attachment.name}</span><Check size={13} className="ml-auto shrink-0" /></div>
          <audio controls src={previewUrl} className="mt-3 h-9 w-full" aria-label="Prévia do áudio selecionado" />
        </div>
      )}

      <p role="status" aria-live="polite" className="mt-3 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">
        {processing ? "Áudio em análise pela IA..." : recording ? "Gravando pelo microfone deste dispositivo..." : attachment ? "Áudio pronto para transcrever e registrar." : "Nenhum áudio anexado."}
      </p>
      {error && <p role="alert" className="mt-2 text-[11px] text-[#ee7d77]">{error}</p>}
      <p className="mt-2 text-[10px] leading-relaxed text-[#acabaa]/35">Use somente gravações autorizadas. O arquivo original e a transcrição serão salvos no histórico do contato.</p>
    </div>
  );
}
