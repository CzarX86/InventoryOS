"use client";
import { useEffect } from "react";

/**
 * Handles two PWA concerns:
 * 1. Auto-reload when a new service worker activates (controllerchange).
 * 2. Shows/hides the .offline-indicator strip based on network status.
 */
export default function ServiceWorkerUpdater() {
  useEffect(() => {
    // --- Service worker update ---
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    }

    // --- Offline indicator ---
    const setOffline = () => document.body.classList.add("is-offline");
    const setOnline = () => document.body.classList.remove("is-offline");

    if (!navigator.onLine) setOffline();

    window.addEventListener("offline", setOffline);
    window.addEventListener("online", setOnline);

    return () => {
      window.removeEventListener("offline", setOffline);
      window.removeEventListener("online", setOnline);
    };
  }, []);

  return (
    <div className="offline-indicator" role="status" aria-live="polite">
      SEM CONEXÃO — MODO OFFLINE
    </div>
  );
}
