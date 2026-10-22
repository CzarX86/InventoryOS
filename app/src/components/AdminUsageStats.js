import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { TrendingUp, Activity, DollarSign, Brain, ReceiptText } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export default function AdminUsageStats() {
  const [stats, setStats] = useState(null);
  const [hasStatsDoc, setHasStatsDoc] = useState(false);
  const [recon, setRecon] = useState(null);
  const [hasReconDoc, setHasReconDoc] = useState(false);
  const [loading, setLoading] = useState(Boolean(db));

  useEffect(() => {
    if (!db) return undefined;

    const now = new Date();
    const monthKey = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}`;

    // Listen to the real-time aggregator doc we created in functions
    const unsub = onSnapshot(doc(db, "system_usage", `ai_usage_summary_${monthKey}`), (d) => {
      setHasStatsDoc(d.exists());
      setStats(d.exists() ? d.data() : null);
      setLoading(false);
    });
    // Listen to the Billing Export reconciliation detail for the same month
    const unsubRecon = onSnapshot(doc(db, "system_billing_reconciliation", monthKey), (d) => {
      setHasReconDoc(d.exists());
      setRecon(d.exists() ? d.data() : null);
    });

    return () => { unsub(); unsubRecon(); };
  }, []);

  if (loading) return null;

  const now = new Date();
  const monthLabel = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  // Honest empty state: no monthly summary doc means nothing was measured yet.
  if (!hasStatsDoc || !stats) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card p-8 text-center shadow-sm">
        <p className="text-sm font-medium text-foreground">Sem dados medidos neste mês ({monthLabel})</p>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
          Nenhuma operação de IA foi agregada ainda. Os números aparecem aqui assim que
          execuções forem concluídas e registradas pelo agregador de uso.
        </p>
        {hasReconDoc && recon ? (
          <p className="mx-auto mt-3 max-w-xl text-[10px] leading-relaxed text-muted-foreground">
            Custo oficial GCP ({recon.currency || "USD"}): US$ {Number(recon.officialCostUsd || 0).toFixed(3)} ·{" "}
            {recon.rowCount || 0} linhas · {(recon.services || []).join(", ") || "sem serviços discriminados"}
          </p>
        ) : (
          <p className="mt-3 text-[10px] text-muted-foreground">
            Custo oficial GCP: não reconciliado — conecte o Billing Export para comparar.
          </p>
        )}
      </div>
    );
  }

  // Calculation for run-rate
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const mtdCost = stats?.totalCostUsd || 0;
  const officialCost = stats?.officialCostUsd == null ? null : Number(stats.officialCostUsd);
  const runRate = (mtdCost / dayOfMonth) * daysInMonth;
  const totalTasks = stats?.totalRequests || 0;
  const avgCostPerTask = totalTasks > 0 ? mtdCost / totalTasks : 0;

  const reconServices = hasReconDoc && recon ? (recon.services || []) : [];
  const reconRowCount = hasReconDoc && recon ? (recon.rowCount || 0) : 0;
  const reconGross = hasReconDoc && recon && recon.grossCostUsd != null ? Number(recon.grossCostUsd) : null;
  const reconCredits = hasReconDoc && recon && recon.creditsUsd != null ? Number(recon.creditsUsd) : null;
  const reconSyncedAt = hasReconDoc && recon?.syncedAt?.toDate?.() ? recon.syncedAt.toDate().toLocaleString("pt-BR") : null;
  const deltaVsMeasured = officialCost != null ? officialCost - mtdCost : null;

  const officialDetail = officialCost == null
    ? "Conecte o Billing Export para reconciliar"
    : [
        "Sincronizado pelo Google Cloud Billing Export",
        reconServices.length > 0 ? `Serviços: ${reconServices.join(", ")}` : null,
        hasReconDoc ? `${reconRowCount} linhas de faturamento` : `${stats?.officialCostRows || 0} linhas de faturamento`,
        reconGross != null ? `Bruto US$ ${reconGross.toFixed(3)}` : null,
        reconCredits != null && reconCredits !== 0 ? `Créditos US$ ${reconCredits.toFixed(3)}` : null,
        deltaVsMeasured != null ? `Diferença vs. medido: US$ ${deltaVsMeasured.toFixed(3)}` : null,
        reconSyncedAt ? `Sincronizado em ${reconSyncedAt}` : null,
      ].filter(Boolean).join(" · ");

  const metrics = [
    {
      label: "Custo registrado no mês",
      value: `US$ ${mtdCost.toFixed(3)}`,
      icon: DollarSign,
      color: "text-emerald-500",
      detail: `${stats?.measuredRequests || 0} operações com uso medido · ${stats?.estimatedRequests || 0} estimadas`,
      live: true
    },
    {
      label: "Projeção para o mês",
      value: `US$ ${runRate.toFixed(2)}`,
      icon: TrendingUp,
      color: "text-primary",
      detail: `Estimativa até ${now.toLocaleDateString("pt-BR", { month: "short" })}`
    },
    {
      label: "Custo médio por operação",
      value: `US$ ${avgCostPerTask.toFixed(4)}`,
      icon: Brain,
      color: "text-primary/60",
      detail: `${totalTasks} execuções registradas`
    },
    {
      label: "Custo oficial GCP",
      value: officialCost == null || !Number.isFinite(officialCost) ? "Não configurado" : `US$ ${officialCost.toFixed(3)}`,
      icon: ReceiptText,
      color: "text-amber-600",
      detail: officialDetail
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
      {metrics.map((metric, i) => (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          key={metric.label}
          className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-colors hover:border-primary/30"
        >
          <div className="flex justify-between items-start mb-6">
              <div className={`rounded-lg bg-muted/70 p-2 ${metric.color}`}>
              <metric.icon size={16} />
            </div>
            {metric.live && (
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[9px] font-medium text-emerald-700">Atualizado</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground">
              {metric.value}
            </p>
          </div>

          <div className="mt-4 border-t border-border/70 pt-4">
            <p className="text-[10px] text-muted-foreground">
              {metric.detail}
            </p>
          </div>

        </motion.div>
      ))}
    </div>
  );
}
