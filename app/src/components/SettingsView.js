"use client";
import { Zap, Clock, LogOut, Check, Share2, ToggleLeft, ToggleRight } from "lucide-react";
import useAuth from "@/hooks/useAuth";

const WORKFLOWS = [
  {
    id: "real-time",
    name: "Real-time",
    desc: "Pesquisa de mercado durante o cadastro. Dados completos imediatamente.",
    icon: Zap,
  },
  {
    id: "background",
    name: "Background",
    desc: "Pula a pesquisa no scan. Itens marcados para validação posterior.",
    icon: Clock,
  },
];

export default function SettingsView() {
  const { user, isAdmin, updateSettings, logout } = useAuth();

  return (
    <div>
      {/* Title */}
      <div className="px-4 md:px-6 pt-8 pb-6 border-b border-white/[0.07]">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none">
          Config.
        </h1>
      </div>

      {/* AI Workflow */}
      <div className="border-b border-white/[0.07]">
        <div className="px-4 md:px-6 py-4 border-b border-white/[0.07]">
          <p className="text-base font-black uppercase tracking-widest text-zinc-300">Fluxo de Extração via IA</p>
        </div>
        {WORKFLOWS.map(({ id, name, desc, icon: Icon }) => {
          const active = user?.aiWorkflow === id;
          return (
            <button
              key={id}
              onClick={() => updateSettings({ aiWorkflow: id })}
              className={`w-full flex items-start gap-4 px-4 md:px-6 py-5 border-b border-white/[0.07] text-left hover:bg-white/[0.02] transition-colors ${
                active ? "bg-white/[0.03]" : ""
              }`}
            >
              <div className={`mt-0.5 shrink-0 ${active ? "text-white" : "text-zinc-200"}`}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-base font-bold uppercase tracking-wide mb-0.5 ${active ? "text-white" : "text-zinc-300"}`}>
                  {name}
                </p>
                <p className="text-base text-zinc-200 leading-relaxed">{desc}</p>
              </div>
              {active && (
                <Check size={13} className="text-white shrink-0 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Sharing Preferences */}
      <div className="border-b border-white/[0.07]">
        <div className="px-4 md:px-6 py-4 border-b border-white/[0.07]">
          <p className="text-base font-black uppercase tracking-widest text-zinc-300">Preferências de Compartilhamento</p>
        </div>
        <button
          onClick={() => updateSettings({ sharePriceByDefault: !user?.sharePriceByDefault })}
          className="w-full flex items-center justify-between px-4 md:px-6 py-5 border-b border-white/[0.07] hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className={`shrink-0 ${user?.sharePriceByDefault ? "text-white" : "text-zinc-500"}`}>
              <Share2 size={16} />
            </div>
            <div className="text-left">
              <p className="text-base font-bold uppercase tracking-wide text-white">Incluir Preço ao Compartilhar</p>
              <p className="text-sm text-zinc-400 mt-0.5">O preço de venda será incluído por padrão no texto de compartilhamento.</p>
            </div>
          </div>
          <div className={user?.sharePriceByDefault ? "text-white" : "text-zinc-600"}>
            {user?.sharePriceByDefault ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </div>
        </button>
      </div>

      {/* Profile */}
      <div className="border-b border-white/[0.07]">
        <div className="px-4 md:px-6 py-4 border-b border-white/[0.07]">
          <p className="text-base font-black uppercase tracking-widest text-zinc-300">Perfil & Segurança</p>
        </div>
        <div className="flex items-center justify-between px-4 md:px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[#141414] font-black text-base shrink-0">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div>
              <p className="text-base font-bold text-white">{user?.email}</p>
              <p className="text-base font-bold uppercase tracking-widest text-zinc-200 mt-0.5">
                {isAdmin ? "Admin" : "Usuário"} · Firebase
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-base font-black uppercase tracking-widest text-zinc-200 hover:text-red-400 transition-colors"
          >
            <LogOut size={12} /> Sair
          </button>
        </div>
      </div>

      <div className="px-4 md:px-6 py-6">
        <p className="text-base font-black uppercase tracking-[0.3em] text-zinc-300">InventoryOS v2.0</p>
      </div>
    </div>
  );
}
