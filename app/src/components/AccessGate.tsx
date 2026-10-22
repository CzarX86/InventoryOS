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
        <Card className="w-full shadow-sm">
          <CardHeader className="border-b border-border/70 px-6 py-7">
            <div
              className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl border ${
                revoked
                  ? "border-destructive/20 bg-destructive/10 text-destructive"
                  : "border-primary/20 bg-accent text-primary"
              }`}
            >
              {revoked ? <ShieldAlert size={24} aria-hidden /> : <Clock3 size={24} aria-hidden />}
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight">
              {revoked ? "Acesso revogado" : "Aguardando aprovação"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 px-6 py-7">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {revoked
                ? "Esta conta não tem mais acesso aos dados da plataforma. Fale com o administrador se precisar solicitar uma nova liberação."
                : "Seu cadastro foi recebido. Um administrador precisa aprovar o acesso antes que os dados da plataforma sejam liberados."}
            </p>
            {email && (
              <div className="rounded-lg border border-border/70 bg-muted/60 px-4 py-3">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">Conta solicitante</p>
                <p className="truncate font-mono text-xs text-foreground">{email}</p>
              </div>
            )}
            <Button
              variant="outline"
              onClick={onLogout}
              className="h-10 w-full gap-2 border-destructive/20 text-destructive hover:bg-destructive/10"
            >
              <LogOut size={14} aria-hidden /> Sair da sessão
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
