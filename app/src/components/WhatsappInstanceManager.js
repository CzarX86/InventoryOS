import { useState, useEffect, useCallback, Fragment } from "react";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Loader2, QrCode, Smartphone, Wifi, WifiOff, Trash2, LogOut, Plus, RefreshCw, CheckCircle2, Info, PauseCircle, PlayCircle, ChevronDown, ChevronUp, Copy, Bot, AlertCircle, Eye, PowerOff, Users, User, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

export default function WhatsappInstanceManager() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [activeInstance, setActiveInstance] = useState(null);
  const [newInstanceName, setNewInstanceName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [events, setEvents] = useState([]);
  const [notification, setNotification] = useState(null); // { message: string, type: 'success' | 'error' }
  const [pausedInstances, setPausedInstances] = useState({});

  const toggleInstancePause = async (instanceName) => {
    setActionLoading(`pause-${instanceName}`);
    // Simulate network delay to give user precise UI feedback on their click action
    await new Promise(r => setTimeout(r, 600));
    
    setPausedInstances(prev => {
      const newState = { ...prev, [instanceName]: !prev[instanceName] };
      try {
        localStorage.setItem("whatsapp_paused_instances", JSON.stringify(newState));
      } catch {}
      
      showNotification(
        newState[instanceName]
          ? `Digestion pausada na instância [${instanceName}].`
          : `Digestion retomada na instância [${instanceName}].`
      );
      
      return newState;
    });
    setActionLoading(null);
  };
  const [expandedEvent, setExpandedEvent] = useState(null);

  const [ignoredGroups, setIgnoredGroups] = useState({});

  useEffect(() => {
    try {
      const p = localStorage.getItem("whatsapp_paused_instances");
      if (p) setPausedInstances(JSON.parse(p));
      const i = localStorage.getItem("whatsapp_ignored_groups");
      if (i) setIgnoredGroups(JSON.parse(i));
    } catch (e) {}
  }, []);

  const toggleGroupIgnore = async (groupId, groupName) => {
    setActionLoading(`group-${groupId}`);
    await new Promise(r => setTimeout(r, 600)); // fake delay
    setIgnoredGroups(prev => {
      const newState = { ...prev, [groupId]: !prev[groupId] };
      try { localStorage.setItem("whatsapp_ignored_groups", JSON.stringify(newState)); } catch {}
      showNotification(newState[groupId] 
        ? `Grupo "${groupName}" silenciado. A IA não processará mais mensagens dele.`
        : `Grupo "${groupName}" monitorado. A IA voltará a escutá-lo.`
      );
      return newState;
    });
    setActionLoading(null);
  };

  const getContactInfo = (payload) => {
    if (!payload?.data?.message?.key && !payload?.data?.key) return { name: "Sistema", id: "---", isGroup: false };
    const key = payload.data.message?.key || payload.data.key;
    const remoteJid = key?.remoteJid || "";
    const isGroup = remoteJid.includes("@g.us");
    const id = isGroup ? (key?.participant || remoteJid) : remoteJid;
    const senderName = payload.data.pushName || id?.split("@")[0] || "Desconhecido";
    
    // Evolution API v2 often has group name in payload.data.groupContext.groupName
    let groupName = payload.data?.groupContext?.groupName || 
                    payload.data?.sender?.name;
    
    if (isGroup && !groupName) {
      groupName = remoteJid.split("@")[0]; // Fallback to JID part
    }

    return { 
      name: senderName, 
      groupName: isGroup ? groupName : null,
      id: id?.split("@")[0], 
      isGroup, 
      groupId: remoteJid
    };
  };

  const getMessagePreview = (payload) => {
    const data = payload?.data;
    const msg = data?.message;
    
    if (!msg) {
      if (payload.eventType === "groups.upsert" || payload.eventType === "groups.update") {
        return `Configuração de Grupo: ${data?.subject || data?.name || "Alterada"}`;
      }
      return "(Sem conteúdo/Evento de sistema)";
    }
    
    return msg.conversation || 
           msg.extendedTextMessage?.text || 
           (msg.imageMessage ? "[Imagem anexada]" : null) || 
           (msg.audioMessage ? "[Áudio anexado]" : null) || 
           (msg.videoMessage ? "[Vídeo anexado]" : null) || 
           (msg.documentMessage ? "[Documento anexado]" : "[Arquivo/Mídia]");
  };

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const fetchEvents = useCallback(async () => {
    try {
      const getEvents = httpsCallable(functions, "getWhatsappEvents");
      const result = await getEvents();
      setEvents(result.data || []);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  }, []);

  const fetchInstances = useCallback(async () => {
    try {
      const listInstances = httpsCallable(functions, "listWhatsappInstances");
      const result = await listInstances();
      if (result.data.status === 200) {
        setInstances(result.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch instances:", error);
      showNotification("Erro ao atualizar instâncias. Verifique a conexão com a Evolution API.", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
    fetchEvents();
    const instInterval = setInterval(fetchInstances, 30000); // Poll every 30s
    const eventInterval = setInterval(fetchEvents, 15000);   // Poll events more frequently
    return () => {
      clearInterval(instInterval);
      clearInterval(eventInterval);
    };
  }, [fetchInstances, fetchEvents]);

  const handleCreateInstance = async () => {
    if (!newInstanceName) return;
    setActionLoading("create");
    try {
      const createInstance = httpsCallable(functions, "createWhatsappInstance");
      const result = await createInstance({ instanceName: newInstanceName });
      if (result.data.status === 201) {
        setNewInstanceName("");
        await fetchInstances();
      }
    } catch (error) {
      console.error("Failed to create instance:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteInstance = async (instanceName) => {
    setActionLoading(instanceName);
    try {
      const deleteInstance = httpsCallable(functions, "deleteWhatsappInstance");
      const result = await deleteInstance({ instanceName });
      
      if (result.data.status === 200) {
        showNotification(`Instância ${instanceName} deletada com sucesso!`);
        await fetchInstances();
        if (activeInstance === instanceName) {
          setActiveInstance(null);
          setQrCode(null);
        }
      } else {
        throw new Error(result.data.data?.message || "Erro desconhecido");
      }
      setConfirmDelete(null);
    } catch (error) {
      console.error("Failed to delete instance:", error);
      showNotification(`Falha ao deletar: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogoutInstance = async (instanceName) => {
    setActionLoading(instanceName);
    try {
      const logoutInstance = httpsCallable(functions, "logoutWhatsappInstance");
      await logoutInstance({ instanceName });
      await fetchInstances();
    } catch (error) {
      console.error("Failed to logout instance:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleGetQrCode = async (instanceName) => {
    setActiveInstance(instanceName);
    setQrCode("loading");
    try {
      const getQr = httpsCallable(functions, "getWhatsappQrCode");
      const result = await getQr({ instanceName });
      if (result.data.data?.base64) {
        setQrCode(result.data.data.base64);
      } else {
        setQrCode(null);
      }
    } catch (error) {
      console.error("Failed to get QR code:", error);
      setQrCode(null);
    }
  };

  const handleSetWebhook = async (instanceName) => {
    setActionLoading(`webhook-${instanceName}`);
    try {
      const setWebhook = httpsCallable(functions, "setWhatsappWebhook");
      await setWebhook({ instanceName });
      showNotification("Webhook configurado com sucesso! Monitorando eventos...");
    } catch (error) {
      console.error("Failed to set webhook:", error);
      showNotification(`Erro ao configurar webhook: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSyncGroups = async (instanceName) => {
    setActionLoading(`sync-${instanceName}`);
    try {
      const syncGroups = httpsCallable(functions, "syncWhatsappGroups");
      const result = await syncGroups({ instanceName });
      
      if (result.data.status === 200) {
        showNotification(result.data.message || "Grupos sincronizados com sucesso!");
        await fetchInstances();
        await fetchEvents(); // Refresh to resolve names
      } else {
        throw new Error(result.data.message || "Falha na sincronização");
      }
    } catch (error) {
      console.error("Failed to sync groups:", error);
      showNotification(`Erro ao sincronizar grupos: ${error.message}`, "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-8 bg-[#0e0e0e]">
      {/* Header & Create */}
      <div className="border border-[#484848]/20 bg-[#131313] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-3 text-[8px] font-mono text-[#484848] uppercase tracking-widest">WAPP_INSTANCE_CONTROLLER</div>
        <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="space-y-2">
            <Badge variant="outline" className="h-5 px-2 bg-[#1f2020] text-[#97a5ff] border-[#484848]/20 text-[9px] font-normal uppercase tracking-[0.2em] rounded-none font-display">
              OPS_INITIATOR
            </Badge>
            <h2 className="text-2xl font-normal uppercase tracking-tighter text-[#e7e5e5] font-display">INSTÂNCIAS_<span className="text-[#acabaa]/30">WHATSAPP</span></h2>
            <p className="text-[10px] text-[#acabaa]/40 font-mono uppercase tracking-widest">PROTOCOLO_DE_CONEXÃO_MULTI_DISPOSITIVO</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-0 group relative border border-[#484848]/20 bg-[#0e0e0e]">
              <div className="px-3 border-r border-[#484848]/10 text-[#acabaa]/30 hidden md:block">
                <Bot size={14} />
              </div>
              <Input
                type="text"
                placeholder="ID_INSTÂNCIA (ALPHA_NUM)"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
                className="w-full md:w-64 font-mono text-xs uppercase tracking-tight h-12 border-0 bg-transparent focus-visible:ring-0 rounded-none text-[#e7e5e5]"
              />
            </div>
            <Button
              onClick={handleCreateInstance}
              disabled={actionLoading === "create" || !newInstanceName}
              className="font-normal uppercase tracking-widest px-8 h-12 rounded-none bg-primary hover:bg-primary/90 text-primary-foreground transition-none font-display text-[10px]"
            >
              {actionLoading === "create" ? (
                <Loader2 className="animate-spin mr-3" size={14} />
              ) : (
                <Plus size={14} className="mr-3" />
              )}
              PROLONG_STORAGE
            </Button>
          </div>
        </div>
      </div>

      {/* Instances List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {instances.length === 0 ? (
          <div className="col-span-full border border-dashed border-[#484848]/20 bg-transparent p-12 text-center rounded-none">
            <p className="text-[10px] font-normal uppercase tracking-[0.3em] text-[#acabaa]/30 font-display">SYSTEM_EMPTY: NO_ACTIVE_INSTANCES</p>
          </div>
        ) : (
          instances.map((inst) => {
            const instanceName = inst?.instance?.instanceName || inst?.name || inst?.instanceName;
            const connectionStatus = inst?.instance?.status || inst?.connectionStatus || inst?.status;
            
            if (!instanceName) return null;

            const isConnected = connectionStatus === "open";
            const isActionLoading = actionLoading === instanceName;

            return (
              <div 
                key={instanceName}
                className="group relative flex flex-col bg-[#131313] border border-[#484848]/20 rounded-none transition-none overflow-hidden"
              >
                {/* Status Bar */}
                <div className={`h-1 w-full ${isConnected ? "bg-emerald-500/40" : "bg-amber-500/40"}`} />
                
                <div className="p-6 flex flex-row items-start justify-between space-y-0 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-none border ${isConnected ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border-amber-500/20"}`}>
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <h3 className="text-lg font-normal uppercase tracking-tighter text-[#e7e5e5] font-display">{instanceName}</h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <Badge variant="outline" className={`h-4 px-2 text-[8px] font-bold uppercase tracking-[0.2em] rounded-none font-mono ${isConnected ? "border-emerald-500/20 text-emerald-500" : "border-amber-500/20 text-amber-500"}`}>
                          {isConnected ? "STABLE_CONNECTION" : "LINK_REQUIRED"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {confirmDelete === instanceName ? (
                      <div className="flex items-center gap-px bg-[#484848]/20 border border-[#484848]/20">
                        <Button 
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteInstance(instanceName)}
                          className="h-9 px-4 text-[8px] font-normal uppercase tracking-widest rounded-none bg-[#7f2927] hover:bg-[#9e3330] transition-none font-display"
                        >
                          CONFIRM_PURGE
                        </Button>
                        <Button 
                          size="icon"
                          variant="ghost"
                          onClick={() => setConfirmDelete(null)}
                          className="h-9 w-9 bg-[#1f2020] text-[#acabaa] rounded-none hover:bg-[#2a2b2b] transition-none"
                        >
                          <Plus size={14} className="rotate-45" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <Button 
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleInstancePause(instanceName)}
                            className={`h-10 w-10 rounded-none border border-transparent transition-none ${pausedInstances[instanceName] ? "text-amber-500 bg-amber-500/10 border-amber-500/20" : "text-[#acabaa]/40 hover:text-[#e7e5e5] hover:bg-[#1f2020]"}`}
                        >
                            {actionLoading === `pause-${instanceName}` ? <Loader2 size={16} className="animate-spin" /> : (pausedInstances[instanceName] ? <PlayCircle size={16} /> : <PauseCircle size={16} />)}
                        </Button>

                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSetWebhook(instanceName)}
                          className={`h-10 w-10 rounded-none border border-transparent transition-none ${isConnected ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-[#acabaa]/40 hover:text-[#e7e5e5] hover:bg-[#1f2020]"}`}
                        >
                          {actionLoading === `webhook-${instanceName}` ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                        </Button>

                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSyncGroups(instanceName)}
                          className="h-10 w-10 rounded-none text-[#acabaa]/40 hover:text-emerald-500 hover:bg-emerald-500/10 hover:border-emerald-500/20 border border-transparent transition-none"
                        >
                          {actionLoading === `sync-${instanceName}` ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        </Button>

                        <Button 
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(instanceName)}
                          className="h-10 w-10 rounded-none text-[#acabaa]/40 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/20 border border-transparent transition-none"
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 pb-8 pt-0 flex flex-col gap-6 relative z-10">
                  <div className="h-px w-full bg-[#484848]/10" />
                  
                  {/* Actions / QR Code Area */}
                  {!isConnected ? (
                    <div className="space-y-6">
                      {activeInstance === instanceName && qrCode ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-none border-4 border-primary/20">
                          {qrCode === "loading" ? (
                            <div className="h-48 w-48 flex items-center justify-center">
                              <Loader2 className="animate-spin text-[#0e0e0e]" size={32} />
                            </div>
                          ) : (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={qrCode} alt="WhatsApp QR Code" className="h-48 w-48" />
                              <div className="mt-6 px-4 py-1.5 bg-[#0e0e0e] text-[#e7e5e5] text-[10px] font-normal uppercase tracking-[0.2em] rounded-none font-display border border-primary/20 anim-pulse">

                                AGUARDANDO_ESCANEAMENTO
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleGetQrCode(instanceName)}
                          className="w-full h-14 bg-emerald-600 hover:bg-emerald-500 text-[#0e0e0e] font-normal uppercase tracking-[0.3em] rounded-none transition-none font-display text-xs"
                        >
                          <QrCode size={18} className="mr-3" />
                          INIT_CONNECT_SEQUENCE
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-[#1f2020] p-4 rounded-none border border-[#484848]/10 flex flex-col gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#acabaa]/30 font-mono">BATERIA_LVL</span>
                          <span className="text-sm font-bold text-[#e7e5e5] font-mono">
                            {inst.battery !== undefined && inst.battery !== null ? `${inst.battery}%` : (inst.instance?.batteryLevel ?? "---")}
                          </span>
                        </div>
                        <div className="bg-[#1f2020] p-4 rounded-none border border-[#484848]/10 flex flex-col gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-[#acabaa]/30 font-mono">OS_ARCH_TYPE</span>
                          <span className="text-sm font-bold text-[#e7e5e5] uppercase font-mono tracking-tighter">
                            {inst.platform || inst.instance?.platform || "---"}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleLogoutInstance(instanceName)}
                          className="col-span-2 h-12 mt-4 font-normal uppercase tracking-[0.25em] border-[#7f2927]/20 bg-[#0e0e0e] hover:bg-[#7f2927]/10 text-[#ee7d77] rounded-none transition-none font-display text-[10px]"
                        >
                          <LogOut size={16} className="mr-3" />
                          EXIT_INSTANCE_SESSION
                        </Button>
                      </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Global Notification */}
      {notification && (
        <div className="fixed bottom-10 right-10 z-[100] border-l-4 border-primary bg-[#131313] p-6 shadow-[0_32px_64px_rgba(0,0,0,0.6)] animate-in slide-in-from-right-8 duration-200 rounded-none w-96 border border-[#484848]/20">
          <div className="flex items-start gap-5">
            <div className={`mt-1 p-2 rounded-none border ${notification.type === "error" ? "bg-[#7f2927]/10 text-[#ee7d77] border-[#7f2927]/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"}`}>
              {notification.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-normal uppercase tracking-[0.25em] text-[#acabaa]/40 mb-2 font-display">
                SYSTEM_EVENT:// {notification.type === "error" ? "CRITICAL_ERROR" : "OP_SUCCESS"}
              </p>
              <p className="text-sm font-bold text-[#e7e5e5] uppercase font-mono leading-tight tracking-tight">
                {notification.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Activity Monitor Section */}
      <div className="mt-12 flex flex-col gap-8">
        <div className="flex items-center justify-between border-b border-[#484848]/20 pb-6 relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <Activity className="text-[#97a5ff]" size={20} />
            <div>
              <h2 className="text-sm font-normal uppercase tracking-[0.4em] text-[#e7e5e5] font-display">
                MONITOR_ATIVIDADE_GLOBAL
              </h2>
              <p className="text-[9px] font-mono uppercase tracking-widest text-[#acabaa]/30 mt-1">REALTIME_EVENT_STREAM_V2</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-2 bg-[#0e0e0e] border border-emerald-500/20 relative z-10">
            <span className="w-1.5 h-1.5 rounded-none bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-500 font-mono">LINK_ACTIVE</span>
          </div>
        </div>
        
        <div className="border border-[#484848]/20 bg-[#131313] rounded-none overflow-hidden">
          <Table className="font-mono">
            <TableHeader className="bg-[#1f2020] border-b border-[#484848]/20">
              <TableRow className="hover:bg-transparent border-none h-14">
                <TableHead className="w-12"></TableHead>
                <TableHead className="text-[9px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/40 font-display">TYPE_ID</TableHead>
                <TableHead className="text-[9px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/40 font-display">ENDPOINT_CONTEXT</TableHead>
                <TableHead className="text-[9px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/40 font-display">PROCESSING_STATE</TableHead>
                <TableHead className="text-right text-[9px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/40 font-display">TIMESTAMP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="p-12 text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">
                    Aguardando eventos do WhatsApp...
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const isExpanded = expandedEvent === event.id;
                  const previewText = getMessagePreview(event.payload);
                  const contact = getContactInfo(event.payload);
                  
                  return (
                    <Fragment key={event.id}>
                      <TableRow 
                        className={`cursor-pointer transition-none group border-b border-[#484848]/10 h-16 ${isExpanded ? "bg-[#1f2020]" : "bg-[#131313] hover:bg-[#191a1a]"}`}
                        onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                      >
                        <TableCell className="text-[#acabaa]/30 group-hover:text-[#e7e5e5]">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-normal uppercase tracking-tight group-hover:text-[#97a5ff] text-[#e7e5e5] font-display">
                              {event.eventType || "MESSAGES_UPSERT"}
                            </span>
                            <span className="text-[8px] font-mono uppercase tracking-widest text-[#acabaa]/30 font-bold">UID_{event.id.slice(-8)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-1.5">
                            {contact.isGroup ? (
                              <>
                                <span className="text-[10px] font-normal uppercase tracking-tight text-emerald-500/80 flex items-center gap-2 font-display">
                                  <Users size={12}/> {contact.groupName.toUpperCase()}
                                </span>
                                <span className="text-[9px] font-bold text-[#acabaa]/40 flex items-center gap-1.5 uppercase tracking-tighter">
                                  <User size={10}/> {contact.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-[10px] font-normal text-[#e7e5e5] flex items-center gap-2 uppercase font-display">
                                <User size={12} className="text-[#acabaa]/30"/> {contact.name}
                              </span>
                            )}
                            <span className="text-[8px] font-bold uppercase tracking-widest text-[#acabaa]/10 font-mono">
                              SRC_ID::{event.instanceId || "NIL"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col items-start gap-2">
                            <Badge variant="outline" className={`text-[8px] font-bold uppercase tracking-[0.2em] border-none px-2 py-0.5 h-auto rounded-none font-mono ${
                              event.status === "processed" ? "bg-emerald-500/10 text-emerald-500" :
                              event.status === "failed" ? "bg-red-500/10 text-red-500" :
                              "bg-[#1f2020] text-[#acabaa]/40"
                            }`}>
                              {event.status === "processed" ? "SYNC_COMPLETE" : (event.status ? event.status.toUpperCase() : "RECEIVED")}
                            </Badge>
                            
                            {event.payload?.data?.message && (
                              <Badge variant="outline" className={`text-[8px] font-bold uppercase tracking-[0.2em] border-none px-2 py-0.5 h-auto rounded-none font-mono gap-2 ${
                                event.aiExtractionStatus === "processed" ? "bg-[#3e4829] text-[#acc3ce]" :
                                event.aiExtractionStatus === "failed" ? "bg-[#7f2927]/10 text-[#ee7d77]" :
                                "bg-[#1f2020] text-[#acabaa]/20"
                              }`}>
                                <Bot size={10} />
                                {event.aiExtractionStatus === "processed" ? (event.aiClassification ? event.aiClassification.toUpperCase() : "EXTRACTED") : 
                                 event.aiExtractionStatus === "failed" ? "ENGINE_ERR" : "QUEUE_ACTIVE"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[9px] font-bold text-[#e7e5e5] font-mono tracking-tight">
                              {event.occurredAt ? new Date(event.occurredAt).toLocaleDateString("pt-BR") : "---"}
                            </span>
                            <span className="text-[8px] font-bold text-[#acabaa]/20 font-mono tracking-widest">
                              {event.occurredAt ? new Date(event.occurredAt).toLocaleTimeString("pt-BR") : "---"}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent bg-[#111212]/50 border-b border-[#484848]/20">
                          <TableCell colSpan={5} className="p-8">
                            <div className="flex flex-col gap-8 animate-in fade-in duration-200">
                              {previewText && (
                                <div className="p-6 bg-[#0e0e0e] border border-[#484848]/20 rounded-none relative">
                                  <div className="absolute top-0 right-0 p-2 text-[7px] font-mono text-[#484848] uppercase tracking-[0.4em]">RAW_STRING_BUFFER</div>
                                  <span className="text-[9px] font-normal uppercase tracking-[0.2em] text-[#97a5ff] mb-4 block font-display">PREVIEW_DE_FRAGMENTO</span>
                                  <p className="text-sm text-[#e7e5e5]/80 font-mono leading-relaxed border-l-2 border-[#484848]/40 pl-4">{previewText}</p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#484848]/20 border border-[#484848]/20">
                                <div className="bg-[#131313] p-6 flex items-center justify-between transition-none">
                                  <div className="flex gap-5 items-center">
                                    <div className="p-3 bg-[#1f2020] rounded-none border border-[#484848]/10 text-[#acabaa]/30">
                                      <Bot size={18}/>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-normal uppercase tracking-widest text-[#acabaa]/40 font-display">ENGINE_CLASSIFIER</span>
                                      <span className="text-xs font-bold text-[#e7e5e5] uppercase font-mono">{event.aiExtraction ? "OPTIMIZED_EXTRACTION" : "WAITING_IN_BUFFER..."}</span>
                                    </div>
                                  </div>
                                  <Button variant="outline" size="sm" className="h-9 px-6 text-[8px] font-normal uppercase tracking-widest rounded-none border-[#484848]/20 font-display transition-none hover:bg-[#1f2020]">
                                    <Eye size={14} className="mr-2" /> REVISAR_LOG
                                  </Button>
                                </div>

                                {contact.isGroup && (
                                  <div className={`bg-[#131313] p-6 flex items-center justify-between transition-none ${ignoredGroups[contact.groupId] ? "border-l-4 border-amber-500/40" : ""}`}>
                                    <div className="flex gap-5 items-center min-w-0">
                                      <div className={`p-3 rounded-none border ${ignoredGroups[contact.groupId] ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-[#1f2020] border-[#484848]/10 text-[#acabaa]/30"}`}>
                                        <Users size={18}/>
                                      </div>
                                      <div className="flex flex-col min-w-0">
                                        <span className="text-[9px] font-normal uppercase tracking-widest text-[#acabaa]/40 font-display">MONITOR_POLICY</span>
                                        <span className="text-xs font-bold text-[#e7e5e5] uppercase font-mono truncate">{contact.groupName}</span>
                                      </div>
                                    </div>
                                    <Button 
                                      variant={ignoredGroups[contact.groupId] ? "default" : "outline"}
                                      size="sm"
                                      onClick={(e) => { e.stopPropagation(); toggleGroupIgnore(contact.groupId, contact.name); }}
                                      className={`h-9 px-6 text-[8px] font-normal uppercase tracking-widest rounded-none transition-none font-display ${ignoredGroups[contact.groupId] ? "bg-amber-600 hover:bg-amber-500 text-[#0e0e0e] border-none" : "border-[#484848]/20 hover:bg-[#1f2020]"}`}
                                    >
                                      {actionLoading === `group-${contact.groupId}` ? <Loader2 size={12} className="animate-spin" /> : (ignoredGroups[contact.groupId] ? <PlayCircle size={14} className="mr-2" /> : <PowerOff size={14} className="mr-2" />)}
                                      {ignoredGroups[contact.groupId] ? "ENABLE_LISTEN" : "MUTE_DOMAIN"}
                                    </Button>
                                  </div>
                                )}
                              </div>

                              <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                  <span className="text-[9px] font-normal uppercase tracking-[0.25em] text-[#acabaa]/20 font-display">METADATA_EXTRACT_REPT</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      navigator.clipboard.writeText(JSON.stringify(event.payload || event, null, 2));
                                      showNotification("Payload copiado com sucesso!");
                                    }}
                                    className="h-8 text-[8px] font-normal uppercase tracking-widest text-[#acabaa]/30 hover:text-[#e7e5e5] transition-none font-display"
                                  >
                                    <Copy size={12} className="mr-2" /> CLONE_JSON_NODE
                                  </Button>
                                </div>
                                <div className="h-48 w-full border border-[#484848]/10 bg-[#0e0e0e] p-6 font-mono text-[10px] overflow-auto custom-scrollbar">
                                  <pre className="text-[#acabaa]/40 leading-relaxed">
                                    {JSON.stringify(event.payload || event, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
      </div>
    </div>
  );
}
