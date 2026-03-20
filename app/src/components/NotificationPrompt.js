"use client";
import { useState, useEffect } from "react";
import { Bell, ShieldAlert, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useAuth from "@/hooks/useAuth";
import { registerAdminPushToken } from "@/lib/push";
import MagneticTooltip from "@/components/MagneticTooltip";

export default function NotificationPrompt() {
  const { user, isAdmin } = useAuth();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Only check if we're in the browser
    if (typeof window === "undefined") return;

    // Check if standalone PWA
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    
    // Check if permission is default and not dismissed this session
    const isPermissionDefault = "Notification" in window && Notification.permission === "default";
    const sessionDismissed = sessionStorage.getItem("notification_prompt_dismissed");

    if (isStandalone && isPermissionDefault && !sessionDismissed && user) {
      // Delay slightly for better UX (don't show immediately on load)
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleEnable = async () => {
    setLoading(true);
    try {
      await registerAdminPushToken(user);
      setSuccess(true);
      setTimeout(() => {
        setShow(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to enable notifications:", error);
      // We don't hide on error, maybe the user wants to try again or they'll just close it
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("notification_prompt_dismissed", "true");
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[110] w-[calc(100%-32px)] max-w-md pointer-events-auto"
      >
        <div className="bg-[#0c0c0e]/95 backdrop-blur-xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.5)] p-6 rounded-2xl relative overflow-hidden group">
          
          {/* subtle animated background glow */}
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-all duration-1000" />
          
          <button 
            onClick={handleDismiss} 
            className="absolute top-4 right-4 p-1.5 text-zinc-500 hover:text-white rounded-full hover:bg-white/5 transition-all z-10"
            aria-label="Ignorar"
          >
            <X size={18} />
          </button>
          
          <div className="flex flex-col gap-5 relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                <Bell size={24} className="text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white">
                  Notificações Críticas
                </h3>
                <p className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-widest mt-0.5">
                  Recomendado para Segurança
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-zinc-300 leading-relaxed">
                Ative os alertas para receber avisos de segurança e atualizações importantes do sistema diretamente no seu dispositivo.
              </p>
              
              <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/[0.05]">
                <ShieldAlert size={14} className="text-emerald-400" />
                <span className="text-[11px] text-zinc-400 font-medium">
                  Fique por dentro de qualquer atividade suspeita no estoque.
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-3 mt-2">
              <MagneticTooltip text="Clique para proteger seu acesso">
                <button
                  onClick={handleEnable}
                  disabled={loading || success}
                  className="px-8 py-3 bg-emerald-500 text-black font-black uppercase tracking-widest text-[11px] hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  {success ? (
                    <>
                      <Check size={14} />
                      <span>Ativado!</span>
                    </>
                  ) : loading ? (
                    "Processando..."
                  ) : (
                    "Ativar Notificações"
                  )}
                </button>
              </MagneticTooltip>
              
              <button
                onClick={handleDismiss}
                className="px-4 py-3 text-zinc-400 font-bold uppercase tracking-widest text-[11px] hover:text-white transition-colors"
              >
                Agora não
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
