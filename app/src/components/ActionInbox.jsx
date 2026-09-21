"use client";

import React, { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CheckSquare2,
  CircleHelp,
  Clock3,
  Inbox,
  MessageCircle,
  Search,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, functions } from "@/lib/firebase";

/**
 * Centraliza oportunidades e tarefas extraídas do relacionamento para que a
 * equipe saiba o que precisa de uma decisão ou de um próximo passo.
 */
export default function ActionInbox({ onOpenCrm, user }) {
  const [opportunities, setOpportunities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null);
  const [feedback, setFeedback] = useState("");
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;

  useEffect(() => {
    if (!db || !workspaceId) {
      setLoading(false);
      return undefined;
    }

    let opportunitiesLoaded = false;
    let tasksLoaded = false;
    let reviewsLoaded = false;
    const finishLoading = () => {
      if (opportunitiesLoaded && tasksLoaded && reviewsLoaded) setLoading(false);
    };

    const oppsQuery = query(collection(db, "opportunities"), where("workspaceId", "==", workspaceId), limit(100));
    const tasksQuery = query(collection(db, "tasks"), where("workspaceId", "==", workspaceId), limit(100));
    const reviewsQuery = query(collection(db, "crm_review_items"), where("workspaceId", "==", workspaceId), limit(100));
    const unsubOpps = onSnapshot(oppsQuery, (snap) => {
      setOpportunities(snap.docs.map((item) => ({ id: item.id, ...item.data(), kind: "opportunity" })));
      opportunitiesLoaded = true;
      finishLoading();
    }, () => {
      setError("Não foi possível carregar as oportunidades agora.");
      opportunitiesLoaded = true;
      finishLoading();
    });
    const unsubTasks = onSnapshot(tasksQuery, (snap) => {
      setTasks(snap.docs.map((item) => ({ id: item.id, ...item.data(), kind: "task" })));
      tasksLoaded = true;
      finishLoading();
    }, () => {
      setError("Não foi possível carregar todas as tarefas agora.");
      tasksLoaded = true;
      finishLoading();
    });
    const unsubReviews = onSnapshot(reviewsQuery, (snap) => {
      setReviews(snap.docs.map((item) => ({ id: item.id, ...item.data(), kind: "review" })));
      reviewsLoaded = true;
      finishLoading();
    }, () => {
      setError("Não foi possível carregar as sugestões para revisão.");
      reviewsLoaded = true;
      finishLoading();
    });

    return () => {
      unsubOpps();
      unsubTasks();
      unsubReviews();
    };
  }, [workspaceId]);

  const handleUpdate = async (item, nextStatus) => {
    const collectionName = item.kind === "opportunity" ? "opportunities" : "tasks";
    try {
      await updateDoc(doc(db, collectionName, item.id), item.kind === "opportunity"
        ? { stage: nextStatus, updatedAt: new Date() }
        : { status: nextStatus, updatedAt: new Date() });
      setFeedback(item.kind === "opportunity" ? "Oportunidade concluída." : "Tarefa resolvida.");
      window.setTimeout(() => setFeedback(""), 3000);
    } catch (updateError) {
      console.error("Action update failed:", updateError);
      setError("Não foi possível atualizar este registro. Tente novamente.");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteDoc(doc(db, pendingDelete.kind === "opportunity" ? "opportunities" : "tasks", pendingDelete.id));
      setFeedback("Registro removido.");
      window.setTimeout(() => setFeedback(""), 3000);
    } catch (deleteError) {
      console.error("Action delete failed:", deleteError);
      setError("Não foi possível remover este registro.");
    } finally {
      setPendingDelete(null);
    }
  };

  const handleReview = async (review, decision) => {
    if (!functions) {
      setError("A revisão precisa de uma conexão Firebase ativa.");
      return;
    }
    try {
      const callable = httpsCallable(functions, decision === "approve" ? "approveCrmReviewItem" : "rejectCrmReviewItem");
      await callable({ reviewId: review.id });
      setFeedback(decision === "approve" ? "Sugestão aprovada e enviada ao CRM." : "Sugestão descartada.");
      window.setTimeout(() => setFeedback(""), 3000);
    } catch (reviewError) {
      console.error("CRM review failed:", reviewError);
      setError("Não foi possível concluir a revisão. Tente novamente.");
    }
  };

  const allItems = useMemo(() => [...opportunities, ...tasks], [opportunities, tasks]);
  const activeItems = useMemo(() => allItems.filter((item) => !isCompleted(item)), [allItems]);
  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return allItems
      .filter((item) => !isCompleted(item))
      .filter((item) => activeTab === "all" || item.kind === activeTab.slice(0, -1))
      .filter((item) => {
        if (!normalizedSearch) return true;
        return getItemTitle(item).toLowerCase().includes(normalizedSearch)
          || String(item.remoteJid || "").toLowerCase().includes(normalizedSearch)
          || String(item.description || "").toLowerCase().includes(normalizedSearch);
      })
      .sort((left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt));
  }, [activeTab, allItems, searchQuery]);

  const counts = {
    all: activeItems.length + reviews.filter((item) => item.status === "pending").length,
    opportunities: opportunities.filter((item) => !isCompleted(item)).length,
    tasks: tasks.filter((item) => !isCompleted(item)).length,
  };

  return (
    <div className="min-h-full bg-background pb-16">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-4 gap-1.5 rounded-full border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800"><Inbox size={13} /> Acompanhe os próximos passos</Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Central de ações</h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">O que nasce nas conversas e precisa virar uma decisão, uma tarefa ou um retorno para o cliente.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-sm">
            <Target size={18} className="text-blue-700" />
            <div><p className="text-xl font-semibold leading-none">{counts.all}</p><p className="mt-1 text-xs text-muted-foreground">pendências abertas</p></div>
          </div>
        </header>

        <Card className="mb-6 rounded-2xl border-border/70 bg-card shadow-sm">
          <CardContent className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
            <HowItWorks icon={Sparkles} title="A IA identifica" text="Pedidos, oportunidades e compromissos que aparecem nas conversas." />
            <HowItWorks icon={CircleHelp} title="Você decide" text="A equipe revisa o contexto antes de assumir qualquer ação." />
            <HowItWorks icon={CheckCircle2} title="O time acompanha" text="Tudo fica organizado aqui até ser concluído ou removido." last />
          </CardContent>
        </Card>

        {error && <Alert variant="destructive" className="mb-5"><AlertCircle /><AlertTitle>Não foi possível atualizar a central</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
        {feedback && <Alert className="mb-5 border-emerald-200 bg-emerald-50 text-emerald-950"><CheckCircle2 /><AlertDescription>{feedback}</AlertDescription></Alert>}

        {reviews.filter((item) => item.status === "pending").length > 0 && <ReviewQueue reviews={reviews.filter((item) => item.status === "pending")} onReview={handleReview} />}

        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-border/70 bg-card p-3 shadow-sm sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Pesquisar ações" placeholder="Pesquisar por assunto ou contato" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="h-10 rounded-xl border-border/70 bg-muted/35 pl-10 shadow-none" />
          </div>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="grid h-10 w-full grid-cols-3 bg-muted/60 sm:w-auto sm:min-w-[360px]">
              <TabsTrigger value="all" className="gap-1.5 rounded-lg text-xs">Tudo <Count>{counts.all}</Count></TabsTrigger>
              <TabsTrigger value="opportunities" className="gap-1.5 rounded-lg text-xs">Oportunidades <Count>{counts.opportunities}</Count></TabsTrigger>
              <TabsTrigger value="tasks" className="gap-1.5 rounded-lg text-xs">Tarefas <Count>{counts.tasks}</Count></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">Carregando ações…</div>
        ) : filteredItems.length === 0 ? (
          <EmptyState hasSearch={Boolean(searchQuery || activeTab !== "all")} onOpenCrm={onOpenCrm} />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1"><p className="text-sm font-semibold">Pendências para revisar</p><p className="text-xs text-muted-foreground">{filteredItems.length} registro{filteredItems.length === 1 ? "" : "s"}</p></div>
            <AnimatePresence initial={false}>
              {filteredItems.map((item) => <ActionItem key={`${item.kind}-${item.id}`} item={item} onUpdate={handleUpdate} onDelete={setPendingDelete} />)}
            </AnimatePresence>
          </div>
        )}
      </div>

      <Dialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remover este registro?</DialogTitle><DialogDescription>Ele sairá da Central de ações e não poderá ser recuperado por aqui.</DialogDescription></DialogHeader>
          <DialogFooter><Button variant="outline" onClick={() => setPendingDelete(null)}>Cancelar</Button><Button variant="destructive" onClick={handleDelete}>Remover</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HowItWorks({ icon: Icon, title, text, last = false }) {
  return <div className={`relative flex gap-3 ${!last ? "after:absolute after:-right-3 after:top-1/2 after:hidden after:h-px after:w-6 after:bg-border sm:after:block" : ""}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon size={17} /></span><div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div></div>;
}

function ReviewQueue({ reviews, onReview }) {
  return <section className="mb-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-sm"><Sparkles size={18} /></span><div><p className="text-sm font-semibold text-violet-950">Sugestões da IA para revisar</p><p className="mt-1 text-xs leading-relaxed text-violet-900/75">A IA encontrou oportunidades, tarefas ou possibilidades de cross-selling. Nada entra no CRM sem a decisão da equipe.</p></div></div>
    <div className="space-y-3">{reviews.map((review) => <ReviewItem key={review.id} review={review} onReview={onReview} />)}</div>
  </section>;
}

function ReviewItem({ review, onReview }) {
  const suggestion = review.suggestion || {};
  const kindLabel = { opportunity: "Oportunidade", task: "Tarefa", cross_sell: "Cross-selling" }[review.kind] || "Sugestão";
  const title = suggestion.title || suggestion.description || suggestion.name || review.summary || "Sugestão sem descrição";
  return <article className="flex flex-col gap-4 rounded-xl border border-violet-200 bg-card p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full border-violet-200 bg-violet-50 text-[10px] text-violet-800">{kindLabel}</Badge>{review.confidence != null && <span className="text-[11px] text-muted-foreground">Confiança {Math.round(Number(review.confidence) * 100)}%</span>}</div><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{review.summary || "Sugestão extraída de uma conversa do WhatsApp."}</p></div><div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" onClick={() => onReview(review, "reject")} className="h-9 rounded-lg">Descartar</Button><Button size="sm" onClick={() => onReview(review, "approve")} className="h-9 gap-1.5 rounded-lg"><CheckCircle2 size={14} /> Aprovar</Button></div></article>;
}

function Count({ children }) {
  return <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{children}</span>;
}

function ActionItem({ item, onUpdate, onDelete }) {
  const isOpportunity = item.kind === "opportunity";
  const title = getItemTitle(item);
  const status = isOpportunity ? item.stage || "new" : item.status || "pending";
  const Icon = isOpportunity ? BriefcaseBusiness : CheckSquare2;
  const tone = isOpportunity ? "border-blue-100 bg-blue-50 text-blue-700" : "border-amber-100 bg-amber-50 text-amber-700";

  return (
    <motion.article initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="group flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tone}`}><Icon size={19} /></div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2"><Badge variant="outline" className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>{isOpportunity ? "Oportunidade" : "Tarefa"}</Badge><span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span></div>
        <h2 className="truncate text-sm font-semibold text-foreground sm:text-base">{title}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"><span className="inline-flex items-center gap-1.5"><MessageCircle size={13} /> {item.remoteJid?.split("@")[0] || "Origem não informada"}</span>{item.estimatedValue && <span className="font-medium text-emerald-700">R$ {item.estimatedValue}</span>}</div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3 sm:border-t-0 sm:pt-0">
        <Badge variant="outline" className="rounded-full border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">{formatStatus(status)}</Badge>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => onUpdate(item, isOpportunity ? "closed_won" : "completed")} className="h-9 gap-1.5 rounded-lg">{isOpportunity ? "Concluir" : "Resolver"}<ArrowRight size={14} /></Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(item)} className="h-9 w-9 rounded-lg text-muted-foreground hover:text-destructive" aria-label={`Remover ${title}`}><Trash2 size={15} /></Button>
        </div>
      </div>
    </motion.article>
  );
}

function EmptyState({ hasSearch, onOpenCrm }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center shadow-sm"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Clock3 size={22} /></span><h2 className="mt-4 text-base font-semibold">{hasSearch ? "Nenhum registro encontrado" : "Sua central está em dia"}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{hasSearch ? "Tente buscar por outro assunto ou escolha outra categoria." : "Quando uma conversa gerar uma oportunidade ou tarefa, ela aparecerá aqui para revisão."}</p>{!hasSearch && onOpenCrm && <Button variant="outline" onClick={onOpenCrm} className="mt-5 gap-2 rounded-xl">Abrir CRM <ArrowRight size={15} /></Button>}</div>;
}

function isCompleted(item) {
  return item.kind === "opportunity" ? ["closed_won", "closed_lost", "completed"].includes(item.stage) : ["completed", "done", "resolved"].includes(item.status);
}

function getItemTitle(item) {
  return item.kind === "opportunity" ? item.title || "Oportunidade sem título" : item.description || item.title || "Tarefa sem descrição";
}

function timestampValue(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.toDate === "function") return value.toDate().getTime();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value) {
  const timestamp = timestampValue(value);
  return timestamp ? new Date(timestamp).toLocaleDateString("pt-BR") : "Data não informada";
}

function formatStatus(status) {
  return { new: "Nova", pending: "Pendente", in_progress: "Em andamento", closed_won: "Concluída", completed: "Resolvida" }[status] || status;
}
