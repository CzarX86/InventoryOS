import { useState, useEffect, useCallback } from "react";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import { Loader2, QrCode, Smartphone, Wifi, WifiOff, Trash2, LogOut, Plus, RefreshCw, CheckCircle2 } from "lucide-react";

export default function WhatsappInstanceManager() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [activeInstance, setActiveInstance] = useState(null);
  const [newInstanceName, setNewInstanceName] = useState("");

  const fetchInstances = useCallback(async () => {
    try {
      const listInstances = httpsCallable(functions, "listWhatsappInstances");
      const result = await listInstances();
      if (result.data.status === 200) {
        setInstances(result.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch instances:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(fetchInstances, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [fetchInstances]);

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
    if (!confirm(`Tem certeza que deseja excluir a instância ${instanceName}?`)) return;
    setActionLoading(instanceName);
    try {
      const deleteInstance = httpsCallable(functions, "deleteWhatsappInstance");
      await deleteInstance({ instanceName });
      await fetchInstances();
      if (activeInstance === instanceName) {
        setActiveInstance(null);
        setQrCode(null);
      }
    } catch (error) {
      console.error("Failed to delete instance:", error);
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
      alert("Webhook configurado com sucesso!");
    } catch (error) {
      console.error("Failed to set webhook:", error);
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
                      <button 
                        onClick={() => handleSetWebhook(instanceName)}
                        title="Configurar Webhook"
                        className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
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
                        onClick={() => handleDeleteInstance(instanceName)}
                        className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/5 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
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
    </div>
  );
}
