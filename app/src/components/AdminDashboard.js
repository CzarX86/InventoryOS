import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, doc } from "firebase/firestore";
import { Loader2, Undo2, Bug, Copy, Bell, Activity as ActivityIcon } from "lucide-react";
import { isActivityUndone, undoActivityEvent } from "@/lib/audit";
import { updateErrorStatus } from "@/lib/errorReporting";
import AdminPushRegistration from "@/components/AdminPushRegistration";
import useFeatureFlags from "@/hooks/useFeatureFlags";
import { EXPANSION_FEATURE_FLAGS, isFeatureEnabled } from "@/lib/featureFlags";
import WhatsappInstanceManager from "@/components/WhatsappInstanceManager";
import AdminUsageStats from "@/components/AdminUsageStats";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function extractTimestampValue(value) {
  if (!value) return 0;
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
}

function normalizeAiUsageEntry(entry) {
  const totalTokenCount =
    entry.actualTotalTokenCount ??
    entry.totalTokenCount ??
    entry.estimatedTotalTokens ??
    0;
  const callCount = entry.usageCalls?.length ?? entry.calls?.length ?? 0;
  const costUsd = entry.actualCostUsd ?? entry.estimatedCostUsd ?? null;

  return {
    ...entry,
    totalTokenCount,
    callCount,
    costUsd,
    sortTimestamp: extractTimestampValue(entry.createdAt),
  };
}

function mergeAiUsageEntries(...entryGroups) {
  return entryGroups
    .flat()
    .map(normalizeAiUsageEntry)
    .sort((left, right) => right.sortTimestamp - left.sortTimestamp)
    .slice(0, 12);
}

function formatUsdCost(value) {
  if (value == null || Number.isNaN(Number(value))) return null;
  return `US$ ${Number(value).toFixed(4)}`;
}

export default function AdminDashboard({ items = [], user = null }) {
  const [telemetry, setTelemetry] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [tokenUsage, setTokenUsage] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [errorReports, setErrorReports] = useState([]);
  const [undoingId, setUndoingId] = useState(null);
  const [updatingErrorId, setUpdatingErrorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { flags, enabledCount } = useFeatureFlags(user);

  useEffect(() => {
    if (!db) return;
    let aiRuns = [];
    let legacyTaskUsage = [];
    const syncAiUsage = () => {
      setTokenUsage(mergeAiUsageEntries(aiRuns, legacyTaskUsage));
    };
    const q = query(collection(db, "telemetry"), orderBy("timestamp", "desc"), limit(10));
    const unsubTele = onSnapshot(q, snap =>
      setTelemetry(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubHealth = onSnapshot(doc(db, "system", "health"), d => {
      setSystemHealth(d.data());
      setLoading(false);
    });
    const unsubAiRuns = onSnapshot(
      query(collection(db, "ai_runs"), orderBy("createdAt", "desc"), limit(12)),
      snap => {
        aiRuns = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        syncAiUsage();
      }
    );
    const unsubTokenUsage = onSnapshot(
      query(collection(db, "task_ai_usage"), orderBy("createdAt", "desc"), limit(12)),
      snap => {
        legacyTaskUsage = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        syncAiUsage();
      }
    );
    const unsubActivity = onSnapshot(
      query(collection(db, "activity_log"), orderBy("createdAt", "desc"), limit(16)),
      snap => setActivityLog(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const unsubErrors = onSnapshot(
      query(collection(db, "error_reports"), orderBy("createdAt", "desc"), limit(20)),
      snap => setErrorReports(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubTele(); unsubHealth(); unsubAiRuns(); unsubTokenUsage(); unsubActivity(); unsubErrors(); };
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

  const inventoryStats = useMemo(() => items.reduce((acc, item) => {
    if (item.status === "IN STOCK") acc.inStock += 1;
    if (item.status === "SOLD") acc.sold += 1;
    return acc;
  }, { inStock: 0, sold: 0 }), [items]);

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
      <div className="flex items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="animate-spin text-primary" size={24} />
        <p className="text-sm font-display font-normal uppercase tracking-[0.2em] text-muted-foreground">Sincronizando Ativos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Title */}
      <div className="px-4 md:px-6 pt-8 pb-6 border-b border-foreground/5 bg-background/80 backdrop-blur-md sticky top-0 z-10 font-display">
        <h1 className="text-4xl md:text-5xl font-normal uppercase tracking-tighter text-foreground leading-none">
          Admin_Terminal<span className="text-primary italic">.exe</span>
        </h1>
      </div>

      <div className="px-4 md:px-6 space-y-8">
        {/* Financial stats */}
        <div className="space-y-4">
          <AdminPushRegistration user={user} isAdmin={Boolean(user)} />
          <AdminUsageStats />
        </div>

        {/* Inventory Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Using tonal layering instead of shadows and borders */}
          <div className="bg-[#131313] p-6 rounded-none border-l-2 border-primary/20">
            <span className="text-[10px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground block mb-4">Stock_Status</span>
            <p className="text-4xl font-display font-normal text-foreground">{inventoryStats.inStock}</p>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/60 mt-2 block">Available_Units</span>
          </div>
          <div className="bg-[#131313] p-6 rounded-none border-l-2 border-foreground/5">
            <span className="text-[10px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground block mb-4">Outflow_Metrics</span>
            <p className="text-4xl font-display font-normal text-foreground">{inventoryStats.sold}</p>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40 mt-2 block">Total_Sales_Confirmed</span>
          </div>
        </div>

        {/* System Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { label: "AI_QUERIES", value: systemHealth?.totalAIRequests ?? 0, mono: true },
            { label: "SERVER_STATUS", value: "Online", highlight: true },
            { label: "DB_LATENCY", value: "14ms", mono: true },
          ].map(({ label, value, mono, highlight }) => (
            <div key={label} className="bg-[#131313] p-4 rounded-none">
              <span className="text-[10px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground mb-3 block">{label}</span>
              <p className={`text-xl font-display font-normal ${highlight ? "text-primary" : "text-foreground"} ${mono ? "font-mono" : ""}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Expansion flags */}
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-foreground/5 pb-2">
            <h2 className="text-lg font-display font-normal uppercase tracking-[0.15em] text-foreground">Deployment_Control</h2>
            <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-50">
              {enabledCount} / {EXPANSION_FEATURE_FLAGS.length} ACTIVE_FLAGS
            </p>
          </div>
          <div className="bg-[#131313] rounded-none overflow-hidden">
            <Table>
              <TableBody>
                {EXPANSION_FEATURE_FLAGS.map((flag) => {
                  const enabled = Boolean(flags?.[flag]);
                  return (
                    <TableRow key={flag} className="hover:bg-[#1f2020] border-foreground/5 transition-none">
                      <TableCell className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground py-4">
                        {flag}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <Badge variant="outline" className={`rounded-none border-none text-[9px] font-display font-normal uppercase tracking-widest px-3 ${enabled ? "bg-emerald-500/10 text-emerald-500" : "bg-muted/30 text-muted-foreground/40"}`}>
                          {enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* WhatsApp Management */}
        {isFeatureEnabled(flags, "whatsappIngestion") && (
          <section className="space-y-4">
            <h2 className="text-lg font-display font-normal uppercase tracking-[0.15em] text-foreground">WA_Bridge_Protocol</h2>
            <div className="bg-[#131313] p-1 rounded-none border border-foreground/5">
              <WhatsappInstanceManager />
            </div>
          </section>
        )}

        {/* Token usage */}
        <section className="space-y-4">
          <h2 className="text-lg font-display font-normal uppercase tracking-[0.15em] text-foreground">AI_Resource_Consumption</h2>
          <div className="bg-[#131313] rounded-none border border-foreground/5">
            {tokenUsage.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-display font-normal uppercase tracking-[0.2em] text-[10px]">
                No_Resource_Logs_Detected
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-[#1f2020]">
                  <TableRow className="hover:bg-transparent border-foreground/5">
                    <TableHead className="uppercase tracking-[0.2em] text-[9px] font-display font-normal text-muted-foreground">Log_Entry</TableHead>
                    <TableHead className="uppercase tracking-[0.2em] text-[9px] font-display font-normal text-muted-foreground hidden md:table-cell">Operation_Hash</TableHead>
                    <TableHead className="uppercase tracking-[0.2em] text-[9px] font-display font-normal text-muted-foreground">Tokens</TableHead>
                    <TableHead className="uppercase tracking-[0.2em] text-[9px] font-display font-normal text-muted-foreground text-right">Cost_USD</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenUsage.map(task => (
                    <TableRow key={task.id} className="hover:bg-[#1f2020] border-foreground/5 transition-none">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-display font-normal uppercase tracking-wider text-[11px]">{task.taskType}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase">Actor: {task.actorId?.slice(0, 8)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[9px] text-muted-foreground/40 hidden md:table-cell uppercase">
                        {task.taskId?.slice(0, 16)}…
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-primary/80">
                        {task.totalTokenCount ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-mono text-[11px] text-foreground">
                        {task.costUsd != null ? formatUsdCost(task.costUsd) : "---"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {/* Support inbox */}
        <section className="space-y-4">
          <h2 className="text-lg font-display font-normal uppercase tracking-[0.15em] text-foreground">System_Exceptions</h2>
          <div className="grid grid-cols-1 gap-4">
            {errorReports.length === 0 ? (
              <div className="py-12 flex items-center justify-center bg-[#131313] border border-foreground/5 border-dashed">
                <p className="text-[10px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground/30">No_Exceptions_Recorded</p>
              </div>
            ) : (
              errorReports.map(report => (
                <div key={report.id} className="bg-[#131313] rounded-none overflow-hidden border border-red-500/20">
                  <div className="flex flex-row items-center justify-between p-4 border-b border-red-500/10 bg-red-500/[0.02]">
                    <div className="flex items-center gap-3 min-w-0">
                      <Bug size={14} className="text-red-500 shrink-0" />
                      <span className="text-[10px] font-display font-normal uppercase tracking-[0.1em]">
                        {report.action}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400">
                        {report.errorId?.slice(0, 8)}
                      </span>
                    </div>
                    <Badge variant="outline" className={`uppercase text-[9px] rounded-none border-none font-display font-normal ${report.severity === 'high' ? 'bg-red-500 text-white' : 'bg-[#1f2020] text-muted-foreground'}`}>
                      {report.severity}
                    </Badge>
                  </div>
                  <div className="p-6 space-y-6">
                    <div>
                      <p className="font-display font-normal text-lg leading-tight uppercase tracking-tight">{report.humanMessage}</p>
                      {report.knownReason && (
                        <p className="text-xs font-mono text-muted-foreground/60 mt-2 uppercase">{report.knownReason}</p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-foreground/5 border border-foreground/5">
                      <div className="bg-[#191a1a] p-4">
                        <p className="text-[9px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground mb-2 opacity-50">Origin_User</p>
                        <p className="font-mono text-[11px] truncate">{report.userEmail || report.userId || "UNDEFINED"}</p>
                      </div>
                      <div className="bg-[#191a1a] p-4">
                        <p className="text-[9px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground mb-2 opacity-50">Stack_Trace</p>
                        <p className="font-mono text-[10px] leading-relaxed break-all text-muted-foreground/60">{report.technicalMessage || "NO_DATA"}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="bg-[#1f2020] text-[10px] uppercase font-display font-normal tracking-[0.15em] rounded-none py-5 border-none hover:bg-foreground hover:text-background transition-none"
                        onClick={() => handleCopyError(report)}
                      >
                        <Copy size={12} className="mr-2" /> Log_Copy
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="bg-[#1f2020] text-[10px] uppercase font-display font-normal tracking-[0.15em] rounded-none py-5 border-none hover:bg-primary hover:text-primary-foreground transition-none"
                        disabled={updatingErrorId === report.id}
                        onClick={() => handleErrorStatus(report, "acknowledged")}
                      >
                        Acknowledge
                      </Button>
                      <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] uppercase font-display font-normal tracking-[0.15em] rounded-none py-5 border-none transition-none ml-auto"
                        disabled={updatingErrorId === report.id}
                        onClick={() => handleErrorStatus(report, "resolved")}
                      >
                        Resolve_Exception
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Activity history */}
        <section className="space-y-4">
          <h2 className="text-lg font-display font-normal uppercase tracking-[0.15em] text-foreground">Global_Operations_Log</h2>
          <div className="bg-[#131313] rounded-none border border-foreground/5">
            {activityLog.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-display font-normal uppercase tracking-[0.2em] text-[10px]">
                No_Activity_Streaming
              </div>
            ) : (
              <Table>
                <TableBody>
                  {activityLog.map(activity => {
                    const undone = isActivityUndone(activity.id, activityLog) || undoneActivityIds.has(activity.id);
                    const canUndo = activity.reversible && !undone && activity.actionType !== "UNDO_ACTION";

                    return (
                      <TableRow key={activity.id} className="hover:bg-[#1f2020] border-foreground/5 transition-none leading-none">
                        <TableCell className="w-[100px] font-mono text-[10px] text-muted-foreground/40">
                          {activity.createdAt?.toDate?.()?.toLocaleTimeString?.(undefined, { hour12: false }) || "--:--:--"}
                        </TableCell>
                        <TableCell>
                          <span className="font-display font-normal uppercase tracking-wider text-[11px] text-foreground">
                            {activity.actionType}
                          </span>
                        </TableCell>
                        <TableCell className="text-[10px] font-mono text-muted-foreground/60 uppercase">
                          {activity.targetType}/{activity.targetId?.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-[10px] font-mono text-muted-foreground/30 uppercase">
                          User: {activity.actorId?.slice(0, 8) || "system"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-3">
                            {undone && <span className="text-muted-foreground/40 text-[9px] uppercase font-display font-normal italic tracking-widest">Cancelled</span>}
                            {canUndo && (
                              <Button
                                variant="ghost"
                                size="xs"
                                className="font-display font-normal uppercase tracking-[0.2em] text-[10px] rounded-none h-8 px-4 bg-[#1f2020] text-primary hover:bg-primary hover:text-primary-foreground transition-none"
                                onClick={() => handleUndo(activity)}
                                disabled={undoingId === activity.id}
                              >
                                {undoingId === activity.id ? <Loader2 className="animate-spin" size={12} /> : "ROLLBACK"}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </section>

        {/* Telemetry */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-foreground/5 pb-2">
            <h2 className="text-lg font-display font-normal uppercase tracking-[0.15em] text-foreground">Live_Telemetry_Feed</h2>
            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] font-display font-normal tracking-widest text-emerald-500 uppercase">Streaming</span>
            </div>
          </div>
          <div className="bg-[#131313] rounded-none border border-foreground/5">
            {telemetry.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-display font-normal uppercase tracking-[0.2em] text-[10px]">
                No_Data_Packets
              </div>
            ) : (
              <Table>
                <TableBody>
                  {telemetry.map(log => (
                    <TableRow key={log.id} className="hover:bg-[#1f2020] border-foreground/5 transition-none">
                      <TableCell className="w-[100px] font-mono text-[10px] text-muted-foreground/40">
                        {log.timestamp?.toDate()?.toLocaleTimeString(undefined, { hour12: false })}
                      </TableCell>
                      <TableCell>
                        <span className={`font-display font-normal uppercase tracking-wider text-[11px] ${log.type?.includes('ERROR') ? 'text-red-500' : 'text-primary/60'}`}>
                          {log.type}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground/30 hidden md:table-cell uppercase">
                        Origin: {log.userId?.slice(0, 8) || "Global"}
                      </TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[300px] truncate text-muted-foreground/60 uppercase">
                        {JSON.stringify(log.metadata)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
