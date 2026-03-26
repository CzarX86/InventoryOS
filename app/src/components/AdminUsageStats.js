import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { TrendingUp, Activity, DollarSign, Brain } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

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

  const metrics = [
    {
      label: "AI_MONTHLY_EXPENDITURE",
      value: `US$ ${mtdCost.toFixed(3)}`,
      icon: DollarSign,
      color: "text-emerald-500",
      detail: "MTD_REALTIME_SYNC",
      live: true
    },
    {
      label: "PROJECTED_RUNRATE",
      value: `US$ ${runRate.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-primary",
      detail: `EST_END_${now.toLocaleString('en-US', { month: 'short' }).toUpperCase()}`
    },
    {
      label: "AVG_TASK_UNIT_COST",
      value: `US$ ${avgCostPerTask.toFixed(4)}`,
      icon: Brain,
      color: "text-primary/60",
      detail: `${totalTasks}_LOGGED_EXECUTIONS`
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {metrics.map((metric, i) => (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          key={metric.label}
          className="bg-[#131313] p-6 rounded-none relative overflow-hidden group border-l-2 border-foreground/5 hover:border-primary/40 transition-colors"
        >
          <div className="flex justify-between items-start mb-6">
            <div className={`p-2 bg-foreground/5 ${metric.color}`}>
              <metric.icon size={16} />
            </div>
            {metric.live && (
              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[8px] font-display font-black tracking-widest text-emerald-500 uppercase">Live</span>
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <p className="text-[10px] font-display font-black uppercase tracking-[0.2em] text-muted-foreground/60">{metric.label}</p>
            <p className="text-3xl font-display font-black text-foreground tracking-tighter">
              {metric.value}
            </p>
          </div>
          
          <div className="mt-4 pt-4 border-t border-foreground/5">
            <p className="text-[9px] font-mono uppercase tracking-[0.15em] text-muted-foreground/40 font-bold">
              {metric.detail}
            </p>
          </div>

          {/* Decorative scanner line on hover */}
          <div className="absolute bottom-0 left-0 w-full h-[1px] bg-primary/0 group-hover:bg-primary/20 transition-all duration-500 shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
        </motion.div>
      ))}
    </div>
  );
}

