"use client";
import { MessageSquare, Info, ShieldCheck, Zap } from "lucide-react";
import WhatsappInstanceManager from "@/components/WhatsappInstanceManager";

export default function WhatsappView() {
  return (
    <div className="pb-20">
      {/* Title Section */}
      <div className="px-4 md:px-6 pt-8 pb-6 border-b border-white/[0.07]">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/80">Monitor de Extração Live</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none">
          WhatsApp<br /><span className="text-zinc-600">Automação</span>
        </h1>
      </div>

      {/* Logic / Help Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-white/[0.07]">
        <div className="p-6 border-b md:border-b-0 md:border-r border-white/[0.07] bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3 text-zinc-400">
            <Zap size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Ingestão Passiva</span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            O sistema monitora todas as mensagens recebidas pela conta conectada. Atualmente, cada mensagem é 
            registrada no banco de dados para posterior auditoria e treinamento da IA.
          </p>
        </div>
        <div className="p-6 border-b md:border-b-0 md:border-r border-white/[0.07] bg-white/0">
          <div className="flex items-center gap-2 mb-3 text-zinc-400">
            <ShieldCheck size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Identidade do Projeto</span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            O prefixo <code className="text-white font-bold px-1">ios_</code> identifica instâncias do **Inventory OS**. 
            Isso não afeta o tipo do seu aparelho (iOS/Android), que é detectado automaticamente pela API.
          </p>
        </div>
        <div className="p-6 bg-white/[0.01]">
          <div className="flex items-center gap-2 mb-3 text-zinc-400">
            <Info size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">Ativar Webhook</span>
          </div>
          <p className="text-sm text-zinc-300 leading-relaxed italic">
            Se o monitor de atividade estiver vazio, certifique-se de clicar no ícone <span className="text-white font-bold">✓ (Configurar Webhook)</span> 
            na sua instância após realizar a conexão do aparelho.
          </p>
        </div>
      </div>

      {/* Instance Manager Section */}
      <div className="bg-white/0">
        <WhatsappInstanceManager />
      </div>
    </div>
  );
}
