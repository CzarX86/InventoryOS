import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { TrendingUp, Activity, DollarSign, Brain, Zap } from "lucide-react";
import { motion } from "framer-motion";

export default function AdminUsageStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;
    
    // Listen to the real-time aggregator doc we created in functions
    const unsub = onSnapshot(doc(db, "system_usage", `ai_usage_summary_${monthKey}`), (d) => {
      if (d.exists()) {
        setStats(d.data());
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  if (loading) return null;

  // Calculation for run-rate
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  
  const mtdCost = stats?.totalCostUsd || 0;
  const runRate = (mtdCost / dayOfMonth) * daysInMonth;
  const totalTasks = stats?.totalRequests || 0;
  const avgCostPerTask = totalTasks > 0 ? mtdCost / totalTasks : 0;

  const cards = [
    {
      label: "Gasto IA (Mês)",
      value: `US$ ${mtdCost.toFixed(3)}`,
      icon: DollarSign,
      color: "text-emerald-400",
      detail: `MTD Real-time`
    },
    {
      label: "Projeção (Run-rate)",
      value: `US$ ${runRate.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-blue-400",
      detail: `Estimativa p/ final de ${now.toLocaleString('pt-BR', { month: 'short' })}`
    },
    {
      label: "Custo Médio / Tarefa",
      value: `US$ ${avgCostPerTask.toFixed(4)}`,
      icon: Brain,
      color: "text-purple-400",
      detail: `${totalTasks} execuções automáticas`
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-1 border-b border-white/[0.07] bg-white/[0.02]">
      {cards.map((card, i) => (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          key={card.label}
          className={`px-4 md:px-6 py-6 border-white/[0.07] ${i < 2 ? "md:border-r" : ""}`}
        >
          <div className="flex items-start justify-between mb-3">
            <div className={`p-2 rounded-lg bg-white/[0.03] ${card.color}`}>
              <card.icon size={18} />
            </div>
            {i === 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-400 animate-pulse">
                <Activity size={10} /> Live
              </span>
            )}
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-1">{card.label}</p>
          <p className="text-2xl font-black text-white">{card.value}</p>
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-2 font-bold">{card.detail}</p>
        </motion.div>
      ))}
    </div>
  );
}
