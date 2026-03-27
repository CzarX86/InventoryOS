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
            <Badge variant="outline" className="h-5 px-2 bg-[#1f2020] text-[#acc3ce] border-[#484848]/20 text-[11px] font-bold uppercase tracking-[0.2em] shadow-none rounded-none font-display">
            REALTIME_MONITOR.LOG
          </Badge>
        </div>
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-[#e7e5e5] leading-none font-display">
          COMMS_HUBS<br /><span className="text-[#acabaa]/30">IA_AUTOMATION_NODE</span>
        </h1>
      </div>

      {/* Logic / Help Grid */}
      <div className="px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#484848]/10 border border-[#484848]/10">
          <div className="bg-[#131313] p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#acabaa]">
              <Zap size={14} className="text-[#97a5ff]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-display">{label}</span>
            </div>
            <p className="text-[11px] text-[#acabaa]/60 leading-relaxed font-mono uppercase">
              RECV_STREAM: MONITORING ALL INCOMING TRAFFIC. EACH PACKET IS LOGGED FOR CONTINUOUS NEURAL TRAINING.
            </p>
          </div>

          <div className="bg-[#131313] p-6 space-y-4">
            <div className="flex items-center gap-2 text-[#acabaa]">
              <ShieldCheck size={14} className="text-[#97a5ff]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-display">INSTANCE_ID_POLICY</span>
            </div>
            <p className="text-[11px] text-[#acabaa]/60 leading-relaxed font-mono uppercase">
              IDENT_PREFIX: [IOS_] FOR CORE INVENTORY SYSTEMS. AUTO-HW DETECTION ENABLED VIA API SNIFFER.
            </p>
          </div>

          <div className="bg-[#191a1a] p-6 space-y-4 border-l border-[#484848]/10">
            <div className="flex items-center gap-2 text-[#97a5ff]">
              <Info size={14} />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-display">BOOT_CONFIGURATION</span>
            </div>
            <p className="text-[11px] text-[#97a5ff]/60 leading-relaxed font-mono uppercase italic">
              IF_NULL: EXEC [WEBHOOK_SYNC] ON INSTANCE AFTER AUTHENTICATION TO ENGAGE PIPELINE.
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
