"use client";
/* global window, localStorage, navigator, process */
import { useEffect, useState } from "react";

/**
 * Handles two PWA concerns:
 * 1. Auto-reload when a new service worker activates (controllerchange).
 * 2. Shows/hides the .offline-indicator strip based on network status.
 */
export default function ServiceWorkerUpdater() {
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator !== "undefined") return !navigator.onLine;
    return false;
  });
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState(null);

  useEffect(() => {
    // --- Version-based update detection ---
    const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION;
    if (currentVersion) {
      const lastVersion = localStorage.getItem("last_notified_version");
      
      // If we have a stored version and it's different from current,
      // it means the app just updated (via SW reload or manual refresh).
      if (lastVersion && lastVersion !== currentVersion) {
        setShowUpdateToast(true);
      }
      
      // Update stored version to current
      localStorage.setItem("last_notified_version", currentVersion);
    }

    if (showUpdateToast) {
      const timer = setTimeout(() => setShowUpdateToast(false), 8000); // 8 seconds for better visibility
      return () => clearTimeout(timer);
    }
  }, [showUpdateToast]);

  useEffect(() => {
    // --- Service worker update detection ---
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        // 1. Check if there's already a waiting worker
        if (registration.waiting) {
          setWaitingWorker(registration.waiting);
          setShowUpdatePrompt(true);
        }

        // 2. Listen for future updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                setWaitingWorker(newWorker);
                setShowUpdatePrompt(true);
              }
            });
          }
        });
      });

      // --- Controller change (actual reload) ---
      const handleControllerChange = () => {
        if (navigator.serviceWorker.controller) {
          window.location.reload();
        }
      };
      
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
      
      // --- Offline indicator ---
      const handleOffline = () => setIsOffline(true);
      const handleOnline = () => setIsOffline(false);
      window.addEventListener("offline", handleOffline);
      window.addEventListener("online", handleOnline);

      return () => {
        navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("online", handleOnline);
      };
    }
  }, []);

  const handleUpdate = () => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
      setShowUpdatePrompt(false);
    }
  };

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 text-center z-[9999]" role="status" aria-live="polite">
          SEM CONEXÃO — MODO OFFLINE
        </div>
      )}
      {showUpdatePrompt && (
        <UpdatePrompt onUpdate={handleUpdate} onClose={() => setShowUpdatePrompt(false)} />
      )}
      {showUpdateToast && (
        <UpdateToast onClose={() => setShowUpdateToast(false)} />
      )}
    </>
  );
}

function UpdatePrompt({ onUpdate, onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-[130] animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div className="bg-emerald-600 text-white shadow-2xl rounded-2xl p-4 flex flex-col gap-3 min-w-[280px] max-w-[320px]">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-[13px] font-black uppercase tracking-tight leading-none mb-1">Nova Versão</h4>
            <p className="text-[11px] text-white/90 leading-relaxed font-medium">Uma atualização importante está pronta para o InventoryOS.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={onUpdate}
            className="flex-1 bg-white text-emerald-600 text-[11px] font-black uppercase tracking-widest py-2.5 rounded-lg hover:bg-emerald-50 transition-colors active:scale-95 duration-200"
          >
            Atualizar Agora
          </button>
          <button 
            onClick={onClose}
            className="px-3 text-white/70 text-[10px] uppercase font-bold hover:text-white transition-colors"
          >
            Depois
          </button>
        </div>
      </div>
    </div>
  );
}

function UpdateToast({ onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-[120]">
      <div className="bg-[#1a1c1e] border-l-4 border-emerald-500 shadow-2xl p-4 flex items-center gap-4 min-w-[300px] animate-in slide-in-from-right-10 duration-500 rounded-lg">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
          <div className="w-5 h-5 text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-white">App Atualizado</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">InventoryOS v{process.env.NEXT_PUBLIC_APP_VERSION} ativo.</p>
        </div>
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
