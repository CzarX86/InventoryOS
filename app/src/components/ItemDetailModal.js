"use client";
import { X, Edit2, Mic, Package, Hash, Tag, Activity, Calendar, Server, Share2, CornerRightDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getBrandLogo } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function DetailField({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="py-5 border-b border-foreground/5 last:border-0 group select-none">
      <div className="flex items-center gap-2 mb-2 opacity-40 group-hover:opacity-80 transition-opacity">
        <Icon size={12} className="text-primary/60" />
        <span className="text-[11px] font-display font-normal uppercase tracking-[0.2em]">{label}</span>
      </div>
      <p className={`text-sm text-foreground/90 ${mono ? "font-mono" : "font-display font-normal uppercase"} tracking-tight`}>
        {value || <span className="text-muted-foreground/20 italic">NULL_DATA</span>}
      </p>
    </div>
  );
}

export default function ItemDetailModal({ isOpen, onClose, item, onEdit }) {
  if (!item) return null;

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
        }
      }
    } else {
      navigator.clipboard.writeText(text);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    const d = date.toDate ? date.toDate() : new Date(date);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d).toUpperCase();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl bg-[#0e0e0e] border-foreground/10 p-0 overflow-hidden shadow-none flex flex-col max-h-[95vh] rounded-none focus:outline-none">
        <DialogHeader className="hidden">
          <DialogTitle>{item.model}</DialogTitle>
          <DialogDescription>Detalhes do equipamento {item.brand} - {item.model}</DialogDescription>
        </DialogHeader>

        {/* Header (Industrial Plate) */}
        <div className="relative h-64 shrink-0 bg-[#131313] p-10 flex flex-col justify-end overflow-hidden border-b border-foreground/10">
          {/* Grid Pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: `radial-gradient(circle, white 1px, transparent 1px)`, backgroundSize: '16px 16px' }} />
          
          <div className="absolute top-6 right-6 flex gap-2 z-20">
            <Button 
              size="icon"
              variant="outline"
              className="w-10 h-10 rounded-none bg-[#1f2020] border-foreground/10 hover:bg-foreground hover:text-background transition-none"
              onClick={() => handleShare("whatsapp")}
            >
              <Share2 size={16} />
            </Button>
            <Button 
               size="icon"
               variant="outline"
               className="w-10 h-10 rounded-none bg-[#1f2020] border-foreground/10 hover:bg-primary hover:text-primary-foreground transition-none"
               onClick={() => onEdit(item)}
            >
              <Edit2 size={16} />
            </Button>
          </div>
          
          <div className="relative z-10 flex items-end gap-8">
            {item.productImageUrl ? (
              <div className="w-32 h-32 rounded-none overflow-hidden border border-foreground/10 bg-[#0e0e0e] grayscale group hover:grayscale-0 transition-all duration-500">
                <img src={item.productImageUrl} alt={item.model} className="w-full h-full object-cover scale-110 group-hover:scale-100 transition-transform duration-700" />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-none bg-[#1f2020] border border-foreground/10 flex items-center justify-center text-muted-foreground/20">
                <Package size={40} strokeWidth={1} />
              </div>
            )}
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="bg-transparent border-foreground/10 text-[10px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground/40 rounded-none font-mono py-0 h-5">
                  UID_{item.id?.slice(0, 8).toUpperCase()}
                </Badge>
                <div className={`px-3 h-5 flex items-center text-[10px] font-display font-normal uppercase tracking-[0.2em] border-none rounded-none
                    ${item.status === "IN STOCK" ? "bg-emerald-500/10 text-emerald-500" :
                    item.status === "SOLD" ? "bg-foreground/5 text-muted-foreground/60" :
                    "bg-red-500/10 text-red-500"}`}>
                  {item.status}
                </div>
              </div>
              <h2 className="text-4xl font-display font-normal uppercase tracking-tighter text-foreground leading-none mb-1 truncate">
                {item.model}
              </h2>
              <p className="text-xl text-muted-foreground font-display font-normal uppercase tracking-tight opacity-40">{item.brand}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0e0e0e]">
          <div className="grid grid-cols-1 md:grid-cols-2 p-10 gap-x-12 border-b border-foreground/5">
            <DetailField icon={Server} label="CATEGORIA_IDX" value={item.type} />
            <DetailField icon={Hash} label="PART_NUMBER_REF" value={item.partNumber} mono />
            <DetailField icon={Calendar} label="ENTRY_TIMESTAMP" value={formatDate(item.createdAt)} />
            <DetailField icon={Activity} label="LAST_SYNCHRONIZATION" value={formatDate(item.updatedAt)} />
          </div>

          <div className="p-10">
            {/* Specifications Section */}
            <div className="mb-12">
              <div className="flex items-center gap-2 mb-6 opacity-40">
                <CornerRightDown size={14} className="text-primary/60" />
                <h4 className="text-[11px] font-display font-normal uppercase tracking-[0.2em]">TECHNICAL_SPECIFICATIONS.TXT</h4>
              </div>
              <div className="bg-[#131313] border border-foreground/10 p-8 rounded-none relative group transition-all">
                <div className="absolute top-0 right-0 p-3 text-[10px] font-mono text-muted-foreground/20 uppercase font-bold">UTF-8</div>
                <div className="absolute top-0 left-0 w-[2px] h-0 bg-primary group-hover:h-full transition-all duration-300" />
                <p className="text-sm text-foreground/70 leading-relaxed font-mono whitespace-pre-wrap">
                  {item.specifications || "NO_TECHNICAL_DATA_AVAILABLE_IN_SYSTEM_INDEX"}
                </p>
              </div>
            </div>

            {/* Audio Log Section */}
            {item.audioUrl && (
              <div className="p-8 bg-[#131313] border border-foreground/10 rounded-none flex items-center gap-8 group">
                <div className="w-16 h-16 rounded-none bg-[#1f2020] border border-foreground/10 flex items-center justify-center text-primary/40 group-hover:text-primary transition-colors shrink-0">
                  <Mic size={28} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-display font-normal uppercase tracking-[0.2em] opacity-30">VOICE_TRANSMISSION_LOG</p>
                    <span className="text-[10px] font-mono text-primary/40 uppercase">AI_SOURCE_ENCODED</span>
                  </div>
                  <audio src={item.audioUrl} controls className="w-full h-8 brightness-[0.4] contrast-200" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-foreground/10 bg-[#0e0e0e]/50 backdrop-blur-md">
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full py-8 text-[12px] font-display font-normal uppercase tracking-[0.4em] hover:bg-foreground hover:text-background rounded-none transition-all duration-300 text-muted-foreground/60"
          >
            DISMISS_VIEWPORT_TERMINAL
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

