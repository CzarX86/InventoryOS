import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, CalendarClock, Check, History, Loader2, PackageSearch, Plus, UserRound } from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { db as firebaseDb } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CRM_CHANNEL_LABELS } from "@/lib/uiText";

const db = firebaseDb as unknown as Firestore | undefined;

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

type CrmEvent = {
  id: string;
  eventType?: string | null;
  channelType?: string | null;
  summary?: string | null;
  source?: string | null;
  occurredAt?: unknown;
  nextContactAt?: unknown;
};

type EquipmentLink = {
  id: string;
  relationType?: string | null;
  equipmentType?: string | null;
  brand?: string | null;
  model?: string | null;
  status?: string | null;
  catalogItemId?: string | null;
};

const EMPTY_CONTACT = {
  companyName: "",
  companySector: "",
  companyLocality: "",
  name: "",
  role: "",
  sector: "",
  email: "",
  phoneNumber: "",
  whatsappRemoteJid: "",
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

function timestampToMillis(value: unknown) {
  if (typeof (value as { toMillis?: () => number })?.toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof (value as { toDate?: () => Date })?.toDate === "function") {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  const date = new Date(String(value || ""));
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatDate(value: unknown) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Ainda não registrado";
}

function toDateInputValue(value: unknown) {
  const millis = timestampToMillis(value);
  return millis ? new Date(millis).toISOString().slice(0, 16) : "";
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
  return channelType
    ? (CRM_CHANNEL_LABELS as Record<string, string>)[channelType] || channelType
    : "OUTRO";
}

export default function CrmView({ user }: { user: CrmUser }) {
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT);
  const [interactionForm, setInteractionForm] = useState(EMPTY_INTERACTION);
  const [equipmentForm, setEquipmentForm] = useState(EMPTY_EQUIPMENT);
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [equipmentLinks, setEquipmentLinks] = useState<EquipmentLink[]>([]);
  const [savingContact, setSavingContact] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) || null;

  useEffect(() => {
    if (!db || !workspaceId) return undefined;
    const companyQuery = query(collection(db, "accounts"), where("workspaceId", "==", workspaceId), limit(200));
    const contactQuery = query(collection(db, "contacts"), where("workspaceId", "==", workspaceId), limit(500));
    const catalogQuery = query(collection(db, "catalog_items"), where("workspaceId", "==", workspaceId), limit(300));
    const unsubscribeCompanies = onSnapshot(companyQuery, (snapshot) => {
      setCompanies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Company)).sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "pt-BR")));
    }, () => setError("Não foi possível carregar as empresas."));
    const unsubscribeContacts = onSnapshot(contactQuery, (snapshot) => {
      const nextContacts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Contact));
      setContacts(nextContacts);
      setSelectedContactId((current) => current && nextContacts.some((contact) => contact.id === current) ? current : nextContacts[0]?.id || null);
    }, () => setError("Não foi possível carregar os contatos."));
    const unsubscribeCatalog = onSnapshot(catalogQuery, (snapshot) => {
      setCatalogItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CatalogItem)));
    }, () => setError("Não foi possível carregar o catálogo de equipamentos."));
    return () => {
      unsubscribeCompanies();
      unsubscribeContacts();
      unsubscribeCatalog();
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!db || !selectedContactId || !workspaceId) {
      setEvents([]);
      setEquipmentLinks([]);
      return undefined;
    }
    const eventsQuery = query(collection(db, "crm_events"), where("workspaceId", "==", workspaceId), where("contactId", "==", selectedContactId), limit(100));
    const interestsQuery = query(collection(db, "interests"), where("workspaceId", "==", workspaceId), where("contactId", "==", selectedContactId), limit(100));
    const installedQuery = query(collection(db, "installed_base"), where("workspaceId", "==", workspaceId), where("contactId", "==", selectedContactId), limit(100));
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CrmEvent)).sort((left, right) => timestampToMillis(right.occurredAt) - timestampToMillis(left.occurredAt)));
    }, () => setError("Não foi possível carregar o histórico do contato."));
    const unsubscribeInterests = onSnapshot(interestsQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, relationType: "interest", ...item.data() } as EquipmentLink));
      setEquipmentLinks((current) => [...items, ...current.filter((item) => item.relationType === "installed")]);
    });
    const unsubscribeInstalled = onSnapshot(installedQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, relationType: "installed", ...item.data() } as EquipmentLink));
      setEquipmentLinks((current) => [...current.filter((item) => item.relationType === "interest"), ...items]);
    });
    return () => {
      unsubscribeEvents();
      unsubscribeInterests();
      unsubscribeInstalled();
    };
  }, [selectedContactId, workspaceId]);

  const groupedCompanies = useMemo(() => companies.map((company) => ({
    ...company,
    contacts: contacts.filter((contact) => contact.companyId === company.id),
  })), [companies, contacts]);

  const handleContactSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !contactForm.companyName.trim() || !contactForm.name.trim()) {
      setError("Informe ao menos a empresa e o nome do contato.");
      return;
    }
    setSavingContact(true);
    setError(null);
    try {
      const normalizedName = contactForm.companyName.trim().toLowerCase();
      const existingCompany = companies.find((company) => String(company.name || "").trim().toLowerCase() === normalizedName);
      const companyId = existingCompany?.id || (await addDoc(collection(db, "accounts"), {
        type: "account",
        name: contactForm.companyName.trim(),
        sector: contactForm.companySector.trim() || null,
        locality: contactForm.companyLocality.trim() || contactForm.locality.trim() || null,
        workspaceId,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })).id;
      await addDoc(collection(db, "contacts"), {
        type: "contact",
        companyId,
        workspaceId,
        ownerId: user.uid,
        name: contactForm.name.trim(),
        displayName: contactForm.name.trim(),
        role: contactForm.role.trim() || null,
        sector: contactForm.sector.trim() || contactForm.companySector.trim() || null,
        email: contactForm.email.trim() || null,
        phoneNumber: contactForm.phoneNumber.trim() || null,
        phoneDigits: contactForm.phoneNumber.replace(/\D/g, "") || null,
        whatsappRemoteJid: contactForm.whatsappRemoteJid.trim() || null,
        locality: contactForm.locality.trim() || contactForm.companyLocality.trim() || null,
        notes: contactForm.notes.trim() || null,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setContactForm(EMPTY_CONTACT);
    } catch {
      setError("Não foi possível salvar o contato. Tente novamente.");
    } finally {
      setSavingContact(false);
    }
  };

  const handleInteractionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !selectedContact || !interactionForm.summary.trim()) {
      setError("Selecione um contato e descreva a interação.");
      return;
    }
    setSavingInteraction(true);
    setError(null);
    try {
      const occurredAt = new Date(interactionForm.occurredAt);
      const nextContactAt = interactionForm.nextContactAt
        ? new Date(interactionForm.nextContactAt)
        : new Date(occurredAt.getTime() + (10 * 24 * 60 * 60 * 1000));
      await addDoc(collection(db, "crm_events"), {
        type: "crm_event",
        eventType: "contact_interaction",
        source: "manual",
        channelType: interactionForm.channelType,
        summary: interactionForm.summary.trim(),
        occurredAt,
        nextContactAt,
        contactId: selectedContact.id,
        companyId: selectedContact.companyId || null,
        workspaceId,
        ownerId: user.uid,
        actorUserId: user.uid,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "contacts", selectedContact.id), {
        lastContactAt: occurredAt,
        nextContactAt,
        nextContactSource: "manual",
        followUpStatus: "green",
        updatedAt: serverTimestamp(),
      });
      setInteractionForm({ ...EMPTY_INTERACTION, occurredAt: new Date().toISOString().slice(0, 16) });
    } catch {
      setError("Não foi possível registrar a interação.");
    } finally {
      setSavingInteraction(false);
    }
  };

  const handleEquipmentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !selectedContact || (!equipmentForm.catalogItemId && !equipmentForm.model.trim() && !equipmentForm.brand.trim())) {
      setError("Informe um equipamento do catálogo ou preencha marca/modelo.");
      return;
    }
    setSavingEquipment(true);
    setError(null);
    try {
      const selectedCatalogItem = catalogItems.find((item) => item.id === equipmentForm.catalogItemId);
      const targetCollection = equipmentForm.relationType === "installed" ? "installed_base" : "interests";
      await addDoc(collection(db, targetCollection), {
        type: targetCollection === "installed_base" ? "installed_base_item" : "interest",
        relationType: equipmentForm.relationType,
        contactId: selectedContact.id,
        companyId: selectedContact.companyId || null,
        workspaceId,
        ownerId: user.uid,
        catalogItemId: selectedCatalogItem?.id || null,
        equipmentType: equipmentForm.equipmentType.trim() || selectedCatalogItem?.itemType || null,
        brand: equipmentForm.brand.trim() || selectedCatalogItem?.brand || null,
        model: equipmentForm.model.trim() || selectedCatalogItem?.model || null,
        status: selectedCatalogItem ? "confirmed" : "pending_catalog",
        source: "manual",
        createdAt: serverTimestamp(),
      });
      setEquipmentForm(EMPTY_EQUIPMENT);
    } catch {
      setError("Não foi possível vincular o equipamento.");
    } finally {
      setSavingEquipment(false);
    }
  };

  return (
    <div className="min-h-full bg-[#0e0e0e] pb-20 text-[#e7e5e5]">
      <div className="border-b border-[#484848]/20 bg-[#0e0e0e] px-4 py-10 md:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center gap-2"><Building2 size={15} className="text-[#97a5ff]" /><span className="font-mono text-[9px] uppercase tracking-[0.25em] text-[#acabaa]/50">AMBIENTE_CRM</span></div>
          <h1 className="font-display text-3xl font-normal uppercase tracking-tight">Relacionamento <span className="text-[#acabaa]/30">e contatos</span></h1>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#acabaa]/60">Empresas, responsáveis, histórico de contato e equipamentos em um único lugar.</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:px-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
            <CardHeader className="border-b border-[#484848]/20 px-4 py-4"><CardTitle className="flex items-center gap-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60"><Plus size={14} className="text-[#97a5ff]" /> Novo contato</CardTitle></CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleContactSubmit} noValidate className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2"><Label htmlFor="companyName">Empresa</Label><Input id="companyName" value={contactForm.companyName} onChange={(event) => setContactForm({ ...contactForm, companyName: event.target.value })} className={fieldClassName()} placeholder="Nome da empresa" /></div>
                <div><Label htmlFor="contactName">Responsável</Label><Input id="contactName" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} className={fieldClassName()} placeholder="Nome do contato" /></div>
                <div><Label htmlFor="contactRole">Função</Label><Input id="contactRole" value={contactForm.role} onChange={(event) => setContactForm({ ...contactForm, role: event.target.value })} className={fieldClassName()} placeholder="Compras, manutenção..." /></div>
                <div><Label htmlFor="contactSector">Setor</Label><Input id="contactSector" value={contactForm.sector} onChange={(event) => setContactForm({ ...contactForm, sector: event.target.value })} className={fieldClassName()} placeholder="Setor da empresa" /></div>
                <div><Label htmlFor="contactLocality">Localidade</Label><Input id="contactLocality" value={contactForm.locality} onChange={(event) => setContactForm({ ...contactForm, locality: event.target.value })} className={fieldClassName()} placeholder="Cidade / UF" /></div>
                <div><Label htmlFor="contactEmail">E-mail</Label><Input id="contactEmail" type="email" value={contactForm.email} onChange={(event) => setContactForm({ ...contactForm, email: event.target.value })} className={fieldClassName()} placeholder="contato@empresa.com" /></div>
                <div><Label htmlFor="contactPhone">Telefone</Label><Input id="contactPhone" type="tel" value={contactForm.phoneNumber} onChange={(event) => setContactForm({ ...contactForm, phoneNumber: event.target.value })} className={fieldClassName()} placeholder="(00) 00000-0000" /></div>
                <div><Label htmlFor="contactWhatsappRemoteJid">ID WhatsApp</Label><Input id="contactWhatsappRemoteJid" value={contactForm.whatsappRemoteJid} onChange={(event) => setContactForm({ ...contactForm, whatsappRemoteJid: event.target.value })} className={fieldClassName()} placeholder="5511999999999@s.whatsapp.net" /><p className="mt-1 font-mono text-[9px] text-[#acabaa]/40">Opcional · conecta o histórico automático.</p></div>
                <div className="md:col-span-2"><Label htmlFor="contactNotes">Observação</Label><Textarea id="contactNotes" value={contactForm.notes} onChange={(event) => setContactForm({ ...contactForm, notes: event.target.value })} className={`${fieldClassName()} min-h-20 resize-none`} placeholder="Contexto inicial do contato" /></div>
                <Button type="submit" disabled={savingContact} className="rounded-none bg-[#e7e5e5] text-[#0e0e0e] hover:bg-[#c6c6c7] md:col-span-2">{savingContact ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Salvar contato</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
            <CardHeader className="border-b border-[#484848]/20 px-4 py-4"><CardTitle className="flex items-center gap-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60"><Building2 size={14} className="text-[#97a5ff]" /> Empresas e contatos</CardTitle></CardHeader>
            <CardContent className="p-0">
              {groupedCompanies.length === 0 && <p className="px-4 py-10 text-center text-xs text-[#acabaa]/60">Nenhum contato cadastrado ainda.</p>}
              <div className="divide-y divide-[#484848]/15">
                {groupedCompanies.map((company) => (
                  <div key={company.id} className="px-4 py-4">
                    <div className="mb-3 flex items-center justify-between"><div><p className="text-sm text-[#e7e5e5]">{company.name || "Empresa sem nome"}</p><p className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/40">{company.sector || "Setor não informado"} · {company.locality || "Localidade não informada"}</p></div><Badge variant="outline" className="rounded-none border-[#484848]/30 text-[9px] text-[#acabaa]/70">{company.contacts.length}</Badge></div>
                    {company.contacts.length === 0 ? <p className="text-xs text-[#acabaa]/40">Sem responsáveis cadastrados.</p> : <div className="space-y-1">{company.contacts.map((contact) => { const state = followUpState(contact); return <button key={contact.id} type="button" onClick={() => setSelectedContactId(contact.id)} className={`flex w-full items-center justify-between gap-3 border px-3 py-3 text-left transition-colors hover:bg-[#1a1a1a] ${selectedContactId === contact.id ? "border-[#97a5ff]/40 bg-[#97a5ff]/[0.06]" : "border-transparent bg-[#0e0e0e]"}`}><span className="min-w-0"><span className="block truncate text-sm text-[#e7e5e5]">{contact.displayName || contact.name}</span><span className="block truncate font-mono text-[10px] text-[#acabaa]/50">{contact.role || "Função não informada"}</span></span><Badge variant="outline" className={`shrink-0 rounded-none text-[8px] uppercase tracking-widest ${state.className}`}>{state.label}</Badge></button>; })}</div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {!selectedContact ? (
            <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-6 text-center"><UserRound size={24} className="text-[#acabaa]/40" /><p className="text-sm text-[#acabaa]/70">Selecione um contato para ver o histórico.</p></CardContent></Card>
          ) : (
            <>
              <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none">
                <CardHeader className="border-b border-[#484848]/20 px-4 py-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="font-display text-xl font-normal uppercase tracking-tight">{selectedContact.displayName || selectedContact.name}</CardTitle><p className="mt-1 text-xs text-[#acabaa]/60">{companies.find((company) => company.id === selectedContact.companyId)?.name || "Empresa não vinculada"} · {selectedContact.role || "Função não informada"}</p></div><Badge variant="outline" className={`rounded-none text-[8px] uppercase tracking-widest ${followUpState(selectedContact).className}`}>{followUpState(selectedContact).label}</Badge></div></CardHeader>
                <CardContent className="grid gap-3 p-4 text-xs text-[#acabaa]/70 sm:grid-cols-2"><p><span className="block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">E-mail</span>{selectedContact.email || "—"}</p><p><span className="block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Telefone</span>{selectedContact.phoneNumber || "—"}</p><p><span className="block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Último contato</span>{formatDate(selectedContact.lastContactAt)}</p><p><span className="block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Próximo contato</span>{formatDate(selectedContact.nextContactAt)}{selectedContact.nextContactSource === "ai" && <span className="ml-2 text-[#97a5ff]">IA</span>}</p>{selectedContact.notes && <p className="sm:col-span-2"><span className="block font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/35">Observação</span>{selectedContact.notes}</p>}</CardContent>
              </Card>

              <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-4 py-4"><CardTitle className="flex items-center gap-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60"><History size={14} className="text-[#97a5ff]" /> Registrar interação</CardTitle></CardHeader><CardContent className="p-4"><form onSubmit={handleInteractionSubmit} noValidate className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="interactionChannel">Canal</Label><select id="interactionChannel" value={interactionForm.channelType} onChange={(event) => setInteractionForm({ ...interactionForm, channelType: event.target.value })} className={`${fieldClassName()} h-8 w-full px-2.5`}><option value="phone">Ligação</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="meeting">Reunião</option><option value="other">Outro</option></select></div><div><Label htmlFor="interactionDate">Quando</Label><Input id="interactionDate" type="datetime-local" value={interactionForm.occurredAt} onChange={(event) => setInteractionForm({ ...interactionForm, occurredAt: event.target.value })} className={fieldClassName()} /></div></div><div><Label htmlFor="nextContactAt">Próximo contato</Label><Input id="nextContactAt" type="datetime-local" value={interactionForm.nextContactAt} onChange={(event) => setInteractionForm({ ...interactionForm, nextContactAt: event.target.value })} className={fieldClassName()} /><p className="mt-1 font-mono text-[9px] text-[#acabaa]/40">Sem data: o sistema agenda o padrão de 10 dias.</p></div><div><Label htmlFor="interactionSummary">Resumo</Label><Textarea id="interactionSummary" value={interactionForm.summary} onChange={(event) => setInteractionForm({ ...interactionForm, summary: event.target.value })} className={`${fieldClassName()} min-h-24 resize-none`} placeholder="O que foi tratado e qual é a próxima ação?" /></div><Button type="submit" disabled={savingInteraction} className="w-full rounded-none bg-[#acc3ce] text-[#0e0e0e] hover:bg-[#c8d9df]">{savingInteraction ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Registrar interação</Button></form></CardContent></Card>

              <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-4 py-4"><CardTitle className="flex items-center gap-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60"><CalendarClock size={14} className="text-[#97a5ff]" /> Linha do tempo</CardTitle></CardHeader><CardContent className="p-4">{events.length === 0 ? <p className="text-xs text-[#acabaa]/50">Nenhuma interação registrada.</p> : <div className="space-y-4">{events.map((event) => <div key={event.id} className="border-l border-[#97a5ff]/30 pl-4"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-none border-[#484848]/30 text-[8px] uppercase tracking-widest">{channelLabel(event.channelType)}</Badge><span className="font-mono text-[9px] text-[#acabaa]/40">{formatDate(event.occurredAt)}</span></div><p className="mt-2 text-xs leading-relaxed text-[#e7e5e5]">{event.summary}</p>{Boolean(event.nextContactAt) && <p className="mt-1 font-mono text-[9px] text-[#acabaa]/45">Próximo: {formatDate(event.nextContactAt)} {event.source === "whatsapp" ? "· WhatsApp" : ""}</p>}</div>)}</div>}</CardContent></Card>

              <Card className="rounded-none border-[#484848]/20 bg-[#131313] shadow-none"><CardHeader className="border-b border-[#484848]/20 px-4 py-4"><CardTitle className="flex items-center gap-2 font-mono text-[10px] font-normal uppercase tracking-[0.2em] text-[#acabaa]/60"><PackageSearch size={14} className="text-[#97a5ff]" /> Equipamentos vinculados</CardTitle></CardHeader><CardContent className="space-y-4 p-4"><form onSubmit={handleEquipmentSubmit} noValidate className="space-y-3"><div><Label htmlFor="equipmentRelation">Relação</Label><select id="equipmentRelation" value={equipmentForm.relationType} onChange={(event) => setEquipmentForm({ ...equipmentForm, relationType: event.target.value })} className={`${fieldClassName()} h-8 w-full px-2.5`}><option value="interest">Interesse comercial</option><option value="installed">Equipamento instalado</option></select></div><div><Label htmlFor="catalogItem">Item do catálogo</Label><select id="catalogItem" value={equipmentForm.catalogItemId} onChange={(event) => { const item = catalogItems.find((catalog) => catalog.id === event.target.value); setEquipmentForm({ ...equipmentForm, catalogItemId: event.target.value, equipmentType: item?.itemType || equipmentForm.equipmentType, brand: item?.brand || equipmentForm.brand, model: item?.model || equipmentForm.model }); }} className={`${fieldClassName()} h-8 w-full px-2.5`}><option value="">Não encontrado no catálogo</option>{catalogItems.map((item) => <option key={item.id} value={item.id}>{[item.itemType, item.brand, item.model].filter(Boolean).join(" · ") || item.id}</option>)}</select></div><div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="equipmentType">Tipo</Label><Input id="equipmentType" value={equipmentForm.equipmentType} onChange={(event) => setEquipmentForm({ ...equipmentForm, equipmentType: event.target.value })} className={fieldClassName()} placeholder="Sensor" /></div><div><Label htmlFor="equipmentBrand">Marca</Label><Input id="equipmentBrand" value={equipmentForm.brand} onChange={(event) => setEquipmentForm({ ...equipmentForm, brand: event.target.value })} className={fieldClassName()} placeholder="Marca" /></div><div><Label htmlFor="equipmentModel">Modelo</Label><Input id="equipmentModel" value={equipmentForm.model} onChange={(event) => setEquipmentForm({ ...equipmentForm, model: event.target.value })} className={fieldClassName()} placeholder="Modelo" /></div></div><Button type="submit" disabled={savingEquipment} variant="outline" className="w-full rounded-none">{savingEquipment ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Vincular equipamento</Button></form>{equipmentLinks.length > 0 && <div className="space-y-2 border-t border-[#484848]/15 pt-4">{equipmentLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-3 border border-[#484848]/20 bg-[#0e0e0e] px-3 py-3"><div className="min-w-0"><p className="truncate text-xs text-[#e7e5e5]">{[link.equipmentType, link.brand, link.model].filter(Boolean).join(" · ") || "Equipamento sem descrição"}</p><p className="font-mono text-[9px] uppercase tracking-widest text-[#acabaa]/40">{link.relationType === "installed" ? "Instalado" : "Interesse"}{link.status === "pending_catalog" ? " · Pendente de catálogo" : ""}</p></div><PackageSearch size={14} className="shrink-0 text-[#acabaa]/40" /></div>)}</div>}</CardContent></Card>
            </>
          )}
        </div>
      </div>
      {error && <div role="alert" className="fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 border border-[#ee7d77]/30 bg-[#1a1a1a] px-4 py-3 text-xs text-[#ee7d77]">{error}</div>}
    </div>
  );
}
