import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, doc } from "firebase/firestore";
import { Activity, Shield, Cpu, TrendingUp, DollarSign, Loader2, Undo2, Bug, Copy, Bell } from "lucide-react";
import { isActivityUndone, undoActivityEvent } from "@/lib/audit";
import { updateErrorStatus } from "@/lib/errorReporting";
import AdminPushRegistration from "@/components/AdminPushRegistration";

export default function AdminDashboard({ items = [], user = null }) {
  const [telemetry, setTelemetry] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [tokenUsage, setTokenUsage] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [errorReports, setErrorReports] = useState([]);
  const [undoingId, setUndoingId] = useState(null);
  const [updatingErrorId, setUpdatingErrorId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "telemetry"), orderBy("timestamp", "desc"), limit(10));
    const unsubTele = onSnapshot(q, snap =>
      setTelemetry(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubHealth = onSnapshot(doc(db, "system", "health"), d => {
      setSystemHealth(d.data());
      setLoading(false);
    });
    const unsubTokenUsage = onSnapshot(
      query(collection(db, "task_ai_usage"), orderBy("createdAt", "desc"), limit(12)),
      snap => setTokenUsage(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubActivity = onSnapshot(
      query(collection(db, "activity_log"), orderBy("createdAt", "desc"), limit(16)),
      snap => setActivityLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubErrors = onSnapshot(
      query(collection(db, "error_reports"), orderBy("createdAt", "desc"), limit(20)),
      snap => setErrorReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubTele(); unsubHealth(); unsubTokenUsage(); unsubActivity(); unsubErrors(); };
  }, []);

  const undoneActivityIds = useMemo(() => {
    const logs = activityLog;
    return new Set(
      logs
        .filter(log => log.actionType === "UNDO_ACTION")
        .map(log => log.metadata?.targetActivityId)
        .filter(Boolean)
    );
  }, [activityLog]);

  const financials = useMemo(() => {
    const totalEstimatedValue = items
      .filter(i => i.status === "IN STOCK")
      .reduce((a, i) => a + (parseFloat(i.estimatedMarketValue) || 0), 0);
    const grossProfit = items
      .filter(i => i.status === "SOLD")
      .reduce((a, i) => a + ((parseFloat(i.sellingPrice) || 0) - (parseFloat(i.estimatedMarketValue) || 0)), 0);
    return { totalEstimatedValue, grossProfit };
  }, [items]);

  const handleUndo = async (activity) => {
    if (!user || !activity) return;
    setUndoingId(activity.id);
    try {
      await undoActivityEvent(db, activity, user);
    } catch (error) {
      console.error("Undo failed:", error);
    } finally {
      setUndoingId(null);
    }
  };

  const handleCopyError = async (errorReport) => {
    const payload = JSON.stringify({
      errorId: errorReport.errorId,
      ticketId: errorReport.ticketId,
      humanMessage: errorReport.humanMessage,
      knownReason: errorReport.knownReason,
      technicalMessage: errorReport.technicalMessage,
      errorCode: errorReport.errorCode,
      httpStatus: errorReport.httpStatus,
      clientContext: errorReport.clientContext,
      reproductionContext: errorReport.reproductionContext,
    }, null, 2);

    await navigator.clipboard.writeText(payload);
  };

  const handleErrorStatus = async (errorReport, status) => {
    setUpdatingErrorId(errorReport.id);
    try {
      await updateErrorStatus(errorReport.id, status, errorReport.ticketId || null);
    } catch (error) {
      console.error("Error status update failed:", error);
    } finally {
      setUpdatingErrorId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 gap-3">
        <Loader2 className="animate-spin text-zinc-300" size={18} />
        <p className="text-base font-bold uppercase tracking-widest text-zinc-200">Sincronizando...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Title */}
      <div className="px-4 md:px-6 pt-8 pb-6 border-b border-white/[0.07]">
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-none">
          Admin
        </h1>
      </div>

      {/* Financial stats */}
      <AdminPushRegistration user={user} isAdmin={Boolean(user)} />

      <div className="flex border-b border-white/[0.07]">
        <div className="flex-1 px-4 md:px-6 py-5 border-r border-white/[0.07]">
          <p className="text-base font-bold uppercase tracking-widest text-zinc-300 mb-1">Valor em Estoque</p>
          <p className="text-2xl font-black text-white">
            R$ {financials.totalEstimatedValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="flex-1 px-4 md:px-6 py-5">
          <p className="text-base font-bold uppercase tracking-widest text-zinc-300 mb-1">Lucro Bruto</p>
          <p className="text-2xl font-black text-white">
            R$ {financials.grossProfit.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* System stats */}
      <div className="flex border-b border-white/[0.07]">
        {[
          { label: "Requisições IA", value: systemHealth?.totalAIRequests ?? 0 },
          { label: "Serviço",        value: "Online" },
          { label: "Latência DB",    value: "14ms" },
        ].map(({ label, value }, i, arr) => (
          <div
            key={label}
            className={`flex-1 px-4 md:px-6 py-4 ${i < arr.length - 1 ? "border-r border-white/[0.07]" : ""}`}
          >
            <p className="text-base font-bold uppercase tracking-widest text-zinc-300 mb-1">{label}</p>
            <p className="text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Token usage */}
      <div className="px-4 md:px-6 pt-6 pb-2">
        <h2 className="text-base font-black uppercase tracking-widest text-zinc-200">Token Usage</h2>
      </div>
      <div className="border-t border-white/[0.07]">
        {tokenUsage.length === 0 ? (
          <p className="text-base font-bold uppercase tracking-widest text-zinc-200 text-center py-10">
            Sem tarefas registradas.
          </p>
        ) : (
          tokenUsage.map(task => (
            <div
              key={task.id}
              className="flex flex-col md:flex-row md:items-center gap-2 px-4 md:px-6 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-base font-black uppercase tracking-widest text-zinc-300">
                  {task.taskType}
                </span>
                <span className="text-base text-zinc-200 font-mono shrink-0">
                  {task.taskId?.slice(0, 12)}…
                </span>
                <span className="text-base font-bold text-zinc-200">
                  {task.actorId?.slice(0, 8)}…
                </span>
              </div>
              <div className="md:ml-auto flex items-center gap-4 text-base text-zinc-200">
                <span>{task.totalTokenCount ?? 0} tokens</span>
                <span>{task.calls?.length ?? 0} calls</span>
                <span>{task.itemId ? `Item ${task.itemId.slice(0, 8)}…` : "Sem item"}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Activity history */}
      <div className="px-4 md:px-6 pt-6 pb-2">
        <h2 className="text-base font-black uppercase tracking-widest text-zinc-200">Activity History</h2>
      </div>

      {/* Support inbox */}
      <div className="px-4 md:px-6 pt-6 pb-2">
        <h2 className="text-base font-black uppercase tracking-widest text-zinc-200">Support Inbox</h2>
      </div>
      <div className="border-t border-white/[0.07]">
        {errorReports.length === 0 ? (
          <p className="text-base font-bold uppercase tracking-widest text-zinc-200 text-center py-10">
            Sem erros registrados.
          </p>
        ) : (
          errorReports.map(report => (
            <div
              key={report.id}
              className="px-4 md:px-6 py-4 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Bug size={14} className="text-red-400 shrink-0" />
                  <span className="text-base font-black uppercase tracking-wider text-white">
                    {report.action}
                  </span>
                  <span className="text-base font-mono text-zinc-400">
                    {report.errorId}
                  </span>
                  {report.ticketId && (
                    <span className="text-base font-mono text-emerald-300">
                      {report.ticketId}
                    </span>
                  )}
                </div>
                <div className="md:ml-auto flex items-center gap-2 text-base text-zinc-300">
                  <span>{report.severity}</span>
                  <span>{report.status}</span>
                  {report.adminNotified && (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <Bell size={12} /> push
                    </span>
                  )}
                </div>
              </div>
              <p className="text-base font-bold text-zinc-200 mt-3">{report.humanMessage}</p>
              {report.knownReason && (
                <p className="text-base text-zinc-400 mt-1">{report.knownReason}</p>
              )}
              <div className="mt-3 grid gap-2 text-base text-zinc-300">
                <p>Usuario: {report.userEmail || report.userId || "desconhecido"}</p>
                <p>Tecnico: {report.technicalMessage || "sem detalhes"}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => handleCopyError(report)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white bg-white/10 hover:bg-white/20 transition-colors"
                >
                  <Copy size={11} />
                  Copiar log
                </button>
                <button
                  onClick={() => handleErrorStatus(report, "acknowledged")}
                  disabled={updatingErrorId === report.id}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
                >
                  Reconhecer
                </button>
                <button
                  onClick={() => handleErrorStatus(report, "resolved")}
                  disabled={updatingErrorId === report.id}
                  className="px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-50 transition-colors"
                >
                  Resolver
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-white/[0.07]">
        {activityLog.length === 0 ? (
          <p className="text-base font-bold uppercase tracking-widest text-zinc-200 text-center py-10">
            Sem atividade registrada.
          </p>
        ) : (
          activityLog.map(activity => {
            const undone = isActivityUndone(activity.id, activityLog) || undoneActivityIds.has(activity.id);
            const canUndo = activity.reversible && !undone && activity.actionType !== "UNDO_ACTION";

            return (
              <div
                key={activity.id}
                className="flex flex-col md:flex-row md:items-center gap-3 px-4 md:px-6 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base text-zinc-200 font-mono shrink-0">
                    {activity.createdAt?.toDate?.()?.toLocaleTimeString?.() || "--:--"}
                  </span>
                  <span className="text-base font-black uppercase tracking-wider px-2 py-0.5 bg-white/5 text-zinc-200">
                    {activity.actionType}
                  </span>
                  <span className="text-base font-bold text-zinc-200 truncate">
                    {activity.targetType}/{activity.targetId?.slice(0, 8)}…
                  </span>
                </div>
                <div className="md:ml-auto flex items-center gap-3">
                  <span className="text-base text-zinc-300">
                    {activity.actorEmail || activity.actorId?.slice(0, 8) || "unknown"}
                  </span>
                  {activity.reversible ? (
                    <span className={`text-base font-bold uppercase tracking-widest ${undone ? "text-zinc-500" : "text-emerald-400"}`}>
                      {undone ? "Undone" : "Reversible"}
                    </span>
                  ) : (
                    <span className="text-base font-bold uppercase tracking-widest text-zinc-500">Locked</span>
                  )}
                  {canUndo && (
                    <button
                      onClick={() => handleUndo(activity)}
                      disabled={undoingId === activity.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white bg-white/10 hover:bg-white/20 disabled:opacity-50 transition-colors"
                    >
                      <Undo2 size={11} />
                      Undo
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Telemetry */}
      <div className="px-4 md:px-6 pt-6 pb-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black uppercase tracking-widest text-zinc-200">Live Telemetry</h2>
          <span className="flex items-center gap-1.5 text-base font-bold uppercase tracking-widest text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ao vivo
          </span>
        </div>
      </div>

      <div className="border-t border-white/[0.07]">
        {telemetry.length === 0 ? (
          <p className="text-base font-bold uppercase tracking-widest text-zinc-200 text-center py-10">
            Sem registros.
          </p>
        ) : (
          telemetry.map(log => (
            <div
              key={log.id}
              className="flex flex-col md:flex-row md:items-center gap-2 px-4 md:px-6 py-3 border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-base text-zinc-200 font-mono shrink-0">
                  {log.timestamp?.toDate()?.toLocaleTimeString()}
                </span>
                <span className={`text-base font-black uppercase tracking-wider px-2 py-0.5 ${
                  log.type?.includes("ERROR")
                    ? "bg-red-500/10 text-red-400"
                    : "bg-white/5 text-zinc-200"
                }`}>
                  {log.type}
                </span>
                <span className="text-base font-bold text-zinc-200">
                  {log.userId?.slice(0, 8)}…
                </span>
              </div>
              <div className="md:ml-auto font-mono text-base text-zinc-200 max-w-xs truncate">
                {JSON.stringify(log.metadata)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
