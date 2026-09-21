import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Mail,
  MessageCircle,
  Phone,
  RefreshCw,
  Users,
  Video,
} from "lucide-react";
import {
  collection,
  limit,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { db as firebaseDb } from "@/lib/firebase";
import { listAccessUsers, type AccessUserSummary } from "@/lib/accessControl";
import {
  aggregateCrmPerformance,
  type CrmPerformanceContact,
  type CrmPerformanceEmployee,
  type CrmPerformanceEvent,
  type EmployeePerformanceMetric,
  type PeriodDays,
  type PerformancePeriodSummary,
} from "@/lib/crmPerformance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const db = firebaseDb as unknown as Firestore | undefined;

type CrmPerformanceUser = {
  uid?: string | null;
  email?: string | null;
  displayName?: string | null;
  workspaceId?: string | null;
  defaultAccountId?: string | null;
  isHiddenOwner?: boolean;
};

type Company = {
  id: string;
  name?: string | null;
};

type LoadingState = {
  events: boolean;
  contacts: boolean;
  companies: boolean;
  employees: boolean;
};

const EMPTY_LOADING: LoadingState = {
  events: false,
  contacts: false,
  companies: false,
  employees: false,
};

const READY_LOADING: LoadingState = {
  events: true,
  contacts: true,
  companies: true,
  employees: true,
};

const CHANNELS = [
  { key: "phone", label: "Ligações", icon: Phone, color: "bg-[#97a5ff]" },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "bg-[#acc3ce]" },
  { key: "email", label: "E-mail", icon: Mail, color: "bg-[#c6c6c7]" },
  { key: "meeting", label: "Reuniões", icon: Video, color: "bg-[#8ba1ac]" },
  { key: "other", label: "Outros", icon: Activity, color: "bg-[#acabaa]" },
] as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = typeof (value as { toDate?: () => Date })?.toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatPeriod(periodDays: PeriodDays) {
  if (periodDays == null) return "Todo o histórico";
  return `Últimos ${periodDays} dias`;
}

function parsePeriod(value: string): PeriodDays {
  if (value === "all") return null;
  const parsed = Number(value);
  return parsed === 7 || parsed === 30 || parsed === 90 ? parsed : 30;
}

function mergeEmployees(currentUser: CrmPerformanceUser | null, accessUsers: AccessUserSummary[]) {
  const employeeMap = new Map<string, CrmPerformanceEmployee>();
  accessUsers.forEach((employee) => {
    if (employee.uid && employee.status !== "pending") employeeMap.set(employee.uid, employee);
  });
  if (currentUser?.uid && !currentUser.isHiddenOwner) {
    employeeMap.set(currentUser.uid, {
      uid: currentUser.uid,
      displayName: currentUser.displayName || null,
      email: currentUser.email || null,
      status: "approved",
    });
  }
  return Array.from(employeeMap.values());
}

function Delta({ current, previous }: { current: number; previous: number | null }) {
  if (previous == null) return <span className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">sem base comparável</span>;
  if (previous === 0 && current === 0) return <span className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">sem variação</span>;
  if (previous === 0) return <span className="font-mono text-[9px] uppercase tracking-widest text-[#acc3ce]">novo período</span>;
  const percentage = Math.round(((current - previous) / previous) * 100);
  const isPositive = percentage >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest ${isPositive ? "text-[#acc3ce]" : "text-[#ee7d77]"}`}>
      <Icon size={11} /> {isPositive ? "+" : ""}{percentage}% vs período anterior
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  helper,
  delta,
  accent = "#97a5ff",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  helper: string;
  delta?: ReactNode;
  accent?: string;
}) {
  return (
    <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
      <CardContent className="relative p-4">
        <div className="mb-6 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#acabaa]/55">{label}</span>
          <Icon size={15} style={{ color: accent }} />
        </div>
        <p className="font-display text-3xl font-normal text-[#e7e5e5]">{value}</p>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/40">{helper}</p>
        {delta && <div className="mt-4 border-t border-[#484848]/20 pt-3">{delta}</div>}
      </CardContent>
    </Card>
  );
}

function EmployeeStatus({ status }: { status: string | null }) {
  if (status !== "revoked") return null;
  return <Badge variant="outline" className="ml-2 rounded-none border-[#ee7d77]/30 text-[8px] uppercase tracking-widest text-[#ee7d77]">revogado</Badge>;
}

function employeeShare(metric: EmployeePerformanceMetric, total: number) {
  return total ? `${Math.round((metric.totalInteractions / total) * 100)}%` : "—";
}

export default function CrmPerformanceDashboard({ user }: { user: CrmPerformanceUser | null }) {
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;
  const [events, setEvents] = useState<CrmPerformanceEvent[]>([]);
  const [contacts, setContacts] = useState<CrmPerformanceContact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [employees, setEmployees] = useState<CrmPerformanceEmployee[]>([]);
  const [periodDays, setPeriodDays] = useState<PeriodDays>(30);
  const [loading, setLoading] = useState<LoadingState>(() => (db && workspaceId ? EMPTY_LOADING : READY_LOADING));
  const [error, setError] = useState<string | null>(null);
  const [employeeError, setEmployeeError] = useState(false);
  const [eventLimitReached, setEventLimitReached] = useState(false);
  const [metricsNow] = useState(() => Date.now());

  useEffect(() => {
    if (!db || !workspaceId) {
      return undefined;
    }

    const markLoaded = (key: keyof LoadingState) => setLoading((current) => ({ ...current, [key]: true }));
    const scopedQuery = (collectionName: string, max: number) => query(
      collection(db, collectionName),
      where("workspaceId", "==", workspaceId),
      limit(max),
    );
    const eventsUnsubscribe = onSnapshot(
      scopedQuery("crm_events", 2000),
      (snapshot) => {
        setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CrmPerformanceEvent)));
        setEventLimitReached(snapshot.size >= 2000);
        markLoaded("events");
      },
      () => {
        setError("Não foi possível carregar as atividades do CRM.");
        markLoaded("events");
      },
    );
    const contactsUnsubscribe = onSnapshot(
      scopedQuery("contacts", 1000),
      (snapshot) => {
        setContacts(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CrmPerformanceContact)));
        markLoaded("contacts");
      },
      () => {
        setError("Não foi possível carregar os contatos do CRM.");
        markLoaded("contacts");
      },
    );
    const companiesUnsubscribe = onSnapshot(
      scopedQuery("accounts", 500),
      (snapshot) => {
        setCompanies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Company)));
        markLoaded("companies");
      },
      () => markLoaded("companies"),
    );

    void listAccessUsers()
      .then((result) => setEmployees(mergeEmployees(user, result.users)))
      .catch(() => {
        setEmployeeError(true);
        setEmployees(mergeEmployees(user, []));
      })
      .finally(() => markLoaded("employees"));

    return () => {
      eventsUnsubscribe();
      contactsUnsubscribe();
      companiesUnsubscribe();
    };
  }, [user, workspaceId]);

  const metrics = useMemo(() => aggregateCrmPerformance({
    now: metricsNow,
    periodDays,
    events,
    contacts,
    employees,
    hiddenEmployeeIds: user?.isHiddenOwner && user.uid ? [user.uid] : [],
  }), [contacts, employees, events, metricsNow, periodDays, user]);
  const companyNames = useMemo(() => new Map(companies.map((company) => [company.id, company.name || "Empresa sem nome"])), [companies]);
  const isLoading = Object.values(loading).some((value) => !value);
  const previous = metrics.previousPeriod;
  const channelRows = CHANNELS.filter((channel) => Boolean(metrics.channels[channel.key]));
  const channelMax = Math.max(...channelRows.map((channel) => metrics.channels[channel.key] || 0), 1);
  const trendMax = Math.max(...metrics.trend.map((point) => point.interactions), 1);
  const hasData = metrics.totalInteractions > 0;

  if (isLoading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center gap-3 bg-[#0e0e0e] text-[#acabaa]/60">
        <Loader2 size={18} className="animate-spin text-[#97a5ff]" />
        <p className="font-mono text-[10px] uppercase tracking-[0.25em]">Sincronizando performance do CRM...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#0e0e0e] pb-20 text-[#e7e5e5]">
      <div className="border-b border-[#484848]/20 bg-[#0e0e0e] px-4 py-8 md:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-4 flex items-center gap-2"><BarChart3 size={15} className="text-[#97a5ff]" /><span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#acabaa]/50">CRM_PERFORMANCE</span></div>
            <h1 className="font-display text-3xl font-normal uppercase tracking-tight">Performance <span className="text-[#acabaa]/30">da equipe</span></h1>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#acabaa]/60">Atividade comercial registrada, alcance da base e pendências de follow-up em um só lugar.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="crm-performance-period" className="sr-only">Período de análise</label>
            <div className="flex items-center gap-2 border border-[#484848]/30 bg-[#131313] px-3">
              <CalendarDays size={13} className="text-[#97a5ff]" />
              <select
                id="crm-performance-period"
                value={periodDays == null ? "all" : String(periodDays)}
                onChange={(event) => setPeriodDays(parsePeriod(event.target.value))}
                className="h-9 bg-transparent font-mono text-[10px] uppercase tracking-widest text-[#e7e5e5] outline-none"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="all">Todo o histórico</option>
              </select>
            </div>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="h-9 rounded-none border-[#484848]/30 text-[10px] uppercase tracking-widest">
              <RefreshCw size={13} /> Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
        {error && <p role="alert" className="border border-[#ee7d77]/30 bg-[#7f2927]/10 px-4 py-3 text-xs text-[#ee7d77]">{error}</p>}
        {employeeError && <p className="border border-[#97a5ff]/20 bg-[#97a5ff]/[0.04] px-4 py-3 text-xs text-[#acabaa]/70">A equipe não pôde ser identificada agora; atividades sem nome aparecem como ID técnico.</p>}
        {eventLimitReached && <p className="border border-[#97a5ff]/20 bg-[#97a5ff]/[0.04] px-4 py-3 text-xs text-[#acabaa]/70">A leitura de atividades atingiu o limite inicial de 2.000 registros. Os KPIs representam o conjunto carregado e devem ser refinados com uma agregação histórica antes de usar o dashboard para períodos muito movimentados.</p>}

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Phone}
            label="Ligações registradas"
            value={formatNumber(metrics.calls)}
            helper="interações com canal ligação"
            delta={<Delta current={metrics.calls} previous={previous?.calls ?? null} />}
          />
          <MetricCard
            icon={Activity}
            label="Interações totais"
            value={formatNumber(metrics.totalInteractions)}
            helper={`todos os canais · ${formatPeriod(periodDays)}`}
            delta={<Delta current={metrics.totalInteractions} previous={previous?.totalInteractions ?? null} />}
            accent="#acc3ce"
          />
          <MetricCard
            icon={Users}
            label="Contatos alcançados"
            value={formatNumber(metrics.contactsReached)}
            helper="contatos distintos com atividade"
            delta={<Delta current={metrics.contactsReached} previous={previous?.contactsReached ?? null} />}
            accent="#c6c6c7"
          />
          <MetricCard
            icon={AlertTriangle}
            label="Follow-ups vencidos"
            value={formatNumber(metrics.overdueContacts.length)}
            helper="estado atual da base"
            accent="#ee7d77"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
            <CardHeader className="border-b border-[#484848]/20 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/65">Ritmo de atividade</CardTitle>
                  <p className="mt-1 text-xs text-[#acabaa]/45">Interações registradas ao longo de {formatPeriod(periodDays).toLowerCase()}.</p>
                </div>
                <Badge variant="outline" className="rounded-none border-[#484848]/30 text-[9px] uppercase tracking-widest text-[#acabaa]/55">{formatNumber(metrics.totalInteractions)} registros</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex h-48 items-end gap-1.5 sm:gap-2" aria-label="Interações e ligações por intervalo">
                {metrics.trend.map((point) => (
                  <div key={point.key} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2" title={`${point.label}: ${point.interactions} interações, ${point.calls} ligações`}>
                    <div className="flex h-36 w-full items-end justify-center">
                      <div
                        className={`w-full max-w-8 border-t-2 border-[#97a5ff] ${point.interactions ? "bg-[#97a5ff]/25" : "bg-[#484848]/15"}`}
                        style={{ height: `${point.interactions ? Math.max((point.interactions / trendMax) * 100, 8) : 3}%` }}
                        aria-label={`${point.label}: ${point.interactions} interações`}
                      />
                    </div>
                    <span className="font-mono text-[8px] text-[#acabaa]/40">{point.label}</span>
                  </div>
                ))}
              </div>
              {!hasData && <p className="mt-2 text-center text-xs text-[#acabaa]/45">Nenhuma interação registrada no período selecionado.</p>}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#484848]/20 pt-3 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">
                <span className="inline-flex items-center gap-2"><span className="h-2 w-2 bg-[#97a5ff]" /> Interações</span>
                <span className="inline-flex items-center gap-2"><Phone size={10} className="text-[#acc3ce]" /> Ligações incluídas no total</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
            <CardHeader className="border-b border-[#484848]/20 px-4 py-4">
              <CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/65">Mix de canais</CardTitle>
              <p className="mt-1 text-xs text-[#acabaa]/45">Onde a equipe está concentrando os contatos.</p>
            </CardHeader>
            <CardContent className="space-y-5 p-4">
              {channelRows.length === 0 ? <p className="py-8 text-center text-xs text-[#acabaa]/45">Sem dados de canal no período.</p> : channelRows.map((channel) => {
                const count = metrics.channels[channel.key] || 0;
                const Icon = channel.icon;
                return (
                  <div key={channel.key}>
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="inline-flex items-center gap-2 text-[#e7e5e5]"><Icon size={13} className="text-[#acabaa]/55" /> {channel.label}</span>
                      <span className="font-mono text-[10px] text-[#acabaa]/60">{formatNumber(count)} · {Math.round((count / metrics.totalInteractions) * 100)}%</span>
                    </div>
                    <div className="h-1 bg-[#484848]/25"><div className={`h-full ${channel.color}`} style={{ width: `${(count / channelMax) * 100}%` }} /></div>
                  </div>
                );
              })}
              <div className="border-t border-[#484848]/20 pt-4">
                <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Follow-ups agendados</span><span className="font-display text-xl text-[#e7e5e5]">{formatNumber(metrics.scheduledFollowUps)}</span></div>
                <p className="text-[10px] leading-relaxed text-[#acabaa]/40">Interações do período que deixaram uma próxima data de contato.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
          <CardHeader className="border-b border-[#484848]/20 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/65">Performance por funcionário</CardTitle>
                <p className="mt-1 text-xs text-[#acabaa]/45">Ranking por ligações e volume de atividade no período selecionado.</p>
              </div>
              <Badge variant="outline" className="w-fit rounded-none border-[#484848]/30 text-[9px] uppercase tracking-widest text-[#acabaa]/55">{formatPeriod(periodDays)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {metrics.employeeMetrics.length === 0 ? (
              <div className="px-4 py-12 text-center text-xs text-[#acabaa]/45">Nenhuma atividade atribuída à equipe no período.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#484848]/20 hover:bg-transparent">
                    <TableHead className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Funcionário</TableHead>
                    <TableHead className="text-right font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Ligações</TableHead>
                    <TableHead className="text-right font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Interações</TableHead>
                    <TableHead className="text-right font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Contatos</TableHead>
                    <TableHead className="text-right font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Follow-ups</TableHead>
                    <TableHead className="text-right font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Participação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.employeeMetrics.map((metric) => (
                    <TableRow key={metric.uid} className={`border-[#484848]/15 ${metric.isUnassigned ? "bg-[#ee7d77]/[0.03]" : ""}`}>
                      <TableCell className="min-w-48 text-xs text-[#e7e5e5]">
                        <span>{metric.name}</span>
                        <EmployeeStatus status={metric.status} />
                        {metric.isUnassigned && <span className="mt-1 block font-mono text-[9px] uppercase tracking-widest text-[#ee7d77]/55">atividade sem responsável</span>}
                      </TableCell>
                      <TableCell className="text-right font-display text-base text-[#e7e5e5]">{formatNumber(metric.calls)}</TableCell>
                      <TableCell className="text-right font-display text-base text-[#acc3ce]">{formatNumber(metric.totalInteractions)}</TableCell>
                      <TableCell className="text-right font-display text-base text-[#e7e5e5]">{formatNumber(metric.contactsReached)}</TableCell>
                      <TableCell className="text-right font-display text-base text-[#e7e5e5]">{formatNumber(metric.scheduledFollowUps)}</TableCell>
                      <TableCell className="text-right font-mono text-[10px] text-[#acabaa]/60">{employeeShare(metric, metrics.totalInteractions)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
            <CardHeader className="border-b border-[#484848]/20 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/65">Fila de follow-up</CardTitle>
                  <p className="mt-1 text-xs text-[#acabaa]/45">Contatos cujo próximo contato já passou.</p>
                </div>
                <Badge variant="outline" className="rounded-none border-[#ee7d77]/30 text-[9px] uppercase tracking-widest text-[#ee7d77]">{formatNumber(metrics.overdueContacts.length)} atrasados</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {metrics.overdueContacts.length === 0 ? (
                <div className="flex items-center gap-3 px-4 py-10 text-xs text-[#acc3ce]/70"><CheckCircle2 size={16} /> Nenhum follow-up vencido na base.</div>
              ) : (
                <div className="divide-y divide-[#484848]/15">
                  {metrics.overdueContacts.slice(0, 6).map((contact) => (
                    <div key={contact.id} className="flex items-center justify-between gap-4 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm text-[#e7e5e5]">{contact.displayName || contact.name || "Contato sem nome"}</p>
                        <p className="truncate font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/40">{companyNames.get(contact.companyId || "") || "Empresa não vinculada"}</p>
                      </div>
                      <div className="shrink-0 text-right"><p className="font-mono text-[10px] text-[#ee7d77]">desde {formatDate(contact.nextContactAt)}</p><p className="mt-1 font-mono text-[9px] text-[#acabaa]/35">último {formatDate(contact.lastContactAt)}</p></div>
                    </div>
                  ))}
                  {metrics.overdueContacts.length > 6 && <p className="px-4 py-3 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/40">+ {metrics.overdueContacts.length - 6} contatos aguardando ação</p>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
            <CardHeader className="border-b border-[#484848]/20 px-4 py-4"><CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/65">Qualidade da leitura</CardTitle></CardHeader>
            <CardContent className="space-y-5 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Atividades atribuídas</span><span className="font-display text-2xl text-[#acc3ce]">{metrics.attributionRate}%</span></div>
                <div className="h-1 bg-[#484848]/25"><div className="h-full bg-[#acc3ce]" style={{ width: `${metrics.attributionRate}%` }} /></div>
                <p className="mt-2 text-[10px] leading-relaxed text-[#acabaa]/40">{formatNumber(metrics.attributedInteractions)} de {formatNumber(metrics.totalInteractions)} interações têm funcionário identificado.</p>
              </div>
              <div className="border-t border-[#484848]/20 pt-4">
                <div className="mb-2 flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Base ativa</span><span className="font-display text-2xl text-[#e7e5e5]">{formatNumber(metrics.activeContacts)}</span></div>
                <p className="text-[10px] leading-relaxed text-[#acabaa]/40">Contatos não inativos no workspace. A cobertura da base no período foi de {metrics.activeContacts ? Math.round((metrics.contactsReachedInActiveBase / metrics.activeContacts) * 100) : 0}%.</p>
              </div>
              <p className="border-t border-[#484848]/20 pt-4 text-[10px] leading-relaxed text-[#acabaa]/45">Definição: ligação é um evento CRM com <span className="font-mono text-[#e7e5e5]/70">channelType=phone</span>. O CRM ainda não registra duração, conexão ou resultado da chamada.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
