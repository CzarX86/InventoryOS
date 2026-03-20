"use client";
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

  useEffect(() => {
    // Check if we just updated
    const wasUpdated = localStorage.getItem("pwa_updated");
    if (wasUpdated === "true") {
      setShowUpdateToast(true);
      localStorage.removeItem("pwa_updated");
      // Auto-hide after 5 seconds
      const timer = setTimeout(() => setShowUpdateToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    // --- Service worker update ---
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        // Set flag to show toast after reload
        localStorage.setItem("pwa_updated", "true");
        window.location.reload();
      });
    }
    }

    // --- Offline indicator ---

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return (
    <>
      {isOffline && (
        <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 text-center z-[9999]" role="status" aria-live="polite">
          SEM CONEXÃO — MODO OFFLINE
        </div>
      )}
      {showUpdateToast && <UpdateToast onClose={() => setShowUpdateToast(false)} />}
    </>
  );
}

function UpdateToast({ onClose }) {
  return (
    <div className="fixed bottom-6 right-6 z-[120] pointer-events-auto">
      <div className="bg-[#1a1c1e] border-l-4 border-emerald-500 shadow-2xl p-4 flex items-center gap-4 min-w-[300px] animate-in slide-in-from-right-10 duration-500">
        <div className="w-10 h-10 bg-emerald-500/10 rounded-full flex items-center justify-center shrink-0">
          <div className="w-5 h-5 text-emerald-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-white">App Atualizado</p>
          <p className="text-[11px] text-zinc-400 mt-0.5">Nova versão ativa e pronta para uso.</p>
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
