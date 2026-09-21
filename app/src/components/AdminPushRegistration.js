"use client";
import { useState, useEffect } from "react";
import { BellRing, BellOff, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { registerAdminPushToken } from "@/lib/push";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function getInitialPushState(isAdmin) {
  if (!isAdmin || typeof Notification === "undefined") {
    return { status: "unsupported", message: "Notificações não estão disponíveis neste navegador." };
  }

  if (Notification.permission === "granted") {
    return { status: "enabled", message: "Alertas administrativos ativos neste dispositivo." };
  }

  if (Notification.permission === "denied") {
    return { status: "blocked", message: "Notificações bloqueadas no navegador. Libere-as nas configurações para ativar." };
  }

  return { status: "idle", message: "" };
}

export default function AdminPushRegistration({ user, isAdmin }) {
  const [pushState, setPushState] = useState({ status: "loading", message: "" });

  useEffect(() => {
    setPushState(getInitialPushState(isAdmin));
  }, [isAdmin]);

  const enablePush = async () => {
    if (!user || !isAdmin) return;

    setPushState(prev => ({ ...prev, status: "processing" }));
    try {
      await registerAdminPushToken(user);
      setPushState({
        status: "enabled",
        message: "Alertas administrativos ativos neste dispositivo.",
      });
    } catch (error) {
      console.error("Admin push registration failed:", error);
      setPushState({
        status: "error",
        message: error.message || "Não foi possível ativar as notificações.",
      });
    }
  };

  if (!isAdmin) return null;

  const { status, message } = pushState;

  return (
    <div className="p-6 rounded-none border-l-2 border-primary/20 bg-[#131313] flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div className="flex items-center gap-5">
        <div className={`p-3 rounded-none shrink-0 ${
          status === "enabled" ? "bg-emerald-500/10 text-emerald-500" : 
          status === "blocked" ? "bg-red-500/10 text-red-500" :
          "bg-foreground/5 text-muted-foreground"
        }`}>
          {status === "enabled" ? <BellRing size={20} /> : <BellOff size={20} />}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-display font-normal tracking-tight text-foreground">
              Notificações administrativas
            </h3>
            {status === "enabled" && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none h-5 px-2 text-[9px] font-display font-normal uppercase tracking-widest rounded-none">
                Ativos
              </Badge>
            )}
          </div>
          <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
            {message || "Receba alertas sobre solicitações de acesso e ocorrências importantes."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {status === "error" && (
            <div className="flex items-center gap-2 text-[10px] font-display font-normal text-red-500 mr-2 tracking-widest">
            <AlertCircle size={14} /> Falha ao sincronizar
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={enablePush}
          disabled={status === "processing" || status === "enabled" || status === "unsupported"}
          className={`rounded-none h-10 px-6 text-[10px] font-display font-normal uppercase tracking-[0.2em] transition-none border-none
            ${status === "enabled" 
              ? "bg-foreground/5 text-muted-foreground/40" 
              : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
        >
          {status === "processing" ? (
            <>
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
              Ativando...
            </>
          ) : status === "enabled" ? (
            <>
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              Alertas ativos
            </>
          ) : (
            "Ativar alertas"
          )}
        </Button>
      </div>
    </div>
  );
}
