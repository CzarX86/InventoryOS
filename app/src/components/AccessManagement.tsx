import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RefreshCw, ShieldCheck, ShieldOff, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ACCESS_STATUS, AccessStatus, AccessUserSummary, approveAccessRequest, listAccessUsers, revokeAccess } from "@/lib/accessControl";

type AccessManagementProps = {
  currentUser?: { uid?: string | null } | null;
};

type ActionState = {
  user: AccessUserSummary;
  action: "approve" | "revoke";
} | null;

function formatDate(value: unknown) {
  if (!value) return "—";
  const date = typeof (value as { toDate?: () => Date })?.toDate === "function"
    ? (value as { toDate: () => Date }).toDate()
    : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("pt-BR");
}

function statusLabel(status: AccessStatus) {
  if (status === ACCESS_STATUS.APPROVED) return "Aprovado";
  if (status === ACCESS_STATUS.REVOKED) return "Revogado";
  return "Pendente";
}

function statusClass(status: AccessStatus) {
  if (status === ACCESS_STATUS.APPROVED) return "border-[#acc3ce]/30 bg-[#293e48] text-[#acc3ce]";
  if (status === ACCESS_STATUS.REVOKED) return "border-[#ee7d77]/30 bg-[#7f2927]/20 text-[#ee7d77]";
  return "border-[#97a5ff]/30 bg-[#97a5ff]/10 text-[#97a5ff]";
}

export default function AccessManagement({ currentUser }: AccessManagementProps) {
  const [filter, setFilter] = useState<"all" | AccessStatus>("all");
  const [users, setUsers] = useState<AccessUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionState>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAccessUsers();
      setUsers(result.users.filter((user) => user.uid !== currentUser?.uid));
    } catch {
      setError("Não foi possível carregar os usuários. Verifique sua permissão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const counts = useMemo(() => users.reduce((result, user) => {
    result[user.status] = (result[user.status] || 0) + 1;
    return result;
  }, { pending: 0, approved: 0, revoked: 0 } as Record<AccessStatus, number>), [users]);

  const visibleUsers = useMemo(
    () => filter === "all" ? users : users.filter((user) => user.status === filter),
    [filter, users],
  );

  const executeAction = async () => {
    if (!action) return;
    setBusyUid(action.user.uid);
    setError(null);
    try {
      if (action.action === "approve") await approveAccessRequest(action.user.uid);
      else await revokeAccess(action.user.uid);
      setAction(null);
      await loadUsers();
    } catch {
      setError("A alteração não foi concluída. O estado foi mantido e pode ser tentado novamente.");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <section className="border-t border-[#484848]/20 bg-[#0e0e0e] px-4 py-8 md:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#97a5ff]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#acabaa]/50">ACCESS_CONTROL</span>
            </div>
            <h2 className="font-display text-2xl font-normal uppercase tracking-tight text-[#e7e5e5]">Usuários da plataforma</h2>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-[#acabaa]/60">Aprovação obrigatória antes de liberar qualquer dado. O owner da plataforma é protegido e não aparece nesta lista.</p>
          </div>
          <Button variant="outline" onClick={() => void loadUsers()} disabled={loading} className="w-fit rounded-none border-[#484848]/30 text-xs uppercase tracking-widest">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Atualizar
          </Button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-px border border-[#484848]/20 bg-[#484848]/20 sm:grid-cols-4">
          <button type="button" onClick={() => setFilter("all")} className={`bg-[#131313] px-3 py-4 text-left transition-colors hover:bg-[#1a1a1a] ${filter === "all" ? "ring-1 ring-inset ring-[#97a5ff]/50" : ""}`}>
            <span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-[#acabaa]/50">Todos</span>
            <span className="mt-1 block font-display text-2xl font-normal text-[#e7e5e5]">{users.length}</span>
          </button>
          {(["pending", "approved", "revoked"] as AccessStatus[]).map((status) => (
            <button key={status} type="button" onClick={() => setFilter(status)} className={`bg-[#131313] px-3 py-4 text-left transition-colors hover:bg-[#1a1a1a] ${filter === status ? "ring-1 ring-inset ring-[#97a5ff]/50" : ""}`}>
              <span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-[#acabaa]/50">{statusLabel(status)}</span>
              <span className="mt-1 block font-display text-2xl font-normal text-[#e7e5e5]">{counts[status] || 0}</span>
            </button>
          ))}
        </div>

        {error && <p role="alert" className="mb-4 border border-[#ee7d77]/30 bg-[#7f2927]/10 px-4 py-3 text-xs text-[#ee7d77]">{error}</p>}

        <Card className="rounded-none border border-[#484848]/20 bg-[#131313] shadow-none">
          <CardHeader className="border-b border-[#484848]/20 px-4 py-4">
            <CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60">{filter === "all" ? "Todos os estados" : statusLabel(filter)}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-xs text-[#acabaa]/60"><Loader2 size={16} className="animate-spin" /> Carregando acessos...</div>
            ) : visibleUsers.length === 0 ? (
              <div className="flex items-center justify-center gap-2 px-4 py-12 text-xs text-[#acabaa]/60"><UserRound size={16} /> Nenhum usuário neste estado.</div>
            ) : (
              <div className="divide-y divide-[#484848]/15">
                {visibleUsers.map((user) => (
                  <div key={user.uid} className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-[#e7e5e5]">{user.displayName || "Usuário sem nome"}</p>
                      <p className="truncate font-mono text-[11px] text-[#acabaa]/60">{user.email || "E-mail indisponível"}</p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Solicitado em {formatDate(user.requestedAt)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={`rounded-none text-[9px] uppercase tracking-widest ${statusClass(user.status)}`}>{statusLabel(user.status)}</Badge>
                      {user.status !== ACCESS_STATUS.APPROVED ? (
                        <Button size="sm" onClick={() => setAction({ user, action: "approve" })} disabled={busyUid === user.uid} className="rounded-none bg-[#acc3ce] text-[#0e0e0e] hover:bg-[#c8d9df]">
                          {busyUid === user.uid ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Aprovar
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" onClick={() => setAction({ user, action: "revoke" })} disabled={busyUid === user.uid} className="rounded-none">
                          {busyUid === user.uid ? <Loader2 size={13} className="animate-spin" /> : <ShieldOff size={13} />} Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(action)} onOpenChange={(open: boolean) => !open && setAction(null)}>
        <DialogContent className="rounded-none border-[#484848]/30 bg-[#131313] text-[#e7e5e5]">
          <DialogHeader className="">
            <DialogTitle className="font-display font-normal uppercase tracking-tight">{action?.action === "approve" ? "Aprovar acesso" : "Revogar acesso"}</DialogTitle>
            <DialogDescription className="text-[#acabaa]">
              {action?.action === "approve"
                ? `Liberar os dados da plataforma para ${action?.user.email || "este usuário"}?`
                : `Bloquear imediatamente o acesso de ${action?.user.email || "este usuário"}? Os dados históricos serão preservados.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="">
            <Button variant="outline" onClick={() => setAction(null)} disabled={Boolean(busyUid)} className="rounded-none">Cancelar</Button>
            <Button variant={action?.action === "approve" ? "default" : "destructive"} onClick={() => void executeAction()} disabled={Boolean(busyUid)} className="rounded-none">
              {busyUid ? <Loader2 size={14} className="animate-spin" /> : null}
              {action?.action === "approve" ? "Confirmar aprovação" : "Confirmar revogação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
