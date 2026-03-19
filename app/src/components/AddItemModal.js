"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, Camera, Check, Sparkles, RotateCcw, TrendingUp, Mic, Square, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import useAIExtraction from "@/hooks/useAIExtraction";
import { logAIUsage } from "@/lib/usage";
import useAuth from "@/hooks/useAuth";
import {
  appendTaskUsageCall,
  buildActivityEvent,
  createAuditTaskId,
  createTaskLedger,
  logInventoryActivity,
  logTaskCompletion,
} from "@/lib/audit";
import GlobalLoadingBar from "@/components/GlobalLoadingBar";

const INPUT = "w-full bg-transparent border-b border-white/[0.1] py-2.5 text-base text-white placeholder:text-zinc-200 outline-none focus:border-white/30 transition-colors";
const STATUS_OPTIONS = ["IN STOCK", "SOLD", "REPAIR", "RESERVED"];

const EMPTY_FORM = {
  type: "", brand: "", model: "", partNumber: "",
  specifications: "", sellingPrice: "", estimatedMarketValue: "",
  marketJustification: "", status: "IN STOCK", audioUrl: "", productImageUrl: "",
};

export default function AddItemModal({ isOpen, onClose, onAdded, editItem = null }) {
  const { user } = useAuth();
  const [taskLedger, setTaskLedger] = useState(() =>
    createTaskLedger({
      taskId: createAuditTaskId(),
      actorId: user?.uid || null,
    })
  );
  const resetTaskLedger = useCallback(() => {
    setTaskLedger(
      createTaskLedger({
        taskId: createAuditTaskId(),
        actorId: user?.uid || null,
      })
    );
  }, [user?.uid]);
  const { loading: isExtracting, suggestions, hasPendingConfirmation, processExtraction, processAudioExtraction, confirmSuggestions } = useAIExtraction({
    onUsage: (usageEvent) => {
      setTaskLedger(prev => appendTaskUsageCall(prev, usageEvent));
    },
  });
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [audioBlob, setAudioBlob] = useState(null);
  const [productImageFile, setProductImageFile] = useState(null);
  const [isProcessingProductPhoto, setIsProcessingProductPhoto] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const cancelRecordingRef = useRef(false);

  useEffect(() => {
    setValidationError("");
    setSuccess(false);

    if (!isOpen) {
      setFormData(EMPTY_FORM);
      setAudioBlob(null);
      setProductImageFile(null);
      resetTaskLedger();
      return;
    }

    if (editItem) {
      setFormData({
        ...EMPTY_FORM,
        ...editItem
      });
    } else {
      setFormData(EMPTY_FORM);
      setAudioBlob(null);
      setProductImageFile(null);
      resetTaskLedger();
    }
  }, [editItem, isOpen, resetTaskLedger]);

  useEffect(() => {
    if (suggestions && user) {
      logAIUsage(user.uid, "IMAGE_OCR", { 
        strategy: "GEMINI-FLASH-LITE-FALLBACK",
        optimized: true,
        timestamp: new Date().toISOString() 
      });
    }
  }, [suggestions, user]);

  useEffect(() => {
    if (suggestions) {
      setFormData(prev => ({
        ...prev,
        ...Object.keys(suggestions).reduce((acc, key) => {
          // Robust mapping for common field variations
          let normalizedKey = key.toLowerCase();
          if (normalizedKey.includes('spec') || normalizedKey.includes('technical')) normalizedKey = 'specifications';
          if (normalizedKey.includes('brand') || normalizedKey.includes('manufacturer')) normalizedKey = 'brand';
          if (normalizedKey.includes('price')) normalizedKey = 'estimatedMarketValue';
          
          const validFields = ['type', 'brand', 'model', 'partNumber', 'specifications', 'estimatedMarketValue', 'marketJustification'];
          
          if (validFields.includes(normalizedKey) && suggestions[key] !== null) {
            acc[normalizedKey] = suggestions[key].toString().toUpperCase();
          }
          return acc;
        }, {}),
      }));
    }
  }, [suggestions]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) await processExtraction(file, user?.aiWorkflow === "background");
  };

  const startRecording = async () => {
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
        if (cancelRecordingRef.current) {
          cancelRecordingRef.current = false;
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        await processAudioExtraction(blob, user?.aiWorkflow === "background");
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      cancelRecordingRef.current = true;
      mediaRecorderRef.current.stop();
    }
  };

  const [validationError, setValidationError] = useState("");

  const validateForm = () => {
    if (!formData.type?.trim()) return "O campo 'Tipo de Equipamento' é obrigatório.";
    if (!formData.brand?.trim()) return "O campo 'Fabricante / Marca' é obrigatório.";
    if (!formData.model?.trim()) return "O campo 'Modelo' é obrigatório.";

    return null;
  };

  const handleSubmit = async () => {
    if (hasPendingConfirmation) return;
    
    const error = validateForm();
    if (error) {
      setValidationError(error);
      return;
    }
    
    setValidationError("");
    setSaving(true);
    try {
      let finalAudioUrl = formData.audioUrl;
      let finalProductImageUrl = formData.productImageUrl;

      if (audioBlob) {
        const audioRef = ref(storage, `inventory_audio/${Date.now()}.webm`);
        await uploadBytes(audioRef, audioBlob);
        finalAudioUrl = await getDownloadURL(audioRef);
      }

      if (productImageFile) {
        const imageRef = ref(storage, `inventory_images/${Date.now()}_${productImageFile.name}`);
        await uploadBytes(imageRef, productImageFile);
        finalProductImageUrl = await getDownloadURL(imageRef);
      }

      const auditSnapshot = {
        ...formData,
        audioUrl: finalAudioUrl,
        productImageUrl: finalProductImageUrl,
        needsMarketResearch: user?.aiWorkflow === "background" && !formData.estimatedMarketValue,
        updatedAt: new Date().toISOString(),
      };
      const data = {
        ...formData,
        audioUrl: finalAudioUrl,
        productImageUrl: finalProductImageUrl,
        needsMarketResearch: user?.aiWorkflow === "background" && !formData.estimatedMarketValue,
        updatedAt: serverTimestamp(),
      };
      
      if (editItem) {
        await updateDoc(doc(db, "inventory", editItem.id), data);
        try {
          await logInventoryActivity(db, buildActivityEvent({
            actionType: "UPDATE_ITEM",
            actorId: user?.uid || null,
            actorEmail: user?.email || null,
            targetType: "inventory",
            targetId: editItem.id,
            before: editItem,
            after: { ...editItem, ...auditSnapshot },
            reversible: true,
            metadata: { source: "modal" },
          }));
        } catch (auditError) {
          console.error("Audit logging failed for update:", auditError);
        }
      } else {
        const createdRef = await addDoc(collection(db, "inventory"), { ...data, createdAt: serverTimestamp() });
        const createdItem = {
          ...auditSnapshot,
          id: createdRef.id,
          createdAt: new Date().toISOString(),
        };

        try {
          await logTaskCompletion(db, taskLedger, {
            actorEmail: user?.email || null,
            itemId: createdRef.id,
            relatedActionType: "CREATE_ITEM",
            after: createdItem,
          });

          await logInventoryActivity(db, buildActivityEvent({
            actionType: "CREATE_ITEM",
            actorId: user?.uid || null,
            actorEmail: user?.email || null,
            targetType: "inventory",
            targetId: createdRef.id,
            before: null,
            after: createdItem,
            reversible: true,
            metadata: {
              taskId: taskLedger.taskId,
              tokenTotal: taskLedger.totalTokenCount,
            },
          }));
        } catch (auditError) {
          console.error("Audit logging failed for create:", auditError);
        }
      }
      onAdded();
      if (!editItem) {
        setSuccess(true);
        resetTaskLedger();
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const isAI = (f) => !!suggestions?.[f];

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.18 }}
        className="w-full md:max-w-xl bg-[#141414] border-t md:border border-white/[0.08] overflow-hidden shadow-2xl max-h-[95vh] flex flex-col relative"
      >
        <GlobalLoadingBar isLoading={saving || isExtracting || isProcessingProductPhoto} />
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center p-8 bg-black min-h-[400px]"
            >
              <div className="relative mb-12">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: [0.8, 1.2, 0.8],
                    opacity: [0, 0.2, 0]
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-white blur-3xl rounded-full"
                />
                <motion.div 
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15, stiffness: 200 }}
                  className="relative w-24 h-24 bg-white rounded-3xl flex items-center justify-center text-black"
                >
                  <Check size={48} strokeWidth={3} />
                </motion.div>
              </div>

              <motion.h3 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-4xl font-black uppercase tracking-tighter text-white mb-2"
              >
                REGISTRADO
              </motion.h3>
              <motion.p 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-zinc-500 text-xs font-black uppercase tracking-[0.3em] mb-12"
              >
                Ativo processado com sucesso
              </motion.p>

              <div className="flex flex-col w-full gap-3 max-w-xs">
                <button
                  onClick={() => {
                    setFormData(EMPTY_FORM);
                    setAudioBlob(null);
                    setValidationError("");
                    setSuccess(false);
                    resetTaskLedger();
                  }}
                  className="w-full py-5 bg-white text-black font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-all active:scale-[0.98] shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
                >
                  Novo Item
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-5 border border-white/[0.08] text-zinc-400 font-black uppercase tracking-widest text-xs hover:bg-white/[0.05] hover:text-white transition-all active:scale-[0.98]"
                >
                  Voltar para Home
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-white/[0.08] shrink-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-base font-black uppercase tracking-widest text-white">
                    {editItem ? "Editar" : "Novo Registro"}
                  </h2>
                  {editItem && (
                    <span className="text-base font-mono text-zinc-200">{editItem.id?.slice(0, 8)}</span>
                  )}
                </div>
                <button onClick={onClose} className="text-zinc-200 hover:text-white transition-colors p-1">
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="overflow-y-auto flex-1">

                {/* AI Scanner & Product Photo */}
                {!editItem ? (
                  <div className="border-b border-white/[0.08]">
                    {isExtracting ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-4 bg-white/[0.02]">
                        <div className="relative flex items-center justify-center w-14 h-14">
                          <motion.div
                            animate={{ scale: [1, 2, 1], opacity: [0.2, 0, 0.2] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="absolute inset-0 rounded-full bg-white"
                          />
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          >
                            <Sparkles size={22} className="text-white" />
                          </motion.div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-black uppercase tracking-[0.2em] text-white">IA Processando</p>
                          <motion.p
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.4, repeat: Infinity }}
                            className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 mt-1"
                          >
                            Processando base de dados...
                          </motion.p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col sm:flex-row">
                        <div className="relative flex-1 border-b sm:border-b-0 sm:border-r border-white/[0.08]">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={isRecording}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                          />
                          <div className="flex flex-col items-center justify-center p-6 h-full hover:bg-white/[0.02] transition-colors">
                            <Camera size={24} className="shrink-0 mb-3 text-zinc-200" />
                            <p className="text-sm font-bold uppercase tracking-wider text-center text-zinc-300">Scan Etiqueta</p>
                            <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Extração IA</span>
                          </div>
                        </div>

                        <div className="relative flex-1 border-b sm:border-b-0 sm:border-r border-white/[0.08]">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                setIsProcessingProductPhoto(true);
                                setProductImageFile(file);
                                // Brief "processing" feel
                                setTimeout(() => setIsProcessingProductPhoto(false), 800);
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className={`flex flex-col items-center justify-center p-6 h-full transition-colors ${productImageFile ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"}`}>
                            <div className={`shrink-0 mb-3 ${productImageFile ? "text-emerald-400" : "text-zinc-200"}`}>
                              {productImageFile ? <Check size={24} /> : <Camera size={24} />}
                            </div>
                            <p className={`text-sm font-bold uppercase tracking-wider text-center ${productImageFile ? "text-emerald-400" : "text-zinc-300"}`}>
                              {productImageFile ? "Foto Selecionada" : "Foto do Produto"}
                            </p>
                            <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Visualização</span>
                          </div>
                        </div>

                        {isRecording ? (
                          <div className="relative flex-1 flex flex-col items-center justify-center p-6 h-full bg-white/[0.03]">
                            <div className="flex items-center gap-6 mb-3">
                              <button onClick={(e) => { e.stopPropagation(); cancelRecording(); }} className="text-zinc-400 hover:text-white transition-colors flex flex-col items-center">
                                <X size={20} className="mb-1" />
                                <span className="text-[9px] font-black uppercase tracking-widest">Cancelar</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); stopRecording(); }} className="text-red-500 hover:text-red-400 transition-colors flex flex-col items-center">
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.7, repeat: Infinity }}>
                                  <Square size={20} className="mb-1 fill-red-500" />
                                </motion.div>
                                <span className="text-[9px] font-black uppercase tracking-widest">Enviar AI</span>
                              </button>
                            </div>
                            <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 animate-pulse">Gravando...</span>
                          </div>
                        ) : (
                          <div
                            className="relative flex-1 flex flex-col items-center justify-center p-6 h-full transition-colors cursor-pointer hover:bg-white/[0.02]"
                            onClick={startRecording}
                          >
                            <div className="shrink-0 mb-3 text-zinc-200">
                              <Mic size={24} />
                            </div>
                            <p className="text-sm font-bold uppercase tracking-wider text-center text-zinc-300">
                              Ditar
                            </p>
                            <span className="mt-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Voz IA</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-b border-white/[0.08] p-6 text-center">
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-zinc-600">Edição de Atributos</p>
                  </div>
                )}

                {/* Audio Log */}
                {(audioBlob || formData.audioUrl) && (
                  <div className="px-5 md:px-6 py-4 border-b border-white/[0.08] flex items-center gap-4 bg-white/[0.02]">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-black shrink-0">
                      <Mic size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold uppercase tracking-widest text-white mb-1">Log de Voz (Cadastro)</p>
                      <audio 
                          src={audioBlob ? URL.createObjectURL(audioBlob) : formData.audioUrl} 
                          controls 
                          className="h-8 w-full outline-none mt-1 invert brightness-150 contrast-200" 
                      />
                    </div>
                  </div>
                )}
                
                {/* Validation Error */}
                {validationError && (
                  <div className="px-5 md:px-6 py-4 bg-red-500/10 border-b border-white/[0.08]">
                    <p className="text-sm font-bold text-red-400">{validationError}</p>
                  </div>
                )}

                {/* Status */}
                <div className="border-b border-white/[0.08]">
                  <div className="px-5 md:px-6 pt-5 pb-1">
                    <p className="text-base font-black uppercase tracking-widest text-zinc-200 mb-3">Status</p>
                    <div className="flex gap-0 border border-white/[0.08]">
                      {STATUS_OPTIONS.map((s, i) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => set("status", s)}
                          className={`flex-1 py-2 text-base font-black uppercase tracking-wider transition-colors ${
                            i < STATUS_OPTIONS.length - 1 ? "border-r border-white/[0.08]" : ""
                          } ${
                            formData.status === s
                              ? "bg-white text-[#141414]"
                              : "text-zinc-200 hover:text-zinc-200 hover:bg-white/[0.03]"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fields grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 px-5 md:px-6 pb-5 mt-5">
                    {[
                      { id: "type",                 label: "Tipo de Equipamento",  placeholder: "Ex: Inversor de Frequência" },
                      { id: "brand",                label: "Fabricante / Marca",    placeholder: "Ex: Siemens, WEG" },
                      { id: "model",                label: "Modelo",                placeholder: "Ex: CFW11" },
                      { id: "partNumber",           label: "Part Number",           placeholder: "Código de identificação", mono: true },
                      { id: "estimatedMarketValue", label: "Valor de Mercado",      placeholder: "R$", type: "number" },
                      { id: "sellingPrice",         label: "Preço de Venda",        placeholder: "R$", type: "number" },
                    ].map(field => (
                      <div key={field.id} className="py-3 md:odd:pr-4 md:even:pl-4 md:odd:border-r md:odd:border-white/[0.06]">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-base font-black uppercase tracking-widest text-zinc-200">{field.label}</label>
                          {isAI(field.id) && (
                            <span className="flex items-center gap-0.5 text-base font-black uppercase tracking-wider text-white/50">
                              <Sparkles size={7} /> IA
                            </span>
                          )}
                        </div>
                        <input
                          type={field.type || "text"}
                          className={`${INPUT} ${field.mono ? "font-mono text-base" : ""} ${isAI(field.id) ? "border-white/30" : ""}`}
                          placeholder={field.placeholder}
                          value={formData[field.id]}
                          onChange={e => set(field.id, field.type === "number" ? e.target.value : e.target.value.toUpperCase())}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Market insights */}
                {formData.marketJustification && (
                  <div className="flex gap-3 px-5 md:px-6 py-4 border-b border-white/[0.08]">
                    <TrendingUp size={13} className="text-zinc-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-base font-black uppercase tracking-widest text-zinc-300 mb-1">Insights de Mercado</p>
                      <p className="text-base text-zinc-300 leading-relaxed italic">&quot;{formData.marketJustification}&quot;</p>
                    </div>
                  </div>
                )}

                {/* Specs */}
                <div className="px-5 md:px-6 py-4 border-b border-white/[0.08]">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-base font-black uppercase tracking-widest text-zinc-200">Especificações Técnicas</label>
                    {isAI("specifications") && (
                      <span className="flex items-center gap-0.5 text-base font-black uppercase tracking-wider text-white/50">
                        <Sparkles size={7} /> IA
                      </span>
                    )}
                  </div>
                  <textarea
                    className={`${INPUT} font-mono text-base min-h-[80px] resize-none ${isAI("specifications") ? "border-white/30" : ""}`}
                    placeholder="Potência, Tensão, Corrente..."
                    value={formData.specifications}
                    onChange={e => set("specifications", e.target.value.toUpperCase())}
                  />
                </div>

                {/* AI Confirmation */}
                <AnimatePresence>
                  {hasPendingConfirmation && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-b border-white/[0.08]"
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-5 md:px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Check size={13} className="text-white shrink-0" />
                          <div>
                            <p className="text-base font-black uppercase tracking-wider text-white">Revisar dados extraídos</p>
                            <p className="text-base text-zinc-200">Confirme as informações preenchidas pela IA</p>
                          </div>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
                          <button
                            type="button"
                            onClick={() => { setFormData(EMPTY_FORM); setAudioBlob(null); setValidationError(""); }}
                            className="flex-1 sm:flex-none px-4 py-2 text-base font-black uppercase tracking-widest text-zinc-200 border border-white/[0.1] hover:bg-white/[0.05] transition-colors"
                          >
                            Recomeçar
                          </button>
                          <button
                            type="button"
                            onClick={() => { setValidationError(""); confirmSuggestions(); }}
                            className="flex-1 sm:flex-none px-4 py-2 text-base font-black uppercase tracking-widest bg-white text-[#141414] hover:bg-zinc-200 transition-colors"
                          >
                            Confirmar
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Final Actions */}
              <div className="flex border-t border-white/[0.08] shrink-0">
                <button
                  type="button"
                  onClick={() => { setValidationError(""); onClose(); }}
                  className="flex-1 py-4 text-base font-black uppercase tracking-widest text-zinc-200 hover:text-white border-r border-white/[0.08] hover:bg-white/[0.03] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving || isExtracting || hasPendingConfirmation}
                  onClick={handleSubmit}
                  className={`flex-[2] flex items-center justify-center gap-2 py-4 text-base font-black uppercase tracking-widest transition-colors ${
                    hasPendingConfirmation || saving
                      ? "text-zinc-200 cursor-not-allowed"
                      : "bg-white text-[#141414] hover:bg-zinc-200"
                  }`}
                >
                  {saving
                    ? <Loader2 className="animate-spin" size={14} />
                    : hasPendingConfirmation ? "Aguardando revisão"
                    : editItem ? "Salvar alterações"
                    : "Cadastrar item"
                  }
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
