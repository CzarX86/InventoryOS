"use client";
import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Check, X, MessageSquare, Users, ChevronDown, ChevronRight, 
  Play, AlertCircle, Terminal, Brain, Shield, User, Briefcase, Info 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Sub-component to show message history for a contact
 */
function MessagePreview({ jid }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jid) return;
    
    const q = query(
      collection(db, "whatsapp_messages"),
      where("remoteJid", "==", jid),
      orderBy("timestamp", "desc"),
      limit(10)
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
      setMessages(msgs);
      setLoading(false);
    });

    return unsub;
  }, [jid]);

  if (loading) return (
    <div className="p-8 flex items-center justify-center gap-3 bg-[#0e0e0e]">
      <motion.div 
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="w-1 h-3 bg-primary/40" 
      />
      <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground">BUFFER_STREAM_SYNCING...</span>
    </div>
  );
  
  if (messages.length === 0) return (
    <div className="p-8 flex items-center justify-center gap-3 bg-[#0e0e0e]">
      <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/30">NO_DATA_BUFFER_FOUND</span>
    </div>
  );

  return (
    <div className="p-6 bg-[#0b0b0b] border-y border-white/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-muted-foreground/10 uppercase tracking-widest font-black pointer-events-none">
        CONTEXT_WINDOW_v2.5
      </div>
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-4 bg-primary/60" />
        <h4 className="text-[10px] uppercase tracking-[0.25em] font-display font-black text-muted-foreground flex items-center gap-2">
          PROTOCOL_HISTORY_STREAM
        </h4>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => (
            <motion.div 
              key={msg.id} 
              initial={{ opacity: 0, x: msg.fromMe ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`flex flex-col ${msg.fromMe ? 'items-end' : 'items-start'}`}
            >
              <div className={`max-w-[85%] px-4 py-3 border ${
                msg.fromMe 
                  ? 'bg-[#1a1b1b] border-primary/20 text-foreground' 
                  : 'bg-[#121212] border-white/10 text-muted-foreground'
              } rounded-none relative group`}>
                <div className="flex items-center justify-between gap-6 mb-2 border-b border-white/5 pb-1">
                  <span className="text-[9px] font-display font-black uppercase tracking-widest text-primary/60 truncate max-w-[150px]">
                    {msg.pushName || (msg.fromMe ? 'SYSTEM_ROOT' : 'EXT_USER')}
                  </span>
                  <span className="text-[8px] font-mono text-muted-foreground/40 font-black">
                    {msg.timestamp?.toDate()?.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] font-mono leading-relaxed whitespace-pre-wrap uppercase tracking-tight">
                  {msg.text}
                </p>
                
                {msg.extracted === "waiting_context" && (
                  <div className="mt-3 pt-2 border-t border-amber-500/20 flex items-center gap-2 text-[9px] text-amber-500/80 font-mono font-black uppercase tracking-widest">
                    <AlertCircle size={10} />
                    <span>FRAGMENT_DETECTED: {msg.completenessReason || "WAIT_CONTEXT"}</span>
                  </div>
                )}

                {msg.extracted === "skipped" && (
                  <div className="mt-3 pt-2 border-t border-red-500/20 flex items-center gap-2 text-[9px] text-red-500/60 font-mono font-black uppercase tracking-widest">
                    <Info size={10} />
                    <span>FILTER_SKIPPED: {msg.relevanceCategory || "IRRELEVANT"}</span>
                  </div>
                )}

              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function ContactReviewQueue() {
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Escutar contatos individuais
    const contactsQuery = query(collection(db, "whatsapp_contacts"), orderBy("lastMessageAt", "desc"));
    const unsubContacts = onSnapshot(contactsQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: "contact" }));
      setContacts(data);
    });

    // Escutar grupos
    const groupsQuery = query(collection(db, "whatsapp_groups"), orderBy("lastMessageAt", "desc"));
    const unsubGroups = onSnapshot(groupsQuery, (snap) => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data(), type: "group" }));
      setGroups(data);
      setLoading(false);
    });

    return () => {
      unsubContacts();
      unsubGroups();
    };
  }, []);

  const handleUpdateStatus = async (item, newStatus) => {
    const collectionName = item.type === "group" ? "whatsapp_groups" : "whatsapp_contacts";
    try {
      await updateDoc(doc(db, collectionName, item.id), {
        monitoringStatus: newStatus,
        updatedAt: new Date(),
        // Se for uma classificação direta de tipo (pessoal/profissional)
        ...(typeof newStatus === 'object' ? newStatus : {})
      });
    } catch (error) {
      console.error("Erro ao atualizar status de monitoramento:", error);
    }
  };

  const triggerBatchProcess = async () => {
    setIsProcessing(true);
    try {
      const trigger = httpsCallable(functions, "triggerWhatsappBatch");
      const result = await trigger();
      console.log("Batch Process Result:", result.data);
    } catch (error) {
      console.error("Erro ao disparar batch process:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-none font-display text-[9px] font-black uppercase tracking-widest rounded-none px-3">MONITORANDO</Badge>;
      case "ignored":
        return <Badge className="bg-muted text-muted-foreground border-none font-display text-[9px] font-black uppercase tracking-widest rounded-none px-3 opacity-40">IGNORADO</Badge>;
      case "pending_review":
      default:
        return <Badge className="bg-amber-500/10 text-amber-500 border-none font-display text-[9px] font-black uppercase tracking-widest rounded-none px-3">PENDENTE</Badge>;
    }
  };

  const getAiBadge = (item) => {
    const classification = item.aiClassification || "unprocessed";
    const confidence = item.confidenceScore || 0;
    
    if (classification === "unprocessed") {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-2 text-muted-foreground/20 italic font-mono text-[9px] uppercase tracking-widest">
                <Brain size={10} className="grayscale opacity-30" />
                <span>NO_INSIGHT</span>
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-black border-white/10 rounded-none text-[10px] font-mono tracking-widest uppercase">
              AGUARDANDO_PROCESSAMENTO_LOTE
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    const isHighConf = confidence > 0.85;
    const color = classification === "professional" ? "text-primary" : "text-purple-400";
    const Icon = classification === "professional" ? Briefcase : User;

    return (
      <div className="flex flex-col gap-1">
        <div className={`flex items-center gap-2 ${color} font-display text-[9px] font-black uppercase tracking-[0.15em]`}>
          <Icon size={12} />
          <span>{classification === "professional" ? "COMERCIAL" : "PESSOAL"}</span>
        </div>
        <div className="flex items-center gap-1.5 h-1 w-20 bg-white/5 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${confidence * 100}%` }}
            className={`h-full ${isHighConf ? 'bg-primary' : 'bg-muted-foreground/40'}`}
          />
        </div>
      </div>
    );
  };

  const allItems = [...contacts, ...groups].sort((a, b) => {
    const dateA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
    const dateB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
    return dateB - dateA; // descending
  });

  return (
    <div className="bg-[#0e0e0e] border border-white/5 rounded-none overflow-hidden font-display">
      {/* Header section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-8 bg-[#131313] border-b border-white/5 gap-6">
        <div className="flex items-center gap-5">
          <div className="w-1.5 h-12 bg-primary" />
          <div className="space-y-1">
            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-foreground leading-none">
              FILA_DE_REVISÃO_DE_GATEWAY
            </h2>
            <div className="flex items-center gap-3">
              <p className="text-[10px] font-mono font-black uppercase tracking-[0.25em] text-muted-foreground/40">
                SISTEMA_DE_ROTEAMENTO_E_PROSPECÇÃO_IA
              </p>
              <div className="h-px w-8 bg-white/5" />
              <div className="flex items-center gap-2 text-[9px] font-mono text-primary/60 font-black">
                <Shield size={10} />
                <span>ACTIVE_GUARD_LOADED</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4 w-full md:w-auto">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 md:flex-none bg-[#1a1b1c] border-white/10 text-muted-foreground hover:bg-white/5 font-display text-[9px] font-black uppercase tracking-[0.2em] rounded-none py-6 px-8 transition-none h-auto"
            onClick={triggerBatchProcess}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Terminal className="w-3.5 h-3.5 mr-2 animate-pulse" />
                SYNCING_LOTE...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 mr-2" />
                PROCESSAR_IA
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#1a1b1c]">
              <TableRow className="border-white/5 hover:bg-transparent">
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-muted-foreground font-display text-[9px] font-black uppercase tracking-[0.2em] py-5">IDENTIDADE_DO_STREAM</TableHead>
                <TableHead className="text-muted-foreground font-display text-[9px] font-black uppercase tracking-[0.2em] py-5">INSIGHT_IA</TableHead>
                <TableHead className="text-muted-foreground font-display text-[9px] font-black uppercase tracking-[0.2em] py-5">STATUS</TableHead>
                <TableHead className="text-muted-foreground font-display text-[9px] font-black uppercase tracking-[0.2em] py-5 text-right">COMANDOS_RAIO_X</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableCell colSpan={5} className="text-center py-24">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-0.5 bg-white/10 overflow-hidden relative">
                         <motion.div 
                          animate={{ left: ["-100%", "100%"] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 bg-primary/60" 
                        />
                      </div>
                      <span className="text-[10px] font-mono font-black uppercase tracking-[0.5em] text-muted-foreground/30">BUFFERING_ENVIRONMENT_DATA...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && allItems.length === 0 && (
                <TableRow className="hover:bg-transparent border-white/5">
                  <TableCell colSpan={5} className="text-center py-24">
                    <span className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-muted-foreground/20 italic">NULL_STREAM_DETECTION</span>
                  </TableCell>
                </TableRow>
              )}
              {allItems.map((item) => (
                <React.Fragment key={item.id}>
                  <TableRow 
                    className={`border-white/5 hover:bg-[#111111] transition-none cursor-pointer leading-none relative ${expandedId === item.id ? 'bg-[#111111]' : ''}`}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <TableCell className="p-0 text-center relative">
                      {expandedId === item.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                      <div className="flex items-center justify-center h-full">
                        {expandedId === item.id ? <ChevronDown size={14} className="text-primary" /> : <ChevronRight size={14} className="text-muted-foreground/20" />}
                      </div>
                    </TableCell>
                    <TableCell className="py-6">
                      <div className="flex flex-col gap-2">
                        <span className="flex items-center gap-3 font-display uppercase text-[12px] font-black tracking-widest text-white leading-none">
                          {item.type === "group" ? (
                            <Users size={14} className="text-secondary/60" />
                          ) : (
                            <MessageSquare size={14} className="text-primary/60" />
                          )}
                          <span className="truncate max-w-[250px]">{item.name || item.pushName || "UNIDENTIFIED_USER"}</span>
                        </span>
                        <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-tighter">
                          <span className="text-muted-foreground/30">{item.id}</span>
                          <span className="text-muted-foreground/10">•</span>
                          <span className="text-muted-foreground/40 font-black">
                            ACT: {item.lastMessageAt?.toDate()?.toLocaleDateString("pt-BR", { hour12: false, hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-6">{getAiBadge(item)}</TableCell>
                    <TableCell className="py-6">{getStatusBadge(item.monitoringStatus || "pending_review")}</TableCell>
                    <TableCell className="text-right py-6">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                onClick={() => handleUpdateStatus(item, "active")}
                                size="sm" 
                                className={`h-10 px-4 rounded-none transition-none font-black text-[9px] tracking-widest uppercase ${
                                  item.monitoringStatus === "active" 
                                    ? 'bg-emerald-500 text-black border-none' 
                                    : 'bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500 hover:text-black border border-emerald-500/20'
                                }`}
                              >
                                {item.monitoringStatus === "active" ? <Check size={14} strokeWidth={4} /> : "ATIVAR"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black border-white/10 rounded-none text-[9px] uppercase font-mono">
                              MONITORAR_ESTE_FLUXO
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button 
                                onClick={() => handleUpdateStatus(item, "ignored")}
                                size="sm" 
                                className={`h-10 px-4 rounded-none transition-none font-black text-[9px] tracking-widest uppercase ${
                                  item.monitoringStatus === "ignored"
                                    ? 'bg-red-500 text-black border-none'
                                    : 'bg-red-500/5 text-red-500 hover:bg-red-500 hover:text-black border border-red-500/20'
                                }`}
                              >
                                {item.monitoringStatus === "ignored" ? <X size={14} strokeWidth={4} /> : "IGNORAR"}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-black border-white/10 rounded-none text-[9px] uppercase font-mono">
                              REJEITAR_PROSPECÇÃO
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                  <AnimatePresence>
                    {expandedId === item.id && (
                      <TableRow className="border-white/5 bg-[#0b0b0b] hover:bg-transparent overflow-hidden">
                        <TableCell colSpan={5} className="p-0">
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "circOut" }}
                          >
                            <MessagePreview jid={item.id} />
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    )}
                  </AnimatePresence>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

