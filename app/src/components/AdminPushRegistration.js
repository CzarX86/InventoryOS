"use client";

import { useState } from "react";
import { BellRing } from "lucide-react";
import { registerAdminPushToken } from "@/lib/push";

function getInitialPushState(isAdmin) {
  if (!isAdmin || typeof Notification === "undefined") {
    return {
      status: "idle",
      message: "",
    };
  }

  if (Notification.permission === "granted") {
    return {
      status: "enabled",
      message: "Push ativo neste dispositivo.",
    };
  }

  if (Notification.permission === "denied") {
    return {
      status: "blocked",
      message: "Push bloqueado no navegador.",
    };
  }

  return {
    status: "idle",
    message: "",
  };
}

export default function AdminPushRegistration({ user, isAdmin }) {
  const [{ status, message }, setPushState] = useState(() => getInitialPushState(isAdmin));

  const enablePush = async () => {
    if (!user || !isAdmin) return;

    setPushState(prev => ({ ...prev, status: "loading" }));
    try {
      await registerAdminPushToken(user);
      setPushState({
        status: "enabled",
        message: "Push ativado com sucesso neste dispositivo.",
      });
    } catch (error) {
      console.error("Admin push registration failed:", error);
      setPushState({
        status: "error",
        message: error.message || "Falha ao ativar notificacoes push.",
      });
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="px-4 md:px-6 py-4 border-b border-white/[0.07] flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <BellRing size={16} className="text-zinc-300" />
        <div>
          <p className="text-base font-black uppercase tracking-widest text-zinc-200">
            Push Admin
          </p>
          <p className="text-base text-zinc-400">
            {message || "Ative push neste dispositivo para receber erros reportados."}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={enablePush}
        disabled={status === "loading" || status === "enabled"}
        className="px-4 py-2 text-base font-black uppercase tracking-widest text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
      >
        {status === "enabled" ? "Ativado" : status === "loading" ? "Ativando..." : "Ativar push"}
      </button>
    </div>
  );
}
