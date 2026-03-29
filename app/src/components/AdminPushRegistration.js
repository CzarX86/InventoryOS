"use client";
import { useState, useEffect } from "react";
import { BellRing, BellOff, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { registerAdminPushToken } from "@/lib/push";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function getInitialPushState(isAdmin) {
  if (!isAdmin || typeof Notification === "undefined") {
    return { status: "unsupported", message: "SYSTEM_PUSH_NOT_SUPPORTED" };
  }

  if (Notification.permission === "granted") {
    return { status: "enabled", message: "PUSH_PROTOCOL_ACTIVE_DEVICE" };
  }

  if (Notification.permission === "denied") {
    return { status: "blocked", message: "ACCESS_DENIED_BY_BROWSER" };
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
        message: "PUSH_ACTIVATED_SUCCESSFULLY",
      });
    } catch (error) {
      console.error("Admin push registration failed:", error);
      setPushState({
        status: "error",
        message: error.message || "FAILURE_ACTIVATING_NOTIFICATIONS",
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
            <h3 className="text-sm font-display font-normal uppercase tracking-[0.2em] text-foreground">
              ADMIN_NOTIFICATION_BRIDGE_V1
            </h3>
            {status === "enabled" && (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-none h-5 px-2 text-[9px] font-display font-normal uppercase tracking-widest rounded-none">
                ONLINE
              </Badge>
            )}
          </div>
          <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">
            {message || "ESTABLISH_REALTIME_ALERTLOG_STREAM_FOR_CRITICAL_ERRORS"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {status === "error" && (
          <div className="flex items-center gap-2 text-[10px] font-display font-normal text-red-500 uppercase mr-2 tracking-widest">
            <AlertCircle size={14} /> ERR_SYNC_FAIL
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
              SYNCHRONIZING...
            </>
          ) : status === "enabled" ? (
            <>
              <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              BRIDGE_ESTABLISHED
            </>
          ) : (
            "CONNECT_BRIDGE"
          )}
        </Button>
      </div>
    </div>
  );
}

