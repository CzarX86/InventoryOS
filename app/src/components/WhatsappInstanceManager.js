import { useState, useEffect, useCallback, Fragment } from "react";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Loader2, QrCode, Smartphone, Wifi, WifiOff, Trash2, LogOut, Plus, RefreshCw, CheckCircle2, Info, PauseCircle, PlayCircle, ChevronDown, ChevronUp } from "lucide-react";

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
  const [isPaused, setIsPaused] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState(null);

  const getMessagePreview = (payload) => {
    if (!payload?.data?.message) return null;
    const msg = payload.data.message;
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
    if (!isPaused) fetchEvents();
    const instInterval = setInterval(fetchInstances, 30000); // Poll every 30s
    let eventInterval;
    if (!isPaused) {
      eventInterval = setInterval(fetchEvents, 15000);   // Poll events more frequently
    }
    return () => {
      clearInterval(instInterval);
      if (eventInterval) clearInterval(eventInterval);
    };
  }, [fetchInstances, fetchEvents, isPaused]);

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

  if (loading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin text-zinc-500" size={24} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      {/* Header & Create */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/50 p-6 border border-white/5 backdrop-blur-sm">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight text-white mb-1">Gerenciar WhatsApp</h2>
          <p className="text-sm text-zinc-400 font-medium">Conecte sua conta para automatizar o inventário.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Nome da Instância (ex: principal)"
            value={newInstanceName}
            onChange={(e) => setNewInstanceName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))}
            className="bg-zinc-950 border border-white/10 px-4 py-2 text-sm font-bold text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-colors"
          />
          <div className="hidden lg:block group relative" title="O prefixo ios_ é adicionado automaticamente para identificar este projeto.">
            <Info size={14} className="text-zinc-500 cursor-help" />
          </div>
          <button
            onClick={handleCreateInstance}
            disabled={actionLoading === "create" || !newInstanceName}
            className="bg-white text-black px-4 py-2 text-xs font-black uppercase tracking-widest hover:bg-zinc-200 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {actionLoading === "create" ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            Criar
          </button>
        </div>
      </div>

      {/* Instances List */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {instances.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-white/10">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">Nenhuma instância encontrada.</p>
          </div>
        ) : (
          instances.map((inst) => {
            // Suporte para ambas as versões da API (Evolution v1 wrap ou v2 flat)
            const instanceName = inst?.instance?.instanceName || inst?.name || inst?.instanceName;
            const connectionStatus = inst?.instance?.status || inst?.connectionStatus || inst?.status;
            
            if (!instanceName) return null;

            const isConnected = connectionStatus === "open";
            const isActionLoading = actionLoading === instanceName;

            return (
              <div 
                key={instanceName}
                className="group relative flex flex-col bg-zinc-950 border border-white/5 hover:border-white/10 transition-all overflow-hidden"
              >
                {/* Status Bar */}
                <div className={`h-1 w-full ${isConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
                
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${isConnected ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>
                        <Smartphone size={18} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black uppercase tracking-tight text-white">{instanceName}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {isConnected ? (
                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                              <Wifi size={10} /> Conectado
                            </span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-400">
                              <WifiOff size={10} /> Desconectado
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {confirmDelete === instanceName ? (
                        <div className="flex items-center gap-2 pr-1">
                          <button 
                            onClick={() => handleDeleteInstance(instanceName)}
                            className="px-3 py-1.5 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-red-600 transition-all rounded-sm shadow-lg shadow-red-500/20"
                          >
                            CONFIRMAR EXCLUSÃO
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(null)}
                            className="p-1.5 text-zinc-500 hover:text-white transition-all"
                          >
                            <Plus size={14} className="rotate-45" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleSetWebhook(instanceName)}
                            title="Configurar Webhook (Necessário para o Monitor de Atividade)"
                            className={`p-2 transition-all ${isConnected ? "text-emerald-500 hover:text-emerald-400" : "text-zinc-500 hover:text-white"}`}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button 
                            onClick={() => fetchInstances()}
                            className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                          >
                            <RefreshCw size={16} className={isActionLoading ? "animate-spin" : ""} />
                          </button>
                          <button 
                            onClick={() => setConfirmDelete(instanceName)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/5 transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions / QR Code Area */}
                  <div className="flex flex-col gap-3 pt-2">
                    {!isConnected && (
                      <div className="flex flex-col gap-4">
                        {activeInstance === instanceName && qrCode ? (
                          <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-2xl shadow-emerald-500/10">
                            {qrCode === "loading" ? (
                              <div className="h-48 w-48 flex items-center justify-center">
                                <Loader2 className="animate-spin text-zinc-900" size={32} />
                              </div>
                            ) : (
                              <>
                                <img src={qrCode} alt="WhatsApp QR Code" className="h-48 w-48" />
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-900 mt-4 text-center">
                                  Escaneie no WhatsApp {" > "} Aparelhos Conectados
                                </p>
                              </>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleGetQrCode(instanceName)}
                            className="w-full bg-emerald-500 text-black py-3 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-400 transition-all flex items-center justify-center gap-2"
                          >
                            <QrCode size={14} />
                            Conectar Aparelho
                          </button>
                        )}
                      </div>
                    )}

                    {isConnected && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-zinc-900/50 p-3 border border-white/5 rounded-lg flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Bateria</span>
                          <span className="text-sm font-bold text-white">
                            {inst.battery !== undefined && inst.battery !== null ? `${inst.battery}%` : "---"}
                          </span>
                        </div>
                        <div className="bg-zinc-900/50 p-3 border border-white/5 rounded-lg flex flex-col gap-1">
                          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Plataforma</span>
                          <span className="text-sm font-bold text-white capitalize">
                            {inst.platform || "---"}
                          </span>
                        </div>
                        <button
                          onClick={() => handleLogoutInstance(instanceName)}
                          className="col-span-2 border border-white/10 text-white py-2.5 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white/5 transition-all flex items-center justify-center gap-2 mt-2"
                        >
                          <LogOut size={14} />
                          Desconectar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Global Notification */}
      {notification && (
        <div 
          className={`fixed bottom-8 right-8 z-50 p-4 border flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300 ${
            notification.type === "error" 
              ? "bg-red-950 border-red-500 text-red-200" 
              : "bg-emerald-950 border-emerald-500 text-emerald-200"
          }`}
        >
          {notification.type === "error" ? <WifiOff size={18} /> : <CheckCircle2 size={18} />}
          <span className="text-xs font-black uppercase tracking-tight">{notification.message}</span>
        </div>
      )}

      {/* Activity Monitor Section */}
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-3">
            Monitor de Atividade (Digestão/IA)
            <button 
              onClick={() => setIsPaused(!isPaused)} 
              title={isPaused ? "Retomar Ingestão" : "Pausar Ingestão"}
              className={`hover:text-white transition-all ${isPaused ? "text-amber-500" : "text-zinc-500"}`}
            >
              {isPaused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
            </button>
          </h2>
          <div className="flex items-center gap-2">
            {!isPaused ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Live</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Pausado</span>
              </>
            )}
          </div>
        </div>
        
        <div className="bg-black border border-white/5 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-900/50">
                <th className="p-3 w-8 border-b border-white/5"></th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">Evento</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">Instância</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5">Status</th>
                <th className="p-3 text-[10px] font-black uppercase tracking-widest text-zinc-500 border-b border-white/5 text-right">Data/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-[10px] font-bold uppercase tracking-widest text-zinc-700">
                    Aguardando eventos do WhatsApp...
                  </td>
                </tr>
              ) : (
                events.map((event) => {
                  const isExpanded = expandedEvent === event.id;
                  const previewText = getMessagePreview(event.payload);
                  
                  return (
                    <Fragment key={event.id}>
                      <tr 
                        className="hover:bg-white/[0.02] transition-colors group cursor-pointer"
                        onClick={() => setExpandedEvent(isExpanded ? null : event.id)}
                      >
                        <td className="p-3 text-zinc-600 group-hover:text-white transition-colors">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <span className="text-[11px] font-black uppercase tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                              {event.eventType || "MESSAGES_UPSERT"}
                            </span>
                            <span className="text-[9px] font-medium text-zinc-600">ID: {event.id.slice(-8)}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="text-[10px] font-bold text-zinc-400">{event.instanceId || "---"}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-full ${
                            event.status === "processed" ? "bg-emerald-500/10 text-emerald-400" :
                            event.status === "failed" ? "bg-red-500/10 text-red-400" :
                            "bg-amber-500/10 text-amber-400"
                          }`}>
                            {event.status || "recebido"}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-[10px] font-medium text-zinc-400">
                              {event.occurredAt ? new Date(event.occurredAt).toLocaleDateString("pt-BR") : "---"}
                            </span>
                            <span className="text-[9px] font-black text-zinc-500">
                              {event.occurredAt ? new Date(event.occurredAt).toLocaleTimeString("pt-BR") : "---"}
                            </span>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-zinc-950/50">
                          <td colSpan={5} className="p-4 border-l-2 border-emerald-500/50">
                            <div className="flex flex-col gap-2">
                              {previewText && (
                                <div className="mb-2 p-3 bg-zinc-900 border border-white/5 rounded-md">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 mb-1 block">Preview da Mensagem:</span>
                                  <p className="text-sm text-zinc-300 font-medium">&quot;{previewText}&quot;</p>
                                </div>
                              )}
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payload Completo:</span>
                              <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap overflow-x-auto p-3 bg-black border border-white/5 font-mono max-h-64 overflow-y-auto">
                                {JSON.stringify(event.payload || event, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
