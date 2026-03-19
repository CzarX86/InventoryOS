"use client";
import { useState, useEffect } from "react";
import { Download, X, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
    isInstallable: isIOS && !isStandalone,
  };
}

export default function PWAInstallPrompt() {
  const clientInstallState = getClientInstallState();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(clientInstallState.isInstallable);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS] = useState(clientInstallState.isIOS);
  const [isStandalone, setIsStandalone] = useState(clientInstallState.isStandalone);

  useEffect(() => {
    if (isStandalone) {
      return; // Already installed, no need to show anything
    }

    // Handle Android/Desktop beforeinstallprompt
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    const onAppInstalled = () => {
      setIsInstallable(false);
      setIsInstalling(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, [isStandalone]);

  const handleInstall = async () => {
    if (!deferredPrompt && !isIOS) return;
    
    setIsInstalling(true);

    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setDeferredPrompt(null);
        setIsInstallable(false);
      }
    }
    
    // For iOS, there might be no prompt(), we just keep showing instructions
    // but we can simulate a short loading state to give feedback that they clicked
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
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-sm pointer-events-auto"
      >
        <div className="bg-[#1a1a1a] border border-emerald-500/30 shadow-2xl p-4 flex flex-col gap-3 relative overflow-hidden group">
          
          {/* subtle animated background glow */}
          <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

          <button 
            onClick={() => setDismissed(true)} 
            className="absolute top-2 right-2 p-1 text-zinc-500 hover:text-white transition-colors z-10"
            aria-label="Dismiss install prompt"
          >
            <X size={14} />
          </button>
          
          <div className="flex items-start gap-3 mt-1 relative z-10">
            <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center justify-center shrink-0">
              <Download size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-white mb-1">
                Instalar App Localmente
              </p>
              {isIOS && !deferredPrompt ? (
                <p className="text-xs text-zinc-400 leading-relaxed max-w-[200px]">
                  No iOS, toque no botao &quot;Compartilhar&quot; e depois em &quot;Adicionar a Tela de Inicio&quot;.
                </p>
              ) : (
                <p className="text-xs text-zinc-400 leading-relaxed max-w-[200px]">
                  Tenha acesso rápido e melhor performance instalando o app.
                </p>
              )}
            </div>
          </div>
          
          {(!isIOS || deferredPrompt) && (
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="w-full flex items-center justify-center gap-2 mt-2 py-3 bg-white text-[#141414] font-black uppercase tracking-widest text-xs hover:bg-zinc-200 transition-colors disabled:opacity-50 relative z-10"
            >
              {isInstalling ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Instalando...</span>
                </>
              ) : (
                "Instalar Agora"
              )}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
