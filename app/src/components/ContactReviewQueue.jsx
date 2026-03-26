"use client";
import React, { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, MessageSquare, Users, ChevronDown, ChevronRight, Play, AlertCircle, Terminal } from "lucide-react";

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
      <div className="w-1 h-3 bg-primary/40 animate-pulse" />
      <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground">BUFFER_STREAM_SYNCING...</span>
    </div>
  );
  
  if (messages.length === 0) return (
    <div className="p-8 flex items-center justify-center gap-3 bg-[#0e0e0e]">
      <span className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/30">NO_DATA_BUFFER_FOUND</span>
    </div>
  );

  return (
    <div className="p-6 bg-[#0e0e0e] border-y border-foreground/5 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-muted-foreground/10 uppercase tracking-widest font-black pointer-events-none">
        CONTEXT_WINDOW_v2.4
      </div>
      
      <div className="flex items-center gap-3 mb-6">
        <div className="w-1 h-4 bg-primary/60" />
        <h4 className="text-[10px] uppercase tracking-[0.25em] font-display font-black text-muted-foreground flex items-center gap-2">
          PROTOCOL_HISTORY_STREAM
        </h4>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.fromMe ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] px-4 py-3 border ${
              msg.fromMe 
                ? 'bg-[#1f2020] border-primary/20 text-foreground' 
                : 'bg-[#131313] border-foreground/10 text-muted-foreground'
            } rounded-none relative`}>
              <div className="flex items-center justify-between gap-6 mb-2 border-b border-foreground/5 pb-1">
                <span className="text-[9px] font-display font-black uppercase tracking-widest text-primary/60 truncate max-w-[120px]">
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
            </div>
          </div>
        ))}
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

  const handleUpdateStatus = async (id, type, newStatus) => {
    const collectionName = type === "group" ? "whatsapp_groups" : "whatsapp_contacts";
    try {
      await updateDoc(doc(db, collectionName, id), {
        monitoringStatus: newStatus,
        updatedAt: new Date()
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

  const allItems = [...contacts, ...groups].sort((a, b) => {
    const dateA = a.lastMessageAt?.toMillis ? a.lastMessageAt.toMillis() : 0;
    const dateB = b.lastMessageAt?.toMillis ? b.lastMessageAt.toMillis() : 0;
    return dateB - dateA; // descending
  });

  return (
    <div className="bg-[#0e0e0e] border border-foreground/5 rounded-none overflow-hidden font-display">
      {/* Header section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-[#131313] border-b border-foreground/5 gap-6">
        <div className="flex items-center gap-4">
          <div className="w-1.5 h-10 bg-primary" />
          <div className="space-y-1">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-foreground leading-none">
              FILA_DE_REVISÃO_DE_GATEWAY
            </h2>
            <p className="text-[10px] font-mono font-black uppercase tracking-[0.15em] text-muted-foreground/60">
              SISTEMA_DE_ROTEAMENTO_E_FILTRAGEM_SEMÂNTICA_IA
            </p>
          </div>
        </div>
        
        <Button 
          variant="outline" 
          size="sm" 
          className="bg-[#1f2020] border-primary/20 text-primary hover:bg-primary hover:text-[#0e0e0e] font-display text-[10px] font-black uppercase tracking-[0.2em] rounded-none py-6 px-6 transition-none shrink-0"
          onClick={triggerBatchProcess}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <>
              <Terminal className="w-4 h-4 mr-2 animate-pulse" />
              EXECUTANDO_LOTE...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              FORÇAR_PROCESSAMENTO_IA
            </>
          )}
        </Button>
      </div>

      <div className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#1f2020]">
              <TableRow className="border-foreground/5 hover:bg-transparent">
                <TableHead className="w-10"></TableHead>
                <TableHead className="text-muted-foreground font-display text-[10px] font-black uppercase tracking-[0.2em] py-5">IDENTIDADE_DO_STREAM</TableHead>
                <TableHead className="text-muted-foreground font-display text-[10px] font-black uppercase tracking-[0.2em] py-5">ÚLTIMO_CONTATO</TableHead>
                <TableHead className="text-muted-foreground font-display text-[10px] font-black uppercase tracking-[0.2em] py-5">STATUS_MONITOR</TableHead>
                <TableHead className="text-muted-foreground font-display text-[10px] font-black uppercase tracking-[0.2em] py-5 text-right">COMANDOS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow className="hover:bg-transparent border-foreground/5">
                  <TableCell colSpan={5} className="text-center py-20">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-1 bg-foreground/10 overflow-hidden relative">
                         <div className="absolute inset-0 bg-primary/40 animate-[loading-bar_2s_infinite]" />
                      </div>
                      <span className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-muted-foreground/40">BUFFERING_ENVIRONMENT_DATA...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && allItems.length === 0 && (
                <TableRow className="hover:bg-transparent border-foreground/5">
                  <TableCell colSpan={5} className="text-center py-20">
                    <span className="text-[10px] font-mono font-black uppercase tracking-[0.4em] text-muted-foreground/20 italic">NULL_STREAM_DETECTION</span>
                  </TableCell>
                </TableRow>
              )}
              {allItems.map((item) => (
                <React.Fragment key={item.id}>
                  <TableRow 
                    className={`border-foreground/5 hover:bg-[#131313] transition-none cursor-pointer leading-none ${expandedId === item.id ? 'bg-[#131313] border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'}`}
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                  >
                    <TableCell className="p-0 text-center">
                      <div className="flex items-center justify-center h-full">
                        {expandedId === item.id ? <ChevronDown size={14} className="text-primary" /> : <ChevronRight size={14} className="text-muted-foreground/40" />}
                      </div>
                    </TableCell>
                    <TableCell className="py-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="flex items-center gap-3 font-display uppercase text-xs font-black tracking-widest text-foreground">
                          {item.type === "group" ? (
                            <div className="p-1 px-1.5 bg-secondary/10 text-secondary border border-secondary/20">
                              <Users size={12} strokeWidth={3} />
                            </div>
                          ) : (
                            <div className="p-1 px-1.5 bg-primary/10 text-primary border border-primary/20">
                              <MessageSquare size={12} strokeWidth={3} />
                            </div>
                          )}
                          {item.name || "UNIDENTIFIED_STREAM"}
                        </span>
                        <span className="text-[9px] text-muted-foreground/30 font-mono uppercase tracking-tighter truncate max-w-[200px]">{item.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground/60 text-[10px] font-mono font-black uppercase py-4">
                      {item.lastMessageAt?.toDate()?.toLocaleDateString("pt-BR", { hour12: false, hour: '2-digit', minute: '2-digit' }) || 'DATA_ERR'}
                    </TableCell>
                    <TableCell className="py-4">{getStatusBadge(item.monitoringStatus || "pending_review")}</TableCell>
                    <TableCell className="text-right py-4">
                      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {item.monitoringStatus !== "active" && (
                          <Button 
                            onClick={() => handleUpdateStatus(item.id, item.type, "active")}
                            variant="ghost" 
                            size="sm" 
                            className="h-9 w-9 p-0 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-[#0e0e0e] border-none rounded-none transition-none"
                          >
                            <Check size={16} strokeWidth={3} />
                          </Button>
                        )}
                        {item.monitoringStatus !== "ignored" && (
                          <Button 
                            onClick={() => handleUpdateStatus(item.id, item.type, "ignored")}
                            variant="ghost" 
                            size="sm" 
                            className="h-9 w-9 p-0 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-[#0e0e0e] border-none rounded-none transition-none"
                          >
                            <X size={16} strokeWidth={3} />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === item.id && (
                    <TableRow className="border-foreground/5 bg-[#0e0e0e] hover:bg-transparent">
                      <TableCell colSpan={5} className="p-0 border-l-2 border-l-primary">
                        <MessagePreview jid={item.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

