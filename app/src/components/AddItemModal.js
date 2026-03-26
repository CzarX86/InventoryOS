"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { X, Loader2, Camera, Check, Sparkles, Mic, Square } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, storage } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import useAIExtraction from "@/hooks/useAIExtraction";
import { logAIUsage } from "@/lib/usage";
import useAuth from "@/hooks/useAuth";
import ErrorNotice from "@/components/ErrorNotice";
import {
  appendTaskUsageCall,
  buildActivityEvent,
  createAuditTaskId,
  createTaskLedger,
  logInventoryActivity,
  logTaskCompletion,
} from "@/lib/audit";
import { escalateErrorReport, recordAppError, toUserFacingError } from "@/lib/errorReporting";
import GlobalLoadingBar from "@/components/GlobalLoadingBar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const STATUS_OPTIONS = ["IN STOCK", "SOLD", "REPAIR", "RESERVED"];

const EMPTY_FORM = {
  type: "", brand: "", model: "", partNumber: "",
  specifications: "", status: "IN STOCK", audioUrl: "", productImageUrl: "",
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
  const { loading: isExtracting, suggestions, hasPendingConfirmation, error: extractionError, processExtraction, processAudioExtraction, confirmSuggestions } = useAIExtraction({
    onUsage: (usageEvent) => {
      setTaskLedger(prev => appendTaskUsageCall(prev, usageEvent));
    },
    userContext: user,
  });
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [audioBlob, setAudioBlob] = useState(null);
  const [productImageFile, setProductImageFile] = useState(null);
  const [isProcessingProductPhoto, setIsProcessingProductPhoto] = useState(false);
  const [success, setSuccess] = useState(false);
  const [supportError, setSupportError] = useState(null);
  const [reportingSupport, setReportingSupport] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const cancelRecordingRef = useRef(false);

  useEffect(() => {
    setValidationError("");
    setSuccess(false);
    setSupportError(null);

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
      setValidationError("");
      setSupportError(null);
      setFormData(prev => ({
        ...prev,
        ...Object.keys(suggestions).reduce((acc, key) => {
          let normalizedKey = key.toLowerCase();
          if (normalizedKey.includes("spec") || normalizedKey.includes("technical")) normalizedKey = "specifications";
          if (normalizedKey.includes("brand") || normalizedKey.includes("manufacturer")) normalizedKey = "brand";
          
          const validFields = ["type", "brand", "model", "partNumber", "specifications"];
          
          if (validFields.includes(normalizedKey) && suggestions[key] !== null) {
            acc[normalizedKey] = suggestions[key].toString().toUpperCase();
          }
          return acc;
        }, {}),
      }));
    }
  }, [suggestions]);

  useEffect(() => {
    if (extractionError) {
      setValidationError(extractionError.humanMessage);
      setSupportError(extractionError);
    }
  }, [extractionError]);

  const set = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (file) await processExtraction(file, user?.aiWorkflow === "background");
  };

  const startRecording = async () => {
    setValidationError("");
    setSupportError(null);
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
      const report = await recordAppError({
        error: err,
        source: "add-item-modal",
        action: "AUDIO_REGISTRATION_CAPTURE",
        user,
        context: {
          errorContext: "microphone",
          reproductionContext: {
            attemptedAction: "start-recording",
          },
        },
      });
      const userError = toUserFacingError(report);
      setValidationError(userError.humanMessage);
      setSupportError(userError);
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

  const handleSupportReport = async () => {
    if (!supportError?.errorId || !user) return;
    setReportingSupport(true);
    try {
      const escalated = await escalateErrorReport(supportError.errorId, user);
      if (escalated) {
        setSupportError(prev => ({
          ...prev,
          reportedByUser: true,
          ticketId: escalated.ticketId,
        }));
      }
    } finally {
      setReportingSupport(false);
    }
  };

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
      setSupportError(null);
      return;
    }
    
    setValidationError("");
    setSupportError(null);
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
        updatedAt: new Date().toISOString(),
      };
      const data = {
        ...formData,
        audioUrl: finalAudioUrl,
        productImageUrl: finalProductImageUrl,
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
    } catch (error) {
      console.error("Save item failed:", error);
      const report = await recordAppError({
        error,
        source: "add-item-modal",
        action: "SAVE_ITEM",
        user,
        context: {
          errorContext: "save-item",
          reproductionContext: {
            isEdit: Boolean(editItem),
            hasAudioBlob: Boolean(audioBlob),
            hasProductImageFile: Boolean(productImageFile),
            formData: {
              type: formData.type,
              brand: formData.brand,
              model: formData.model,
              partNumber: formData.partNumber,
              status: formData.status,
            },
          },
        },
      });
      const userError = toUserFacingError(report);
      setValidationError(userError.humanMessage);
      setSupportError(userError);
    } finally {
      setSaving(false);
    }
  };

  const isAI = (f) => !!suggestions?.[f];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl bg-[#0e0e0e] border-foreground/10 p-0 overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.5)] flex flex-col max-h-[90vh] rounded-none border-[1px]">
        <div className="absolute inset-0 pointer-events-none industrial-noise opacity-20" />
        <GlobalLoadingBar isLoading={saving || isExtracting || isProcessingProductPhoto} />
        
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex-1 flex flex-col items-center justify-center p-8 min-h-[400px] relative z-10"
            >
              <div className="relative mb-12">
                <motion.div 
                  initial={{ scale: 0, rotate: -45 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", damping: 15, stiffness: 400, mass: 0.5 }}
                  className="relative w-24 h-24 bg-primary rounded-none flex items-center justify-center text-primary-foreground border-4 border-[#0e0e0e] shadow-[0_0_20px_rgba(var(--primary),0.3)]"
                >
                  <Check size={48} strokeWidth={4} />
                </motion.div>
                <div className="absolute -top-4 -right-4 bg-primary px-2 py-1 text-[8px] font-mono font-black uppercase tracking-widest text-[#0e0e0e]">
                  STATUS:OK
                </div>
              </div>

              <motion.h3 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.05, delay: 0.1 }}
                className="text-5xl font-display font-black uppercase tracking-tighter text-foreground mb-4 leading-none text-center"
              >
                REGISTRADO
              </motion.h3>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.05, delay: 0.2 }}
                className="text-muted-foreground text-[10px] font-mono font-bold uppercase tracking-[0.4em] mb-12 text-center"
              >
                SYSTEMS_UPDATE_SUCCESS // ATIVO_ID_SINC
              </motion.p>

              <div className="flex flex-col w-full gap-px bg-foreground/10 border border-foreground/10 max-w-sm">
                <Button
                  size="lg"
                  className="w-full py-10 text-[10px] font-display font-black uppercase tracking-[0.25em] rounded-none bg-primary hover:bg-primary/90 text-primary-foreground transition-none"
                  onClick={() => {
                    setFormData(EMPTY_FORM);
                    setAudioBlob(null);
                    setValidationError("");
                    setSuccess(false);
                    resetTaskLedger();
                  }}
                >
                  NOVO_CADASTRO
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full py-10 text-[10px] font-display font-black uppercase tracking-[0.25em] rounded-none border-0 bg-obsidian-800 hover:bg-obsidian-750 text-foreground transition-none"
                  onClick={onClose}
                >
                  VOLTAR_PAINEL
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <DialogHeader className="px-6 py-8 border-b border-foreground/10 shrink-0 space-y-0 bg-[#0e0e0e] relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-8 bg-primary" />
                  <div>
                    <DialogTitle className="text-lg font-display font-black uppercase tracking-[0.15em] text-foreground leading-none">
                      {editItem ? "EDIÇÃO_DE_ATIVO" : "SISTEMA_INGESTÃO_FORGE"}
                    </DialogTitle>
                    {editItem && (
                      <p className="font-mono text-[9px] text-primary mt-1 uppercase tracking-widest">
                        UUID_REF: {editItem.id}
                      </p>
                    )}
                  </div>
                </div>
                <DialogDescription className="hidden">
                  Módulo de digitalização de ativos industriais via OCR Vision e Extração Semântica.
                </DialogDescription>
              </DialogHeader>

              <div className="overflow-y-auto flex-1 custom-scrollbar">
                {/* AI Scanner & Product Photo */}
                {!editItem ? (
                  <div className="border-b border-foreground/10 grid grid-cols-3 divide-x divide-foreground/10 bg-[#131313] relative z-10">
                    {isExtracting ? (
                      <div className="col-span-3 flex flex-col items-center justify-center py-16 gap-6 bg-primary/[0.02]">
                        <div className="relative flex items-center justify-center w-20 h-20">
                          <motion.div
                            animate={{ scale: [1, 1.4, 1], opacity: [0.1, 0, 0.1] }}
                            transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                            className="absolute inset-0 rounded-none bg-primary"
                          />
                          <motion.div
                            animate={{ rotate: [0, 90, 180, 270, 360] }}
                            transition={{ duration: 1, repeat: Infinity, ease: "steps(4)" }}
                          >
                            <Sparkles size={32} className="text-primary" />
                          </motion.div>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-display font-black uppercase tracking-[0.4em] text-foreground">EXTRACTING_DATA</p>
                          <p className="text-[9px] font-mono uppercase tracking-widest text-primary/60 mt-2 animate-pulse">
                            NEURAL_PATH_ENGAGED // STREAM_DATA...
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Scan Etiqueta */}
                        <div className="relative flex flex-col items-center justify-center p-8 hover:bg-white/[0.03] transition-none cursor-pointer group min-h-[180px]">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={isRecording}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                          />
                          <Camera size={28} className="shrink-0 mb-5 text-muted-foreground group-hover:text-primary transition-none" />
                          <p className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-center text-foreground">ETIQUETA_OCR</p>
                          <div className="mt-4 px-2 py-0.5 border border-foreground/20 bg-[#0e0e0e] text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground group-hover:text-primary group-hover:border-primary">
                            INIT_SCAN
                          </div>
                        </div>

                        {/* Foto Produto */}
                        <div className="relative flex flex-col items-center justify-center p-8 transition-none hover:bg-white/[0.03] group">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                setIsProcessingProductPhoto(true);
                                setProductImageFile(file);
                                setTimeout(() => setIsProcessingProductPhoto(false), 400);
                              }
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div className={`shrink-0 mb-5 transition-none ${productImageFile ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`}>
                            {productImageFile ? <Check size={28} strokeWidth={3} /> : <Camera size={28} />}
                          </div>
                          <p className={`text-[10px] font-display font-black uppercase tracking-[0.2em] text-center ${productImageFile ? "text-primary" : "text-foreground"}`}>
                            FOTO_REFERÊN
                          </p>
                          <div className={`mt-4 px-2 py-0.5 border text-[8px] font-mono font-black uppercase tracking-widest ${productImageFile ? "border-primary/40 bg-primary/10 text-primary" : "border-foreground/20 bg-[#0e0e0e] text-muted-foreground group-hover:border-primary group-hover:text-primary"}`}>
                            VISUAL_REF
                          </div>
                        </div>

                        {/* Ditar */}
                        <div 
                          className={`relative flex flex-col items-center justify-center p-8 h-full transition-none cursor-pointer group ${isRecording ? "bg-red-950/20" : "hover:bg-white/[0.03]"}`}
                          onClick={isRecording ? stopRecording : startRecording}
                        >
                          {isRecording ? (
                            <div className="flex flex-col items-center">
                              <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 0.3, repeat: Infinity }}>
                                <Square size={28} className="mb-5 fill-red-500 text-red-500" />
                              </motion.div>
                              <p className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-red-500">STOP_RECORD</p>
                              <div className="mt-4 px-2 py-0.5 border border-red-500/40 bg-red-500/10 text-[8px] font-mono font-black uppercase tracking-widest text-red-500">
                                REC_ACTIVE
                              </div>
                            </div>
                          ) : (
                            <>
                              <Mic size={28} className="shrink-0 mb-5 text-muted-foreground group-hover:text-primary transition-none" />
                              <p className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-center text-foreground">COMANDO_VOZ</p>
                              <div className="mt-4 px-2 py-0.5 border border-foreground/20 bg-[#0e0e0e] text-[8px] font-mono font-black uppercase tracking-widest text-muted-foreground group-hover:border-primary group-hover:text-primary">
                                VOICE_DRIVE
                              </div>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="border-b border-foreground/10 p-4 text-center bg-[#131313]/40 relative z-10 flex items-center justify-center gap-3">
                    <div className="w-1 h-3 bg-primary/40" />
                    <p className="text-[9px] font-mono font-black uppercase tracking-[0.4em] text-muted-foreground/60">BUFFER://ATTRIBUTE_EDIT_MODE</p>
                    <div className="w-1 h-3 bg-primary/40" />
                  </div>
                )}

                {/* Audio Log */}
                {(audioBlob || formData.audioUrl) && (
                  <div className="px-6 py-6 border-b border-foreground/10 flex items-center gap-6 bg-primary/[0.02] relative z-10">
                    <div className="w-14 h-14 rounded-none bg-primary flex items-center justify-center text-[#0e0e0e] shrink-0 border border-[#0e0e0e]">
                      <Mic size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[9px] font-mono font-black uppercase tracking-[0.3em] text-primary mb-3">RAW_VOICE_CAPTURE_STREAM</p>
                      <audio 
                          src={audioBlob ? URL.createObjectURL(audioBlob) : formData.audioUrl} 
                          controls 
                          className="h-8 w-full outline-none opacity-80 invert grayscale brightness-200 contrast-125" 
                      />
                    </div>
                    <Button variant="outline" size="icon" className="h-12 w-12 text-muted-foreground border-foreground/10 rounded-none hover:bg-white/5 transition-none" onClick={() => {setAudioBlob(null); set("audioUrl", "");}}>
                      <X size={20} />
                    </Button>
                  </div>
                )}
                
                {/* Validation Error */}
                {validationError && !supportError && (
                  <div className="px-6 py-5 bg-red-950/20 border-b border-red-500/30 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-4 bg-red-500" />
                      <p className="text-[10px] font-mono font-black text-red-500 uppercase tracking-widest leading-none">ERROR_REPORT:// {validationError}</p>
                    </div>
                  </div>
                )}

                <div className="px-6 relative z-10 mt-6">
                  <ErrorNotice
                    error={supportError}
                    onReport={handleSupportReport}
                    reporting={reportingSupport}
                  />
                </div>

                {/* Form Fields */}
                <div className="p-8 space-y-12 relative z-10">
                  {/* Status Selection */}
                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-3 bg-primary/40" />
                      <Label className="text-[10px] font-display font-black uppercase tracking-[0.25em] text-muted-foreground">ATIVO_STATUS_SYSTEM</Label>
                    </div>
                    <ToggleGroup 
                      type="single" 
                      value={formData.status} 
                      onValueChange={(val) => val && set("status", val)} 
                      className="justify-start gap-px bg-foreground/10 border border-foreground/10 flex-wrap rounded-none overflow-hidden"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <ToggleGroupItem
                          key={s}
                          value={s}
                          className="px-6 h-12 text-[10px] font-display font-black uppercase tracking-[0.1em] rounded-none border-0 bg-[#0e0e0e] border-r border-foreground/5 data-[state=on]:bg-primary data-[state=on]:text-[#0e0e0e] hover:bg-white/5 transition-none flex-1"
                        >
                          {s}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>

                  {/* Main Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {[
                      { id: "type",                 label: "TIPO_EQUIP",  placeholder: "DRIVE / PLC / SENSOR" },
                      { id: "brand",                label: "MANUFACTURER",    placeholder: "SIEMENS / WEG / ABB" },
                      { id: "model",                label: "MODEL_REF",                placeholder: "SYS_REFERENCE" },
                      { id: "partNumber",           label: "SERIAL_PN",           placeholder: "S/N ID", mono: true },
                    ].map(field => (
                      <div key={field.id} className="space-y-4">
                        <div className="flex items-center justify-between px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-3 bg-primary/30" />
                            <Label htmlFor={field.id} className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground">
                              {field.label}
                            </Label>
                          </div>
                          {isAI(field.id) && (
                            <div className="px-2 py-0.5 border border-primary/20 bg-primary/5 text-[8px] font-mono font-black text-primary uppercase tracking-tighter flex items-center gap-1.5">
                              <Sparkles size={8} /> IA_SUGG
                            </div>
                          )}
                        </div>
                        <Input
                          id={field.id}
                          className={`h-12 rounded-none border-foreground/10 bg-[#131313]/60 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary transition-none border-[1px] ${field.mono ? "font-mono text-sm tracking-tight" : "font-display font-black text-xs uppercase tracking-wider"} ${isAI(field.id) ? "border-primary/40 bg-primary/[0.02]" : ""}`}
                          placeholder={field.placeholder}
                          value={formData[field.id]}
                          onChange={e => set(field.id, (e.target.value || "").toUpperCase())}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Specs */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3 bg-primary/30" />
                        <Label className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground">MOD_SPECIFICATIONS</Label>
                      </div>
                      {isAI("specifications") && (
                        <div className="px-2 py-0.5 border border-primary/20 bg-primary/5 text-[8px] font-mono font-black text-primary uppercase tracking-tighter flex items-center gap-1.5">
                          <Sparkles size={8} /> IA_GENERATED
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <div className="absolute top-3 right-3 font-mono text-[8px] text-muted-foreground pointer-events-none opacity-40 uppercase tracking-widest">RAW_TEXT_BLOCK</div>
                      <Textarea
                        className={`font-mono text-xs min-h-[160px] rounded-none border-foreground/10 bg-[#131313]/60 focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary border-[1px] leading-relaxed resize-none p-5 transition-none break-all ${isAI("specifications") ? "border-primary/40 bg-primary/[0.02]" : ""}`}
                        placeholder="POTÊNCIA // TENSÃO // CORRENTE // DIMENSÕES"
                        value={formData.specifications}
                        onChange={e => set("specifications", (e.target.value || "").toUpperCase())}
                      />
                    </div>
                  </div>
                </div>

                {/* AI Confirmation */}
                <AnimatePresence>
                  {hasPendingConfirmation && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.1 }}
                      className="bg-primary shadow-[inset_0_0_20px_rgba(0,0,0,0.1)] relative z-20"
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-8 px-8 py-8">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-none bg-[#0e0e0e] flex items-center justify-center text-primary shrink-0 border border-black/40 shadow-lg">
                            <Sparkles size={28} />
                          </div>
                          <div>
                            <p className="text-xs font-display font-black uppercase tracking-[0.25em] text-[#0e0e0e] leading-none mb-2">REVISÃO_PENDENTE</p>
                            <p className="text-[9px] font-mono text-[#0e0e0e]/70 uppercase tracking-widest font-bold">ANALYTICS_COMPLETE // CONFIRM_REQUIRED</p>
                          </div>
                        </div>
                        <div className="flex gap-px bg-black/10 border border-black/10 w-full sm:w-auto sm:ml-auto">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 sm:flex-none text-[10px] font-display font-black uppercase tracking-[0.2em] rounded-none border-0 bg-[#0e0e0e] text-white hover:bg-black/80 py-6 h-auto px-8 transition-none"
                            onClick={() => { setFormData(EMPTY_FORM); setAudioBlob(null); setValidationError(""); setSupportError(null); }}
                          >
                            DESCARTAR
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 sm:flex-none text-[10px] font-display font-black uppercase tracking-[0.25em] rounded-none border-0 bg-white text-black hover:bg-white/90 py-6 h-auto px-10 transition-none"
                            onClick={() => { setValidationError(""); setSupportError(null); confirmSuggestions(); }}
                          >
                            SINCRONIZAR
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Final Actions */}
              <div className="flex p-px bg-foreground/10 border-t border-foreground/10 shrink-0 bg-[#0e0e0e] relative z-10">
                <Button
                  variant="ghost"
                  className="flex-1 font-display font-black uppercase tracking-[0.3em] text-[10px] h-20 rounded-none bg-[#131313] hover:bg-white/5 text-muted-foreground transition-none"
                  onClick={() => { setValidationError(""); setSupportError(null); onClose(); }}
                >
                  ABORT_SESSION
                </Button>
                <Button
                  disabled={saving || isExtracting || hasPendingConfirmation}
                  onClick={handleSubmit}
                  className="flex-[2] font-display font-black uppercase tracking-[0.3em] text-[10px] h-20 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground shadow-none transition-none border-l border-white/10"
                >
                  {saving ? (
                    <>
                      <Loader2 className="animate-spin mr-3" size={16} />
                      MOD_SYNC_ACTIVE...
                    </>
                  ) : hasPendingConfirmation ? (
                    "REVISÃO_REQUERIDA"
                  ) : editItem ? (
                    "COMMIT_CHANGES"
                  ) : (
                    "INIT_DATA_COMMIT"
                  )}
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
