import { Clock3, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type AccessGateProps = {
  status: "pending" | "revoked" | string;
  email?: string | null;
  onLogout: () => void;
};

export default function AccessGate({ status, email, onLogout }: AccessGateProps) {
  const revoked = status === "revoked";
  return (
    <main className="min-h-screen bg-background px-6 py-16 text-foreground">
      <div className="mx-auto flex min-h-[70vh] max-w-lg items-center justify-center">
        <Card className="w-full rounded-none border border-[#484848]/30 bg-[#131313] shadow-none">
          <CardHeader className="border-b border-[#484848]/20 px-6 py-7">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-none border border-[#97a5ff]/30 bg-[#97a5ff]/10 text-[#97a5ff]">
              {revoked ? <ShieldAlert size={24} /> : <Clock3 size={24} />}
            </div>
            <CardTitle className="font-display text-2xl font-normal uppercase tracking-tight text-[#e7e5e5]">
              {revoked ? "Acesso revogado" : "Aguardando aprovação"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-6 py-7">
            <p className="text-sm leading-relaxed text-[#acabaa]">
              {revoked
                ? "Esta conta não tem mais acesso aos dados da plataforma. Fale com o administrador se precisar solicitar uma nova liberação."
                : "Seu cadastro foi recebido. Um administrador precisa aprovar o acesso antes que os dados da plataforma sejam liberados."}
            </p>
            {email && (
              <div className="border border-[#484848]/20 bg-[#0e0e0e] px-4 py-3">
                <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[#acabaa]/50">Conta solicitante</p>
                <p className="truncate font-mono text-xs text-[#e7e5e5]">{email}</p>
              </div>
            )}
            <Button
              variant="outline"
              onClick={onLogout}
              className="h-10 w-full rounded-none border-[#ee7d77]/30 text-[#ee7d77] hover:bg-[#ee7d77]/10"
            >
              <LogOut size={14} /> Sair da sessão
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
