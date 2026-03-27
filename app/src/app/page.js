"use client";
import { useState, useRef, useMemo, useEffect } from "react";
import {
  Search, Plus, Mic, Package, Boxes, Settings,
  Shield, LogOut, MoreHorizontal, Loader2, X, Share2, Trash2, MessageSquare,
  CheckSquare
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
import PWAInstallPrompt from "@/components/PWAInstallPrompt"; // Added PWAInstallPrompt import
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import useAuth from "@/hooks/useAuth";
import useInventory from "@/hooks/useInventory";
import { buildActivityEvent, logInventoryActivity } from "@/lib/audit";
import { escalateErrorReport, recordAppError, toUserFacingError } from "@/lib/errorReporting";
import { db } from "@/lib/firebase";
import { getBrandMeta } from "@/lib/utils";

const STATUS_CONFIG = {
  "IN STOCK":  { 
    cls: "text-[#acc3ce]", // on_secondary_container
    dot: "bg-[#8ba1ac]", // secondary
    bg: "bg-[#293e48]"   // secondary_container
  },
  "SOLD":      { 
    cls: "text-[#acabaa]", // on_surface_variant
    dot: "bg-[#484848]", // outline_variant
    bg: "bg-[#191a1a]"   // surface_container
  },
  "REPAIR":    { 
    cls: "text-[#ee7d77]", // error
    dot: "bg-[#7f2927]", // error_container
    bg: "bg-[#7f2927]/20"
  },
  "RESERVED":  { 
    cls: "text-[#97a5ff]", // tertiary
    dot: "bg-[#8596ff]", // tertiary_container
    bg: "bg-[#8596ff]/10"
  },
};

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("INVENTORY");
  const [itemToEdit, setItemToEdit] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showSplash, setShowSplash] = useState(true);

  const { user, loading: authLoading, isAdmin, login, logout } = useAuth();
  const { loading: invLoading, searchQuery, setSearchQuery, filteredItems, items, deleteItem, syncError } = useInventory(user);

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
    { id: "INVENTORY", label: "Inventário", icon: Boxes },
    ...(isAdmin ? [
      { id: "ACTIONS", label: "Ações", icon: CheckSquare },
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
          <h1 className="text-4xl font-black uppercase tracking-tight text-foreground mb-2 font-display">
            Inventory<br />OS
          </h1>
          <p className="text-base text-zinc-300 mb-1 leading-relaxed">
            Gestão de estoque com extração inteligente por IA.
          </p>
          {process.env.NEXT_PUBLIC_APP_VERSION && (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-10 font-mono">
              Versão {process.env.NEXT_PUBLIC_APP_VERSION}
            </p>
          )}
          <div className="h-px bg-white/[0.08] mb-8" />
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-zinc-100 text-[#141414] font-bold text-base py-3 transition-colors"
          >
            <GoogleIcon />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
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

      <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/20 selection:text-primary">
        <style jsx global>{`
          html, body {
            overflow: hidden;
            position: fixed;
            width: 100%;
            height: 100%;
            -webkit-overflow-scrolling: touch;
            touch-action: none;
          }
          #__next, main, .overflow-y-auto {
            touch-action: pan-y;
          }
        `}</style>

        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden md:flex flex-col w-44 shrink-0 border-r border-[#484848]/20 bg-[#0e0e0e]">
          {/* Logo */}
          <div className="px-6 pt-8 pb-6 border-b border-[#484848]/20">
            <h1 className="text-lg font-black uppercase tracking-tighter text-[#e7e5e5] leading-none font-display">
              IOS<span className="text-[#97a5ff]">.</span>
              <br />
              <span className="text-[8px] tracking-[0.3em] opacity-30 uppercase font-bold font-display">INVENTORY_OS</span>
            </h1>
          </div>

          {/* Nav */}
          <nav className="flex-1 py-6 px-3 space-y-1">
            {navItems.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={activeTab === id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveTab(id)}
                className={`w-full justify-start gap-3 h-10 font-bold uppercase tracking-widest text-[9px] rounded-none transition-none font-display ${
                  activeTab === id 
                    ? "bg-[#1f2020] text-[#e7e5e5]" 
                    : "text-[#acabaa]/60 hover:text-[#e7e5e5] hover:bg-[#131313]"
                }`}
              >
                <Icon size={14} className={activeTab === id ? "text-[#97a5ff]" : ""} />
                {label}
              </Button>
            ))}
          </nav>

          {/* User Account */}
          <div className="p-4 border-t border-[#484848]/20 bg-[#131313]">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-none bg-[#1f2020] border border-[#484848]/20 flex items-center justify-center text-[#97a5ff] font-black text-xs shrink-0">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#e7e5e5] truncate font-display">
                  {user.displayName || user.email?.split("@")[0]}
                </p>
                <Badge variant="outline" className="h-4 px-1.5 py-0 border-[#97a5ff]/20 text-[#97a5ff] bg-[#97a5ff]/5 text-[7px] font-bold uppercase tracking-widest shadow-none rounded-none font-display">
                  USR_ROOT
                </Badge>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              className="w-full justify-center gap-2 h-8 text-[8px] font-bold uppercase tracking-widest border-[#ee7d77]/10 text-[#ee7d77] hover:bg-[#ee7d77]/10 hover:border-[#ee7d77]/20 transition-none rounded-none font-display"
            >
              <LogOut size={12} /> TERMINATE_SESSION
            </Button>
          </div>
        </aside>

        {/* ── Main content area ── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-background relative">
          
          {/* Top Bar / Header */}
          <header className="flex items-center h-14 gap-4 px-4 md:px-6 border-b border-[#484848]/10 shrink-0 bg-[#0e0e0e] z-30">
            {/* Mobile Brand indicator */}
            <span className="md:hidden text-lg font-black uppercase tracking-tighter text-[#e7e5e5] bg-[#1f2020] px-2 py-0.5 rounded-none font-display">IOS</span>

            {/* Search Input */}
            <div className="flex-1 max-w-md relative group">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#acabaa]/30 group-focus-within:text-[#97a5ff] transition-none" />
              <Input
                type="text"
                placeholder="SEARCH_MANIFEST_DB..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-[#131313] border-none shadow-none focus-visible:ring-1 focus-visible:ring-[#97a5ff]/20 placeholder:text-[#acabaa]/20 text-[9px] font-bold uppercase tracking-[0.1em] transition-none rounded-none font-display"
              />
              {searchQuery && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-[#acabaa]/30 hover:text-[#e7e5e5] transition-none rounded-none"
                >
                  <X size={14} />
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsVoiceOpen(true)}
                    className="h-9 w-9 text-muted-foreground/30 hover:text-primary hover:bg-primary/5 transition-all rounded-none"
                  >
                    <Mic size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-none">
                  <p className="text-[10px] font-black uppercase">Busca por Voz</p>
                </TooltipContent>
              </Tooltip>

              <Button
                onClick={() => { setItemToEdit(null); setIsModalOpen(true); }}
                className="gap-2 bg-[#e7e5e5] hover:bg-[#c6c6c7] text-[#0e0e0e] text-[9px] font-bold uppercase tracking-widest h-9 px-4 shadow-none rounded-none transition-none font-display border border-[#484848]/10"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">ADD_NEW_ENTRY</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="md:hidden h-9 w-9 text-destructive/40 bg-destructive/5 hover:bg-destructive/20 hover:text-destructive transition-all border border-destructive/10 rounded-none"
              >
                <LogOut size={16} />
              </Button>
            </div>
          </header>

          {/* Main area scrollable */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.99, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 1.01, y: -4 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="h-full"
              >
                {activeTab === "ADMIN" && isAdmin ? (
                  <AdminDashboard items={items} user={user} />
                ) : activeTab === "WHATSAPP" ? (
                  <WhatsappView />
                ) : activeTab === "ACTIONS" ? (
                  <ActionInbox />
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
          <div className="md:hidden flex border-t border-foreground/2 shrink-0 bg-background h-16 items-center justify-around px-2 z-40">
            {navItems.map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant="ghost"
                onClick={() => setActiveTab(id)}
                className={`flex-1 flex flex-col items-center justify-center gap-1.5 h-16 py-0 hover:bg-transparent rounded-none ${
                  activeTab === id ? "text-primary" : "text-muted-foreground/40"
                }`}
              >
                <Icon size={16} strokeWidth={activeTab === id ? 3 : 2} className={activeTab === id ? "drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]" : ""} />
                <span className="text-[6.5px] font-bold uppercase tracking-[0.15em]">{label}</span>
                {activeTab === id && (
                  <motion.div 
                    layoutId="activeTabDot" 
                    className="w-1.5 h-1.5 rounded-none bg-primary"
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
            <div className="bg-[#1a1a1a] border border-white/[0.1] shadow-2xl p-4 rounded-none">
              {notification.error ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-none bg-red-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                      {notification.error.humanMessage}
                    </span>
                  </div>
                  {notification.error.knownReason && (
                    <p className="text-xs text-zinc-400">{notification.error.knownReason}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={notification.onAction || (() => setNotification(null))}
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-white bg-white/10 px-3 py-1.5 hover:bg-white/20 transition-colors rounded-none"
                    >
                      {notification.actionLabel || "Fechar"}
                    </button>
                    {!notification.error.reportedByUser && (
                      <button
                        onClick={handleNotificationSupport}
                        disabled={reportingNotification}
                        className="text-[10px] font-black uppercase tracking-[0.2em] text-white bg-red-500/20 px-3 py-1.5 hover:bg-red-500/30 disabled:opacity-50 transition-colors rounded-none"
                      >
                        {reportingNotification ? "Enviando..." : "Enviar log para suporte"}
                      </button>
                    )}
                    {(notification.error.ticketId || notification.error.errorId) && (
                      <span className="text-[10px] font-mono text-zinc-500 py-1.5">
                        {notification.error.ticketId || notification.error.errorId}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-none bg-red-500 animate-pulse" />
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                      {notification.message}
                    </span>
                  </div>
                  <button
                    onClick={notification.onAction || (() => undoDelete?.(notification.id))}
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-white bg-white/10 px-3 py-1.5 hover:bg-white/20 transition-colors rounded-none"
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
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em]">Sincronizando Ativos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* Page Title & Context */}
      <div className="px-4 md:px-6 pt-10 pb-8 bg-[#0e0e0e]">
        <div className="flex items-center gap-3 mb-4">
          <Badge variant="outline" className="h-5 px-2 bg-[#1f2020] text-[#97a5ff] border-[#484848]/20 text-[9px] font-bold uppercase tracking-[0.2em] shadow-none rounded-none font-display">
            STATUS_OPERACIONAL.SYS
          </Badge>
        </div>
        <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[#e7e5e5] leading-none font-display">
          CENTRAL_DE_<span className="text-[#acabaa]/30">INVENTÁRIO</span>
        </h1>
      </div>

      {/* Industrial Stats Grid */}
      <div className="grid grid-cols-3 border-y border-[#484848]/20 bg-[#131313] divide-x divide-[#484848]/20">
        {[
          { label: "TOTAL_ATV",      value: stats.total,   color: "text-[#e7e5e5]" },
          { label: "EM_ESTOQUE",    value: stats.inStock,  color: "text-[#acc3ce]" },
          { label: "VENDIDOS_LOG",   value: stats.sold,     color: "text-[#acabaa]/40" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-3 md:p-5 space-y-1">
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#acabaa]/50 font-display">{label}</p>
            <p className={`text-xl md:text-2xl font-bold tracking-tighter font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Brand Filter Pills */}
      <div className="sticky top-0 z-20 bg-[#0e0e0e]/95 backdrop-blur-md border-b border-[#484848]/20 py-4 px-4 md:px-6 flex items-center gap-2 overflow-x-auto no-scrollbar">
        {availableBrands.map(brand => (
          <Button
            key={brand.key}
            variant={selectedBrandKey === brand.key ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedBrandKey(selectedBrandKey === brand.key ? null : brand.key)}
            className={`h-8 rounded-none text-[9px] font-bold uppercase tracking-[0.15em] transition-none font-display shrink-0 ${
              selectedBrandKey === brand.key 
                ? "bg-[#e7e5e5] text-[#0e0e0e] shadow-none" 
                : "bg-[#191a1a] border-[#484848]/10 text-[#acabaa] hover:bg-[#1f2020] hover:text-[#e7e5e5]"
            }`}
          >
            {brand.label}
          </Button>
        ))}
      </div>


      {/* Inventory List Layout */}
      <div className="min-h-screen pb-32">
        {displayItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 opacity-30">
            <Package size={48} strokeWidth={1} />
            <p className="text-[11px] font-black uppercase tracking-[0.4em]">
              {searchQuery ? "Nenhum Ativo Encontrado" : "Base de Dados Vazia"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-foreground/[0.01]">
            {/* Desktop Table Header */}
            <div className="hidden md:flex items-center gap-6 px-8 py-3 bg-[#131313] text-[8px] font-bold uppercase tracking-[0.3em] text-[#acabaa]/40 border-b border-[#484848]/10 font-display">
              <span className="flex-1">ESPECIFICAÇÕES_DO_ATIVO</span>
              <span className="w-32">CATEGORIA_IDX</span>
              <span className="w-32 px-4">STATUS_FLG</span>
              <span className="w-10 text-right">ACT</span>
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
          <span className="text-[8px] font-black uppercase tracking-tighter">SHARE</span>
        </div>
      </motion.div>

      <motion.div 
        style={{ opacity: deleteOpacity }}
        className="absolute right-0 inset-y-0 w-24 bg-destructive flex items-center justify-center cursor-pointer z-0"
        onClick={() => { controls.start({ x: 0 }); onDelete(item); }}
      >
        <div className="flex flex-col items-center gap-1 text-white">
          <Trash2 size={18} />
          <span className="text-[8px] font-black uppercase tracking-tighter">DELETE</span>
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
        className="relative z-10 w-full min-w-full bg-[#09090b] touch-pan-y"
      >
        <div 
          className="flex items-center gap-4 px-4 md:px-8 py-5 hover:bg-[#131313] active:bg-[#191a1a] transition-none cursor-pointer border-b border-[#484848]/5"
          onClick={() => x.get() === 0 ? onView(item) : controls.start({ x: 0 })}
        >
          {/* Avatar / Thumbnail */}
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-none bg-[#131313] border border-[#484848]/20 p-1 overflow-hidden shrink-0 flex items-center justify-center shadow-none group-hover:scale-100 transition-none">
            {item.productImageUrl ? (
              <img src={item.productImageUrl} alt={item.model} className="w-full h-full object-cover rounded-none grayscale group-hover:grayscale-0" />
            ) : (
              <Package size={20} className="text-[#484848]" />
            )}
          </div>

          {/* Item Bio */}
          <div className="flex-1 min-w-0 py-0.5">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm md:text-base font-bold text-[#e7e5e5] truncate uppercase tracking-tight font-display">{item.model}</span>
            </div>
            <div className="flex items-center gap-2 text-[9px] md:text-[10px] font-mono">
              <span className="font-semibold text-[#acabaa] uppercase">{item.brand}</span>

              {item.partNumber && (
                <>
                  <span className="text-[#484848]">/</span>
                  <span className="text-[#acabaa]/30">{item.partNumber}</span>
                </>
              )}
            </div>
          </div>

          {/* Metadata Desktop */}
          <div className="hidden md:block w-32 shrink-0">
            <Badge variant="secondary" className="bg-[#191a1a] text-[#acabaa] border border-[#484848]/20 font-mono text-[8px] font-black px-2 py-0.5 shadow-none rounded-none uppercase tracking-widest">
              {item.type || "GERAL"}
            </Badge>
          </div>

          {/* Status Pillar */}
          <div className="w-24 shrink-0 flex items-center gap-2 px-2 font-mono">
            <div className={`w-1 h-1 rounded-none ${status.dot}`} />
            <span className={`text-[8px] font-bold uppercase tracking-[0.1em] ${status.cls}`}>
              {item.status}
            </span>
          </div>

          {/* Menu Dropdown */}
          <div className="w-10 shrink-0 flex justify-end">
            <DropdownMenu open={isMenuOpen} onOpenChange={onMenuToggle}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[#484848] hover:text-[#e7e5e5] transition-none rounded-none">
                  <MoreHorizontal size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#1f2020] border-[#484848] rounded-none shadow-none">
                <DropdownMenuItem onClick={() => onEdit(item)} className="text-[9px] font-bold uppercase tracking-widest py-3 cursor-pointer transition-none font-display">
                  EDIT_ACTIVE_RECORD
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#484848]/20" />
                <DropdownMenuItem onClick={() => onShare(item, "whatsapp")} className="text-[9px] font-bold uppercase tracking-widest py-3 text-[#acc3ce] cursor-pointer transition-none font-display">
                  WHATSAPP_EXPORT
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onShare(item)} className="text-[9px] font-bold uppercase tracking-widest py-3 cursor-pointer transition-none font-display">
                  PDF_TELEMETRY
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#484848]/20" />
                <DropdownMenuItem onClick={() => onDelete(item)} className="text-[9px] font-bold uppercase tracking-widest py-3 text-[#ee7d77] cursor-pointer transition-none font-display">
                  WIPE_DATA_ENTRY
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


