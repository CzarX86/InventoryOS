"use client";

import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  ArrowRight,
  AudioLines,
  Building2,
  CalendarClock,
  Check,
  FileAudio,
  History,
  LayoutDashboard,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import type { FirebaseStorage } from "firebase/storage";
import { db as firebaseDb, storage as firebaseStorage } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AutocompleteInput, { type AutocompleteOption } from "@/components/AutocompleteInput";
import CrmAudioCapture from "@/components/CrmAudioCapture";
import { extractCrmInteractionFromAudio } from "@/lib/ai";
import {
  getCrmAudioExtension,
  mergeCrmNotes,
  readBlobAsBase64,
  type CrmAudioAttachment,
} from "@/lib/crmAudio";
import { buildWhatsappRemoteJid, normalizePhoneDigits } from "@/lib/phone";
import { CRM_CHANNEL_LABELS } from "@/lib/uiText";

const db = firebaseDb as unknown as Firestore | undefined;
const storage = firebaseStorage as unknown as FirebaseStorage | undefined;

type CrmUser = { uid?: string | null; workspaceId?: string | null; defaultAccountId?: string | null } | null;

type Company = {
  id: string;
  name?: string | null;
  sector?: string | null;
  locality?: string | null;
  workspaceId?: string | null;
};

type Contact = {
  id: string;
  companyId?: string | null;
  name?: string | null;
  displayName?: string | null;
  role?: string | null;
  sector?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  whatsappRemoteJid?: string | null;
  locality?: string | null;
  notes?: string | null;
  lastContactAt?: unknown;
  nextContactAt?: unknown;
  nextContactSource?: string | null;
};

type CatalogItem = {
  id: string;
  itemType?: string | null;
  brand?: string | null;
  model?: string | null;
};

type CrmAiAnalysis = {
  transcript?: string | null;
  summary?: string | null;
  nextContactAt?: string | null;
  contactUpdates?: {
    role?: string | null;
    sector?: string | null;
    locality?: string | null;
    email?: string | null;
    phoneNumber?: string | null;
    notesAppend?: string | null;
  } | null;
  opportunities?: Array<{ title?: string | null; summary?: string | null; stage?: string | null }>;
  tasks?: Array<{ title?: string | null; summary?: string | null; dueAt?: string | null }>;
  equipmentLinks?: Array<{ relationType?: string | null; equipmentType?: string | null; brand?: string | null; model?: string | null; summary?: string | null }>;
  confidence?: number | null;
  aiModel?: string | null;
};

type CrmEvent = {
  id: string;
  channelType?: string | null;
  summary?: string | null;
  source?: string | null;
  occurredAt?: unknown;
  nextContactAt?: unknown;
  transcript?: string | null;
  audioUrl?: string | null;
  audioName?: string | null;
  aiAnalysis?: CrmAiAnalysis | null;
};

type EquipmentLink = {
  id: string;
  relationType?: string | null;
  equipmentType?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
};

const EMPTY_CONTACT = {
  companyId: null as string | null,
  companyName: "",
  companySector: "",
  companyLocality: "",
  name: "",
  role: "",
  sector: "",
  email: "",
  phoneNumber: "",
  locality: "",
  notes: "",
};

const EMPTY_INTERACTION = {
  channelType: "phone",
  occurredAt: new Date().toISOString().slice(0, 16),
  nextContactAt: "",
  summary: "",
};

const EMPTY_EQUIPMENT = {
  relationType: "interest",
  catalogItemId: "",
  equipmentType: "",
  brand: "",
  model: "",
};

type ContactFormState = typeof EMPTY_CONTACT;
type InteractionFormState = typeof EMPTY_INTERACTION;
type EquipmentFormState = typeof EMPTY_EQUIPMENT;
type GroupedCompany = Company & { contacts: Contact[] };

function timestampToMillis(value: unknown) {
  if (typeof (value as { toMillis?: () => number })?.toMillis === "function") return (value as { toMillis: () => number }).toMillis();
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") return (value as { toDate: () => Date }).toDate().getTime();
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value: unknown) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Ainda não registrado";
}

function followUpState(contact: Contact) {
  const next = timestampToMillis(contact.nextContactAt);
  if (!next) return { label: "Sem próximo contato", className: "border-[#484848]/30 text-[#acabaa]" };
  if (next < Date.now()) return { label: "Contato atrasado", className: "border-[#ee7d77]/30 bg-[#7f2927]/20 text-[#ee7d77]" };
  return { label: "Em dia", className: "border-[#acc3ce]/30 bg-[#293e48] text-[#acc3ce]" };
}

function fieldClassName() {
  return "mt-2 rounded-none border-[#484848]/30 bg-[#0e0e0e] text-sm text-[#e7e5e5] placeholder:text-[#acabaa]/35";
}

function channelLabel(channelType?: string | null) {
  return channelType ? (CRM_CHANNEL_LABELS as Record<string, string>)[channelType] || channelType : "OUTRO";
}

function normalizeOptionValue(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function buildTextOptions(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const options: AutocompleteOption[] = [];
  values.forEach((value) => {
    const label = String(value || "").trim();
    const key = normalizeOptionValue(label);
    if (!label || seen.has(key)) return;
    seen.add(key);
    options.push({ value: label, label });
  });
  return options.sort((left, right) => left.label!.localeCompare(right.label!, "pt-BR", { sensitivity: "base" }));
}

function safeStorageSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120) || "registro";
}

function parseOptionalDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function valueOrNull(value: unknown) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function cleanAudioAnalysis(value: unknown): CrmAiAnalysis {
  const input = (value || {}) as Record<string, unknown>;
  const updates = (input.contactUpdates || {}) as Record<string, unknown>;
  const cleanList = (items: unknown, fields: string[]) => Array.isArray(items)
    ? items.map((item) => {
      const source = (item || {}) as Record<string, unknown>;
      return fields.reduce<Record<string, string | null>>((result, field) => { result[field] = valueOrNull(source[field]); return result; }, {});
    }).filter((item) => Object.values(item).some(Boolean))
    : [];
  return {
    transcript: valueOrNull(input.transcript),
    summary: valueOrNull(input.summary),
    nextContactAt: valueOrNull(input.nextContactAt),
    contactUpdates: {
      role: valueOrNull(updates.role),
      sector: valueOrNull(updates.sector),
      locality: valueOrNull(updates.locality),
      email: valueOrNull(updates.email),
      phoneNumber: valueOrNull(updates.phoneNumber),
      notesAppend: valueOrNull(updates.notesAppend),
    },
    opportunities: cleanList(input.opportunities, ["title", "summary", "stage"]),
    tasks: cleanList(input.tasks, ["title", "summary", "dueAt"]),
    equipmentLinks: cleanList(input.equipmentLinks, ["relationType", "equipmentType", "brand", "model", "summary"]),
    confidence: typeof input.confidence === "number" && Number.isFinite(input.confidence) ? input.confidence : null,
    aiModel: valueOrNull(input.aiModel),
  };
}

function ContactFormCard({ form, setForm, companyOptions, contactNameOptions, roleOptions, sectorOptions, localityOptions, saving, onSubmit }: { form: ContactFormState; setForm: Dispatch<SetStateAction<ContactFormState>>; companyOptions: AutocompleteOption[]; contactNameOptions: AutocompleteOption[]; roleOptions: AutocompleteOption[]; sectorOptions: AutocompleteOption[]; localityOptions: AutocompleteOption[]; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-5 py-5"><div className="flex items-start gap-3"><div className="flex size-9 items-center justify-center border border-[#97a5ff]/30 bg-[#97a5ff]/10 text-[#97a5ff]"><Plus size={16} /></div><div><CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#e7e5e5]">Novo contato</CardTitle><p className="mt-1 text-xs leading-relaxed text-[#acabaa]/55">Cadastre uma pessoa e vincule-a a uma empresa. Os próximos campos reaproveitam valores já usados.</p></div></div></CardHeader><CardContent className="p-5"><form onSubmit={onSubmit} noValidate className="grid gap-x-4 gap-y-4 md:grid-cols-2"><div className="md:col-span-2"><Label htmlFor="companyName">Empresa <span className="text-[#ee7d77]">*</span></Label><AutocompleteInput id="companyName" value={form.companyName} options={companyOptions} onValueChange={(value) => setForm((current) => ({ ...current, companyName: value, companyId: null }))} onOptionSelect={(option) => setForm((current) => ({ ...current, companyName: option.value, companyId: option.id || null }))} className={fieldClassName()} placeholder="Comece a digitar o nome da empresa" autoComplete="organization" /></div><div><Label htmlFor="contactName">Responsável <span className="text-[#ee7d77]">*</span></Label><AutocompleteInput id="contactName" value={form.name} options={contactNameOptions} onValueChange={(value) => setForm((current) => ({ ...current, name: value }))} className={fieldClassName()} placeholder="Nome do contato" autoComplete="name" /></div><div><Label htmlFor="contactRole">Função</Label><AutocompleteInput id="contactRole" value={form.role} options={roleOptions} onValueChange={(value) => setForm((current) => ({ ...current, role: value }))} className={fieldClassName()} placeholder="Compras, manutenção..." autoComplete="organization-title" /></div><div><Label htmlFor="contactSector">Setor</Label><AutocompleteInput id="contactSector" value={form.sector} options={sectorOptions} onValueChange={(value) => setForm((current) => ({ ...current, sector: value }))} className={fieldClassName()} placeholder="Setor da empresa" /></div><div><Label htmlFor="contactLocality">Localidade</Label><AutocompleteInput id="contactLocality" value={form.locality} options={localityOptions} onValueChange={(value) => setForm((current) => ({ ...current, locality: value }))} className={fieldClassName()} placeholder="Cidade / UF" autoComplete="address-level2" /></div><div><Label htmlFor="contactEmail">E-mail</Label><Input id="contactEmail" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={fieldClassName()} placeholder="contato@empresa.com" /></div><div><Label htmlFor="contactPhone">Telefone / WhatsApp</Label><Input id="contactPhone" type="tel" inputMode="tel" autoComplete="tel" value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} className={fieldClassName()} placeholder="(00) 00000-0000" /><p className="mt-1 font-mono text-[9px] leading-relaxed text-[#acabaa]/40">Informe somente o número. A identificação interna do WhatsApp fica oculta.</p></div><div className="md:col-span-2"><Label htmlFor="contactNotes">Observação inicial</Label><Textarea id="contactNotes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={`${fieldClassName()} min-h-24 resize-none`} placeholder="Contexto inicial do contato" /></div><Button type="submit" disabled={saving} className="h-10 rounded-none bg-[#e7e5e5] text-[#0e0e0e] hover:bg-[#c6c6c7] md:col-span-2">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Salvar contato</Button></form></CardContent></Card>;
}

function ContactDirectory({ groupedCompanies, selectedContactId, onSelect }: { groupedCompanies: GroupedCompany[]; selectedContactId: string | null; onSelect: (contactId: string) => void }) {
  return <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-5 py-5"><div className="flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="flex size-9 items-center justify-center border border-[#97a5ff]/30 bg-[#97a5ff]/10 text-[#97a5ff]"><Building2 size={16} /></div><div><CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#e7e5e5]">Empresas e contatos</CardTitle><p className="mt-1 text-xs text-[#acabaa]/55">Escolha um contato para abrir seu contexto.</p></div></div><Badge variant="outline" className="rounded-none border-[#484848]/30 text-[9px] text-[#acabaa]/70">{groupedCompanies.length} empresas</Badge></div></CardHeader><CardContent className="p-0">{groupedCompanies.length === 0 ? <p className="px-5 py-12 text-center text-xs text-[#acabaa]/55">Nenhum contato cadastrado ainda. Comece pela aba Novo contato.</p> : <div className="divide-y divide-[#484848]/15">{groupedCompanies.map((company) => <div key={company.id} className="px-5 py-5"><div className="mb-3 flex items-start justify-between gap-3"><div><p className="text-sm text-[#e7e5e5]">{company.name || "Empresa sem nome"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/40">{company.sector || "Setor não informado"} · {company.locality || "Localidade não informada"}</p></div><Badge variant="outline" className="rounded-none border-[#484848]/30 text-[9px] text-[#acabaa]/70">{company.contacts.length}</Badge></div>{company.contacts.length === 0 ? <p className="text-xs text-[#acabaa]/40">Sem responsáveis cadastrados.</p> : <div className="space-y-1">{company.contacts.map((contact) => { const state = followUpState(contact); return <button key={contact.id} type="button" onClick={() => onSelect(contact.id)} className={`flex w-full items-center justify-between gap-3 border px-3 py-3 text-left transition-colors hover:bg-[#1a1a1a] ${selectedContactId === contact.id ? "border-[#97a5ff]/40 bg-[#97a5ff]/[0.06]" : "border-transparent bg-[#0e0e0e]"}`}><span className="min-w-0"><span className="block truncate text-sm text-[#e7e5e5]">{contact.displayName || contact.name}</span><span className="mt-1 block truncate font-mono text-[10px] text-[#acabaa]/50">{contact.role || "Função não informada"}</span></span><Badge variant="outline" className={`shrink-0 rounded-none text-[8px] uppercase tracking-widest ${state.className}`}>{state.label}</Badge></button>; })}</div>}</div>)}</div>}</CardContent></Card>;
}

function ContactSummaryCard({ contact, company, onOpenHistory }: { contact: Contact; company: Company | undefined; onOpenHistory?: () => void }) {
  const state = followUpState(contact);
  return <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-5 py-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#acabaa]/40">Contato selecionado</p><CardTitle className="mt-2 font-display text-2xl font-normal uppercase tracking-tight">{contact.displayName || contact.name}</CardTitle><p className="mt-1 text-xs text-[#acabaa]/60">{company?.name || "Empresa não vinculada"} · {contact.role || "Função não informada"}</p></div><Badge variant="outline" className={`rounded-none text-[8px] uppercase tracking-widest ${state.className}`}>{state.label}</Badge></div></CardHeader><CardContent className="grid gap-4 p-5 text-xs text-[#acabaa]/70 sm:grid-cols-2"><p><span className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">E-mail</span>{contact.email || "—"}</p><p><span className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Telefone</span>{contact.phoneNumber || "—"}</p><p><span className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Último contato</span>{formatDate(contact.lastContactAt)}</p><p><span className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Próximo contato</span>{formatDate(contact.nextContactAt)}{contact.nextContactSource === "ai" && <span className="ml-2 text-[#97a5ff]">IA</span>}</p>{contact.notes && <p className="leading-relaxed sm:col-span-2"><span className="mb-1 block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Observações</span>{contact.notes}</p>}{onOpenHistory && <Button type="button" onClick={onOpenHistory} variant="outline" className="h-9 rounded-none border-[#97a5ff]/30 bg-transparent text-xs text-[#e7e5e5] hover:bg-[#97a5ff]/10 sm:col-span-2"><History size={14} /> Abrir histórico <ArrowRight size={14} className="ml-auto" /></Button>}</CardContent></Card>;
}

function ContactEmptyState({ onOpenContacts }: { onOpenContacts: () => void }) {
  return <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center"><UserRound size={28} className="text-[#acabaa]/35" /><div><p className="text-sm text-[#e7e5e5]">Nenhum contato selecionado</p><p className="mt-1 text-xs text-[#acabaa]/55">Escolha uma pessoa na sua base para ver dados e histórico.</p></div><Button type="button" onClick={onOpenContacts} variant="outline" className="mt-2 h-9 rounded-none border-[#97a5ff]/30 bg-transparent text-xs hover:bg-[#97a5ff]/10"><Search size={14} /> Abrir empresas e contatos</Button></CardContent></Card>;
}

function InteractionComposer({ contact, form, onChange, onSubmit, audioAttachment, onAudioReady, onAudioError, audioResetKey, saving }: { contact: Contact; form: InteractionFormState; onChange: (patch: Partial<InteractionFormState>) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; audioAttachment: CrmAudioAttachment | null; onAudioReady: (attachment: CrmAudioAttachment | null) => void; onAudioError: (message: string) => void; audioResetKey: number; saving: boolean }) {
  const isAudioProcessing = saving && Boolean(audioAttachment);
  return <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-5 py-5"><div className="flex items-start gap-3"><div className="flex size-9 items-center justify-center border border-[#acc3ce]/30 bg-[#293e48]/40 text-[#acc3ce]"><History size={16} /></div><div><CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#e7e5e5]">Registrar interação</CardTitle><p className="mt-1 text-xs text-[#acabaa]/55">Registre uma nota rápida ou deixe a IA organizar uma conversa inteira.</p></div></div></CardHeader><CardContent className="p-5"><form onSubmit={onSubmit} noValidate className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="interactionChannel">Canal</Label><select id="interactionChannel" value={form.channelType} onChange={(event) => onChange({ channelType: event.target.value })} className={`${fieldClassName()} h-9 w-full px-2.5`}><option value="phone">Ligação</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="meeting">Reunião</option><option value="other">Outro</option></select></div><div><Label htmlFor="interactionDate">Quando</Label><Input id="interactionDate" type="datetime-local" value={form.occurredAt} onChange={(event) => onChange({ occurredAt: event.target.value })} className={fieldClassName()} /></div></div><div><Label htmlFor="nextContactAt">Próximo contato</Label><Input id="nextContactAt" type="datetime-local" value={form.nextContactAt} onChange={(event) => onChange({ nextContactAt: event.target.value })} className={fieldClassName()} /><p className="mt-1 text-[10px] leading-relaxed text-[#acabaa]/40">Se ficar em branco, a IA pode sugerir uma data mencionada no áudio; sem sugestão, usamos 10 dias.</p></div><div><Label htmlFor="interactionSummary">Resumo ou observação</Label><Textarea id="interactionSummary" value={form.summary} onChange={(event) => onChange({ summary: event.target.value })} className={`${fieldClassName()} min-h-24 resize-none`} placeholder={audioAttachment ? "Opcional: acrescente uma observação ao áudio..." : "O que foi tratado e qual é a próxima ação?"} /></div><CrmAudioCapture key={`${contact.id}-${audioResetKey}`} onAudioReady={onAudioReady} onError={onAudioError} processing={isAudioProcessing} disabled={saving && !audioAttachment} /><div className="flex items-start gap-2 border-l-2 border-[#97a5ff]/40 bg-[#97a5ff]/[0.04] px-3 py-2.5 text-[10px] leading-relaxed text-[#acabaa]/60"><Sparkles size={14} className="mt-0.5 shrink-0 text-[#97a5ff]" /><span>A IA pode atualizar somente campos explícitos do contato. Oportunidades, tarefas e equipamentos encontrados ficam como sugestões no histórico para revisão.</span></div><Button type="submit" disabled={saving} className="h-10 w-full rounded-none bg-[#acc3ce] text-[#0e0e0e] hover:bg-[#c8d9df]">{isAudioProcessing ? <><Loader2 size={14} className="animate-spin" /> Analisando áudio...</> : saving ? <><Loader2 size={14} className="animate-spin" /> Registrando...</> : audioAttachment ? <><AudioLines size={14} /> Transcrever e registrar</> : <><Check size={14} /> Registrar interação</>}</Button></form></CardContent></Card>;
}

function TimelineCard({ events }: { events: CrmEvent[] }) {
  return <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-5 py-5"><CardTitle className="flex items-center gap-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60"><CalendarClock size={14} className="text-[#97a5ff]" /> Linha do tempo <Badge variant="outline" className="ml-auto rounded-none border-[#484848]/30 text-[9px] text-[#acabaa]/60">{events.length}</Badge></CardTitle></CardHeader><CardContent className="p-5">{events.length === 0 ? <p className="text-xs text-[#acabaa]/50">Nenhuma interação registrada.</p> : <div className="space-y-5">{events.map((event) => { const suggestions = event.aiAnalysis; const suggestionCount = (suggestions?.opportunities?.length || 0) + (suggestions?.tasks?.length || 0) + (suggestions?.equipmentLinks?.length || 0); return <div key={event.id} className="border-l border-[#97a5ff]/35 pl-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-none border-[#484848]/30 text-[8px] uppercase tracking-widest">{channelLabel(event.channelType)}</Badge>{event.source === "manual_audio" && <Badge variant="outline" className="rounded-none border-[#acc3ce]/30 text-[8px] uppercase tracking-widest text-[#acc3ce]"><AudioLines size={11} /> Áudio</Badge>}<span className="font-mono text-[9px] text-[#acabaa]/40">{formatDate(event.occurredAt)}</span></div><p className="mt-2 text-xs leading-relaxed text-[#e7e5e5]">{event.summary || "Interação sem resumo"}</p>{event.audioUrl && <div className="mt-3 border border-[#484848]/20 bg-[#0e0e0e] p-3"><div className="mb-2 flex items-center gap-2 text-[10px] text-[#acabaa]/60"><FileAudio size={13} className="text-[#acc3ce]" />{event.audioName || "Áudio da interação"}</div><audio controls preload="metadata" src={event.audioUrl} className="h-9 w-full" aria-label="Áudio da interação registrada" /></div>}{event.transcript && <details className="mt-3 border border-[#484848]/20 bg-[#0e0e0e] px-3 py-2"><summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-[#97a5ff]">Ver transcrição</summary><p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[#acabaa]/75">{event.transcript}</p></details>}{suggestionCount > 0 && <details className="mt-3 border border-[#97a5ff]/20 bg-[#97a5ff]/[0.04] px-3 py-2"><summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] uppercase tracking-widest text-[#97a5ff]"><Sparkles size={12} /> Sugestões da IA ({suggestionCount})</summary><div className="mt-3 space-y-2 text-[11px] leading-relaxed text-[#acabaa]/75">{suggestions?.opportunities?.map((item, index) => <p key={`opportunity-${index}`}><span className="text-[#e7e5e5]">Oportunidade:</span> {item.title || item.summary || "Sem título"}</p>)}{suggestions?.tasks?.map((item, index) => <p key={`task-${index}`}><span className="text-[#e7e5e5]">Tarefa:</span> {item.title || item.summary || "Sem título"}</p>)}{suggestions?.equipmentLinks?.map((item, index) => <p key={`equipment-${index}`}><span className="text-[#e7e5e5]">Equipamento:</span> {[item.equipmentType, item.brand, item.model].filter(Boolean).join(" · ") || item.summary || "Sem descrição"}</p>)}</div></details>}{Boolean(event.nextContactAt) && <p className="mt-2 font-mono text-[9px] text-[#acabaa]/45">Próximo: {formatDate(event.nextContactAt)}</p>}</div>; })}</div>}</CardContent></Card>;
}

function EquipmentCard({ catalogItems, equipmentLinks, form, setForm, equipmentTypeOptions, equipmentBrandOptions, equipmentModelOptions, saving, onSubmit }: { catalogItems: CatalogItem[]; equipmentLinks: EquipmentLink[]; form: EquipmentFormState; setForm: Dispatch<SetStateAction<EquipmentFormState>>; equipmentTypeOptions: AutocompleteOption[]; equipmentBrandOptions: AutocompleteOption[]; equipmentModelOptions: AutocompleteOption[]; saving: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-5 py-5"><CardTitle className="flex items-center gap-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60"><PackageSearch size={14} className="text-[#97a5ff]" /> Equipamentos vinculados</CardTitle></CardHeader><CardContent className="space-y-4 p-5"><form onSubmit={onSubmit} noValidate className="space-y-3"><div><Label htmlFor="equipmentRelation">Relação</Label><select id="equipmentRelation" value={form.relationType} onChange={(event) => setForm((current) => ({ ...current, relationType: event.target.value }))} className={`${fieldClassName()} h-9 w-full px-2.5`}><option value="interest">Interesse comercial</option><option value="installed">Equipamento instalado</option></select></div><div><Label htmlFor="catalogItem">Item do catálogo</Label><select id="catalogItem" value={form.catalogItemId} onChange={(event) => { const item = catalogItems.find((catalog) => catalog.id === event.target.value); setForm((current) => ({ ...current, catalogItemId: event.target.value, equipmentType: item?.itemType || current.equipmentType, brand: item?.brand || current.brand, model: item?.model || current.model })); }} className={`${fieldClassName()} h-9 w-full px-2.5`}><option value="">Não encontrado no catálogo</option>{catalogItems.map((item) => <option key={item.id} value={item.id}>{[item.itemType, item.brand, item.model].filter(Boolean).join(" · ") || item.id}</option>)}</select></div><div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="equipmentType">Tipo</Label><AutocompleteInput id="equipmentType" value={form.equipmentType} options={equipmentTypeOptions} onValueChange={(value) => setForm((current) => ({ ...current, equipmentType: value }))} className={fieldClassName()} placeholder="Sensor" /></div><div><Label htmlFor="equipmentBrand">Marca</Label><AutocompleteInput id="equipmentBrand" value={form.brand} options={equipmentBrandOptions} onValueChange={(value) => setForm((current) => ({ ...current, brand: value }))} className={fieldClassName()} placeholder="Marca" /></div><div><Label htmlFor="equipmentModel">Modelo</Label><AutocompleteInput id="equipmentModel" value={form.model} options={equipmentModelOptions} onValueChange={(value) => setForm((current) => ({ ...current, model: value }))} className={fieldClassName()} placeholder="Modelo" /></div></div><Button type="submit" disabled={saving} variant="outline" className="h-9 w-full rounded-none">{saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Vincular equipamento</Button></form>{equipmentLinks.length > 0 && <div className="space-y-2 border-t border-[#484848]/15 pt-4">{equipmentLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-3 border border-[#484848]/20 bg-[#0e0e0e] px-3 py-3"><div className="min-w-0"><p className="truncate text-xs text-[#e7e5e5]">{[link.equipmentType, link.brand, link.model].filter(Boolean).join(" · ") || "Equipamento sem descrição"}</p><p className="mt-1 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/40">{link.relationType === "installed" ? "Instalado" : "Interesse"}{link.status === "pending_catalog" ? " · Pendente de catálogo" : ""}</p></div><PackageSearch size={14} className="shrink-0 text-[#acabaa]/40" /></div>)}</div>}</CardContent></Card>;
}

export default function CrmView({ user }: { user: CrmUser }) {
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [contactForm, setContactForm] = useState<ContactFormState>(EMPTY_CONTACT);
  const [interactionForm, setInteractionForm] = useState<InteractionFormState>(EMPTY_INTERACTION);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>(EMPTY_EQUIPMENT);
  const [audioAttachment, setAudioAttachment] = useState<CrmAudioAttachment | null>(null);
  const [audioResetKey, setAudioResetKey] = useState(0);
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [interestLinks, setInterestLinks] = useState<EquipmentLink[]>([]);
  const [installedLinks, setInstalledLinks] = useState<EquipmentLink[]>([]);
  const [savingContact, setSavingContact] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) || null;
  const selectedCompany = companies.find((company) => company.id === selectedContact?.companyId);
  const equipmentLinks = useMemo(() => [...interestLinks, ...installedLinks], [installedLinks, interestLinks]);
  const companyOptions = useMemo<AutocompleteOption[]>(() => companies.filter((company) => String(company.name || "").trim()).map((company) => ({ id: company.id, value: String(company.name).trim(), label: String(company.name).trim(), description: [company.sector, company.locality].filter(Boolean).join(" · ") || "Empresa cadastrada" })), [companies]);
  const contactNameOptions = useMemo(() => buildTextOptions(contacts.map((contact) => contact.displayName || contact.name)), [contacts]);
  const roleOptions = useMemo(() => buildTextOptions(contacts.map((contact) => contact.role)), [contacts]);
  const sectorOptions = useMemo(() => buildTextOptions([...contacts.map((contact) => contact.sector), ...companies.map((company) => company.sector)]), [companies, contacts]);
  const localityOptions = useMemo(() => buildTextOptions([...contacts.map((contact) => contact.locality), ...companies.map((company) => company.locality)]), [companies, contacts]);
  const equipmentTypeOptions = useMemo(() => buildTextOptions(catalogItems.map((item) => item.itemType)), [catalogItems]);
  const equipmentBrandOptions = useMemo(() => buildTextOptions(catalogItems.map((item) => item.brand)), [catalogItems]);
  const equipmentModelOptions = useMemo(() => buildTextOptions(catalogItems.map((item) => item.model)), [catalogItems]);
  const overdueContacts = useMemo(() => contacts.filter((contact) => { const next = timestampToMillis(contact.nextContactAt); return next > 0 && next < Date.now(); }), [contacts]);
  const upcomingContacts = useMemo(() => contacts.filter((contact) => timestampToMillis(contact.nextContactAt) >= Date.now()).sort((left, right) => timestampToMillis(left.nextContactAt) - timestampToMillis(right.nextContactAt)).slice(0, 6), [contacts]);

  useEffect(() => {
    if (!db || !workspaceId) return undefined;
    const companyQuery = query(collection(db, "accounts"), where("workspaceId", "==", workspaceId), limit(200));
    const contactQuery = query(collection(db, "contacts"), where("workspaceId", "==", workspaceId), limit(500));
    const catalogQuery = query(collection(db, "catalog_items"), where("workspaceId", "==", workspaceId), limit(300));
    const unsubscribeCompanies = onSnapshot(companyQuery, (snapshot) => setCompanies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Company)).sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "pt-BR"))), () => setError("Não foi possível carregar as empresas."));
    const unsubscribeContacts = onSnapshot(contactQuery, (snapshot) => { const nextContacts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Contact)); setContacts(nextContacts); setSelectedContactId((current) => current && nextContacts.some((contact) => contact.id === current) ? current : nextContacts[0]?.id || null); }, () => setError("Não foi possível carregar os contatos."));
    const unsubscribeCatalog = onSnapshot(catalogQuery, (snapshot) => setCatalogItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CatalogItem))), () => setError("Não foi possível carregar o catálogo de equipamentos."));
    return () => { unsubscribeCompanies(); unsubscribeContacts(); unsubscribeCatalog(); };
  }, [workspaceId]);

  useEffect(() => {
    if (!db || !selectedContactId || !workspaceId) { setEvents([]); setInterestLinks([]); setInstalledLinks([]); return undefined; }
    const eventsQuery = query(collection(db, "crm_events"), where("workspaceId", "==", workspaceId), where("contactId", "==", selectedContactId), limit(100));
    const interestsQuery = query(collection(db, "interests"), where("workspaceId", "==", workspaceId), where("contactId", "==", selectedContactId), limit(100));
    const installedQuery = query(collection(db, "installed_base"), where("workspaceId", "==", workspaceId), where("contactId", "==", selectedContactId), limit(100));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CrmEvent)).sort((left, right) => timestampToMillis(right.occurredAt) - timestampToMillis(left.occurredAt))), () => setError("Não foi possível carregar o histórico do contato."));
    const unsubscribeInterests = onSnapshot(interestsQuery, (snapshot) => setInterestLinks(snapshot.docs.map((item) => ({ id: item.id, relationType: "interest", ...item.data() } as EquipmentLink))), () => setError("Não foi possível carregar os interesses do contato."));
    const unsubscribeInstalled = onSnapshot(installedQuery, (snapshot) => setInstalledLinks(snapshot.docs.map((item) => ({ id: item.id, relationType: "installed", ...item.data() } as EquipmentLink))), () => setError("Não foi possível carregar os equipamentos instalados."));
    return () => { unsubscribeEvents(); unsubscribeInterests(); unsubscribeInstalled(); };
  }, [selectedContactId, workspaceId]);

  const groupedCompanies = useMemo(() => companies.map((company) => ({ ...company, contacts: contacts.filter((contact) => contact.companyId === company.id) })), [companies, contacts]);
  const openContact = (contactId: string, tab = "contacts") => { if (contactId !== selectedContactId) { setAudioAttachment(null); setAudioResetKey((current) => current + 1); setInteractionForm({ ...EMPTY_INTERACTION, occurredAt: new Date().toISOString().slice(0, 16) }); setEquipmentForm(EMPTY_EQUIPMENT); } setSelectedContactId(contactId); setActiveTab(tab); };

  const handleContactSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !contactForm.companyName.trim() || !contactForm.name.trim()) { setError("Informe ao menos a empresa e o nome do contato."); return; }
    setSavingContact(true); setError(null);
    try {
      const normalizedName = normalizeOptionValue(contactForm.companyName.trim());
      const existingCompany = (contactForm.companyId && companies.find((company) => company.id === contactForm.companyId)) || companies.find((company) => normalizeOptionValue(String(company.name || "").trim()) === normalizedName);
      const phoneDigits = normalizePhoneDigits(contactForm.phoneNumber);
      const companyId = existingCompany?.id || (await addDoc(collection(db, "accounts"), { type: "account", name: contactForm.companyName.trim(), sector: contactForm.companySector.trim() || null, locality: contactForm.companyLocality.trim() || contactForm.locality.trim() || null, workspaceId, ownerId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })).id;
      const newContact = await addDoc(collection(db, "contacts"), { type: "contact", companyId, workspaceId, ownerId: user.uid, name: contactForm.name.trim(), displayName: contactForm.name.trim(), role: contactForm.role.trim() || null, sector: contactForm.sector.trim() || contactForm.companySector.trim() || null, email: contactForm.email.trim() || null, phoneNumber: contactForm.phoneNumber.trim() || null, phoneDigits: phoneDigits || null, whatsappRemoteJid: buildWhatsappRemoteJid(contactForm.phoneNumber), locality: contactForm.locality.trim() || contactForm.companyLocality.trim() || null, notes: contactForm.notes.trim() || null, status: "active", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      setContactForm(EMPTY_CONTACT); setAudioAttachment(null); setAudioResetKey((current) => current + 1); setSelectedContactId(newContact.id); setActiveTab("contacts");
    } catch { setError("Não foi possível salvar o contato. Tente novamente."); } finally { setSavingContact(false); }
  };

  const handleInteractionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !selectedContact || (!interactionForm.summary.trim() && !audioAttachment)) { setError("Selecione um contato e descreva a interação ou anexe um áudio."); return; }
    const occurredAt = new Date(interactionForm.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) { setError("Informe uma data válida para a interação."); return; }
    setSavingInteraction(true); setError(null);
    let uploadedAudioRef: ReturnType<typeof storageRef> | null = null;
    try {
      let audioAnalysis: CrmAiAnalysis | null = null;
      let audioUrl: string | null = null;
      let audioStoragePath: string | null = null;
      if (audioAttachment) {
        if (!storage) throw new Error("O armazenamento de áudio ainda não está disponível.");
        const base64Audio = await readBlobAsBase64(audioAttachment.blob);
        const result = await extractCrmInteractionFromAudio(base64Audio, audioAttachment.mimeType, { contactName: selectedContact.displayName || selectedContact.name, companyName: selectedCompany?.name, role: selectedContact.role, sector: selectedContact.sector });
        audioAnalysis = cleanAudioAnalysis(result);
        const fileId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        audioStoragePath = `crm_audio/${safeStorageSegment(workspaceId)}/${safeStorageSegment(selectedContact.id)}/${fileId}.${getCrmAudioExtension(audioAttachment.mimeType, audioAttachment.name)}`;
        uploadedAudioRef = storageRef(storage, audioStoragePath);
        await uploadBytes(uploadedAudioRef, audioAttachment.blob, { contentType: audioAttachment.mimeType, customMetadata: { workspaceId, contactId: selectedContact.id, source: "crm_interaction" } });
        audioUrl = await getDownloadURL(uploadedAudioRef);
      }
      const manualNextContactAt = interactionForm.nextContactAt ? new Date(interactionForm.nextContactAt) : null;
      const aiNextContactAt = parseOptionalDate(audioAnalysis?.nextContactAt);
      const nextContactAt = manualNextContactAt && !Number.isNaN(manualNextContactAt.getTime()) ? manualNextContactAt : aiNextContactAt || new Date(occurredAt.getTime() + (10 * 24 * 60 * 60 * 1000));
      const summary = interactionForm.summary.trim() || valueOrNull(audioAnalysis?.summary) || "Mensagem de áudio registrada.";
      const extracted = audioAnalysis?.contactUpdates || {};
      const contactUpdate: Record<string, unknown> = { lastContactAt: occurredAt, nextContactAt, nextContactSource: manualNextContactAt ? "manual" : aiNextContactAt ? "ai" : "manual", followUpStatus: "green", updatedAt: serverTimestamp() };
      const role = valueOrNull(extracted.role); const sector = valueOrNull(extracted.sector); const locality = valueOrNull(extracted.locality); const email = valueOrNull(extracted.email); const phoneNumber = valueOrNull(extracted.phoneNumber);
      if (role) contactUpdate.role = role;
      if (sector) contactUpdate.sector = sector;
      if (locality) contactUpdate.locality = locality;
      if (email) contactUpdate.email = email;
      if (phoneNumber) { contactUpdate.phoneNumber = phoneNumber; contactUpdate.phoneDigits = normalizePhoneDigits(phoneNumber) || null; contactUpdate.whatsappRemoteJid = buildWhatsappRemoteJid(phoneNumber); }
      const notes = valueOrNull(extracted.notesAppend); if (notes) contactUpdate.notes = mergeCrmNotes(selectedContact.notes, notes);
      const eventRef = doc(collection(db, "crm_events"));
      const batch = writeBatch(db);
      batch.set(eventRef, { type: "crm_event", eventType: "contact_interaction", source: audioAttachment ? "manual_audio" : "manual", channelType: interactionForm.channelType, summary, transcript: audioAnalysis?.transcript || null, audioUrl, audioStoragePath, audioName: audioAttachment?.name || null, audioMimeType: audioAttachment?.mimeType || null, audioSizeBytes: audioAttachment?.blob.size || null, aiStatus: audioAnalysis ? "completed" : null, aiAnalysis: audioAnalysis ? { confidence: audioAnalysis.confidence ?? null, contactUpdates: audioAnalysis.contactUpdates || null, opportunities: audioAnalysis.opportunities || [], tasks: audioAnalysis.tasks || [], equipmentLinks: audioAnalysis.equipmentLinks || [], aiModel: audioAnalysis.aiModel || null } : null, occurredAt, nextContactAt, contactId: selectedContact.id, companyId: selectedContact.companyId || null, workspaceId, ownerId: user.uid, actorUserId: user.uid, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      batch.update(doc(db, "contacts", selectedContact.id), contactUpdate);
      await batch.commit();
      setInteractionForm({ ...EMPTY_INTERACTION, occurredAt: new Date().toISOString().slice(0, 16) }); setAudioAttachment(null); setAudioResetKey((current) => current + 1);
    } catch (cause) { if (uploadedAudioRef) await deleteObject(uploadedAudioRef).catch(() => undefined); setError(cause instanceof Error && cause.message.includes("armazenamento") ? cause.message : "Não foi possível analisar ou registrar a interação. Verifique o áudio e tente novamente."); } finally { setSavingInteraction(false); }
  };

  const handleEquipmentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !selectedContact || (!equipmentForm.catalogItemId && !equipmentForm.model.trim() && !equipmentForm.brand.trim())) { setError("Informe um equipamento do catálogo ou preencha marca/modelo."); return; }
    setSavingEquipment(true); setError(null);
    try {
      const selectedCatalogItem = catalogItems.find((item) => item.id === equipmentForm.catalogItemId);
      const targetCollection = equipmentForm.relationType === "installed" ? "installed_base" : "interests";
      await addDoc(collection(db, targetCollection), { type: targetCollection === "installed_base" ? "installed_base_item" : "interest", relationType: equipmentForm.relationType, contactId: selectedContact.id, companyId: selectedContact.companyId || null, workspaceId, ownerId: user.uid, catalogItemId: selectedCatalogItem?.id || null, equipmentType: equipmentForm.equipmentType.trim() || selectedCatalogItem?.itemType || null, brand: equipmentForm.brand.trim() || selectedCatalogItem?.brand || null, model: equipmentForm.model.trim() || selectedCatalogItem?.model || null, status: selectedCatalogItem ? "confirmed" : "pending_catalog", source: "manual", createdAt: serverTimestamp() });
      setEquipmentForm(EMPTY_EQUIPMENT);
    } catch { setError("Não foi possível vincular o equipamento."); } finally { setSavingEquipment(false); }
  };

  const changeInteractionForm = (patch: Partial<InteractionFormState>) => setInteractionForm((current) => ({ ...current, ...patch }));

  return <div className="min-h-full bg-[#0e0e0e] pb-20 text-[#e7e5e5]"><div className="border-b border-[#484848]/20 bg-[#0e0e0e] px-4 py-8 md:px-6 md:py-10"><div className="mx-auto max-w-6xl"><div className="mb-4 flex items-center gap-2"><Building2 size={15} className="text-[#97a5ff]" /><span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#acabaa]/50">AMBIENTE_CRM / CENTRAL_DE_RELACIONAMENTO</span></div><div className="flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><h1 className="font-display text-3xl font-normal uppercase tracking-tight md:text-4xl">Relacionamento <span className="text-[#acabaa]/30">e contatos</span></h1><p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#acabaa]/60">Uma área para cadastrar, acompanhar e agir sobre cada contato — com o histórico no lugar certo.</p></div><div className="flex items-center gap-2 border border-[#484848]/25 bg-[#131313] px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/50"><Users size={13} className="text-[#97a5ff]" /> {contacts.length} contatos ativos</div></div></div></div><div className="mx-auto max-w-6xl px-4 py-6 md:px-6"><div className="mb-6 grid gap-px border border-[#484848]/20 bg-[#484848]/20 sm:grid-cols-2 xl:grid-cols-4"><div className="bg-[#131313] p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Empresas</p><p className="mt-2 text-2xl text-[#e7e5e5]">{companies.length}</p></div><div className="bg-[#131313] p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Contatos</p><p className="mt-2 text-2xl text-[#e7e5e5]">{contacts.length}</p></div><div className="bg-[#131313] p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Acompanhamentos</p><p className={`mt-2 text-2xl ${overdueContacts.length ? "text-[#ee7d77]" : "text-[#acc3ce]"}`}>{overdueContacts.length}</p><p className="mt-1 text-[10px] text-[#acabaa]/45">contatos atrasados</p></div><div className="bg-[#131313] p-4"><p className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Contato em foco</p><p className="mt-2 truncate text-sm text-[#e7e5e5]">{selectedContact?.displayName || selectedContact?.name || "Nenhum"}</p><p className="mt-1 text-[10px] text-[#acabaa]/45">{selectedContact ? formatDate(selectedContact.lastContactAt) : "Escolha na base"}</p></div></div><Tabs value={activeTab} onValueChange={setActiveTab} className="w-full"><TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-1 rounded-none border-b border-[#484848]/25 bg-transparent p-0"><TabsTrigger value="overview" className="h-10 flex-none rounded-none border-b-2 border-transparent px-3 text-[10px] uppercase tracking-widest text-[#acabaa]/60 data-[state=active]:border-[#97a5ff] data-[state=active]:bg-[#97a5ff]/[0.06] data-[state=active]:text-[#e7e5e5]"><LayoutDashboard size={14} /> Visão geral</TabsTrigger><TabsTrigger value="new-contact" className="h-10 flex-none rounded-none border-b-2 border-transparent px-3 text-[10px] uppercase tracking-widest text-[#acabaa]/60 data-[state=active]:border-[#97a5ff] data-[state=active]:bg-[#97a5ff]/[0.06] data-[state=active]:text-[#e7e5e5]"><Plus size={14} /> Novo contato</TabsTrigger><TabsTrigger value="contacts" className="h-10 flex-none rounded-none border-b-2 border-transparent px-3 text-[10px] uppercase tracking-widest text-[#acabaa]/60 data-[state=active]:border-[#97a5ff] data-[state=active]:bg-[#97a5ff]/[0.06] data-[state=active]:text-[#e7e5e5]"><Users size={14} /> Empresas e contatos</TabsTrigger><TabsTrigger value="history" className="h-10 flex-none rounded-none border-b-2 border-transparent px-3 text-[10px] uppercase tracking-widest text-[#acabaa]/60 data-[state=active]:border-[#97a5ff] data-[state=active]:bg-[#e7e5e5]/[0.06] data-[state=active]:text-[#e7e5e5]"><History size={14} /> Histórico e ações</TabsTrigger></TabsList><TabsContent value="overview" className="mt-6"><div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]"><Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-5 py-5"><CardTitle className="font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60">Próximos acompanhamentos</CardTitle></CardHeader><CardContent className="p-0">{upcomingContacts.length === 0 ? <div className="p-6 text-sm text-[#acabaa]/55">Nenhum próximo contato agendado.</div> : <div className="divide-y divide-[#484848]/15">{upcomingContacts.map((contact) => <button key={contact.id} type="button" onClick={() => openContact(contact.id, "history")} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-[#1a1a1a]"><span className="min-w-0"><span className="block truncate text-sm text-[#e7e5e5]">{contact.displayName || contact.name}</span><span className="mt-1 block truncate text-xs text-[#acabaa]/50">{companies.find((company) => company.id === contact.companyId)?.name || "Empresa não vinculada"}</span></span><span className="shrink-0 text-right"><span className="block font-mono text-[10px] text-[#acc3ce]">{formatDate(contact.nextContactAt)}</span><ArrowRight size={14} className="ml-auto mt-2 text-[#97a5ff]" /></span></button>)}</div>}</CardContent></Card><div className="space-y-4"><Card className="rounded-none border-[#97a5ff]/25 bg-[#131313] shadow-none"><CardContent className="p-5"><div className="flex items-start gap-3"><Sparkles size={18} className="mt-0.5 text-[#97a5ff]" /><div><p className="text-sm text-[#e7e5e5]">Fluxo recomendado</p><p className="mt-2 text-xs leading-relaxed text-[#acabaa]/60">Cadastre o contato, selecione-o na base e registre a próxima ligação, reunião ou mensagem. O histórico fica separado da operação diária.</p></div></div><Button type="button" onClick={() => setActiveTab("new-contact")} className="mt-5 h-9 w-full rounded-none bg-[#e7e5e5] text-xs text-[#0e0e0e] hover:bg-[#c6c6c7]"><Plus size={14} /> Cadastrar contato</Button></CardContent></Card><Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardContent className="p-5"><p className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/45">Atenção operacional</p><p className="mt-2 text-sm text-[#e7e5e5]">{overdueContacts.length ? `${overdueContacts.length} contato(s) precisam de acompanhamento.` : "Tudo em dia por enquanto."}</p><Button type="button" onClick={() => setActiveTab("contacts")} variant="outline" className="mt-4 h-9 rounded-none border-[#484848]/40 bg-transparent text-xs hover:bg-[#1a1a1a]">Ver base de contatos <ArrowRight size={14} /></Button></CardContent></Card></div></div></TabsContent><TabsContent value="new-contact" className="mt-6"><div className="mx-auto max-w-3xl"><ContactFormCard form={contactForm} setForm={setContactForm} companyOptions={companyOptions} contactNameOptions={contactNameOptions} roleOptions={roleOptions} sectorOptions={sectorOptions} localityOptions={localityOptions} saving={savingContact} onSubmit={handleContactSubmit} /></div></TabsContent><TabsContent value="contacts" className="mt-6"><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]"><ContactDirectory groupedCompanies={groupedCompanies} selectedContactId={selectedContactId} onSelect={(contactId) => openContact(contactId, "contacts")} />{selectedContact ? <ContactSummaryCard contact={selectedContact} company={selectedCompany} onOpenHistory={() => setActiveTab("history")} /> : <ContactEmptyState onOpenContacts={() => setActiveTab("contacts")} />}</div></TabsContent><TabsContent value="history" className="mt-6">{!selectedContact ? <ContactEmptyState onOpenContacts={() => setActiveTab("contacts")} /> : <div className="space-y-6"><ContactSummaryCard contact={selectedContact} company={selectedCompany} /><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.82fr)]"><div className="space-y-6"><InteractionComposer contact={selectedContact} form={interactionForm} onChange={changeInteractionForm} onSubmit={handleInteractionSubmit} audioAttachment={audioAttachment} onAudioReady={setAudioAttachment} onAudioError={setError} audioResetKey={audioResetKey} saving={savingInteraction} /><TimelineCard events={events} /></div><EquipmentCard catalogItems={catalogItems} equipmentLinks={equipmentLinks} form={equipmentForm} setForm={setEquipmentForm} equipmentTypeOptions={equipmentTypeOptions} equipmentBrandOptions={equipmentBrandOptions} equipmentModelOptions={equipmentModelOptions} saving={savingEquipment} onSubmit={handleEquipmentSubmit} /></div></div>}</TabsContent></Tabs></div>{error && <div role="alert" className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border border-[#ee7d77]/30 bg-[#1a1a1a] px-4 py-3 text-xs text-[#ee7d77]">{error}</div>}</div>;
}
