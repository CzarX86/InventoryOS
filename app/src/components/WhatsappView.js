"use client";
import { MessageSquare, Info, ShieldCheck, Zap } from "lucide-react";
import WhatsappInstanceManager from "@/components/WhatsappInstanceManager";
import ContactReviewQueue from "@/components/ContactReviewQueue";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function WhatsappView() {
  return (
    <div className="pb-20 space-y-8">
      {/* Title Section */}
      <div className="px-4 md:px-6 pt-10 pb-8 bg-[#0e0e0e] border-b border-[#484848]/20">
        <div className="flex items-center gap-3 mb-4">
            <Badge variant="outline" className="h-5 px-2 bg-[#1f2020] text-[#acc3ce] border-[#484848]/20 text-[11px] font-normal uppercase tracking-[0.2em] shadow-none rounded-none font-display">
            MONITORAMENTO_EM_TEMPO_REAL.LOG
          </Badge>
        </div>
        <h1 className="text-3xl md:text-4xl font-normal uppercase tracking-tighter text-[#e7e5e5] leading-none font-display">
          CENTRAL_DE_COMUNICAÇÕES<br /><span className="text-[#acabaa]/30">NÚCLEO_DE_AUTOMAÇÃO_IA</span>
        </h1>
      </div>

      {/* Logic / Help Grid */}
      <div className="px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#484848]/10 border border-[#484848]/10">
          <div className="bg-[#131313] p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#acabaa]">
              <Zap size={14} className="text-[#97a5ff]" />
              <span className="text-[11px] font-normal uppercase tracking-[0.2em] font-display">INGESTÃO_PASSIVA</span>
            </div>
            <p className="text-[11px] text-[#acabaa]/60 leading-relaxed font-mono uppercase">
              FLUXO_DE_RECEBIMENTO: MONITORANDO TODO O TRÁFEGO_RECEBIDO. CADA PACOTE É REGISTRADO PARA TREINAMENTO_NEURAL_CONTÍNUO.
            </p>
          </div>

          <div className="bg-[#131313] p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#acabaa]">
              <ShieldCheck size={14} className="text-[#97a5ff]" />
              <span className="text-[11px] font-normal uppercase tracking-[0.2em] font-display">POLÍTICA_DE_ID_DA_INSTÂNCIA</span>
            </div>
            <p className="text-[11px] text-[#acabaa]/60 leading-relaxed font-mono uppercase">
              PREFIXO_DO_ID: [IOS_] PARA OS SISTEMAS CENTRAIS DE INVENTÁRIO. DETECÇÃO_AUTOMÁTICA_DE_HARDWARE ATIVADA PELO ANALISADOR_DA_API.
            </p>
          </div>

          <div className="bg-[#191a1a] p-6 space-y-4 border-l border-[#484848]/10">
            <div className="flex items-center gap-2 text-[#97a5ff]">
              <Info size={14} />
              <span className="text-[11px] font-normal uppercase tracking-[0.2em] font-display">CONFIGURAÇÃO_DE_INICIALIZAÇÃO</span>
            </div>
            <p className="text-[11px] text-[#97a5ff]/60 leading-relaxed font-mono uppercase italic">
              SE_NULO: EXECUTAR [WEBHOOK_SYNC] NA INSTÂNCIA APÓS A AUTENTICAÇÃO PARA ATIVAR O FLUXO.
            </p>
          </div>
        </div>
      </div>

      {/* Instance Manager Section */}
      <div>
        <WhatsappInstanceManager />
      </div>

      {/* Contact Review Queue Section */}
      <div className="px-4 md:px-6">
        <ContactReviewQueue />
      </div>
    </div>
  );
}
