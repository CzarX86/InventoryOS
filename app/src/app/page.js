"use client";
import { useState, useRef, useMemo } from "react";
import {
  Search, Plus, Mic, Package, Boxes, Settings,
  Shield, LogOut, MoreHorizontal, AlertTriangle, Loader2, X, Share2, Trash2
} from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform, useAnimation } from "framer-motion";
import AddItemModal from "@/components/AddItemModal";
import ItemDetailModal from "@/components/ItemDetailModal";
import VoiceSearch from "@/components/VoiceSearch";
import AdminDashboard from "@/components/AdminDashboard";
import SettingsView from "@/components/SettingsView";
import SplashScreen from "@/components/SplashScreen";
import useAuth from "@/hooks/useAuth";
import useInventory from "@/hooks/useInventory";
import { buildActivityEvent, logInventoryActivity } from "@/lib/audit";
import { getBrandLogo } from "@/lib/utils";

const STATUS_CONFIG = {
  "IN STOCK":  { cls: "text-emerald-400",  dot: "bg-emerald-400" },
  "SOLD":      { cls: "text-zinc-300",     dot: "bg-zinc-500" },
  "REPAIR":    { cls: "text-amber-400",    dot: "bg-amber-400" },
  "RESERVED":  { cls: "text-blue-400",     dot: "bg-blue-400" },
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
  const { loading: invLoading, searchQuery, setSearchQuery, filteredItems, items, deleteItem } = useInventory();

  const [notification, setNotification] = useState(null);
  const [removedItems, setRemovedItems] = useState(new Set());
  const undoIds = useRef(new Set());

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141414]">
        <div className="w-5 h-5 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141414] p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-xs"
        >
          <h1 className="text-4xl font-black uppercase tracking-tight text-white mb-2">
            Inventory<br />OS
          </h1>
          <p className="text-base text-zinc-300 mb-10 leading-relaxed">
            Gestão de estoque com extração inteligente por IA.
          </p>
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

  const navItems = [
    { id: "INVENTORY", label: "Inventário", icon: Boxes },
    ...(isAdmin ? [{ id: "ADMIN", label: "Admin", icon: Shield }] : []),
    { id: "SETTINGS", label: "Config.", icon: Settings },
  ];

  const stats = {
    total: items.length,
    inStock: items.filter(i => i.status === "IN STOCK").length,
    sold: items.filter(i => i.status === "SOLD").length,
  };


  const handleEdit = (item) => { setItemToEdit(item); setIsModalOpen(true); setActiveMenuId(null); };

  const handleDelete = async (item) => {
    const id = item?.id;
    if (!id) return;

    setRemovedItems(prev => new Set([...prev, id]));
    setNotification({ id, message: "Item excluído", action: "Desfazer" });

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
        setNotification({ id, message: "Erro ao excluir. Tente novamente.", action: "OK" });
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

  const handleShare = async (item, platform = "native") => {
    const includePrice = user?.sharePriceByDefault ?? false;
    const text = `Equipamento: ${item.model}\nMarca: ${item.brand}\nPN: ${item.partNumber}\n\nEspecificações:\n${item.specifications}${includePrice && item.sellingPrice ? `\n\nPreço: R$ ${parseFloat(item.sellingPrice).toLocaleString('pt-BR')}` : ""}`;
    
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
    <>
      <AnimatePresence>
        {showSplash && <SplashScreen onComplete={() => setShowSplash(false)} />}
      </AnimatePresence>

      <div className="flex h-screen overflow-hidden bg-[#141414] text-white selection:bg-white selection:text-black">
      {/* Global CSS to prevent mobile bounce/scroll on main body if needed */}
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
      <aside className="hidden md:flex flex-col w-48 shrink-0 border-r border-white/[0.07] bg-[#111]">
        {/* Logo */}
        <div className="px-5 pt-6 pb-5 border-b border-white/[0.07]">
          <span className="text-base font-black uppercase tracking-[0.2em] text-white">
            Inventory<br />OS
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-base font-bold uppercase tracking-widest transition-colors ${
                activeTab === id ? "text-white" : "text-zinc-200 hover:text-zinc-200"
              }`}
            >
              <Icon size={13} strokeWidth={activeTab === id ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </nav>

        {/* User */}
        <div className="px-5 py-4 border-t border-white/[0.07]">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center text-[#111] font-black text-base shrink-0">
              {user.email?.[0].toUpperCase()}
            </div>
            <p className="text-base text-zinc-300 truncate flex-1">{user.email?.split("@")[0]}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-base font-bold uppercase tracking-widest text-zinc-200 hover:text-zinc-200 transition-colors"
          >
            <LogOut size={11} /> Sair
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top bar */}
        <header className="flex items-center gap-3 px-4 md:px-6 py-3 border-b border-white/[0.07] shrink-0">
          {/* Mobile brand */}
          <span className="md:hidden text-base font-black uppercase tracking-widest text-white shrink-0">IOS</span>

          {/* Search */}
          <div className="flex-1 flex items-center gap-2 max-w-sm">
            <Search size={13} className="text-zinc-200 shrink-0" />
            <input
              type="text"
              placeholder="Buscar modelo, marca, part number..."
              className="flex-1 bg-transparent text-base text-white placeholder:text-zinc-200 outline-none"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")}>
                <X size={12} className="text-zinc-200 hover:text-zinc-200" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 ml-auto shrink-0">
            <button
              onClick={() => setIsVoiceOpen(true)}
              className="p-2 text-zinc-200 hover:text-white transition-colors"
              title="Busca por voz"
            >
              <Mic size={15} />
            </button>
            <button
              onClick={() => { setItemToEdit(null); setIsModalOpen(true); }}
              className="flex items-center gap-1.5 bg-white hover:bg-zinc-200 text-[#141414] text-base font-black uppercase tracking-wider px-3 py-2 transition-colors"
            >
              <Plus size={13} />
              <span className="hidden sm:inline">Novo</span>
            </button>
            <button
              onClick={logout}
              className="md:hidden p-2 text-zinc-200 hover:text-red-400 transition-colors ml-1"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="h-full"
            >
              {activeTab === "ADMIN" && isAdmin ? (
                <AdminDashboard items={items} user={user} />
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
        </main>

        {/* Mobile bottom nav */}
        <div className="md:hidden flex border-t border-white/[0.07] shrink-0 bg-[#111]">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-base font-black uppercase tracking-widest transition-colors ${
                activeTab === id ? "text-white" : "text-zinc-200"
              }`}
            >
              <Icon size={16} strokeWidth={activeTab === id ? 2.5 : 2} />
              {label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Retro-Premium Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-32px)] max-w-sm"
          >
            <div className="bg-[#1a1a1a] border border-white/[0.1] shadow-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                  {notification.message}
                </span>
              </div>
              <button
                onClick={() => undoDelete(notification.id)}
                className="text-[10px] font-black uppercase tracking-[0.2em] text-white bg-white/10 px-3 py-1.5 hover:bg-white/20 transition-colors"
              >
                {notification.action}
              </button>
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
    </>
  );
}

function InventoryContent({ items, filteredItems, stats, loading, searchQuery, activeMenuId, setActiveMenuId, onEdit, onDelete, onView = () => {}, onShare = () => {} }) {
  const [selectedCategory, setSelectedCategory] = useState("Todos");

  const uniqueCategories = useMemo(() => {
    const cats = items.map(i => i.type || "Geral");
    return ["Todos", ...Array.from(new Set(cats)).sort()];
  }, [items]);

  const displayItems = useMemo(() => {
    let filtered = filteredItems;
    if (selectedCategory !== "Todos") {
      filtered = filtered.filter(i => (i.type || "Geral") === selectedCategory);
    }
    return filtered;
  }, [filteredItems, selectedCategory]);

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 gap-3">
        <Loader2 className="animate-spin text-zinc-300" size={18} />
        <p className="text-base text-zinc-200 uppercase tracking-widest font-bold">Carregando...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Page title */}
      <div className="px-4 md:px-6 pt-8 pb-6 border-b border-white/[0.07]">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none">
          Inventário
        </h1>
      </div>

      {/* Stats row */}
      <div className="flex border-b border-white/[0.07]">
        {[
          { label: "Total",      value: stats.total,   cls: "text-white" },
          { label: "Em Estoque", value: stats.inStock,  cls: "text-white" },
          { label: "Vendidos",   value: stats.sold,     cls: "text-white" },
        ].map(({ label, value, cls }, i, arr) => (
          <div
            key={label}
            className={`flex-1 px-4 md:px-6 py-5 ${i < arr.length - 1 ? "border-r border-white/[0.07]" : ""}`}
          >
            <p className="text-base font-bold uppercase tracking-widest text-zinc-300 mb-1">{label}</p>
            <p className={`text-3xl font-black ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 px-4 md:px-6 py-4 overflow-x-auto border-b border-white/[0.07] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
        {uniqueCategories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`shrink-0 px-4 py-2 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-[0.15em] transition-all ${
              selectedCategory === cat
                ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                : "bg-white/[0.03] text-zinc-400 border border-white/[0.05] hover:bg-white/[0.08] hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Items */}
      {displayItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Package size={24} className="text-zinc-300" />
          <p className="text-base font-bold uppercase tracking-widest text-zinc-200">
            {searchQuery ? "Nenhum resultado." : "Inventário vazio."}
          </p>
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div className="hidden md:flex items-center gap-4 px-6 py-2 border-b border-white/[0.07]">
            <span className="flex-1 text-base font-bold uppercase tracking-widest text-zinc-200">Item</span>
            <span className="w-32 text-base font-bold uppercase tracking-widest text-zinc-200">Tipo</span>
            <span className="w-24 text-base font-bold uppercase tracking-widest text-zinc-200">Status</span>
            <span className="w-8" />
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
  );
}

function ItemRow({ item, idx, isMenuOpen, onMenuToggle, onEdit, onDelete, onView = () => {}, onShare = () => {} }) {
  const status = STATUS_CONFIG[item.status] || STATUS_CONFIG["SOLD"];
  const x = useMotionValue(0);
  const controls = useAnimation();

  // Delete (swipe left): revealed on the right
  const deleteOpacity = useTransform(x, [-80, -40, 0], [1, 0.6, 0]);
  const deleteScale  = useTransform(x, [-80, -40, 0], [1, 0.85, 0.7]);

  // Share (swipe right): revealed on the left
  const shareOpacity = useTransform(x, [0, 40, 80], [0, 0.6, 1]);
  const shareScale   = useTransform(x, [0, 40, 80], [0.7, 0.85, 1]);

  return (
    <div className="relative overflow-hidden border-b border-white/[0.04]">
      {/* Share background — left side, revealed on swipe right */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-24 bg-emerald-600 flex items-center justify-center cursor-pointer"
        onClick={() => {
          controls.start({ x: 0 });
          onShare(item);
        }}
      >
        <motion.div style={{ opacity: shareOpacity, scale: shareScale }} className="flex flex-col items-center gap-1 text-white">
          <Share2 size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Compartilhar</span>
        </motion.div>
      </div>

      {/* Delete background — right side, revealed on swipe left */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-24 bg-red-600 flex items-center justify-center cursor-pointer"
        onClick={() => {
          controls.start({ x: 0 });
          onDelete(item);
        }}
      >
        <motion.div style={{ opacity: deleteOpacity, scale: deleteScale }} className="flex flex-col items-center gap-1 text-white">
          <Trash2 size={20} />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Excluir</span>
        </motion.div>
      </div>

      <motion.div
        drag="x"
        style={{ x }}
        dragConstraints={{ left: -100, right: 100 }}
        dragElastic={0.15}
        animate={controls}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50) {
            controls.start({ x: -100 });
          } else if (info.offset.x > 50) {
            controls.start({ x: 100 });
          } else {
            controls.start({ x: 0 });
          }
        }}
        initial={{ opacity: 0, x: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        whileTap={{ cursor: "grabbing" }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative z-10 bg-[#141414] touch-pan-y"
      >
        <div 
          className="flex items-center gap-4 px-4 md:px-6 py-4 hover:bg-white/[0.02] active:bg-white/[0.04] transition-colors cursor-pointer"
          onClick={() => {
            if (x.get() !== 0) {
              controls.start({ x: 0 });
            } else {
              onView(item);
            }
          }}
        >
          {/* Thumbnail */}
          <div className="w-12 h-12 rounded-lg bg-white/[0.03] border border-white/[0.05] flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            {item.productImageUrl ? (
              <img src={item.productImageUrl} alt={item.model} className="w-full h-full object-cover" />
            ) : (
              <Package size={20} className="text-zinc-600" />
            )}
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-base font-bold text-white truncate">{item.model}</span>
              {item.needsMarketResearch && (
                <AlertTriangle size={11} className="text-amber-400 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 text-base text-zinc-400">
              {getBrandLogo(item.brand) && (
                <img src={getBrandLogo(item.brand)} alt={item.brand} className="h-3.5 object-contain grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" />
              )}
              <span className="font-medium text-zinc-300">{item.brand}</span>
              {item.partNumber && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono text-xs text-zinc-500 uppercase tracking-tighter">{item.partNumber}</span>
                </>
              )}
            </div>
          </div>

          {/* Type (Desktop) */}
          <div className="hidden md:block w-32 shrink-0">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500 truncate block">
              {item.type || "Geral"}
            </span>
          </div>

          {/* Status */}
          <div className="w-24 shrink-0 flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot}`} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${status.cls}`}>
              {item.status}
            </span>
          </div>

          {/* Menu */}
          <div className="relative w-8 shrink-0 flex justify-end">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMenuToggle();
              }}
              className={`p-1 text-zinc-500 hover:text-white transition-opacity ${isMenuOpen ? "opacity-100" : "md:opacity-0 md:group-hover:opacity-100"}`}
            >
              <MoreHorizontal size={15} />
            </button>

            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute right-0 top-8 z-50 bg-[#1a1a1a] border border-white/[0.1] shadow-2xl min-w-[140px] overflow-hidden"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(item); }}
                    className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors"
                  >
                    Editar
                  </button>
                  <div className="h-px bg-white/[0.07]" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onShare(item, "whatsapp"); }}
                    className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-[#25D366] hover:bg-[#25D366]/10 transition-colors"
                  >
                    WhatsApp
                  </button>
                  <div className="h-px bg-white/[0.07]" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onShare(item); }}
                    className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                  >
                    Outros (Sistema)
                  </button>
                  <div className="h-px bg-white/[0.07]" />
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                    className="w-full text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Excluir
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
