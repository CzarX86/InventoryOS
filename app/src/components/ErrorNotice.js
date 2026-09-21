"use client";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Terminal, CheckCircle2 } from "lucide-react";

export default function ErrorNotice({ error, onReport = null, reporting = false, className = "" }) {
  if (!error) return null;

  const canReport = Boolean(onReport && error.errorId && !error.reportedByUser);

  return (
    <div className={className}>
      <div className="bg-[#131313] border border-red-500/20 shadow-2xl overflow-hidden relative group">
        {/* Warning Plate */}
        <div className="bg-red-500/10 border-b border-red-500/20 py-2 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={14} className="text-red-500" />
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500">
              ALERTA_DE_SISTEMA: ERRO_DETECTADO
            </h3>
          </div>
          <div className="flex items-center gap-1.5 grayscale opacity-40">
            <Terminal size={10} className="text-red-500" />
            <span className="text-[9px] font-mono font-bold text-red-500">
              {error.errorId?.slice(0, 12) || "NULL_ID"}
            </span>
          </div>
        </div>

        <div className="p-5 font-mono">
          <p className="text-xs font-black uppercase tracking-widest text-[#e7e5e5] mb-2 leading-tight">
            MESSAGE: {error.humanMessage}
          </p>
          
          {error.knownReason && (
            <div className="text-[9px] text-muted-foreground/60 uppercase tracking-widest bg-white/5 p-2 border-l-2 border-red-500/40 mb-4">
              REASON_LOG: {error.knownReason}
            </div>
          )}

          {Array.isArray(error.userActions) && error.userActions.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">PROTOCOLOS_DE_RECUPERAÇÃO:</p>
              <ul className="space-y-1.5">
                {error.userActions.map(action => (
                  <li key={action} className="flex items-start gap-3 text-[10px] font-bold text-zinc-400 uppercase tracking-tight">
                    <div className="h-1.5 w-1.5 bg-red-500/40 mt-1 shrink-0" />
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-white/5 pt-4">
            {error.reportedByUser ? (
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span className="text-[9px] font-black uppercase tracking-[0.1em] text-emerald-500">
                  TICKET_SUPORTE_GERADO: {error.ticketId || error.errorId}
                </span>
              </div>
            ) : (
              canReport && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReport}
                  disabled={reporting}
                  className="h-9 px-4 text-[9px] font-black uppercase tracking-[0.2em] rounded-none border-red-500/40 text-red-500 hover:bg-red-500 hover:text-black transition-all"
                >
                  {reporting ? "TRANSMITINDO..." : "REQUISITAR_SUPORTE_TÉCNICO"}
                </Button>
              )
            )}
          </div>
        </div>
        
        {/* Decorative corner indicator */}
        <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-red-500/20" />
      </div>
    </div>
  );
}
