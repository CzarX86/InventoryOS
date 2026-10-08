"use client";

import { useEffect, useState } from "react";
import { Apple, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

function getClientInstallState() {
  if (typeof window === "undefined") {
    return { mode: null, isStandalone: false };
  }

  const userAgent = window.navigator.userAgent.toLowerCase();
  const platform = window.navigator.platform?.toLowerCase() || "";
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIOS =
    /iphone|ipad|ipod/.test(userAgent) ||
    (platform === "macintel" && window.navigator.maxTouchPoints > 1);
  const isMacOS = /macintosh|mac os x/.test(userAgent) || platform.includes("mac");
  const isMacSafari =
    !isIOS &&
    isMacOS &&
    /safari/.test(userAgent) &&
    !/chrome|chromium|crios|edg|opr|opera|firefox|fxios|android/.test(userAgent);
  let mode = null;

  if (!isStandalone) {
    if (isIOS) mode = "ios-safari";
    else if (isMacSafari) mode = "mac-safari";
    else if (isMacOS) mode = "mac-desktop";
  }

  return {
    isStandalone,
    mode,
  };
}

const instructions = {
  "ios-safari": "No Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”.",
  "mac-safari": "No Safari no macOS Sonoma 14 ou posterior, escolha Arquivo > Adicionar ao Dock.",
  "mac-desktop": "No Chrome ou Edge, abra o menu e escolha “Instalar app”. No Safari, use Arquivo > Adicionar ao Dock (macOS Sonoma 14 ou posterior).",
  "browser-menu": "Abra o menu do navegador e escolha “Instalar app” ou “Instalar InventoryOS”.",
};

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [mode, setMode] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const initialState = getClientInstallState();
    setMode(initialState.mode);
    setIsStandalone(initialState.isStandalone);

    if (initialState.isStandalone) return undefined;

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setMode("native");
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalling(false);
      setIsStandalone(true);
      setMode(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    setIsInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setMode(outcome === "accepted" ? null : "browser-menu");
    } catch {
      setDeferredPrompt(null);
      setMode("browser-menu");
    } finally {
      setIsInstalling(false);
    }
  };

  if (!mode || dismissed || isStandalone) return null;

  const PlatformIcon = mode === "ios-safari" || mode === "mac-safari" ? Apple : Download;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[100] mx-auto max-w-sm">
      <aside
        role="region"
        aria-label="Instalação do InventoryOS"
        className="relative rounded-2xl border border-border bg-card p-5 pr-12 shadow-lg"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDismissed(true)}
          aria-label="Fechar aviso de instalação"
          className="absolute right-2 top-2 h-8 w-8"
        >
          <X size={16} />
        </Button>

        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
            <PlatformIcon size={20} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Instale o InventoryOS</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {mode === "native" ? "Abra o InventoryOS em uma janela própria." : instructions[mode]}
            </p>
          </div>
        </div>

        {mode === "native" && (
          <Button onClick={handleInstall} disabled={isInstalling} className="mt-4 w-full">
            {isInstalling ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" aria-hidden="true" />
                Abrindo instalação…
              </>
            ) : (
              <>
                <Download size={16} className="mr-2" aria-hidden="true" />
                Instalar app
              </>
            )}
          </Button>
        )}
      </aside>
    </div>
  );
}
