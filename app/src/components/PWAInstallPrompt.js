"use client";
import { useState, useEffect } from "react";
import { Download, X, Loader2, Smartphone, Apple } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function getClientInstallState() {
  if (typeof window === "undefined") {
    return {
      isIOS: false,
      isStandalone: false,
      isInstallable: false,
    };
  }

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());

  return {
    isIOS,
    isStandalone,
    isInstallable: (isIOS && !isStandalone) || (!isIOS && !isStandalone),
  };
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [clientState, setClientState] = useState({
    isIOS: false,
    isStandalone: false,
    isInstallable: false,
  });

  const { isIOS, isStandalone, isInstallable } = clientState;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const state = getClientInstallState();
    setClientState(state);

    if (state.isStandalone) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setClientState(prev => ({ ...prev, isInstallable: true }));
    };
    
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalling(false);
      setClientState({
        isIOS: clientState.isIOS,
        isStandalone: true,
        isInstallable: false
      });
    };


    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onAppInstalled);

    // Auto-dismiss after 8 seconds if not interacted with
    const timer = setTimeout(() => {
      setDismissed(true);
    }, 8000);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt && !isIOS) return;
    
    setIsInstalling(true);

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setClientState(prev => ({ ...prev, isInstallable: false }));
      }

    }
    
    if (isIOS && !deferredPrompt) {
      setTimeout(() => {
        setIsInstalling(false);
      }, 1500);
      return;
    }

    setIsInstalling(false);
  };

  if (!isInstallable || dismissed || isStandalone) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-4 right-4 z-[100] max-w-sm mx-auto pointer-events-auto"
      >
        <div className="bg-[#131313] border border-white/10 shadow-2xl overflow-hidden relative group">
          {/* Progress Bar Detail */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-white/5" />
          <div className="absolute top-0 left-0 h-[2px] bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-1000 w-1/3 group-hover:w-full" />
          
          <div className="p-5">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setDismissed(true)} 
              className="absolute top-2 right-2 h-8 w-8 rounded-none text-muted-foreground hover:text-white hover:bg-white/5"
            >
              <X size={16} />
            </Button>
            
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                {isIOS ? <Apple size={24} className="text-emerald-500" /> : <Smartphone size={24} className="text-emerald-500" />}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white">
                    MODO_APLICATIVO
                  </h3>
                  <div className="px-1.5 py-0.5 border border-emerald-500/30 text-[8px] font-black uppercase tracking-widest text-emerald-500 bg-emerald-500/5">
                    PWA_MODE
                  </div>
                </div>
                <p className="text-[10px] font-bold text-muted-foreground/80 leading-relaxed uppercase tracking-wide font-mono">
                  {isIOS && !deferredPrompt 
                    ? "SISTEMA: ACESSE COMPARTILHAR > ADICIONAR À TELA DE INÍCIO"
                    : "INSTALE O NÚCLEO INVENTORYOS PARA PERFORMANCE OTIMIZADA"}
                </p>
              </div>
            </div>
            
            {(!isIOS || deferredPrompt) && (
              <Button
                onClick={handleInstall}
                disabled={isInstalling}
                className="w-full h-12 bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-none hover:bg-zinc-200 transition-all"
              >
                {isInstalling ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-2" />
                    EXECUTANDO_SETUP...
                  </>
                ) : (
                  <>
                    <Download size={14} className="mr-2" />
                    INSTALAR_SISTEMA
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Decorative Corner */}
          <div className="absolute bottom-0 right-0 w-2 h-2 border-r border-b border-white/20" />
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
