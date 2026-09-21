"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  MessageCircle,
  MessageSquareText,
  PhoneCall,
  ShoppingBag,
  ShieldCheck,
  Sparkles,
  Target,
  UsersRound,
  Zap,
} from "lucide-react";
import WhatsappInstanceManager from "@/components/WhatsappInstanceManager";
import ContactReviewQueue from "@/components/ContactReviewQueue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { db } from "@/lib/firebase";

const REQUEST_ID = "whatsapp";

const benefits = [
  {
    icon: MessageSquareText,
    title: "Conversas no contexto",
    description: "Relacione mensagens aos contatos, empresas e oportunidades certas, sem perder o histórico.",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    icon: Bot,
    title: "Necessidade clara",
    description: "A IA resume o que o cliente precisa, identifica intenção e organiza o contexto para a equipe.",
    tone: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    icon: ShoppingBag,
    title: "Cross-selling relevante",
    description: "Cruze a conversa com catálogo, histórico e interesses para sugerir produtos relacionados.",
    tone: "bg-lime-50 text-lime-800 border-lime-100",
  },
  {
    icon: Target,
    title: "Workflow automatizado",
    description: "Transforme a conversa em sugestão de CRM, follow-up ou oportunidade para aprovação humana.",
    tone: "bg-violet-50 text-violet-700 border-violet-100",
  },
];

const steps = [
  { number: "01", title: "Conecte", description: "Vincule uma instância do WhatsApp da sua operação." },
  { number: "02", title: "Identifique", description: "Reconheça cliente, empresa e histórico antes de criar qualquer registro." },
  { number: "03", title: "Recomende", description: "Encontre necessidade, oportunidade e possibilidades de cross-selling." },
  { number: "04", title: "Aprove", description: "Revise a sugestão e envie o próximo passo ao CRM com segurança." },
];

export default function WhatsappView({ user }) {
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestStatus, setRequestStatus] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [showConfiguration, setShowConfiguration] = useState(false);

  useEffect(() => {
    if (!db || !user?.uid) return undefined;

    const requestRef = doc(db, "module_requests", `${user.uid}_${REQUEST_ID}`);
    return onSnapshot(requestRef, (snapshot) => {
      setRequestStatus(snapshot.exists() ? snapshot.data()?.status || "pending" : null);
    }, () => {
      setRequestStatus(null);
    });
  }, [user?.uid]);

  const handleRequestAccess = async (event) => {
    event.preventDefault();
    setRequestError("");
    setRequestLoading(true);

    try {
      if (!db) {
        setRequestStatus("pending");
        setRequestOpen(false);
        return;
      }

      const requestRef = doc(db, "module_requests", `${user?.uid || "local"}_${REQUEST_ID}`);
      await setDoc(requestRef, {
        module: REQUEST_ID,
        moduleLabel: "Integração com WhatsApp",
        status: "pending",
        workspaceId: user?.workspaceId || user?.defaultAccountId || null,
        requesterUserId: user?.uid || null,
        requesterEmail: user?.email || null,
        requesterName: user?.displayName || null,
        requesterPhotoURL: user?.photoURL || null,
        message: requestMessage.trim() || null,
        requestedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setRequestStatus("pending");
      setRequestMessage("");
      setRequestOpen(false);
    } catch (error) {
      console.error("WhatsApp module request failed:", error);
      setRequestError("Não foi possível enviar a solicitação. Tente novamente em instantes.");
    } finally {
      setRequestLoading(false);
    }
  };

  const isRequested = requestStatus === "pending" || requestStatus === "approved";

  return (
    <div className="min-h-full bg-background pb-16">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-4 gap-1.5 rounded-full border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
              <MessageCircle size={13} /> Módulo disponível sob solicitação
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">WhatsApp conectado à sua operação.</h1>
            <p className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground">
              Centralize conversas, organize oportunidades e transforme mensagens importantes em próximos passos para a equipe.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {showConfiguration && (
              <Button variant="outline" onClick={() => setShowConfiguration(false)} className="w-full rounded-xl sm:w-auto">
                Ocultar configuração
              </Button>
            )}
            <Button onClick={() => setRequestOpen(true)} disabled={isRequested} className="w-full gap-2 rounded-xl sm:w-auto">
              {isRequested ? <CheckCircle2 size={16} /> : <Zap size={16} />}
              {isRequested ? "Solicitação em análise" : "Solicitar liberação"}
            </Button>
          </div>
        </header>

        {requestStatus === "approved" && (
          <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-950">
            <CheckCircle2 />
            <AlertTitle>Integração liberada</AlertTitle>
            <AlertDescription>O módulo está pronto para ser configurado pela sua equipe.</AlertDescription>
          </Alert>
        )}

        {requestStatus === "pending" && (
          <Alert className="mb-6 border-blue-200 bg-blue-50 text-blue-950">
            <Clock3 />
            <AlertTitle>Solicitação recebida</AlertTitle>
            <AlertDescription>Vamos avaliar a liberação do módulo e avisar você quando estiver disponível.</AlertDescription>
          </Alert>
        )}

        <section className="mb-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden rounded-2xl border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-lime-50 shadow-sm">
            <CardContent className="relative p-6 sm:p-8">
              <div className="relative z-10 max-w-md">
                <p className="text-sm font-semibold text-emerald-950">Uma ponte entre a conversa e a ação</p>
                <p className="mt-3 text-sm leading-relaxed text-emerald-950/70">
                  O WhatsApp deixa de ser uma caixa de entrada isolada. Com a integração, o contexto comercial chega ao lugar onde sua equipe já trabalha.
                </p>
                <div className="mt-7 flex flex-wrap gap-2 text-xs font-medium text-emerald-900">
                  {["CRM atualizado", "IA com revisão humana", "Histórico preservado"].map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1.5">
                      <Check size={13} /> {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pointer-events-none absolute -right-8 -bottom-12 hidden h-56 w-56 rounded-full border-[28px] border-emerald-200/50 sm:block" />
              <div className="pointer-events-none absolute right-10 top-10 hidden h-20 w-20 rounded-3xl border border-lime-300/80 bg-lime-200/70 sm:block" />
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-card shadow-sm">
            <CardHeader className="flex-row items-start justify-between space-y-0 p-5 sm:p-6">
              <div>
                <CardTitle className="text-lg">Como a equipe usa</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Do primeiro contato ao próximo passo.</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><PhoneCall size={18} /></div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0 sm:p-6 sm:pt-0">
              <PreviewMessage label="Cliente" text="Preciso de uma cotação para este modelo e talvez de um segundo equipamento." />
              <div className="ml-8 flex items-center gap-2 text-xs text-muted-foreground"><ArrowRight size={14} className="text-emerald-600" /> Necessidade + oportunidade de cross-selling</div>
              <PreviewMessage label="Sugestão para revisão" text="Vincular ao cliente, oferecer o acessório compatível e criar follow-up para amanhã." accent />
            </CardContent>
          </Card>
        </section>

        <section className="mb-8">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Benefícios do módulo</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Mais contexto, menos trabalho manual.</h2>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {benefits.map(({ icon: Icon, title, description, tone }) => (
              <Card key={title} className="rounded-2xl border-border/70 bg-card shadow-sm">
                <CardContent className="p-5">
                  <span className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${tone}`}><Icon size={18} /></span>
                  <h3 className="text-base font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-8 rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Fluxo de trabalho</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Uma rotina simples para o time.</h2>
            </div>
            <ShieldCheck className="hidden text-emerald-600 sm:block" size={22} />
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step.number} className="relative flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">{step.number}</span>
                <div>
                  <h3 className="text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
                {index < steps.length - 1 && <ArrowRight className="absolute -right-3 top-2 hidden text-border md:block" size={16} />}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <ValueCard icon={UsersRound} title="Contatos qualificados" text="Reconheça pessoas e grupos relevantes para o negócio." />
          <ValueCard icon={Sparkles} title="Sugestões revisáveis" text="A IA propõe ações; a equipe mantém a decisão final." />
          <ValueCard icon={ShieldCheck} title="Dados no workspace" text="Cada registro respeita o acesso e o contexto da sua operação." />
        </section>

        <div className="border-t border-border/70 pt-6">
          <button type="button" onClick={() => setShowConfiguration((value) => !value)} className="flex w-full items-center justify-between gap-4 rounded-xl px-1 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <span>Já tem acesso? Abrir configuração e monitoramento</span>
            <ChevronDown size={18} className={`transition-transform ${showConfiguration ? "rotate-180" : ""}`} />
          </button>
          {showConfiguration && (
            <div className="mt-5 space-y-8">
              <div className="rounded-2xl border border-border/70 bg-card p-4 sm:p-6">
                <WhatsappInstanceManager />
              </div>
              <ContactReviewQueue />
            </div>
          )}
        </div>
      </div>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar liberação do WhatsApp</DialogTitle>
            <DialogDescription>Conte rapidamente como sua equipe pretende usar o módulo. Isso ajuda a preparar a configuração certa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRequestAccess} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsappRequestEmail">E-mail para retorno</Label>
              <Input id="whatsappRequestEmail" value={user?.email || ""} readOnly className="bg-muted/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsappRequestMessage">Como você quer usar o módulo? <span className="text-muted-foreground">(opcional)</span></Label>
              <Textarea id="whatsappRequestMessage" value={requestMessage} onChange={(event) => setRequestMessage(event.target.value)} placeholder="Ex.: acompanhar pedidos de cotação e criar follow-ups automaticamente." className="min-h-28 resize-none" />
            </div>
            {requestError && <p className="text-sm text-destructive" role="alert">{requestError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={requestLoading} className="gap-2">{requestLoading ? "Enviando…" : "Enviar solicitação"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewMessage({ label, text, accent = false }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? "border-emerald-200 bg-emerald-50/70" : "border-border/70 bg-muted/25"}`}>
      <div className="mb-1 flex items-center justify-between gap-3"><span className="text-xs font-medium text-muted-foreground">{label}</span>{accent && <Badge className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white">CRM</Badge>}</div>
      <p className="text-sm font-medium text-foreground">{text}</p>
    </div>
  );
}

function ValueCard({ icon: Icon, title, text }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border/70 bg-muted/20 p-4">
      <Icon size={18} className="mt-0.5 shrink-0 text-emerald-700" />
      <div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div>
    </div>
  );
}
