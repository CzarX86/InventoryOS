import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { Loader2, Bug, Copy, UsersRound, PlugZap, ShieldCheck } from "lucide-react";
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
import AccessManagement from "@/components/AccessManagement";
import UserAvatar from "@/components/UserAvatar";

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
  const [moduleRequests, setModuleRequests] = useState([]);
  const [undoingId, setUndoingId] = useState(null);
  const [updatingErrorId, setUpdatingErrorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { flags, enabledCount } = useFeatureFlags(user);
  const displayActorId = (actorId, fallback = "system") => {
    if (!actorId || (user?.isHiddenOwner && actorId === user.uid)) return fallback;
    return actorId.slice(0, 8);
  };

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return undefined;
    }
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
    const unsubModuleRequests = onSnapshot(
      query(collection(db, "module_requests"), limit(20)),
      snap => setModuleRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return () => { unsubTele(); unsubHealth(); unsubAiRuns(); unsubTokenUsage(); unsubActivity(); unsubErrors(); unsubModuleRequests(); };
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

  const handleModuleRequestStatus = async (request, status) => {
    try {
      await updateDoc(doc(db, "module_requests", request.id), {
        status,
        reviewedAt: new Date(),
        reviewedByUserId: user?.uid || null,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error("Module request update failed:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="animate-spin text-primary" size={24} />
        <p className="text-sm text-muted-foreground">Carregando dados administrativos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Admin overview */}
      <div className="border-b border-border/70 bg-card/95 px-4 pb-7 pt-7 md:px-6 md:pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-start gap-3">
              {!user?.isHiddenOwner && <UserAvatar user={user} size="lg" className="mt-1 border-primary/20" />}
              <div>
                <Badge variant="outline" className="mb-3 rounded-full border-primary/20 bg-accent text-primary">
                  Área administrativa
                </Badge>
                <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                  Controle da operação
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  Gerencie acessos, acompanhe integrações e consulte a saúde, os custos e o histórico do workspace em um só lugar.
                </p>
              </div>
            </div>
            {!user?.isHiddenOwner && (
              <div className="rounded-xl border border-border/70 bg-muted/35 px-4 py-3 lg:min-w-[220px]">
                <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Sessão atual</p>
                <p className="mt-1 truncate text-sm font-semibold text-foreground">{user?.displayName || user?.email || "Administrador"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Permissão de administrador</p>
              </div>
            )}
          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-3">
            {[
              { icon: UsersRound, title: "Acessos da equipe", text: "Aprove, acompanhe ou revogue acessos ao workspace." },
              { icon: PlugZap, title: "Módulos e integrações", text: "Libere recursos solicitados e acompanhe conexões externas." },
              { icon: ShieldCheck, title: "Saúde e custos", text: "Consulte falhas, uso de IA, notificações e atividade recente." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-xl border border-border/70 bg-background px-4 py-4">
                <Icon size={17} className="text-primary" />
                <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-8">
        {/* Financial stats */}
        <div className="space-y-4">
          <AdminPushRegistration user={user} isAdmin={Boolean(user)} />
          <AdminUsageStats />
        </div>

        <AccessManagement currentUser={user} />

        {moduleRequests.filter(request => request.status === "pending").length > 0 && (
          <section className="space-y-4">
            <div className="flex items-end justify-between border-b border-border/70 pb-2">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Solicitações de módulos</h2>
                <p className="mt-1 text-sm text-muted-foreground">Pedidos de liberação enviados pela equipe.</p>
              </div>
              <Badge variant="outline" className="rounded-full border-blue-200 bg-blue-50 text-blue-800">{moduleRequests.filter(request => request.status === "pending").length} pendente(s)</Badge>
            </div>
            <div className="grid gap-3">
              {moduleRequests.filter(request => request.status === "pending").map(request => (
                <div key={request.id} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar user={{ displayName: request.requesterName, email: request.requesterEmail, photoURL: request.requesterPhotoURL }} size="default" />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-800">{request.moduleLabel || request.module}</Badge><span className="text-xs text-muted-foreground">{request.requesterName || request.requesterEmail || "Usuário sem e-mail"}</span></div>
                        <p className="mt-2 text-sm font-medium text-foreground">{request.message || "Solicitação sem observações adicionais."}</p>
                      </div>
                  </div>
                  <div className="flex shrink-0 gap-2"><Button size="sm" onClick={() => handleModuleRequestStatus(request, "approved")} className="rounded-lg">Liberar</Button><Button size="sm" variant="outline" onClick={() => handleModuleRequestStatus(request, "rejected")} className="rounded-lg">Recusar</Button></div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Inventory Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Using tonal layering instead of shadows and borders */}
          <div className="bg-[#131313] p-6 rounded-none border-l-2 border-primary/20">
              <span className="text-[10px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground block mb-4">Itens disponíveis</span>
            <p className="text-4xl font-display font-normal text-foreground">{inventoryStats.inStock}</p>
            <span className="text-[10px] font-mono uppercase tracking-widest text-emerald-500/60 mt-2 block">No inventário</span>
          </div>
          <div className="bg-[#131313] p-6 rounded-none border-l-2 border-foreground/5">
            <span className="text-[10px] font-display font-normal uppercase tracking-[0.2em] text-muted-foreground block mb-4">Itens vendidos</span>
            <p className="text-4xl font-display font-normal text-foreground">{inventoryStats.sold}</p>
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/40 mt-2 block">Saídas registradas</span>
          </div>
        </div>

        {/* System Health Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {[
            { label: "Processamentos de IA", value: systemHealth?.totalAIRequests ?? 0, mono: true },
            { label: "Serviço", value: "Online", highlight: true },
            { label: "Banco de dados", value: "14ms", mono: true },
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
            <div>
              <h2 className="text-lg font-display font-normal tracking-tight text-foreground">Módulos e automações</h2>
              <p className="mt-1 text-sm text-muted-foreground">Veja quais recursos estão liberados neste workspace.</p>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground uppercase opacity-50">
              {enabledCount} de {EXPANSION_FEATURE_FLAGS.length} recursos ativos
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
            <div>
              <h2 className="text-lg font-display font-normal tracking-tight text-foreground">Conexão do WhatsApp</h2>
              <p className="mt-1 text-sm text-muted-foreground">Configure instâncias e acompanhe os eventos recebidos.</p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-card p-1 shadow-sm">
              <WhatsappInstanceManager />
            </div>
          </section>
        )}

        {/* Token usage */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-display font-normal tracking-tight text-foreground">Uso de IA e custos</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Acompanhe tokens processados, modelo utilizado e custo calculado a partir do uso medido. Quando o provedor não informar tokens, mostramos uma estimativa.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            {tokenUsage.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Ainda não há registros de uso de IA.
              </div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-medium text-muted-foreground">Operação</TableHead>
                    <TableHead className="hidden text-xs font-medium text-muted-foreground md:table-cell">Provedor / modelo</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Tokens</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">Custo calculado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokenUsage.map(task => (
                    <TableRow key={task.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{task.taskType || "Operação de IA"}</span>
                          <span className="text-[10px] text-muted-foreground">Responsável: {displayActorId(task.actorId)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-xs text-muted-foreground md:table-cell">
                        {[task.provider, task.model].filter(Boolean).join(" · ") || "Gateway central"}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-primary">
                        {task.totalTokenCount ?? 0}
                      </TableCell>
                      <TableCell className="text-right text-xs font-medium text-foreground">
                        <div>{task.costUsd != null ? formatUsdCost(task.costUsd) : "—"}</div>
                        <div className="text-[10px] font-normal text-muted-foreground">{task.actualCostUsd != null ? "uso medido" : "estimativa"}</div>
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
          <div>
            <h2 className="text-lg font-display font-normal tracking-tight text-foreground">Erros para acompanhar</h2>
            <p className="mt-1 text-sm text-muted-foreground">Revise ocorrências registradas e marque cada uma como tratada.</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {errorReports.length === 0 ? (
              <div className="py-12 flex items-center justify-center bg-[#131313] border border-foreground/5 border-dashed">
                <p className="text-xs text-muted-foreground/60">Nenhum erro registrado.</p>
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
                        <p className="font-mono text-[11px] truncate">{user?.isHiddenOwner && (report.userId === user.uid || report.userEmail === user.email) ? "SYSTEM" : (report.userEmail || report.userId || "UNDEFINED")}</p>
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
          <div>
            <h2 className="text-lg font-display font-normal tracking-tight text-foreground">Histórico da operação</h2>
            <p className="mt-1 text-sm text-muted-foreground">Consulte ações recentes realizadas no workspace.</p>
          </div>
          <div className="bg-[#131313] rounded-none border border-foreground/5">
            {activityLog.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-display font-normal uppercase tracking-[0.2em] text-[10px]">
                Nenhuma ação registrada.
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
                          User: {displayActorId(activity.actorId)}
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
            <div>
              <h2 className="text-lg font-display font-normal tracking-tight text-foreground">Saúde técnica</h2>
              <p className="mt-1 text-sm text-muted-foreground">Eventos em tempo real para diagnóstico da operação.</p>
            </div>
            <div className="flex items-center gap-2 bg-emerald-500/10 px-3 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] font-display font-normal tracking-widest text-emerald-500">Atualização contínua</span>
            </div>
          </div>
          <div className="bg-[#131313] rounded-none border border-foreground/5">
            {telemetry.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground font-display font-normal uppercase tracking-[0.2em] text-[10px]">
                Nenhum evento técnico recente.
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
                        Origin: {displayActorId(log.userId, "Global")}
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
