"use client";
import { useState, useEffect } from "react";
import { Bell, ShieldAlert, X, Check, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useAuth from "@/hooks/useAuth";
import { registerAdminPushToken } from "@/lib/push";
import MagneticTooltip from "@/components/MagneticTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function NotificationPrompt() {
  const { user, isAdmin } = useAuth();
  const canPromptUser = Boolean(user && isAdmin);
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    const isPermissionDefault = "Notification" in window && Notification.permission === "default";
    const sessionDismissed = sessionStorage.getItem("notification_prompt_dismissed");

    if (isStandalone && isPermissionDefault && !sessionDismissed && canPromptUser) {
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [canPromptUser]);

  const handleEnable = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      await registerAdminPushToken(user);
      setSuccess(true);
      setTimeout(() => setShow(false), 2000);
    } catch (error) {
      console.error("Failed to enable notifications:", error);
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
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        className="fixed bottom-24 left-4 right-4 z-[110] max-w-sm mx-auto pointer-events-auto"
      >
        <Card className="bg-background/80 backdrop-blur-xl border-blue-500/20 shadow-2xl overflow-hidden relative group">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/20" />
          <div className="absolute top-0 left-0 h-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-1000 w-1/4 group-hover:w-full" />

          <CardContent className="p-5">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={handleDismiss} 
              className="absolute top-2 right-2 h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </Button>

            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center shrink-0 shadow-inner">
                <Bell size={24} className="text-blue-500" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                    Alertas Críticos
                  </h3>
                  <Badge variant="outline" className="h-4 px-1 text-[8px] font-black uppercase border-blue-500/30 text-blue-600 bg-blue-500/5">
                    Segurança
                  </Badge>
                </div>
                <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
                  Receba avisos de segurança e atualizações importantes do sistema em tempo real.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/5 rounded-lg border border-blue-500/10 mb-5">
              <ShieldAlert size={14} className="text-blue-500" />
              <span className="text-[10px] text-blue-600/80 font-bold uppercase tracking-widest">
                Recomendado para administradores
              </span>
            </div>

            <div className="flex gap-3">
              <MagneticTooltip text="Ativar proteção em tempo real">
                <Button
                  onClick={handleEnable}
                  disabled={loading || success}
                  className="flex-[2] h-11 bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/10"
                >
                  {success ? (
                    <>
                      <Check size={14} className="mr-2" />
                      Ativado!
                    </>
                  ) : loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin mr-2" />
                      Ativando...
                    </>
                  ) : (
                    "Ativar Notificações"
                  )}
                </Button>
              </MagneticTooltip>
              <Button
                variant="ghost"
                onClick={handleDismiss}
                className="flex-1 h-11 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:bg-muted"
              >
                Agora não
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
