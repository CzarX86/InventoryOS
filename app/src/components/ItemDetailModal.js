"use client";
import { X, Edit2, Mic, Package, Hash, Tag, Activity, Calendar, Server, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getBrandLogo } from "@/lib/utils";

function DetailField({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="py-4 border-b border-white/[0.04]">
      <div className="flex items-center gap-2 mb-1.5">
        <Icon size={13} className="text-zinc-500" />
        <span className="text-xs font-black uppercase tracking-widest text-zinc-500">{label}</span>
      </div>
      <p className={`text-base text-white ${mono ? "font-mono" : "font-medium"}`}>
        {value || <span className="text-zinc-700 italic">Não informado</span>}
      </p>
    </div>
  );
}

export default function ItemDetailModal({ isOpen, onClose, item, onEdit }) {
  if (!isOpen || !item) return null;

  const handleShare = async (platform = "native") => {
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
          alert("Texto copiado para a área de transferência!");
        }
      }
    } else {
      navigator.clipboard.writeText(text);
      alert("Texto copiado para a área de transferência!");
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/90 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, y: 100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 100 }}
        className="w-full md:max-w-2xl bg-[#0a0a0a] border-t md:border border-white/[0.1] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,1)] max-h-[90vh] flex flex-col"
      >
        {/* Header (Premium Glass) */}
        <div className="relative h-48 shrink-0 bg-gradient-to-br from-zinc-800 to-black p-6 flex flex-col justify-end">
          <div className="absolute top-4 right-4 flex gap-2 z-20">
            <button 
              onClick={() => handleShare("whatsapp")}
              className="p-2.5 rounded-full bg-white/10 hover:bg-[#25D366] text-white transition-all backdrop-blur-md"
              title="Compartilhar no WhatsApp"
            >
              <svg 
                viewBox="0 0 24 24" 
                width="18" 
                height="18" 
                stroke="currentColor" 
                strokeWidth="2" 
                fill="none" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </button>
            <button 
              onClick={() => handleShare()}
              className="p-2.5 rounded-full bg-white/10 hover:bg-emerald-500 text-white transition-all backdrop-blur-md"
              title="Compartilhar (Sistema)"
            >
              <Share2 size={18} />
            </button>
            <button 
              onClick={() => onEdit(item)}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all backdrop-blur-md"
            >
              <Edit2 size={18} />
            </button>
            <button 
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-black transition-all backdrop-blur-md"
            >
              <X size={18} />
            </button>
          </div>
          
          <div className="relative z-10 flex items-center gap-6">
            {item.productImageUrl && (
              <div className="w-24 h-24 rounded-2xl overflow-hidden border border-white/20 shadow-2xl shrink-0">
                <img src={item.productImageUrl} alt={item.model} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/50">
                {item.id?.slice(0, 8)}
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 ${
                item.status === "IN STOCK" ? "bg-emerald-500/20 text-emerald-400" :
                item.status === "SOLD" ? "bg-zinc-500/20 text-zinc-400" :
                "bg-amber-500/20 text-amber-400"
              }`}>
                {item.status}
              </span>
            </div>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white leading-none">
              {item.model}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {getBrandLogo(item.brand) && (
                <img src={getBrandLogo(item.brand)} alt={item.brand} className="h-5 object-contain" />
              )}
              <p className="text-xl text-zinc-300 font-medium">{item.brand}</p>
            </div>
          </div>
        </div>
          
        {/* Subtle noise/gradient texture */}
        <div className="absolute inset-0 opacity-20 pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
      </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0a0a0a]">
          <div className="grid grid-cols-1 md:grid-cols-2 p-6 gap-x-8">
            <DetailField icon={Server} label="Tipo de Equipamento" value={item.type} />
            <DetailField icon={Hash} label="Part Number" value={item.partNumber} mono />
            <DetailField icon={Calendar} label="Cadastrado em" value={formatDate(item.createdAt)} />
            <DetailField icon={Activity} label="Última Atualização" value={formatDate(item.updatedAt)} />
          </div>

          <div className="px-6 pb-6">
            {/* Specifications Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Tag size={14} className="text-zinc-500" />
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-500">Especificações Técnicas</h4>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.04] p-5 rounded-sm">
                <p className="text-base text-zinc-200 leading-relaxed font-mono whitespace-pre-wrap">
                  {item.specifications || "Nenhum dado técnico disponível."}
                </p>
              </div>
            </div>

            {/* Audio Log Section */}
            {item.audioUrl && (
              <div className="mb-8 p-6 bg-white border border-white flex items-center gap-6 shadow-[0_20px_40px_rgba(255,255,255,0.05)]">
                <div className="w-14 h-14 rounded-full bg-black flex items-center justify-center text-white shrink-0">
                  <Mic size={24} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-black/50 mb-2">Log de Voz Gravado</p>
                  <audio src={item.audioUrl} controls className="w-full h-8 invert translate-y-1" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/[0.08] bg-black">
          <button
            onClick={onClose}
            className="w-full py-4 text-sm font-black uppercase tracking-[0.3em] text-zinc-400 hover:text-white transition-colors"
          >
            Fechar Detalhes
          </button>
        </div>
      </motion.div>
    </div>
  );
}
