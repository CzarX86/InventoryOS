"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MessageCircle,
  Phone,
  Plus,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import { collection, limit, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { timestampToMillis } from "@/lib/crmPerformance";
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

type HomeMetrics = {
  todayEvents: HomeEvent[];
  contactsReached: number;
  scheduledFollowUps: number;
  dailyCounts: Array<{ label: string; count: number }>;
};

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

export default function WorkspaceHome({ user, inventoryCount = 0, onOpenCrm }: { user: HomeUser | null; inventoryCount?: number; onOpenCrm?: () => void }) {
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [loading, setLoading] = useState(Boolean(db && workspaceId));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!db || !workspaceId) {
      return undefined;
    }
    const eventsQuery = query(collection(db, "crm_events"), where("workspaceId", "==", workspaceId), limit(500));
    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as HomeEvent)));
      setLoading(false);
      setError(false);
    }, () => {
      setLoading(false);
      setError(true);
    });
    return () => unsubscribe();
  }, [workspaceId]);

  const personalEvents = useMemo(() => events.filter((event) => belongsToUser(event, user?.uid)), [events, user?.uid]);
  const metrics = useMemo(() => buildHomeMetrics(personalEvents), [personalEvents]);
  const maxDailyCount = Math.max(...metrics.dailyCounts.map((day) => day.count), 1);
  const todayLabel = formatToday();

  return (
    <div className="min-h-full bg-background pb-8">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-medium capitalize text-muted-foreground">{todayLabel}</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Olá, {getFirstName(user)}.</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Acompanhe o que aconteceu e organize os próximos contatos do seu dia.</p>
          </div>
          <Button onClick={onOpenCrm} className="w-full gap-2 rounded-xl sm:w-auto">
            <Plus size={16} /> Registrar interação
          </Button>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Interações hoje" value={metrics.todayEvents.length} icon={TrendingUp} />
          <MiniStat label="Contatos alcançados" value={metrics.contactsReached} icon={UsersRound} />
          <MiniStat label="Follow-ups do dia" value={metrics.scheduledFollowUps} icon={CalendarCheck2} />
          <MiniStat label="Itens no inventário" value={inventoryCount} icon={CheckCircle2} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex-row items-start justify-between gap-4 space-y-0 p-5 pb-3 sm:p-6 sm:pb-4">
              <div>
                <CardTitle className="text-lg font-semibold">Sua performance</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Interações registradas nos últimos 7 dias</p>
              </div>
              <Badge variant="outline" className="rounded-full border-primary/20 bg-accent text-primary">Últimos 7 dias</Badge>
            </CardHeader>
            <CardContent className="p-5 pt-2 sm:p-6 sm:pt-3">
              <div className="mb-6 flex items-end justify-between gap-4">
                <div>
                  <span className="text-4xl font-semibold tracking-tight text-foreground">{metrics.dailyCounts.reduce((total, day) => total + day.count, 0)}</span>
                  <p className="mt-1 text-xs text-muted-foreground">interações atribuídas a você</p>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-lime-100 px-3 py-1.5 text-xs font-semibold text-lime-800">
                  <ArrowUpRight size={14} /> Ritmo da semana
                </div>
              </div>
              <div className="flex h-36 items-end gap-2 rounded-xl bg-[#f4f6f1] p-4 sm:gap-3">
                {metrics.dailyCounts.map((day) => (
                  <div key={day.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">{day.count || ""}</span>
                    <div className="flex h-20 w-full items-end rounded-md bg-white/70 p-1">
                      <div className="w-full rounded-sm bg-foreground/80 transition-all" style={{ height: `${Math.max(day.count ? (day.count / maxDailyCount) * 100 : 7, 7)}%` }} />
                    </div>
                    <span className="text-[11px] capitalize text-muted-foreground">{day.label}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Os números refletem interações de CRM registradas com seu usuário.</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex-row items-center justify-between space-y-0 p-5 sm:p-6">
              <div>
                <CardTitle className="text-lg font-semibold">Atividades de hoje</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Seu histórico mais recente</p>
              </div>
              <Clock3 size={18} className="text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
              {loading ? (
                <p className="py-8 text-sm text-muted-foreground">Carregando suas atividades…</p>
              ) : error ? (
                <p className="py-8 text-sm text-destructive">Não foi possível carregar as atividades agora.</p>
              ) : metrics.todayEvents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/35 px-4 py-8 text-center">
                  <CalendarCheck2 className="mx-auto mb-3 text-muted-foreground/60" size={22} />
                  <p className="text-sm font-medium text-foreground">Nada registrado ainda</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Registre sua primeira interação para começar o histórico do dia.</p>
                  <Button onClick={onOpenCrm} variant="outline" size="sm" className="mt-4 rounded-lg">Registrar agora</Button>
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

function MiniStat({ label, value, icon: Icon }: { label: string; value: number; icon: typeof TrendingUp }) {
  return (
    <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2"><span className="text-xs leading-tight text-muted-foreground">{label}</span><Icon size={16} className="shrink-0 text-muted-foreground" /></div>
        <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
