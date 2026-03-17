"use client";
import { useState, useRef, useEffect } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { extractFromAudio } from "@/lib/ai";

export default function VoiceSearch({ onResult, isOpen, onClose }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    if (!isOpen) {
      if (isRecording) stopRecording();
      setIsProcessing(false);
    }
  }, [isOpen]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const options = { mimeType: 'audio/webm' };
      // Fallback mimeType if current is not supported
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
          const base64AudioMessage = reader.result.split(',')[1];
          const aiResponse = await extractFromAudio(base64AudioMessage, mimeType);
          
          if (aiResponse && aiResponse.text) {
             onResult(aiResponse.text);
          }
          // After processing is done
          setIsProcessing(false);
          setTimeout(onClose, 600);
        };
        // Stop all audio tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied or error:", err);
      // Fallback or error handling can be done here.
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6">
          <motion.div
            animate={{ scale: isRecording ? [1, 1.12, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-2xl cursor-pointer"
            onClick={isRecording ? stopRecording : (!isProcessing ? startRecording : undefined)}
          >
            {isProcessing ? (
              <Loader2 size={30} className="text-zinc-900 animate-spin" />
            ) : isRecording ? (
              <Square size={24} className="text-red-500 fill-red-500" />
            ) : (
              <Mic size={30} className="text-zinc-900" />
            )}
          </motion.div>
        </div>
        <h2 className="text-base font-bold text-white mb-2">
          {isProcessing ? "Processando com Gemini..." : isRecording ? "Gravando... (Toque para parar)" : "Toque para falar"}
        </h2>
        <p className="text-base text-zinc-200 mb-8 min-h-5 italic">
          Diga o modelo, marca ou part number.
        </p>
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-base font-medium text-zinc-300 border border-zinc-700 hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <X size={14} />
          Cancelar
        </button>
      </div>
    </div>
  );
}
