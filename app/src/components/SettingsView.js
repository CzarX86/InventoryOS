"use client";
/* global window, localStorage, navigator, process, document, confirm, caches */
import { Zap, Clock, LogOut, Check, RefreshCw } from "lucide-react";
import useAuth from "@/hooks/useAuth";
import useFeatureFlags from "@/hooks/useFeatureFlags";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const WORKFLOWS = [
  {
    id: "real-time",
    name: "Real-time",
    desc: "Pesquisa de mercado durante o cadastro. Dados completos imediatamente.",
    icon: Zap,
  },
  {
    id: "background",
    name: "Background",
    desc: "Pula a pesquisa no scan. Itens marcados para validação posterior.",
    icon: Clock,
  },
];

export default function SettingsView() {
  const { user, isAdmin, updateSettings, logout } = useAuth();
  const { flags } = useFeatureFlags(user);

  return (
    <div className="pb-20 max-w-2xl mx-auto">
      {/* Title */}
      <div className="px-4 md:px-6 pt-10 pb-8 bg-[#0e0e0e] border-b border-[#484848]/20 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="outline" className="h-5 px-2 bg-[#1f2020] text-[#97a5ff] border-[#484848]/20 text-[9px] font-bold uppercase tracking-[0.2em] shadow-none rounded-none font-display">
            SYSTEM_PREFERENCES.CFG
          </Badge>
        </div>
        <h1 className="text-3xl md:text-4xl font-normal uppercase tracking-tighter text-[#e7e5e5] leading-none font-display">
          CONFIGURAÇÕES_<span className="text-[#acabaa]/30">DO_AMBIENTE</span>
        </h1>
      </div>

      <div className="space-y-8">
        {/* AI Workflow Selection */}
        <section>
          <div className="px-4 md:px-6 py-4">
            <h2 className="text-[10px] font-normal uppercase tracking-[0.25em] text-[#acabaa]/50 font-display">
              CORE_AI_EXTRACTION_ENGINE
            </h2>
          </div>
          <div className="flex flex-col gap-px bg-[#484848]/20 border-y border-[#484848]/20">
            {WORKFLOWS.map(({ id, name, desc, icon: Icon }) => {
              const active = user?.aiWorkflow === id;
              return (
                <button
                  key={id}
                  onClick={() => updateSettings({ aiWorkflow: id })}
                  className={`flex items-start gap-4 px-4 md:px-6 py-6 text-left transition-none ${
                    active ? "bg-[#1f2020]" : "bg-[#0e0e0e] hover:bg-[#131313]"
                  }`}
                >
                  <div className={`mt-0.5 p-3 rounded-none shrink-0 border ${active ? "bg-[#293e48] text-[#acc3ce] border-[#8ba1ac]/20" : "bg-[#131313] text-[#acabaa]/40 border-[#484848]/10"}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className={`text-sm font-normal uppercase tracking-widest font-display ${active ? "text-[#e7e5e5]" : "text-[#acabaa]/40"}`}>
                        {name.toUpperCase()}_MODE
                      </p>
                      {active && (
                        <Badge variant="default" className="h-4 px-1.5 text-[7px] font-bold uppercase tracking-widest bg-[#293e48] text-[#acc3ce] rounded-none font-mono">
                          ACTIVE_STATE
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-[#acabaa]/60 leading-relaxed font-mono uppercase tracking-tight">{desc}</p>
                  </div>
                  {active && (
                    <div className="shrink-0 mt-0.5 w-6 h-6 rounded-none bg-[#acc3ce]/10 flex items-center justify-center border border-[#acc3ce]/20">
                      <Check size={12} className="text-[#acc3ce]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Profile & Security */}
        <section>
          <div className="px-4 md:px-6 py-4">
            <h2 className="text-[10px] font-normal uppercase tracking-[0.25em] text-[#acabaa]/50 font-display">
              AUTH_SESSION_CONTROL
            </h2>
          </div>
          <div className="mx-4 md:mx-6 p-6 border border-[#484848]/20 bg-[#131313] rounded-none relative overflow-hidden">
            <div className="absolute top-0 right-0 p-2 text-[8px] font-mono text-[#484848] uppercase tracking-widest">ENCRYPTED_AUTH_DATA</div>
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-none bg-[#1f2020] border border-[#484848]/20 flex items-center justify-center text-[#97a5ff] font-black text-lg">
                  {user?.email?.[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#e7e5e5] leading-none mb-1.5 font-mono uppercase tracking-tight">{user?.email}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant={isAdmin ? "default" : "secondary"} className={`h-5 px-1.5 text-[8px] font-normal uppercase tracking-widest rounded-none font-display ${isAdmin ? "bg-[#293e48] text-[#acc3ce]" : "bg-[#191a1a] text-[#acabaa]"}`}>
                      {isAdmin ? "SYSTEM_ROOT" : "AUTH_USER"}
                    </Badge>
                    <span className="text-[8px] text-[#acabaa]/30 uppercase font-bold tracking-widest font-mono">FIREBASE_JWT_PROVIDER</span>
                  </div>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={logout}
                className="text-[9px] font-normal uppercase tracking-widest border-[#7f2927]/20 text-[#ee7d77] hover:bg-[#7f2927]/10 rounded-none transition-none font-display h-10 px-6"
              >
                <LogOut size={14} className="mr-2" /> EXIT_SESSION
              </Button>
            </div>
          </div>
        </section>

        {/* System & Maintenance */}
        <section className="px-4 md:px-6 space-y-6 pt-4">
          <Separator className="bg-[#484848]/10" />
          
          <div className="flex flex-col gap-6">
            <Button
              variant="outline"
              className="text-[10px] font-normal uppercase tracking-[0.25em] h-14 justify-start border-[#484848]/20 bg-[#0e0e0e] hover:bg-[#131313] rounded-none transition-none font-display text-[#acabaa]"
              onClick={async () => {
                if (window.confirm("CONFIRM_ACTION: CLEAR_CACHE_AND_FORCE_REBOOT?")) {
                  try {
                    if ("serviceWorker" in window.navigator) {
                      const registrations = await window.navigator.serviceWorker.getRegistrations();
                      for (const registration of registrations) {
                        await registration.unregister();
                      }
                    }
                    if ("caches" in window) {
                      const cacheNames = await window.caches.keys();
                      for (const name of cacheNames) {
                        await window.caches.delete(name);
                      }
                    }
                    window.location.reload(true);
                  } catch (err) {
                    console.error("Erro ao limpar cache:", err);
                    window.location.reload();
                  }
                }
              }}
            >
              <RefreshCw size={14} className="mr-3 text-[#97a5ff]" /> CLEAR_CACHE_AND_SYNC_BUFFERS
            </Button>

            <div className="flex items-center justify-between pt-4 border-t border-[#484848]/5">
              <p className="text-[8px] font-bold uppercase tracking-[0.4em] text-[#acabaa]/20 font-mono">
                IOS_SYSTEM_CORE_V{process.env.NEXT_PUBLIC_APP_VERSION || "1.0.2"}
              </p>
              <Badge variant="outline" className="text-[7px] font-normal uppercase tracking-widest border-[#484848]/10 text-[#acabaa]/20 rounded-none font-display">
                DEPLOYED_STABLE_BUILD
              </Badge>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
