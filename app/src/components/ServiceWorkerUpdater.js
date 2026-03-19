"use client";
import { useEffect, useState } from "react";

/**
 * Handles two PWA concerns:
 * 1. Auto-reload when a new service worker activates (controllerchange).
 * 2. Shows/hides the .offline-indicator strip based on network status.
 */
export default function ServiceWorkerUpdater() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // --- Service worker update ---
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }

    // --- Offline indicator ---
    setIsOffline(!navigator.onLine);

    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 w-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest py-1.5 text-center z-[9999]" role="status" aria-live="polite">
      SEM CONEXÃO — MODO OFFLINE
    </div>
  );
}
