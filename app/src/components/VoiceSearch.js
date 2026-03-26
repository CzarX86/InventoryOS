"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Square, X, Loader2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { extractFromAudio } from "@/lib/ai";
import useAuth from "@/hooks/useAuth";
import ErrorNotice from "@/components/ErrorNotice";
import { recordAppError, escalateErrorReport, toUserFacingError } from "@/lib/errorReporting";
import GlobalLoadingBar from "./GlobalLoadingBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function VoiceSearch({ onResult, isOpen, onClose }) {
  const { user } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [reportingSupport, setReportingSupport] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  useEffect(() => {
    if (!isOpen) {
      if (isRecording) stopRecording();
      setIsProcessing(false);
      setError(null);
    }
  }, [isOpen, isRecording, stopRecording]);

  const handleSupportReport = async () => {
    if (!error?.errorId || !user) return;
    setReportingSupport(true);
    try {
      const escalated = await escalateErrorReport(error.errorId, user);
      if (escalated) {
        setError(prev => ({
          ...prev,
          reportedByUser: true,
          ticketId: escalated.ticketId,
        }));
      }
    } finally {
      setReportingSupport(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      const mimeType = MediaRecorder.isTypeSupported(options.mimeType) ? options.mimeType : 'audio/mp4';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          try {
            const base64AudioMessage = reader.result.split(',')[1];
            const aiResponse = await extractFromAudio(base64AudioMessage, mimeType);

            if (aiResponse && aiResponse.text) {
              onResult(aiResponse.text);
              setTimeout(onClose, 600);
              return;
            }

            const report = await recordAppError({
              error: new Error("Voice search returned no usable text"),
              source: "voice-search",
              action: "VOICE_SEARCH",
              user,
              context: {
                errorContext: "audio-search",
                reproductionContext: { mimeType, audioBlob },
              },
            });
            setError(toUserFacingError(report));
          } catch (error) {
            console.error("Voice search AI error:", error);
            const report = await recordAppError({
              error,
              source: "voice-search",
              action: "VOICE_SEARCH",
              user,
              context: {
                errorContext: "audio-search",
                reproductionContext: { mimeType, audioBlob },
              },
            });
            setError(toUserFacingError(report));
          } finally {
            setIsProcessing(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      const report = await recordAppError({
        error: err,
        source: "voice-search",
        action: "VOICE_SEARCH_CAPTURE",
        user,
        context: {
          errorContext: "microphone",
          reproductionContext: { attemptedAction: "start-recording" },
        },
      });
      setError(toUserFacingError(report));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0e0e0e] border border-white/5 shadow-2xl overflow-hidden p-0 rounded-none ring-0 focus:ring-0">
        <GlobalLoadingBar isLoading={isProcessing} />
        
        {/* Header Terminal Plate */}
        <div className="bg-[#131313] border-b border-white/5 py-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-4 bg-primary" />
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-white">
              SISTEMA_BUSCA_VOZ
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
              {isRecording ? "SIGNAL_ACTIVE" : "STANDBY"}
            </span>
            <div className={`w-1.5 h-1.5 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/20'}`} />
          </div>
        </div>

        <div className="p-10 flex flex-col items-center text-center relative">
          {/* Industrial Noise Layer */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
          
          <div className="relative mb-10">
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1.4, opacity: 0.1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="absolute inset-0 bg-red-500 blur-2xl"
                />
              )}
            </AnimatePresence>
            
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`w-28 h-28 border flex items-center justify-center cursor-pointer transition-all duration-300 ${
                isRecording 
                  ? "bg-red-500/10 border-red-500 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]" 
                  : "bg-[#131313] border-white/10 text-white/40 hover:border-primary/50 hover:text-primary shadow-xl"
              }`}
              onClick={isRecording ? stopRecording : (!isProcessing ? startRecording : undefined)}
              style={{ borderRadius: '0px' }}
            >
              <div className="absolute inset-1 border border-white/5 pointer-events-none" />
              {isProcessing ? (
                <Loader2 size={40} className="animate-spin" />
              ) : isRecording ? (
                <Square size={40} className="fill-current" />
              ) : (
                <Mic size={40} />
              )}
            </motion.div>
          </div>

          <div className="space-y-4 mb-10 relative">
            <div className="text-xl font-black uppercase tracking-[0.1em] text-white">
              {isProcessing ? (
                <div className="flex items-center justify-center gap-3">
                  <span className="animate-pulse">PROCESSANDO...</span>
                </div>
              ) : isRecording ? (
                <span className="text-red-500">OUVINDO...</span>
              ) : (
                "AGUARDANDO"
              )}
            </div>
            
            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground/60 leading-relaxed max-w-[240px] mx-auto">
              {isProcessing 
                ? "DECODIFICANDO FLUXO DE ÁUDIO EM TEMPO REAL" 
                : isRecording 
                  ? "SINAL DE ÁUDIO SENDO CAPTURADO PARA ANÁLISE" 
                  : "TOQUE NO MÓDULO PARA INICIAR CAPTURA"}
            </div>
          </div>

          {!error && !isProcessing && !isRecording && (
            <div className="w-full py-4 border-y border-white/5 mb-10 flex flex-col items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">GUIDE_PARAMETER</span>
              <p className="text-[11px] font-bold text-primary/60 italic tracking-wide font-mono">
                "Diga o modelo, marca ou part number"
              </p>
            </div>
          )}

          <div className="w-full mb-10">
            <ErrorNotice error={error} onReport={handleSupportReport} reporting={reportingSupport} className="text-left" />
          </div>

          <div className="flex gap-4 w-full relative">
            <Button
              variant="outline"
              className="flex-1 font-black uppercase tracking-[0.2em] text-[10px] h-14 rounded-none border-white/10 bg-transparent hover:bg-white/5 transition-all"
              onClick={onClose}
              disabled={isProcessing}
            >
              <X size={14} className="mr-2" /> CANCELAR_SESSÃO
            </Button>
            
            {isRecording && (
              <Button
                className="flex-1 font-black uppercase tracking-[0.2em] text-[10px] h-14 rounded-none bg-red-600 hover:bg-red-500 text-white transition-all shadow-[0_4px_15px_rgba(220,38,38,0.3)]"
                onClick={stopRecording}
              >
                FINALIZAR_AGORA
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
