"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import {
  Search, Plus, Mic, Package, Boxes, Settings,
  Shield, LogOut, MoreHorizontal, Loader2, X, Share2, Trash2, MessageSquare,
  CheckSquare, UserRound, BarChart3, LayoutDashboard
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from "framer-motion";
import AddItemModal from "@/components/AddItemModal";
import ItemDetailModal from "@/components/ItemDetailModal";
import VoiceSearch from "@/components/VoiceSearch";
import AdminDashboard from "@/components/AdminDashboard";
import SettingsView from "@/components/SettingsView";
import WhatsappView from "@/components/WhatsappView";
import SplashScreen from "@/components/SplashScreen";
import ActionInbox from "@/components/ActionInbox";
import CrmView from "@/components/CrmView";
import CrmImportView from "@/components/CrmImportView";
import CrmPerformanceDashboard from "@/components/CrmPerformanceDashboard";
import WorkspaceHome from "@/components/WorkspaceHome";
import AccessGate from "@/components/AccessGate";
import NotificationsBell from "@/components/NotificationsBell";
import PWAInstallPrompt from "@/components/PWAInstallPrompt"; // Added PWAInstallPrompt import
import UserAvatar from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import useAuth from "@/hooks/useAuth";
import useFeatureFlags from "@/hooks/useFeatureFlags";
import useInventory from "@/hooks/useInventory";
import { buildActivityEvent, logInventoryActivity } from "@/lib/audit";
import { escalateErrorReport, recordAppError, toUserFacingError } from "@/lib/errorReporting";
import { db } from "@/lib/firebase";
import { getBrandMeta } from "@/lib/utils";
import { isFeatureEnabled } from "@/lib/featureFlags";

const STATUS_CONFIG = {
  "IN STOCK":  { 
    cls: "text-emerald-700",
    dot: "bg-emerald-500",
    bg: "bg-emerald-50"
  },
  "SOLD":      { 
    cls: "text-slate-500",
    dot: "bg-slate-400",
    bg: "bg-slate-100"
  },
  "REPAIR":    { 
    cls: "text-red-700",
    dot: "bg-red-500",
    bg: "bg-red-50"
  },
  "RESERVED":  { 
    cls: "text-primary",
    dot: "bg-primary",
    bg: "bg-accent"
  },
};

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("HOME");
  const [itemToEdit, setItemToEdit] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showSplash, setShowSplash] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState(null);

  const { user, loading: authLoading, isAdmin, isApproved, isHiddenOwner, accessStatus, login, logout } = useAuth();
  const { flags: expansionFlags } = useFeatureFlags(isApproved ? user : null);
  const { loading: invLoading, searchQuery, setSearchQuery, filteredItems, items, deleteItem, syncError } = useInventory(user, isApproved);
  const crmPerformanceEnabled = isAdmin && isFeatureEnabled(expansionFlags, "crmPerformanceDashboard");

  const handleLogin = async () => {
    setLoginError(null);
    setLoginLoading(true);

    try {
      await login();
    } catch (error) {
      const messages = {
        "auth/popup-closed-by-user": "A janela de login foi fechada. Tente novamente.",
        "auth/unauthorized-domain": "Este endereço ainda não está autorizado no Firebase.",
        "auth/operation-not-allowed": "O login com Google ainda não está habilitado no Firebase.",
        "auth/network-request-failed": "Não foi possível conectar ao Firebase. Verifique sua internet.",
      };
      setLoginError(messages[error?.code] || "Não foi possível iniciar o login. Tente novamente.");
    } finally {
      setLoginLoading(false);
    }
  };

  const [notification, setNotification] = useState(null);
  const [removedItems, setRemovedItems] = useState(new Set());
  const [reportingNotification, setReportingNotification] = useState(false);
  const undoIds = useRef(new Set());

  useEffect(() => {
    if (!syncError) return;
    setNotification({
      id: "sync-error",
      error: syncError,
      actionLabel: "Fechar",
      onAction: () => setNotification(null),
    });
  }, [syncError]);

  const navItems = [
    { id: "HOME", label: "Início", icon: LayoutDashboard },
    { id: "INVENTORY", label: "Inventário", icon: Boxes },
    ...(isApproved ? [
      { id: "CRM", label: "CRM", icon: UserRound },
      ...(crmPerformanceEnabled ? [{ id: "CRM_PERFORMANCE", label: "Performance", mobileLabel: "Equipe", icon: BarChart3 }] : []),
    ] : []),
    ...(isAdmin ? [
      { id: "ACTIONS", label: "Central de ações", mobileLabel: "Ações", icon: CheckSquare },
      { id: "WHATSAPP", label: "WhatsApp", icon: MessageSquare },
      { id: "ADMIN", label: "Admin", icon: Shield }
    ] : []),
    { id: "SETTINGS", label: "Config.", icon: Settings },
  ];

  const stats = {
    total: items.length,
    inStock: items.filter(i => i.status === "IN STOCK").length,
    sold: items.filter(i => i.status === "SOLD").length,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-5 h-5 border-2 border-muted border-t-primary animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xs"
        >
          <h1 className="text-4xl font-semibold tracking-tight text-foreground mb-2 font-display">
            Inventory<span className="text-primary">OS</span>
          </h1>
          <p className="text-base text-muted-foreground mb-1 leading-relaxed">
            Inventário, relacionamento e operação em um só lugar.
          </p>
          {process.env.NEXT_PUBLIC_APP_VERSION && (
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-10 font-mono">
              Versão {process.env.NEXT_PUBLIC_APP_VERSION}
            </p>
          )}
          <div className="h-px bg-border mb-8" />
          {loginError && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {loginError}
            </p>
          )}
          <button
            type="button"
            onClick={handleLogin}
            disabled={loginLoading}
            aria-busy={loginLoading}
            className="w-full flex items-center justify-center gap-2.5 bg-primary hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70 text-primary-foreground font-semibold text-base py-3.5 transition-colors rounded-lg shadow-sm"
          >
            {loginLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <GoogleIcon />}
            {loginLoading ? "Abrindo login..." : "Entrar com Google"}
          </button>
        </motion.div>
      </div>
    );
  }

  if (!isApproved) {
    return <AccessGate status={accessStatus} email={user.email} onLogout={logout} />;
  }

  const handleEdit = (item) => { setItemToEdit(item); setIsModalOpen(true); setActiveMenuId(null); };

  const handleDelete = async (item) => {
    const id = item?.id;
    if (!id) return;

    setRemovedItems(prev => new Set([...prev, id]));
    setNotification({ id, message: "Item excluído", actionLabel: "Desfazer", onAction: () => undoDelete(id) });

    setTimeout(async () => {
      setNotification(prev => prev?.id === id ? null : prev);
      
      if (undoIds.current.has(id)) {
        undoIds.current.delete(id);
        return;
      }

      try {
        await deleteItem(id);
        if (item) {
          try {
            await logInventoryActivity(db, buildActivityEvent({
              actionType: "DELETE_ITEM",
              actorId: user?.uid || null,
              actorEmail: user?.email || null,
              targetType: "inventory",
              targetId: id,
              before: item,
              after: null,
              reversible: true,
              metadata: { source: "inventory-row" },
            }));
          } catch (auditError) {
            console.error("Audit logging failed for delete:", auditError);
          }
        }
        // onSnapshot will remove the item from `items`, then we clean up removedItems
        setRemovedItems(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } catch (err) {
        console.error("Failed to delete:", err);
        // Restore item in UI
        setRemovedItems(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        const report = await recordAppError({
          error: err,
          source: "inventory-row",
          action: "DELETE_ITEM",
          user,
          context: {
            errorContext: "delete-item",
            reproductionContext: {
              itemId: id,
              itemSnapshot: item ? {
                id: item.id,
                type: item.type,
                brand: item.brand,
                model: item.model,
              } : null,
            },
          },
        });
        setNotification({
          id,
          error: toUserFacingError(report),
          actionLabel: "Fechar",
        });
      }
    }, 2500);
  };

  const undoDelete = (id) => {
    undoIds.current.add(id);
    setRemovedItems(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setNotification(null);
  };

  const handleNotificationSupport = async () => {
    if (!notification?.error?.errorId || !user) return;
    setReportingNotification(true);
    try {
      const escalated = await escalateErrorReport(notification.error.errorId, user);
      if (escalated) {
        setNotification(prev => ({
          ...prev,
          error: {
            ...prev.error,
            reportedByUser: true,
            ticketId: escalated.ticketId,
          },
        }));
      }
    } finally {
      setReportingNotification(false);
    }
  };

  const handleShare = async (item, platform = "native") => {
    const text = `Equipamento: ${item.model}\nMarca: ${item.brand}\nPN: ${item.partNumber}\n\nEspecificações:\n${item.specifications}`;
    
    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch (err) {
        if (err.name !== 'AbortError') {
          navigator.clipboard.writeText(text);
          setNotification({ message: "Texto copiado para a área de transferência" });
        }
      }
    } else {
      navigator.clipboard.writeText(text);
      setNotification({ message: "Texto copiado para a área de transferência" });
    }
  };

  return (
    <TooltipProvider>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      <div className="flex min-h-dvh bg-background text-foreground selection:bg-primary/20 selection:text-primary">

        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border/70 bg-card">
          {/* Logo */}
          <div className="px-6 pt-7 pb-6 border-b border-border/70">
            <h1 className="text-xl font-semibold tracking-tight text-foreground leading-none font-display">
              Inventory<span className="text-primary">OS</span>
              <br />
              <span className="text-[10px] tracking-[0.08em] text-muted-foreground font-medium">Workspace operacional</span>
            </h1>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-6 px-3 space-y-1.5">
            {navItems.map(({ id, label, mobileLabel, icon: Icon }) => (
              <Button
                key={id}
                variant={activeTab === id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(id)}
                className={`w-full justify-start gap-3 h-10 font-medium text-sm rounded-lg transition-colors ${
                  activeTab === id 
                    ? "bg-accent text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={16} className={activeTab === id ? "text-primary" : ""} />
                {label}
              </Button>
            ))}
          </nav>

          {/* User Account */}
          <div className="p-4 border-t border-border/70 bg-muted/40">
            {!isHiddenOwner && <div className="flex items-center gap-3 mb-4">
              <UserAvatar user={user} size="lg" className="border-primary/15" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate font-display">
                  {user.displayName || user.email?.split("@")[0]}
                </p>
                <Badge variant="outline" className="h-5 px-2 py-0 border-primary/20 text-primary bg-primary/5 text-[10px] font-medium shadow-none rounded-full font-display">
                  {isAdmin ? "Administrador" : "Equipe"}
                </Badge>
              </div>
            </div>}
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="w-full justify-center gap-2 h-9 text-xs font-medium border-destructive/20 text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors rounded-lg font-display"
            >
              <LogOut size={14} /> Sair
            </Button>
          </div>
        </aside>

        {/* ── Main content area ── */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative">
          
          {/* Top Bar / Header */}
          <header className="sticky top-0 flex items-center min-h-16 gap-3 px-4 md:px-8 border-b border-border/70 shrink-0 bg-card/95 backdrop-blur-sm z-30">
            {/* Mobile Brand indicator */}
            <span className="md:hidden text-base font-semibold tracking-tight text-foreground bg-secondary px-2.5 py-1 rounded-lg font-display">InventoryOS</span>

            {/* Search Input */}
            <div className="flex-1 max-w-md relative group">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input
                type="text"
                placeholder={activeTab === "HOME" ? "Buscar no inventário" : "Buscar por modelo, marca ou código"}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-muted/60 border-border/70 shadow-none focus-visible:ring-2 focus-visible:ring-primary/20 placeholder:text-muted-foreground/70 text-sm transition-colors rounded-lg font-display"
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSearchQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-foreground transition-colors rounded-lg"
                >
                  <X size={14} />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              {isAdmin && <NotificationsBell userId={user.uid} onAccessRequest={() => setActiveTab("ADMIN")} />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsVoiceOpen(true)}
                    className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-accent transition-colors rounded-lg"
                  >
                    <Mic size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-lg">
                  <p className="text-xs font-medium">Busca por voz</p>
                </TooltipContent>
              </Tooltip>

              <Button
                onClick={() => { setItemToEdit(null); setIsModalOpen(true); }}
                className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold h-10 px-4 shadow-sm rounded-lg transition-colors font-display border border-primary/10"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Novo item</span>
              </Button>

              {!isHiddenOwner && <UserAvatar user={user} size="sm" className="md:hidden border-primary/15" />}

              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="md:hidden h-10 w-10 text-destructive/70 bg-destructive/5 hover:bg-destructive/20 hover:text-destructive transition-colors border border-destructive/10 rounded-lg"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </header>

          {/* Main area scrollable */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth pb-20 md:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.99, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.01, y: -4 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                {activeTab === "CRM_PERFORMANCE" && crmPerformanceEnabled ? (
                  <CrmPerformanceDashboard user={user} />
                ) : activeTab === "HOME" ? (
                  <WorkspaceHome user={user} inventoryCount={stats.inStock} onOpenCrm={() => setActiveTab("CRM")} />
                ) : activeTab === "CRM_IMPORT" && isFeatureEnabled(expansionFlags, "crmImport") ? (
                  <CrmImportView user={user} onBack={() => setActiveTab("CRM")} />
                ) : activeTab === "CRM" ? (
                  <CrmView user={user} onOpenImport={() => setActiveTab("CRM_IMPORT")} />
                ) : activeTab === "ADMIN" && isAdmin ? (
                  <AdminDashboard items={items} user={user} />
                ) : activeTab === "WHATSAPP" ? (
                  <WhatsappView user={user} />
                ) : activeTab === "ACTIONS" ? (
                  <ActionInbox user={user} onOpenCrm={() => setActiveTab("CRM")} />
                ) : activeTab === "SETTINGS" ? (

                  <SettingsView />
                ) : (
                  <InventoryContent
                    items={items.filter(i => !removedItems.has(i.id))}
                    filteredItems={filteredItems.filter(i => !removedItems.has(i.id))}
                    stats={stats}
                    loading={invLoading}
                    searchQuery={searchQuery}
                    activeMenuId={activeMenuId}
                    setActiveMenuId={setActiveMenuId}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onView={setSelectedItem}
                    onShare={handleShare}
                  />
                )}
              </motion.div>
            </AnimatePresence>
            {/* Optional PWA Install Prompt - Only after splash */}
            <PWAInstallPrompt />
          </main>

          {/* Mobile bottom nav using shadcn/ui buttons */}
          <div className="md:hidden fixed bottom-3 left-3 right-3 flex border border-border/80 bg-card/95 backdrop-blur-sm h-[4.5rem] items-center justify-start gap-1 overflow-x-auto rounded-2xl px-2 shadow-lg z-40">
            {navItems.map(({ id, label, mobileLabel, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                onClick={() => setActiveTab(id)}
                className={`min-w-[76px] flex-none flex flex-col items-center justify-center gap-1 h-16 py-0 hover:bg-transparent rounded-xl ${
                  activeTab === id ? "text-primary" : "text-muted-foreground/40"
                }`}
              >
                <Icon size={17} strokeWidth={activeTab === id ? 2.5 : 2} />
                <span className="text-[10px] font-medium font-display">{mobileLabel || label}</span>
                {activeTab === id && (
                  <motion.div 
                    layoutId="activeTabDot" 
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Notifications & Modals ── */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-sm"
          >
            <div className="bg-card border border-border shadow-xl p-4 rounded-xl">
              {notification.error ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm font-medium text-foreground">
                      {notification.error.humanMessage}
                    </span>
                  </div>
                  {notification.error.knownReason && (
                    <p className="text-xs text-muted-foreground">{notification.error.knownReason}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={notification.onAction || (() => setNotification(null))}
                      className="text-xs font-medium text-foreground bg-muted px-3 py-2 hover:bg-muted/80 transition-colors rounded-lg"
                    >
                      {notification.actionLabel || "Fechar"}
                    </button>
                    {!notification.error.reportedByUser && (
                      <button
                        onClick={handleNotificationSupport}
                        disabled={reportingNotification}
                        className="text-xs font-medium text-red-700 bg-red-50 px-3 py-2 hover:bg-red-100 disabled:opacity-50 transition-colors rounded-lg"
                      >
                        {reportingNotification ? "Enviando…" : "Enviar log para suporte"}
                      </button>
                    )}
                    {(notification.error.ticketId || notification.error.errorId) && (
                      <span className="text-[10px] font-mono text-muted-foreground py-1.5">
                        {notification.error.ticketId || notification.error.errorId}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm font-medium text-foreground">
                      {notification.message}
                    </span>
                  </div>
                  <button
                    onClick={notification.onAction || (() => undoDelete?.(notification.id))}
                    className="text-xs font-medium text-primary bg-accent px-3 py-2 hover:bg-secondary transition-colors rounded-lg"
                  >
                    {notification.actionLabel || "Fechar"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ItemDetailModal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        item={selectedItem ? { ...selectedItem, userSettings: user } : null}
        onEdit={(item) => {
          setSelectedItem(null);
          handleEdit(item);
        }}
      />

      <AddItemModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setItemToEdit(null); }}
        onAdded={() => {}}
        editItem={itemToEdit}
      />
      
      <VoiceSearch
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        onResult={text => setSearchQuery(text)}
      />
    </TooltipProvider>
  );
}

function InventoryContent({ items, filteredItems, stats, loading, searchQuery, activeMenuId, setActiveMenuId, onEdit, onDelete, onView = () => {}, onShare = () => {} }) {
  const [selectedBrandKey, setSelectedBrandKey] = useState(null);

  const availableBrands = useMemo(() => {
    const brands = new Map();

    items.forEach((item) => {
      const brandMeta = getBrandMeta(item.brand || "Sem marca");
      if (!brands.has(brandMeta.key)) {
        brands.set(brandMeta.key, brandMeta);
      }
    });

    return Array.from(brands.values()).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [items]);

  const displayItems = useMemo(() => {
    let filtered = filteredItems;
    if (selectedBrandKey) {
      filtered = filtered.filter(i => getBrandMeta(i.brand || "Sem marca").key === selectedBrandKey);
    }
    return filtered;
  }, [filteredItems, selectedBrandKey]);

  if (loading && items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Loader2 className="animate-spin text-primary/40" size={32} />
        <p className="text-xs text-muted-foreground font-medium">Sincronizando ativos…</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Page Title & Context */}
      <div className="px-4 md:px-8 pt-7 pb-6 bg-background">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="outline" className="h-6 px-2.5 bg-accent text-primary border-primary/15 text-xs font-medium shadow-none rounded-full font-display">
            Operação ativa
          </Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground leading-tight font-display">
          Central de inventário
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Consulte, organize e compartilhe os equipamentos da operação.</p>
      </div>

      {/* Operational stats */}
      <div className="mx-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm md:mx-8 divide-x divide-border/70">
        {[
          { label: "Total de itens", value: stats.total, color: "text-foreground" },
          { label: "Em estoque", value: stats.inStock, color: "text-emerald-700" },
          { label: "Vendidos", value: stats.sold, color: "text-muted-foreground" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3.5 md:p-5 space-y-1">
            <p className="text-xs text-muted-foreground font-display">{label}</p>
            <p className={`text-xl md:text-2xl font-semibold tracking-tight font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Brand filter pills */}
      <div className="sticky top-16 z-20 bg-background/95 backdrop-blur-md py-4 px-4 md:px-8 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {availableBrands.map(brand => (
          <Button
            key={brand.key}
            variant={selectedBrandKey === brand.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedBrandKey(selectedBrandKey === brand.key ? null : brand.key)}
            className={`h-9 rounded-full text-xs font-medium transition-colors font-display shrink-0 ${
              selectedBrandKey === brand.key 
                ? "bg-foreground text-background shadow-sm"
                : "bg-card border-border/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {brand.label}
          </Button>
        ))}
      </div>


      {/* Inventory List Layout */}
      <div className="min-h-[60vh] pb-8">
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-30">
            <Package size={48} strokeWidth={1} />
            <p className="text-sm font-medium text-muted-foreground">
              {searchQuery ? "Nenhum item encontrado" : "Ainda não há itens no inventário"}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {/* Desktop Table Header */}
            <div className="hidden md:flex items-center gap-6 px-8 py-3 bg-muted/45 text-xs font-medium text-muted-foreground border-b border-border/70 font-display">
              <span className="flex-1">Equipamento</span>
              <span className="w-32">Categoria</span>
              <span className="w-32 px-4">Status</span>
              <span className="w-10 text-right">Ações</span>
            </div>

            {displayItems.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                idx={idx}
                isMenuOpen={activeMenuId === item.id}
                onMenuToggle={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                onEdit={onEdit}
                onDelete={onDelete}
                onView={onView}
                onShare={onShare}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ItemRow({ item, idx, isMenuOpen, onMenuToggle, onEdit, onDelete, onView = () => {}, onShare = () => {} }) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG["SOLD"];
  const x = useMotionValue(0);
  const controls = useAnimation();
  const brandMeta = getBrandMeta(item.brand || "Sem marca");

  // Swipe animations with framer-motion
  // Swipe animations with framer-motion - using a dead zone in center to avoid "noise"
  const deleteOpacity = useTransform(x, [-80, -40, -10], [1, 0.6, 0]);
  const shareOpacity = useTransform(x, [10, 40, 80], [0, 0.6, 1]);

  return (
    <div className="relative overflow-hidden group">
      {/* Quick Action backgrounds */}
      <motion.div 
        style={{ opacity: shareOpacity }}
        className="absolute left-0 inset-y-0 w-24 bg-emerald-600 flex items-center justify-center cursor-pointer z-0"
        onClick={() => { controls.start({ x: 0 }); onShare(item); }}
      >
        <div className="flex flex-col items-center gap-1 text-white">
          <Share2 size={18} />
          <span className="text-[10px] font-semibold">Compartilhar</span>
        </div>
      </motion.div>

      <motion.div 
        style={{ opacity: deleteOpacity }}
        className="absolute right-0 inset-y-0 w-24 bg-destructive flex items-center justify-center cursor-pointer z-0"
        onClick={() => { controls.start({ x: 0 }); onDelete(item); }}
      >
        <div className="flex flex-col items-center gap-1 text-white">
          <Trash2 size={18} />
          <span className="text-[10px] font-semibold">Excluir</span>
        </div>
      </motion.div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.1}
        animate={controls}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) controls.start({ x: -100 });
          else if (info.offset.x > 60) controls.start({ x: 100 });
          else controls.start({ x: 0 });
        }}
        className="relative z-10 w-full min-w-full bg-card touch-pan-y"
      >
        <div 
          className="flex items-center gap-4 px-4 md:px-8 py-4 hover:bg-muted/45 active:bg-muted transition-colors cursor-pointer border-b border-border/60 last:border-b-0"
          onClick={() => x.get() === 0 ? onView(item) : controls.start({ x: 0 })}
        >
          {/* Avatar / Thumbnail */}
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-muted border border-border/70 p-1 overflow-hidden shrink-0 flex items-center justify-center shadow-none group-hover:scale-100 transition-none">
            {item.productImageUrl ? (
              <img src={item.productImageUrl} alt={item.model} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <Package size={20} className="text-muted-foreground/60" />
            )}
          </div>

          {/* Item Bio */}
          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm md:text-base font-semibold text-foreground truncate tracking-tight font-display">{item.model}</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] md:text-[12px] font-mono">
              <span className="font-medium text-muted-foreground">{item.brand}</span>

              {item.partNumber && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-muted-foreground/70">{item.partNumber}</span>
                </>
              )}
            </div>
          </div>

          {/* Metadata Desktop */}
          <div className="hidden md:block w-32 shrink-0">
            <Badge variant="secondary" className="bg-muted text-muted-foreground border border-border/70 font-mono text-[10px] font-medium px-2 py-0.5 shadow-none rounded-full">
              {item.type || "GERAL"}
            </Badge>
          </div>

          {/* Status Pillar */}
          <div className="w-24 shrink-0 flex items-center gap-2 px-2 font-mono">
            <div className={`w-2 h-2 rounded-full ${status.dot}`} />
            <span className={`text-[11px] font-medium font-display ${status.cls}`}>
              {item.status}
            </span>
          </div>

          {/* Menu Dropdown */}
          <div className="w-10 shrink-0 flex justify-end">
            <DropdownMenu open={isMenuOpen} onOpenChange={onMenuToggle}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground transition-colors rounded-lg">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-popover border-border rounded-xl shadow-lg">
                <DropdownMenuItem onClick={() => onEdit(item)} className="text-sm font-medium py-3 cursor-pointer transition-colors font-display">
                  Editar item
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={() => onShare(item, "whatsapp")} className="text-sm font-medium py-3 text-emerald-700 cursor-pointer transition-colors font-display">
                  Compartilhar no WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onShare(item)} className="text-sm font-medium py-3 cursor-pointer transition-colors font-display">
                  Compartilhar
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={() => onDelete(item)} className="text-sm font-medium py-3 text-destructive cursor-pointer transition-colors font-display">
                  Excluir item
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
