"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { httpsCallable, type Functions } from "firebase/functions";
import { uploadBytes, ref, type FirebaseStorage } from "firebase/storage";
import { collection, limit, onSnapshot, query, where, type Firestore } from "firebase/firestore";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Download, FileSpreadsheet, History, Loader2, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db as firebaseDb, functions as firebaseFunctions, storage as firebaseStorage } from "@/lib/firebase";

const db = firebaseDb as unknown as Firestore | undefined;
const functions = firebaseFunctions as Functions | undefined;
const storage = firebaseStorage as FirebaseStorage | undefined;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type ImportUser = { uid?: string | null; workspaceId?: string | null; defaultAccountId?: string | null } | null;
type Summary = { totalRows: number; validRows: number; invalidRows: number; duplicateCandidates?: number; existingMatches?: number; created?: number; updated?: number; skippedRows?: number };
type ImportRow = { rowNumber: number; companyName: string; contactName: string; email: string; phone: string; errors: string[] } & Record<string, unknown>;
type ImportJob = { id: string; status?: string; fileName?: string; createdAt?: unknown; summary?: Summary; importSummary?: Summary };

function timestampValue(value: unknown) {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value: unknown) {
  const timestamp = timestampValue(value);
  return timestamp ? new Date(timestamp).toLocaleDateString("pt-BR") : "Agora";
}

export default function CrmImportView({ user, onBack }: { user: ImportUser; onBack: () => void }) {
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<ImportRow[]>([]);
  const [history, setHistory] = useState<ImportJob[]>([]);
  const [status, setStatus] = useState<"idle" | "uploading" | "validating" | "ready" | "importing" | "completed">("idle");
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!db || !workspaceId) return undefined;
    const jobsQuery = query(collection(db, "crm_import_jobs"), where("workspaceId", "==", workspaceId), limit(8));
    return onSnapshot(jobsQuery, (snapshot) => {
      setHistory(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as ImportJob)).sort((left, right) => timestampValue(right.createdAt) - timestampValue(left.createdAt)));
    }, () => setMessage({ tone: "error", text: "Não foi possível carregar o histórico de importações." }));
  }, [workspaceId]);

  const selectFile = (nextFile: File | null) => {
    setMessage(null);
    if (!nextFile) return;
    if (!/\.(xlsx|xls|csv)$/i.test(nextFile.name)) { setMessage({ tone: "error", text: "Escolha um arquivo Excel (.xlsx/.xls) ou CSV." }); return; }
    if (nextFile.size > MAX_FILE_SIZE) { setMessage({ tone: "error", text: "O arquivo precisa ter no máximo 10 MB." }); return; }
    setFile(nextFile);
    setStatus("idle");
    setSummary(null);
    setPreview([]);
    setErrors([]);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0] || null);
  };

  const validateFile = async () => {
    if (!file) { setMessage({ tone: "error", text: "Escolha um arquivo antes de continuar." }); return; }
    if (!functions || !storage || !user?.uid) { setMessage({ tone: "error", text: "A importação precisa de uma sessão Firebase aprovada. Em desenvolvimento, conecte-se ao emulador ou ao ambiente configurado." }); return; }
    setMessage(null);
    try {
      setStatus("uploading");
      const createJob = httpsCallable<{ fileName: string; fileSize: number }, { jobId: string; storagePath: string }>(functions, "createCrmImportJob");
      const created = (await createJob({ fileName: file.name, fileSize: file.size })).data;
      setJobId(created.jobId);
      await uploadBytes(ref(storage, created.storagePath), file, { contentType: file.type || "application/octet-stream" });
      setStatus("validating");
      const validate = httpsCallable<{ jobId: string }, { summary: Summary; preview: ImportRow[]; errors: ImportRow[] }>(functions, "validateCrmImport");
      const result = (await validate({ jobId: created.jobId })).data;
      setSummary(result.summary);
      setPreview(result.preview || []);
      setErrors(result.errors || []);
      setStatus("ready");
      setMessage({ tone: "success", text: "Arquivo validado. Revise os alertas antes de importar os dados válidos." });
    } catch (error) {
      console.error("CRM import validation failed", error);
      setStatus("idle");
      setMessage({ tone: "error", text: "Não foi possível validar o arquivo. Confira o modelo e tente novamente." });
    }
  };

  const confirmImport = async () => {
    if (!jobId || !functions) return;
    setStatus("importing");
    setMessage(null);
    try {
      const confirm = httpsCallable<{ jobId: string }, Summary>(functions, "confirmCrmImport");
      const result = (await confirm({ jobId })).data;
      setSummary((current) => ({ ...(current || { totalRows: 0, validRows: 0, invalidRows: 0 }), ...result }));
      setStatus("completed");
      setMessage({ tone: "success", text: `${result.created || 0} novos registros criados e ${result.updated || 0} registros atualizados.` });
    } catch (error) {
      console.error("CRM import confirmation failed", error);
      setStatus("ready");
      setMessage({ tone: "error", text: "A importação não foi concluída. Seus dados continuam disponíveis para uma nova tentativa." });
    }
  };

  const statusLabel = useMemo(() => ({ idle: "Pronto para importar", uploading: "Enviando arquivo…", validating: "Validando dados…", ready: "Revisão pronta", importing: "Importando dados…", completed: "Importação concluída" }[status]), [status]);

  return (
    <div className="min-h-full bg-background pb-20 text-foreground">
      <div className="border-b border-border/70 bg-card px-4 py-7 md:px-8 md:py-8">
        <div className="mx-auto max-w-6xl">
          <Button variant="ghost" onClick={onBack} className="mb-4 h-9 gap-2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground"><ArrowLeft size={16} /> Voltar para o CRM</Button>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div><Badge variant="outline" className="mb-3 gap-1.5 rounded-full border-blue-200 bg-blue-50 text-blue-800"><FileSpreadsheet size={14} /> Migração assistida</Badge><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Importar contatos</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Traga sua carteira para o CRM. A plataforma normaliza os dados, identifica duplicidades e mostra os alertas antes de confirmar.</p></div>
            <div className="flex shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground"><span className={`h-2 w-2 rounded-full ${status === "completed" ? "bg-emerald-500" : status === "idle" ? "bg-slate-300" : "bg-blue-500"}`} />{statusLabel}</div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-5 px-4 py-5 md:px-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
        <div className="space-y-5">
          {message && <Alert variant={message.tone === "error" ? "destructive" : "default"} className={message.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-950" : ""}><AlertCircle className="h-4 w-4" /><AlertTitle className="">{message.tone === "error" ? "Revise antes de continuar" : "Tudo certo"}</AlertTitle><AlertDescription className="">{message.text}</AlertDescription></Alert>}
          <Card className="rounded-2xl border-border/70 shadow-sm"><CardHeader className=""><CardTitle className="text-base">1. Envie sua planilha</CardTitle></CardHeader><CardContent className="">
            <div onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${dragging ? "border-primary bg-accent/50" : "border-border bg-muted/20"}`}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" onChange={(event) => selectFile(event.target.files?.[0] || null)} />
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Upload size={22} /></span>
              <p className="mt-4 text-sm font-semibold">Arraste o arquivo aqui</p><p className="mt-1 text-xs text-muted-foreground">ou escolha um arquivo Excel/CSV de até 10 MB</p>
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="mt-5 gap-2 rounded-xl"><FileSpreadsheet size={15} /> Escolher arquivo</Button>
              {file && <div className="mx-auto mt-5 flex max-w-md items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-left"><div className="min-w-0"><p className="truncate text-sm font-medium text-blue-950">{file.name}</p><p className="text-xs text-blue-800/70">{(file.size / 1024).toFixed(0)} KB</p></div><button type="button" onClick={() => { setFile(null); setStatus("idle"); }} className="rounded-lg p-2 text-blue-700 hover:bg-blue-100" aria-label="Remover arquivo"><X size={15} /></button></div>}
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-relaxed text-muted-foreground">O arquivo original fica protegido por até 90 dias para auditoria e suporte; depois é removido automaticamente.</p><Button onClick={validateFile} disabled={!file || ["uploading", "validating", "importing"].includes(status)} className="h-10 shrink-0 gap-2 rounded-xl">{["uploading", "validating"].includes(status) ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Validar arquivo</Button></div>
          </CardContent></Card>

          <Card className="rounded-2xl border-border/70 shadow-sm"><CardHeader className=""><CardTitle className="text-base">2. Revise e confirme</CardTitle></CardHeader><CardContent className="">
            {!summary ? <div className="rounded-xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">O resumo da validação aparecerá aqui depois do envio.</div> : <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="Linhas lidas" value={summary.totalRows || 0} /><Metric label="Prontas para importar" value={summary.validRows || 0} tone="positive" /><Metric label="Com alerta" value={summary.invalidRows || 0} tone={summary.invalidRows ? "warning" : "neutral"} /><Metric label="Repetidas no arquivo" value={summary.duplicateCandidates || 0} tone={summary.duplicateCandidates ? "warning" : "neutral"} /><Metric label="Já cadastradas" value={summary.existingMatches || 0} tone="neutral" /></div>
              {errors.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-start gap-3"><AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-700" /><div><p className="text-sm font-semibold text-amber-950">Algumas linhas precisam de atenção</p><p className="mt-1 text-xs leading-relaxed text-amber-900/80">As linhas válidas serão importadas. Você pode corrigir as demais e fazer uma nova importação depois.</p><div className="mt-3 space-y-1 text-xs text-amber-900">{errors.slice(0, 5).map((row) => <p key={row.rowNumber}>Linha {row.rowNumber}: {row.errors.join("; ")}</p>)}{errors.length > 5 && <p>+ {errors.length - 5} alertas na lista completa</p>}</div></div></div></div>}
              {preview.length > 0 && <div className="mt-5 overflow-x-auto rounded-xl border border-border/70"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-muted/50 text-muted-foreground"><tr><th className="px-3 py-2 font-medium">Linha</th><th className="px-3 py-2 font-medium">Empresa</th><th className="px-3 py-2 font-medium">Contato</th><th className="px-3 py-2 font-medium">E-mail</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody className="divide-y divide-border/60">{preview.map((row) => <tr key={row.rowNumber}><td className="px-3 py-2 text-muted-foreground">{row.rowNumber}</td><td className="px-3 py-2 font-medium">{row.companyName || "—"}</td><td className="px-3 py-2">{row.contactName || "—"}</td><td className="px-3 py-2">{row.email || row.phone || "—"}</td><td className="px-3 py-2">{row.errors?.length ? <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-800">Revisar</Badge> : <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Válida</Badge>}</td></tr>)}</tbody></table></div>}
              <div className="mt-5 flex justify-end"><Button onClick={confirmImport} disabled={status !== "ready" || !summary?.validRows} className="h-10 gap-2 rounded-xl">{status === "importing" ? <Loader2 size={15} className="animate-spin" /> : status === "completed" ? <CheckCircle2 size={15} /> : <Upload size={15} />} {status === "completed" ? "Importação concluída" : "Importar dados válidos"}</Button></div>
            </>}
          </CardContent></Card>
        </div>

        <aside className="space-y-5">
          <Card className="rounded-2xl border-border/70 shadow-sm"><CardHeader className=""><CardTitle className="text-base">Modelos prontos</CardTitle></CardHeader><CardContent className="space-y-3"><TemplateLink href="/templates/crm-contatos-simples.xlsx" title="Modelo simples" description="Empresa, contato, e-mail, telefone e observação" /><TemplateLink href="/templates/crm-contatos-completo.xlsx" title="Modelo completo" description="Inclui função, endereço, datas e WhatsApp" /></CardContent></Card>
          <Card className="rounded-2xl border-border/70 shadow-sm"><CardHeader className=""><CardTitle className="flex items-center gap-2 text-base"><History size={17} className="text-primary" /> Histórico recente</CardTitle></CardHeader><CardContent className="">{history.length === 0 ? <p className="text-sm leading-relaxed text-muted-foreground">As importações desta carteira aparecerão aqui.</p> : <div className="space-y-3">{history.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{item.fileName || "Arquivo sem nome"}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p></div><Badge variant="outline" className="shrink-0 rounded-full text-[10px]">{formatJobStatus(item.status)}</Badge></div>)}</div>}</CardContent></Card>
        </aside>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "positive" | "warning" | "neutral" }) { return <div className={`rounded-xl border p-3 ${tone === "positive" ? "border-emerald-200 bg-emerald-50" : tone === "warning" ? "border-amber-200 bg-amber-50" : "border-border/70 bg-muted/25"}`}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold">{value.toLocaleString("pt-BR")}</p></div>; }
function TemplateLink({ href, title, description }: { href: string; title: string; description: string }) { return <a href={href} download className="flex items-start gap-3 rounded-xl border border-border/70 p-3 transition-colors hover:border-primary/40 hover:bg-accent/40"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Download size={16} /></span><span className="min-w-0"><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{description}</span></span></a>; }
function formatJobStatus(status?: string) { return ({ awaiting_upload: "Aguardando", ready: "Pronta", completed: "Concluída", partial: "Parcial", expired: "Expirada" } as Record<string, string>)[status || ""] || "Em análise"; }
