"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Eye,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { timestampToMillis } from "@/lib/crmPerformance";
import { getWorkspaceHomeSnapshot } from "@/lib/crmHomeApi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type HomeUser = {
  uid?: string | null;
  displayName?: string | null;
  email?: string | null;
  workspaceId?: string | null;
  defaultAccountId?: string | null;
};

type HomeEvent = {
  id?: string;
  eventType?: string | null;
  channelType?: string | null;
  actorUserId?: string | null;
  ownerId?: string | null;
  contactId?: string | null;
  summary?: string | null;
  occurredAt?: unknown;
  nextContactAt?: unknown;
};

type TeamHomeResult = {
  requestKey: string;
  status: "success" | "error";
  events: HomeEvent[];
  eventLimitReached: boolean;
};

type HomeMetrics = {
  todayEvents: HomeEvent[];
  contactsReached: number;
  scheduledFollowUps: number;
  dailyCounts: Array<{ label: string; count: number }>;
};

const EMPTY_HOME_EVENTS: HomeEvent[] = [];
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function startOfDay(value: number) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function isInteraction(event: HomeEvent) {
  return event.eventType === "contact_interaction" || (!event.eventType && Boolean(event.channelType));
}

function belongsToUser(event: HomeEvent, uid: string | null | undefined) {
  if (!uid) return false;
  return event.actorUserId === uid || (!event.actorUserId && event.ownerId === uid);
}

export function buildHomeMetrics(events: HomeEvent[], now = Date.now()): HomeMetrics {
  const today = startOfDay(now);
  const weekStart = today - (6 * DAY_IN_MS);
  const currentEvents = events
    .filter(isInteraction)
    .filter((event) => {
      const occurredAt = timestampToMillis(event.occurredAt);
      return occurredAt >= weekStart && occurredAt <= now;
    });
  const contactIds = new Set(currentEvents.map((event) => event.contactId).filter(Boolean));
  const scheduledFollowUps = currentEvents.filter((event) => {
    const nextContactAt = timestampToMillis(event.nextContactAt);
    return nextContactAt >= today && nextContactAt < today + DAY_IN_MS;
  }).length;
  const todayEvents = currentEvents
    .filter((event) => timestampToMillis(event.occurredAt) >= today)
    .sort((left, right) => timestampToMillis(right.occurredAt) - timestampToMillis(left.occurredAt));
  const dailyCounts = Array.from({ length: 7 }, (_, index) => {
    const dayStart = weekStart + (index * DAY_IN_MS);
    const count = currentEvents.filter((event) => {
      const occurredAt = timestampToMillis(event.occurredAt);
      return occurredAt >= dayStart && occurredAt < dayStart + DAY_IN_MS;
    }).length;
    return {
      label: new Date(dayStart).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
      count,
    };
  });

  return { todayEvents, contactsReached: contactIds.size, scheduledFollowUps, dailyCounts };
}

function getFirstName(user: HomeUser | null) {
  return (user?.displayName || user?.email?.split("@")[0] || "equipe").split(/[ ._-]/)[0];
}

function formatTime(value: unknown) {
  const timestamp = timestampToMillis(value);
  if (!timestamp) return "Horário não informado";
  return new Date(timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatToday() {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
}

function channelMeta(channel: string | null | undefined) {
  if (channel === "phone") return { label: "Ligação", icon: Phone, tone: "text-orange-700 bg-orange-50 border-orange-200" };
  if (channel === "whatsapp") return { label: "WhatsApp", icon: MessageCircle, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  return { label: channel === "email" ? "E-mail" : channel === "meeting" ? "Reunião" : "Outro", icon: CalendarCheck2, tone: "text-primary bg-accent border-primary/15" };
}

export default function WorkspaceHome({ user, inventoryCount = 0, onOpenCrm, canViewTeam = false }: {
  user: HomeUser | null;
  inventoryCount?: number;
  onOpenCrm: () => void;
  canViewTeam?: boolean;
}) {
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(db && workspaceId));
  const [error, setError] = useState(false);
  const [viewSelection, setViewSelection] = useState({ requesterUid: user?.uid || "", targetUid: user?.uid || "" });
  const [teamRoster, setTeamRoster] = useState<{ requesterUid: string; workspaceId: string | null; employees: HomeUser[] } | null>(null);
  const [teamResult, setTeamResult] = useState<TeamHomeResult | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requesterUid = user?.uid || "";
  const viewedUid = canViewTeam && viewSelection.requesterUid === requesterUid
    ? viewSelection.targetUid
    : requesterUid;
  const requestKey = JSON.stringify([requesterUid, workspaceId, viewedUid, retryNonce]);
  const currentTeamResult = teamResult?.requestKey === requestKey ? teamResult : null;
  const employees = teamRoster?.requesterUid === requesterUid && teamRoster.workspaceId === workspaceId
    ? teamRoster.employees
    : [];
  const teamLoading = Boolean(canViewTeam && viewedUid && !currentTeamResult);
  const teamError = Boolean(canViewTeam && currentTeamResult?.status === "error");
  const eventLimitReached = Boolean(currentTeamResult?.status === "success" && currentTeamResult.eventLimitReached);
  const visibleEvents = canViewTeam ? (currentTeamResult?.events || EMPTY_HOME_EVENTS) : events;
  const viewedUser = canViewTeam && viewedUid !== user?.uid
    ? employees.find((employee) => employee.uid === viewedUid) || null
    : user;
  const viewingAnotherUser = Boolean(canViewTeam && user?.uid && viewedUid !== user.uid);
  const ownView = !viewingAnotherUser;

  useEffect(() => {
    if (canViewTeam) return undefined;
    if (!db || !workspaceId) {
      return undefined;
    }
    const eventsQuery = query(
      collection(db, "crm_events"),
      where("workspaceId", "==", workspaceId),
      where("occurredAt", ">=", new Date(startOfDay(Date.now()) - (6 * DAY_IN_MS))),
      limit(200),
    );
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as HomeEvent)));
      setLoading(false);
      setError(false);
    }, () => {
      setLoading(false);
      setError(true);
    });
    return () => unsubscribe();
  }, [workspaceId, canViewTeam]);

  useEffect(() => {
    if (!canViewTeam || !viewedUid) return undefined;

    let active = true;

    getWorkspaceHomeSnapshot(viewedUid)
      .then((snapshot) => {
        if (!active) return;
        setTeamRoster({ requesterUid, workspaceId, employees: snapshot.employees });
        setTeamResult({
          requestKey,
          status: "success",
          events: snapshot.events,
          eventLimitReached: snapshot.eventLimitReached,
        });
      })
      .catch(() => {
        if (!active) return;
        setTeamResult({ requestKey, status: "error", events: [], eventLimitReached: false });
      });

    return () => {
      active = false;
    };
  }, [canViewTeam, requestKey, requesterUid, viewedUid, workspaceId]);

  const personalEvents = useMemo(() => visibleEvents.filter((event) => belongsToUser(event, viewedUid)), [visibleEvents, viewedUid]);
  const metrics = useMemo(() => buildHomeMetrics(personalEvents), [personalEvents]);
  const maxDailyCount = Math.max(...metrics.dailyCounts.map((day) => day.count), 1);
  const todayLabel = formatToday();
  const metricsAvailable = !canViewTeam || (!teamLoading && !teamError);
  const activityLoading = canViewTeam ? teamLoading : loading;
  const activityError = canViewTeam ? teamError : error;
  const interactionTotal = metrics.dailyCounts.reduce((total, day) => total + day.count, 0);
  const viewedName = getFirstName(viewedUser);
  const refreshTeamView = () => setRetryNonce((value) => value + 1);

  return (
    <div className="min-h-full bg-background pb-8">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium capitalize text-muted-foreground">{todayLabel}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Olá, {viewedName}.</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {viewingAnotherUser ? `Acompanhe as interações de CRM atribuídas a ${viewedName}.` : "Acompanhe o que aconteceu e organize os próximos contatos do seu dia."}
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
            {canViewTeam && (
              <div className="w-full sm:min-w-64">
                <label htmlFor="home-user-view" className="mb-1.5 block text-xs font-medium text-muted-foreground">Ver painel de</label>
                <select
                  id="home-user-view"
                  aria-label="Ver painel de"
                  value={viewedUid}
                  onChange={(event) => {
                    setViewSelection({ requesterUid, targetUid: event.target.value });
                  }}
                  className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <option value={user?.uid || ""}>Minha visão — {getFirstName(user)}</option>
                  {employees.filter((employee) => employee.uid !== user?.uid).map((employee) => (
                    <option key={employee.uid || employee.email || "employee"} value={employee.uid || ""}>
                      {employee.displayName || employee.email?.split("@")[0] || "Usuário"}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <Button
              disabled={!ownView}
              aria-disabled={!ownView}
              aria-describedby={viewingAnotherUser ? "home-view-readonly-help" : undefined}
              onClick={() => {
                if (ownView) onOpenCrm();
              }}
              className="w-full gap-2 rounded-xl sm:w-auto"
            >
              <Plus size={16} /> Registrar interação
            </Button>
          </div>
        </header>

        {viewingAnotherUser && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-primary/15 bg-accent/70 px-4 py-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3" role="status">
              <Eye size={18} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <p className="font-medium">Visualização somente leitura</p>
                <p id="home-view-readonly-help" className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Os dados do CRM são de {viewedName}; ações não podem ser registradas em nome de outra pessoa.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="rounded-lg" disabled={teamLoading} onClick={() => {
              if (!teamLoading) refreshTeamView();
            }}>
              <RefreshCw size={14} /> Atualizar visão
            </Button>
          </div>
        )}

        {canViewTeam && teamLoading && (
          <p className="mb-4 text-sm text-muted-foreground" role="status">Carregando a visão de {viewedName}…</p>
        )}
        {canViewTeam && teamError && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <p className="text-sm text-destructive">Não foi possível atualizar esta visão. Tente novamente.</p>
            <Button variant="outline" size="sm" className="rounded-lg" onClick={refreshTeamView}>
              Tentar novamente
            </Button>
          </div>
        )}
        {canViewTeam && eventLimitReached && !teamLoading && !teamError && (
          <p className="mb-4 text-xs text-muted-foreground" role="status">Parte do histórico recente não aparece porque a consulta atingiu o limite de segurança.</p>
        )}

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Interações hoje" value={metricsAvailable ? metrics.todayEvents.length : "—"} icon={TrendingUp} />
          <MiniStat label="Contatos alcançados" value={metricsAvailable ? metrics.contactsReached : "—"} icon={UsersRound} />
          <MiniStat label="Follow-ups do dia" value={metricsAvailable ? metrics.scheduledFollowUps : "—"} icon={CalendarCheck2} />
          <MiniStat label={viewingAnotherUser ? "Itens no inventário da equipe" : "Itens no inventário"} value={inventoryCount} icon={CheckCircle2} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-5 pb-3 sm:p-6 sm:pb-4">
              <div>
                <CardTitle className="text-lg font-semibold">{ownView ? "Sua performance" : `Desempenho de ${viewedName}`}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Interações registradas nos últimos 7 dias</p>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/20 bg-accent text-primary">Últimos 7 dias</Badge>
            </CardHeader>
            <CardContent className="p-5 pt-2 sm:p-6 sm:pt-3">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <span className="text-4xl font-semibold tracking-tight text-foreground">{metricsAvailable ? interactionTotal : "—"}</span>
                  <p className="mt-1 text-xs text-muted-foreground">interações atribuídas {ownView ? "a você" : `a ${viewedName}`}</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1.5 text-xs font-semibold text-lime-800">
                  <ArrowUpRight size={14} /> Ritmo da semana
                </div>
              </div>
              <div className="flex h-36 items-end gap-2 rounded-xl bg-[#f4f6f1] p-4 sm:gap-3">
                {canViewTeam && teamLoading ? (
                  <p className="w-full text-center text-sm text-muted-foreground" role="status">Carregando desempenho…</p>
                ) : canViewTeam && teamError ? (
                  <p className="w-full text-center text-sm text-destructive" role="alert">Desempenho indisponível. Tente atualizar a visão.</p>
                ) : metrics.dailyCounts.map((day) => (
                  <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">{day.count || ""}</span>
                    <div className="flex h-20 w-full items-end rounded-md bg-white/70 p-1">
                      <div className="w-full rounded-sm bg-foreground/80 transition-all" style={{ height: `${Math.max(day.count ? (day.count / maxDailyCount) * 100 : 7, 7)}%` }} />
                    </div>
                    <span className="text-[11px] capitalize text-muted-foreground">{day.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Os números refletem interações de CRM atribuídas ao usuário selecionado.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-5 sm:p-6">
              <div>
                <CardTitle className="text-lg font-semibold">Atividades de hoje</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{ownView ? "Seu histórico mais recente" : `Histórico recente de ${viewedName}`}</p>
              </div>
              <Clock3 size={18} className="text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
              {activityLoading ? (
                <p className="py-8 text-sm text-muted-foreground">{viewingAnotherUser ? `Carregando atividades de ${viewedName}…` : "Carregando suas atividades…"}</p>
              ) : activityError ? (
                <p className="py-8 text-sm text-destructive">Não foi possível carregar as atividades agora.</p>
              ) : metrics.todayEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/35 px-4 py-8 text-center">
                  <CalendarCheck2 className="mx-auto mb-3 text-muted-foreground/60" size={22} />
                  <p className="text-sm font-medium text-foreground">{ownView ? "Nada registrado ainda" : "Nenhuma atividade hoje"}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {ownView ? "Registre sua primeira interação para começar o histórico do dia." : `Não há atividades recentes atribuídas a ${viewedName}.`}
                  </p>
                  {ownView && <Button onClick={() => {
                    if (ownView) onOpenCrm();
                  }} variant="outline" size="sm" className="mt-4 rounded-lg">Registrar agora</Button>}
                </div>
              ) : (
                <div className="space-y-2">
                  {metrics.todayEvents.slice(0, 4).map((event) => {
                    const meta = channelMeta(event.channelType);
                    const Icon = meta.icon;
                    return (
                      <div key={event.id} className="flex items-start gap-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${meta.tone}`}><Icon size={15} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{event.summary || "Interação sem resumo"}</p>
                          <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground"><span>{meta.label}</span><span>·</span><span>{formatTime(event.occurredAt)}</span></p>
                        </div>
                        <ChevronRight size={15} className="mt-2 shrink-0 text-muted-foreground/60" />
                      </div>
                    );
                  })}
                  {metrics.todayEvents.length > 4 && <p className="pt-2 text-center text-xs font-medium text-primary">+ {metrics.todayEvents.length - 4} atividades no dia</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, icon: Icon }: { label: string; value: number | string; icon: typeof TrendingUp }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs leading-tight text-muted-foreground">{label}</span><Icon size={16} className="shrink-0 text-muted-foreground" /></div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
