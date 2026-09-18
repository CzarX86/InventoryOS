import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  AtSign,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  History,
  Loader2,
  Mail,
  MapPin,
  PackageSearch,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import type { Firestore } from "firebase/firestore";
import { db as firebaseDb } from "@/lib/firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { filterCompanySuggestions, normalizePhoneDigits } from "@/lib/crmContacts";
import { cn } from "@/lib/utils";

const db = firebaseDb as unknown as Firestore | undefined;

type CrmUser = { uid?: string | null; workspaceId?: string | null; defaultAccountId?: string | null } | null;

type CompanyAddress = {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
};

type PhoneEntry = {
  label: string;
  value: string;
  hasWhatsapp: boolean;
};

type EmailEntry = {
  label: string;
  value: string;
};

type Company = {
  id: string;
  name?: string | null;
  sector?: string | null;
  locality?: string | null;
  address?: Partial<CompanyAddress> | null;
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
  emails?: EmailEntry[] | null;
  phoneNumber?: string | null;
  phoneNumbers?: PhoneEntry[] | null;
  phoneDigits?: string | null;
  phoneDigitsList?: string[] | null;
  whatsappPhoneDigits?: string[] | null;
  whatsappRemoteJid?: string | null;
  locality?: string | null;
  notes?: string | null;
  lastContactAt?: unknown;
  nextContactAt?: unknown;
  nextContactSource?: string | null;
};

type CatalogItem = { id: string; itemType?: string | null; brand?: string | null; model?: string | null };

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

type ContactFormState = {
  companyId: string;
  companyName: string;
  companySector: string;
  companyLocality: string;
  companyAddress: CompanyAddress;
  name: string;
  role: string;
  sector: string;
  locality: string;
  phones: PhoneEntry[];
  emails: EmailEntry[];
  notes: string;
};

type InteractionFormState = { channelType: string; occurredAt: string; nextContactAt: string; summary: string };
type EquipmentFormState = { relationType: string; catalogItemId: string; equipmentType: string; brand: string; model: string };
type StatusMessage = { tone: "success" | "error"; text: string } | null;

const EMPTY_ADDRESS: CompanyAddress = { street: "", number: "", complement: "", neighborhood: "", postalCode: "", city: "", state: "" };

function createEmptyContactForm(): ContactFormState {
  return {
    companyId: "",
    companyName: "",
    companySector: "",
    companyLocality: "",
    companyAddress: { ...EMPTY_ADDRESS },
    name: "",
    role: "",
    sector: "",
    locality: "",
    phones: [{ label: "Celular", value: "", hasWhatsapp: false }],
    emails: [{ label: "Principal", value: "" }],
    notes: "",
  };
}

function createEmptyInteraction(): InteractionFormState {
  return { channelType: "phone", occurredAt: new Date().toISOString().slice(0, 16), nextContactAt: "", summary: "" };
}

const EMPTY_EQUIPMENT: EquipmentFormState = { relationType: "interest", catalogItemId: "", equipmentType: "", brand: "", model: "" };

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

function formatAddress(address?: Partial<CompanyAddress> | null) {
  if (!address) return "Endereço ainda não informado";
  const firstLine = [address.street, address.number].filter(Boolean).join(", ");
  const secondLine = [address.neighborhood, address.city, address.state].filter(Boolean).join(" · ");
  return [firstLine, address.complement, secondLine, address.postalCode].filter(Boolean).join(" · ") || "Endereço ainda não informado";
}

function followUpState(contact: Contact) {
  const next = timestampToMillis(contact.nextContactAt);
  if (!next) return { label: "Sem próximo contato", className: "border-border text-muted-foreground" };
  if (next < Date.now()) return { label: "Follow-up atrasado", className: "border-red-200 bg-red-50 text-red-700" };
  return { label: "Em dia", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
}

function fieldClassName() {
  return "mt-2 h-10 rounded-lg border-border/80 bg-background text-sm text-foreground placeholder:text-muted-foreground/75";
}

function channelLabel(channel?: string | null) {
  return ({ phone: "Ligação", whatsapp: "WhatsApp", email: "E-mail", meeting: "Reunião", other: "Outro" } as Record<string, string>)[channel || "other"] || "Outro";
}

function contactPhones(contact: Contact): PhoneEntry[] {
  if (Array.isArray(contact.phoneNumbers) && contact.phoneNumbers.length) return contact.phoneNumbers;
  return contact.phoneNumber ? [{ label: "Principal", value: contact.phoneNumber, hasWhatsapp: Boolean(contact.whatsappPhoneDigits?.includes(normalizePhoneDigits(contact.phoneNumber))) }] : [];
}

function contactEmails(contact: Contact): EmailEntry[] {
  if (Array.isArray(contact.emails) && contact.emails.length) return contact.emails;
  return contact.email ? [{ label: "Principal", value: contact.email }] : [];
}

export default function CrmView({ user }: { user: CrmUser }) {
  const workspaceId = user?.workspaceId || user?.defaultAccountId || null;
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactForm, setContactForm] = useState<ContactFormState>(createEmptyContactForm);
  const [interactionForm, setInteractionForm] = useState<InteractionFormState>(createEmptyInteraction);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentFormState>(EMPTY_EQUIPMENT);
  const [events, setEvents] = useState<CrmEvent[]>([]);
  const [equipmentLinks, setEquipmentLinks] = useState<EquipmentLink[]>([]);
  const [savingContact, setSavingContact] = useState(false);
  const [savingInteraction, setSavingInteraction] = useState(false);
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<"overview" | "interactions" | "equipment">("overview");
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusMessage>(null);

  const selectedContact = contacts.find((contact) => contact.id === selectedContactId) || null;
  const selectedCompany = companies.find((company) => company.id === selectedContact?.companyId) || null;
  const companySuggestions = useMemo(() => filterCompanySuggestions(companies, contactForm.companyName), [companies, contactForm.companyName]);

  const visibleContacts = useMemo(() => {
    const term = contactSearch.trim().toLocaleLowerCase("pt-BR");
    return contacts
      .filter((contact) => {
        if (!term) return true;
        const company = companies.find((item) => item.id === contact.companyId);
        return [
          contact.displayName,
          contact.name,
          contact.email,
          contact.phoneNumber,
          contact.role,
          company?.name,
          ...contactEmails(contact).map((email) => email.value),
          ...contactPhones(contact).map((phone) => phone.value),
        ].filter(Boolean).some((value) => String(value).toLocaleLowerCase("pt-BR").includes(term));
      })
      .sort((left, right) => String(left.displayName || left.name || "").localeCompare(String(right.displayName || right.name || ""), "pt-BR"));
  }, [companies, contactSearch, contacts]);

  useEffect(() => {
    if (!db || !workspaceId) return undefined;
    const companyQuery = query(collection(db, "accounts"), where("workspaceId", "==", workspaceId), limit(200));
    const contactQuery = query(collection(db, "contacts"), where("workspaceId", "==", workspaceId), limit(500));
    const catalogQuery = query(collection(db, "catalog_items"), where("workspaceId", "==", workspaceId), limit(300));
    const unsubscribeCompanies = onSnapshot(companyQuery, (snapshot) => {
      setCompanies(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Company)).sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "pt-BR")));
    }, () => setStatus({ tone: "error", text: "Não foi possível carregar as empresas." }));
    const unsubscribeContacts = onSnapshot(contactQuery, (snapshot) => {
      const nextContacts = snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as Contact));
      setContacts(nextContacts);
      setSelectedContactId((current) => current && nextContacts.some((contact) => contact.id === current) ? current : nextContacts[0]?.id || null);
    }, () => setStatus({ tone: "error", text: "Não foi possível carregar os contatos." }));
    const unsubscribeCatalog = onSnapshot(catalogQuery, (snapshot) => {
      setCatalogItems(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CatalogItem)));
    }, () => setStatus({ tone: "error", text: "Não foi possível carregar o catálogo de equipamentos." }));
    return () => { unsubscribeCompanies(); unsubscribeContacts(); unsubscribeCatalog(); };
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
    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => setEvents(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as CrmEvent)).sort((left, right) => timestampToMillis(right.occurredAt) - timestampToMillis(left.occurredAt))), () => setStatus({ tone: "error", text: "Não foi possível carregar o histórico do contato." }));
    const unsubscribeInterests = onSnapshot(interestsQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, relationType: "interest", ...item.data() } as EquipmentLink));
      setEquipmentLinks((current) => [...items, ...current.filter((item) => item.relationType === "installed")]);
    });
    const unsubscribeInstalled = onSnapshot(installedQuery, (snapshot) => {
      const items = snapshot.docs.map((item) => ({ id: item.id, relationType: "installed", ...item.data() } as EquipmentLink));
      setEquipmentLinks((current) => [...current.filter((item) => item.relationType === "interest"), ...items]);
    });
    return () => { unsubscribeEvents(); unsubscribeInterests(); unsubscribeInstalled(); };
  }, [selectedContactId, workspaceId]);

  const selectContact = (contactId: string) => { setSelectedContactId(contactId); setDetailTab("overview"); setMobilePane("detail"); };
  const closeCreateDialog = () => { setCreateOpen(false); setFormError(null); setContactForm(createEmptyContactForm()); };

  const selectCompany = (company: Company) => {
    setContactForm((previous) => ({
      ...previous,
      companyId: company.id,
      companyName: company.name || "",
      companySector: company.sector || "",
      companyLocality: company.locality || company.address?.city || "",
      companyAddress: { ...EMPTY_ADDRESS, ...(company.address || {}) },
    }));
  };

  const updateAddress = (key: keyof CompanyAddress, value: string) => setContactForm((previous) => ({ ...previous, companyAddress: { ...previous.companyAddress, [key]: value } }));
  const updateCompanyCity = (value: string) => setContactForm((previous) => ({ ...previous, companyLocality: value, companyAddress: { ...previous.companyAddress, city: value } }));
  const updatePhone = (index: number, patch: Partial<PhoneEntry>) => setContactForm((previous) => ({ ...previous, phones: previous.phones.map((phone, phoneIndex) => phoneIndex === index ? { ...phone, ...patch } : phone) }));
  const updateEmail = (index: number, patch: Partial<EmailEntry>) => setContactForm((previous) => ({ ...previous, emails: previous.emails.map((email, emailIndex) => emailIndex === index ? { ...email, ...patch } : email) }));

  const handleContactSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const companyName = contactForm.companyName.trim();
    const contactName = contactForm.name.trim();
    if (!db || !user?.uid || !workspaceId || !companyName || !contactName) { setFormError("Informe a empresa e o nome do contato para continuar."); return; }
    setSavingContact(true);
    setFormError(null);
    setStatus(null);
    try {
      const normalizedName = companyName.toLocaleLowerCase("pt-BR");
      const existingCompany = contactForm.companyId ? companies.find((company) => company.id === contactForm.companyId) : companies.find((company) => String(company.name || "").trim().toLocaleLowerCase("pt-BR") === normalizedName);
      const companyId = existingCompany?.id || (await addDoc(collection(db, "accounts"), {
        type: "account",
        name: companyName,
        normalizedName,
        sector: contactForm.companySector.trim() || null,
        locality: contactForm.companyLocality.trim() || contactForm.companyAddress.city.trim() || null,
        address: Object.values(contactForm.companyAddress).some(Boolean) ? contactForm.companyAddress : null,
        workspaceId,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })).id;
      if (existingCompany) {
        await updateDoc(doc(db, "accounts", companyId), {
          sector: contactForm.companySector.trim() || null,
          locality: contactForm.companyLocality.trim() || contactForm.companyAddress.city.trim() || null,
          address: Object.values(contactForm.companyAddress).some(Boolean) ? contactForm.companyAddress : null,
          updatedAt: serverTimestamp(),
        });
      }

      const phones = contactForm.phones.filter((phone) => phone.value.trim()).map((phone) => ({ ...phone, value: phone.value.trim(), digits: normalizePhoneDigits(phone.value) }));
      const emails = contactForm.emails.filter((email) => email.value.trim()).map((email) => ({ ...email, value: email.value.trim() }));
      const phoneDigitsList = phones.map((phone) => phone.digits).filter(Boolean);
      const whatsappPhoneDigits = phones.filter((phone) => phone.hasWhatsapp).map((phone) => phone.digits).filter(Boolean);
      const contactRef = await addDoc(collection(db, "contacts"), {
        type: "contact",
        companyId,
        workspaceId,
        ownerId: user.uid,
        name: contactName,
        displayName: contactName,
        role: contactForm.role.trim() || null,
        sector: contactForm.sector.trim() || contactForm.companySector.trim() || null,
        email: emails[0]?.value || null,
        emails,
        phoneNumber: phones[0]?.value || null,
        phoneDigits: phoneDigitsList[0] || null,
        phoneDigitsList,
        phoneNumbers: phones,
        whatsappPhoneDigits,
        locality: contactForm.locality.trim() || contactForm.companyLocality.trim() || null,
        notes: contactForm.notes.trim() || null,
        status: "active",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await Promise.all([
        ...phones.map((phone, index) => addDoc(collection(db, "contact_channels"), { type: "contact_channel", accountId: companyId, companyId, contactId: contactRef.id, channelType: "phone", channelValue: phone.value, phoneDigits: phone.digits, hasWhatsapp: phone.hasWhatsapp, label: phone.label || "Telefone", isPrimary: index === 0, status: "active", workspaceId, ownerId: user.uid, createdAt: serverTimestamp() })),
        ...emails.map((email, index) => addDoc(collection(db, "contact_channels"), { type: "contact_channel", accountId: companyId, companyId, contactId: contactRef.id, channelType: "email", channelValue: email.value, label: email.label || "E-mail", isPrimary: index === 0, status: "active", workspaceId, ownerId: user.uid, createdAt: serverTimestamp() })),
      ]);

      const newContact = { id: contactRef.id, companyId, name: contactName, displayName: contactName, role: contactForm.role.trim() || null, sector: contactForm.sector.trim() || contactForm.companySector.trim() || null, email: emails[0]?.value || null, emails, phoneNumber: phones[0]?.value || null, phoneNumbers: phones, phoneDigitsList, whatsappPhoneDigits, locality: contactForm.locality.trim() || contactForm.companyLocality.trim() || null, notes: contactForm.notes.trim() || null } satisfies Contact;
      setContacts((current) => [...current.filter((contact) => contact.id !== contactRef.id), newContact]);
      setSelectedContactId(contactRef.id);
      setDetailTab("overview");
      setMobilePane("detail");
      closeCreateDialog();
      setStatus({ tone: "success", text: "Contato criado. Você já pode registrar a primeira interação." });
    } catch {
      setFormError("Não foi possível salvar o contato. Tente novamente.");
    } finally {
      setSavingContact(false);
    }
  };

  const handleInteractionSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !selectedContact || !interactionForm.summary.trim()) { setStatus({ tone: "error", text: "Selecione um contato e descreva a interação." }); return; }
    setSavingInteraction(true);
    setStatus(null);
    try {
      const occurredAt = new Date(interactionForm.occurredAt);
      const nextContactAt = interactionForm.nextContactAt ? new Date(interactionForm.nextContactAt) : new Date(occurredAt.getTime() + (10 * 24 * 60 * 60 * 1000));
      await addDoc(collection(db, "crm_events"), { type: "crm_event", eventType: "contact_interaction", source: "manual", channelType: interactionForm.channelType, summary: interactionForm.summary.trim(), occurredAt, nextContactAt, contactId: selectedContact.id, companyId: selectedContact.companyId || null, workspaceId, ownerId: user.uid, actorUserId: user.uid, createdAt: serverTimestamp() });
      await updateDoc(doc(db, "contacts", selectedContact.id), { lastContactAt: occurredAt, nextContactAt, nextContactSource: "manual", followUpStatus: "green", updatedAt: serverTimestamp() });
      setInteractionForm(createEmptyInteraction());
      setInteractionOpen(false);
      setDetailTab("interactions");
      setStatus({ tone: "success", text: "Interação registrada no histórico do contato." });
    } catch {
      setStatus({ tone: "error", text: "Não foi possível registrar a interação." });
    } finally {
      setSavingInteraction(false);
    }
  };

  const handleEquipmentSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!db || !user?.uid || !workspaceId || !selectedContact || (!equipmentForm.catalogItemId && !equipmentForm.model.trim() && !equipmentForm.brand.trim())) { setStatus({ tone: "error", text: "Informe um equipamento do catálogo ou preencha marca e modelo." }); return; }
    setSavingEquipment(true);
    setStatus(null);
    try {
      const selectedCatalogItem = catalogItems.find((item) => item.id === equipmentForm.catalogItemId);
      const targetCollection = equipmentForm.relationType === "installed" ? "installed_base" : "interests";
      await addDoc(collection(db, targetCollection), { type: targetCollection === "installed_base" ? "installed_base_item" : "interest", relationType: equipmentForm.relationType, contactId: selectedContact.id, companyId: selectedContact.companyId || null, workspaceId, ownerId: user.uid, catalogItemId: selectedCatalogItem?.id || null, equipmentType: equipmentForm.equipmentType.trim() || selectedCatalogItem?.itemType || null, brand: equipmentForm.brand.trim() || selectedCatalogItem?.brand || null, model: equipmentForm.model.trim() || selectedCatalogItem?.model || null, status: selectedCatalogItem ? "confirmed" : "pending_catalog", source: "manual", createdAt: serverTimestamp() });
      setEquipmentForm(EMPTY_EQUIPMENT);
      setStatus({ tone: "success", text: "Equipamento vinculado ao contato." });
    } catch {
      setStatus({ tone: "error", text: "Não foi possível vincular o equipamento." });
    } finally {
      setSavingEquipment(false);
    }
  };

  return (
    <div className="min-h-full bg-background pb-20 text-foreground">
      <div className="border-b border-border/70 bg-card px-4 py-7 md:px-8 md:py-8"><div className="mx-auto max-w-7xl"><div className="mb-3 flex items-center gap-2 text-xs font-medium text-primary"><Building2 size={15} /> CRM</div><div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Contatos e relacionamento</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Organize empresas, contatos e o histórico de cada conversa em um fluxo contínuo.</p></div><Button type="button" onClick={() => { setFormError(null); setCreateOpen(true); }} className="h-10 w-full gap-2 md:w-auto"><Plus size={16} /> Novo contato</Button></div></div></div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 md:px-8 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.6fr)]">
        <section className={cn("min-w-0", mobilePane === "detail" && "hidden xl:block")}><div className="rounded-2xl border border-border/70 bg-card shadow-sm"><div className="border-b border-border/70 p-4"><div className="flex items-center justify-between gap-3"><div><h2 className="text-base font-semibold">Sua carteira</h2><p className="mt-1 text-xs text-muted-foreground">{contacts.length} {contacts.length === 1 ? "contato" : "contatos"}</p></div><UsersRound className="text-primary" size={18} /></div><div className="relative mt-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} /><Input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} className="h-10 pl-9 pr-9" placeholder="Buscar contato ou empresa" aria-label="Buscar contato ou empresa" />{contactSearch && <button type="button" onClick={() => setContactSearch("")} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Limpar busca"><X size={14} /></button>}</div></div><div className="divide-y divide-border/60">{visibleContacts.length === 0 ? <div className="px-5 py-12 text-center"><UserRound className="mx-auto text-muted-foreground/50" size={28} /><p className="mt-3 text-sm font-medium">{contactSearch ? "Nenhum contato encontrado" : "Sua carteira está vazia"}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{contactSearch ? "Tente buscar por outro nome, empresa ou telefone." : "Cadastre um contato para começar a acompanhar os relacionamentos."}</p>{!contactSearch && <Button type="button" variant="outline" onClick={() => setCreateOpen(true)} className="mt-4 gap-2"><Plus size={14} /> Cadastrar contato</Button>}</div> : visibleContacts.map((contact) => { const state = followUpState(contact); const company = companies.find((item) => item.id === contact.companyId); return <button key={contact.id} type="button" onClick={() => selectContact(contact.id)} className={cn("flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none", selectedContactId === contact.id && "bg-accent/60")} aria-current={selectedContactId === contact.id ? "true" : undefined}><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-primary">{(contact.displayName || contact.name || "?").trim().charAt(0).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{contact.displayName || contact.name || "Contato sem nome"}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{company?.name || "Empresa não vinculada"}{contact.role ? ` · ${contact.role}` : ""}</span><span className="mt-1 block text-[11px] text-muted-foreground">{state.label}</span></span><ChevronRight className="shrink-0 text-muted-foreground" size={16} /></button>; })}</div></div></section>

        <section className={cn("min-w-0", mobilePane === "list" && "hidden xl:block")}>{!selectedContact ? <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-dashed border-border bg-card p-8 text-center"><div><UserRound className="mx-auto text-muted-foreground/50" size={30} /><h2 className="mt-4 text-base font-semibold">Selecione um contato</h2><p className="mt-1 max-w-sm text-sm text-muted-foreground">Escolha uma pessoa na carteira para acessar dados, histórico e próximas ações.</p></div></div> : <div className="space-y-5 md:sticky md:top-24 md:self-start"><Button type="button" variant="ghost" onClick={() => setMobilePane("list")} className="h-10 gap-2 px-0 text-muted-foreground hover:bg-transparent hover:text-foreground xl:hidden"><ArrowLeft size={16} /> Voltar para contatos</Button><div className="rounded-2xl border border-border/70 bg-card shadow-sm"><div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-lg font-semibold text-primary">{(selectedContact.displayName || selectedContact.name || "?").trim().charAt(0).toUpperCase()}</span><div className="min-w-0"><h2 className="truncate text-xl font-semibold">{selectedContact.displayName || selectedContact.name}</h2><p className="mt-1 truncate text-sm text-muted-foreground">{selectedCompany?.name || "Empresa não vinculada"}{selectedContact.role ? ` · ${selectedContact.role}` : ""}</p><div className="mt-3 flex flex-wrap gap-2"><Badge variant="outline" className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium", followUpState(selectedContact).className)}>{followUpState(selectedContact).label}</Badge>{selectedContact.sector && <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px] font-medium">{selectedContact.sector}</Badge>}</div></div></div><Button type="button" onClick={() => { setInteractionForm(createEmptyInteraction()); setInteractionOpen(true); }} className="h-10 w-full gap-2 sm:w-auto"><Plus size={15} /> Registrar interação</Button></div><div className="flex overflow-x-auto border-b border-border/70 px-3" role="tablist" aria-label="Detalhes do contato">{[{ id: "overview", label: "Resumo" }, { id: "interactions", label: "Interações", count: events.length }, { id: "equipment", label: "Equipamentos", count: equipmentLinks.length }].map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={detailTab === tab.id} onClick={() => setDetailTab(tab.id as typeof detailTab)} className={cn("min-h-12 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors", detailTab === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab.label}{typeof tab.count === "number" && <span className="ml-1.5 text-xs text-muted-foreground">{tab.count}</span>}</button>)}</div><div className="p-5">{detailTab === "overview" && <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><InfoItem icon={Mail} label="E-mails" value={contactEmails(selectedContact).map((email) => email.value).join(" · ") || "Ainda não informado"} /><InfoItem icon={Phone} label="Telefones" value={contactPhones(selectedContact).map((phone) => phone.value).join(" · ") || "Ainda não informado"} /><InfoItem icon={MapPin} label="Localidade" value={selectedContact.locality || selectedCompany?.locality || "Ainda não informado"} /><InfoItem icon={Clock3} label="Último contato" value={formatDate(selectedContact.lastContactAt)} /></div><div className="rounded-xl border border-border/70 bg-muted/35 p-4"><div className="flex items-center gap-2 text-sm font-semibold"><Building2 size={16} className="text-primary" /> {selectedCompany?.name || "Empresa não vinculada"}</div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{formatAddress(selectedCompany?.address)}</p></div>{selectedContact.notes && <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Observações</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">{selectedContact.notes}</p></div>}<div className="grid gap-3 border-t border-border/70 pt-5 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Próximo contato</p><p className="mt-1 text-sm font-semibold">{formatDate(selectedContact.nextContactAt)}</p></div><div><p className="text-xs text-muted-foreground">Origem da data</p><p className="mt-1 text-sm font-semibold">{selectedContact.nextContactSource === "ai" ? "Sugestão da IA" : selectedContact.nextContactAt ? "Definida pela equipe" : "Ainda não definida"}</p></div></div></div>}{detailTab === "interactions" && <InteractionTimeline events={events} onRegister={() => setInteractionOpen(true)} />}{detailTab === "equipment" && <EquipmentPanel catalogItems={catalogItems} equipmentForm={equipmentForm} setEquipmentForm={setEquipmentForm} equipmentLinks={equipmentLinks} savingEquipment={savingEquipment} onSubmit={handleEquipmentSubmit} />}</div></div></div>}</section>
      </div>

      {status && <div role={status.tone === "error" ? "alert" : "status"} aria-live="polite" className={cn("fixed bottom-20 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-lg md:bottom-6", status.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800")}>{status.text}</div>}


      <Dialog open={createOpen} onOpenChange={(open: boolean) => { if (open) setCreateOpen(true); else closeCreateDialog(); }}>
        <DialogContent showCloseButton={false} className="max-h-[calc(100dvh-1rem)] max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
          <form onSubmit={handleContactSubmit} noValidate className="flex max-h-[calc(100dvh-1rem)] flex-col">
            <DialogHeader className="border-b border-border/70 px-5 py-5 pr-14">
              <DialogTitle className="text-xl">Novo contato</DialogTitle>
              <DialogDescription>Cadastre a pessoa e a empresa. Depois de salvar, você já cai na tela do contato para registrar a primeira interação.</DialogDescription>
              <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="absolute right-3 top-3 h-10 w-10" aria-label="Fechar cadastro"><X size={17} /></Button></DialogClose>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {formError && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
              <div className="space-y-6">
                <section>
                  <SectionEyebrow icon={Building2} label="Empresa" />
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="relative md:col-span-2">
                      <Label htmlFor="companyName">Nome da empresa <span className="text-destructive">*</span></Label>
                      <Input id="companyName" value={contactForm.companyName} onChange={(event) => setContactForm((previous) => ({ ...previous, companyId: "", companyName: event.target.value }))} className={fieldClassName()} placeholder="Digite pelo menos 2 letras para buscar" autoComplete="off" aria-invalid={Boolean(formError && !contactForm.companyName.trim())} />
                      {companySuggestions.length > 0 && <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-lg" role="listbox" aria-label="Empresas encontradas">{companySuggestions.map((company) => <button key={company.id} type="button" role="option" aria-selected={contactForm.companyId === company.id} onClick={() => selectCompany(company)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"><Building2 size={16} className="mt-0.5 shrink-0 text-primary" /><span className="min-w-0"><span className="block truncate text-sm font-medium">{company.name}</span><span className="block truncate text-xs text-muted-foreground">{company.sector || "Setor não informado"}{company.locality ? ` · ${company.locality}` : ""}</span></span></button>)}</div>}
                      {contactForm.companyName.trim().length >= 2 && companySuggestions.length === 0 && <p className="mt-2 text-xs text-muted-foreground">Nenhuma empresa encontrada. Continue para cadastrar uma nova.</p>}
                    </div>
                    <div><Label htmlFor="companySector">Setor da empresa</Label><Input id="companySector" value={contactForm.companySector} onChange={(event) => setContactForm((previous) => ({ ...previous, companySector: event.target.value }))} className={fieldClassName()} placeholder="Indústria, comércio..." /></div>
                    <div><Label htmlFor="companyLocality">Cidade</Label><Input id="companyLocality" value={contactForm.companyLocality} onChange={(event) => updateCompanyCity(event.target.value)} className={fieldClassName()} placeholder="Campinas" /></div>
                  </div>
                </section>
                <section>
                  <SectionEyebrow icon={MapPin} label="Endereço da empresa" />
                  <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]"><div><Label htmlFor="companyStreet">Rua / avenida</Label><Input id="companyStreet" value={contactForm.companyAddress.street} onChange={(event) => updateAddress("street", event.target.value)} className={fieldClassName()} placeholder="Nome da rua" /></div><div><Label htmlFor="companyNumber">Número</Label><Input id="companyNumber" value={contactForm.companyAddress.number} onChange={(event) => updateAddress("number", event.target.value)} className={fieldClassName()} placeholder="123" /></div></div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><Label htmlFor="companyComplement">Complemento</Label><Input id="companyComplement" value={contactForm.companyAddress.complement} onChange={(event) => updateAddress("complement", event.target.value)} className={fieldClassName()} placeholder="Sala, bloco..." /></div><div><Label htmlFor="companyNeighborhood">Bairro</Label><Input id="companyNeighborhood" value={contactForm.companyAddress.neighborhood} onChange={(event) => updateAddress("neighborhood", event.target.value)} className={fieldClassName()} placeholder="Centro" /></div><div><Label htmlFor="companyPostalCode">CEP</Label><Input id="companyPostalCode" inputMode="numeric" value={contactForm.companyAddress.postalCode} onChange={(event) => updateAddress("postalCode", event.target.value)} className={fieldClassName()} placeholder="00000-000" /></div><div><Label htmlFor="companyState">Estado</Label><Input id="companyState" value={contactForm.companyAddress.state} onChange={(event) => updateAddress("state", event.target.value)} className={fieldClassName()} placeholder="SP" /></div></div>
                </section>
                <section>
                  <SectionEyebrow icon={UserRound} label="Pessoa de contato" />
                  <div className="grid gap-4 md:grid-cols-2"><div><Label htmlFor="contactName">Nome <span className="text-destructive">*</span></Label><Input id="contactName" value={contactForm.name} onChange={(event) => setContactForm((previous) => ({ ...previous, name: event.target.value }))} className={fieldClassName()} placeholder="Nome completo" aria-invalid={Boolean(formError && !contactForm.name.trim())} /></div><div><Label htmlFor="contactRole">Função</Label><Input id="contactRole" value={contactForm.role} onChange={(event) => setContactForm((previous) => ({ ...previous, role: event.target.value }))} className={fieldClassName()} placeholder="Compras, manutenção..." /></div><div><Label htmlFor="contactSector">Setor / área</Label><Input id="contactSector" value={contactForm.sector} onChange={(event) => setContactForm((previous) => ({ ...previous, sector: event.target.value }))} className={fieldClassName()} placeholder="Operações" /></div><div><Label htmlFor="contactLocality">Localidade do contato</Label><Input id="contactLocality" value={contactForm.locality} onChange={(event) => setContactForm((previous) => ({ ...previous, locality: event.target.value }))} className={fieldClassName()} placeholder="Cidade / UF" /></div></div>
                </section>
                <section>
                  <SectionEyebrow icon={Phone} label="Telefones" />
                  <div className="space-y-3">{contactForm.phones.map((phone, index) => <div key={`phone-${index}`} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto_auto]"><Input aria-label={`Rótulo do telefone ${index + 1}`} value={phone.label} onChange={(event) => updatePhone(index, { label: event.target.value })} className="h-10" placeholder="Celular" /><Input aria-label={`Telefone ${index + 1}`} type="tel" value={phone.value} onChange={(event) => updatePhone(index, { value: event.target.value })} className="h-10" placeholder="(00) 00000-0000" /><label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:bg-muted"><input type="checkbox" checked={phone.hasWhatsapp} onChange={(event) => updatePhone(index, { hasWhatsapp: event.target.checked })} className="h-4 w-4 accent-primary" /> WhatsApp</label>{contactForm.phones.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setContactForm((previous) => ({ ...previous, phones: previous.phones.filter((_, phoneIndex) => phoneIndex !== index) }))} className="h-10 w-10 text-muted-foreground hover:text-destructive" aria-label={`Remover telefone ${index + 1}`}><Trash2 size={15} /></Button>}</div>)}<Button type="button" variant="outline" onClick={() => setContactForm((previous) => ({ ...previous, phones: [...previous.phones, { label: "Outro", value: "", hasWhatsapp: false }] }))} className="gap-2"><Plus size={14} /> Adicionar telefone</Button></div>
                </section>
                <section>
                  <SectionEyebrow icon={AtSign} label="E-mails" />
                  <div className="space-y-3">{contactForm.emails.map((email, index) => <div key={`email-${index}`} className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)_auto]"><Input aria-label={`Rótulo do e-mail ${index + 1}`} value={email.label} onChange={(event) => updateEmail(index, { label: event.target.value })} className="h-10" placeholder="Principal" /><Input aria-label={`E-mail ${index + 1}`} type="email" value={email.value} onChange={(event) => updateEmail(index, { value: event.target.value })} className="h-10" placeholder="contato@empresa.com" />{contactForm.emails.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => setContactForm((previous) => ({ ...previous, emails: previous.emails.filter((_, emailIndex) => emailIndex !== index) }))} className="h-10 w-10 text-muted-foreground hover:text-destructive" aria-label={`Remover e-mail ${index + 1}`}><Trash2 size={15} /></Button>}</div>)}<Button type="button" variant="outline" onClick={() => setContactForm((previous) => ({ ...previous, emails: [...previous.emails, { label: "Outro", value: "" }] }))} className="gap-2"><Plus size={14} /> Adicionar e-mail</Button></div>
                </section>
                <section><SectionEyebrow icon={History} label="Contexto" /><Label htmlFor="contactNotes">Observações</Label><Textarea id="contactNotes" value={contactForm.notes} onChange={(event) => setContactForm((previous) => ({ ...previous, notes: event.target.value }))} className="mt-2 min-h-24 resize-none" placeholder="Contexto inicial, preferências ou próximos passos" /></section>
              </div>
            </div>
            <DialogFooter className="border-border/70 bg-card px-5 py-4"><Button type="button" variant="outline" onClick={closeCreateDialog} className="h-10">Cancelar</Button><Button type="submit" disabled={savingContact} className="h-10 min-w-36 gap-2">{savingContact ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Criar contato</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={interactionOpen} onOpenChange={setInteractionOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Registrar interação</DialogTitle><DialogDescription>Adicione o que aconteceu e deixe a próxima ação clara para a equipe.</DialogDescription></DialogHeader><form onSubmit={handleInteractionSubmit} noValidate className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="interactionChannel">Canal</Label><select id="interactionChannel" value={interactionForm.channelType} onChange={(event) => setInteractionForm((previous) => ({ ...previous, channelType: event.target.value }))} className={`${fieldClassName()} w-full px-3`}><option value="phone">Ligação</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option><option value="meeting">Reunião</option><option value="other">Outro</option></select></div><div><Label htmlFor="interactionDate">Quando</Label><Input id="interactionDate" type="datetime-local" value={interactionForm.occurredAt} onChange={(event) => setInteractionForm((previous) => ({ ...previous, occurredAt: event.target.value }))} className={fieldClassName()} /></div></div><div><Label htmlFor="nextContactAt">Próximo contato</Label><Input id="nextContactAt" type="datetime-local" value={interactionForm.nextContactAt} onChange={(event) => setInteractionForm((previous) => ({ ...previous, nextContactAt: event.target.value }))} className={fieldClassName()} /><p className="mt-1 text-xs text-muted-foreground">Sem data, o sistema sugere um follow-up em 10 dias.</p></div><div><Label htmlFor="interactionSummary">Resumo <span className="text-destructive">*</span></Label><Textarea id="interactionSummary" value={interactionForm.summary} onChange={(event) => setInteractionForm((previous) => ({ ...previous, summary: event.target.value }))} className="mt-2 min-h-28 resize-none" placeholder="O que foi tratado e qual é a próxima ação?" /></div><DialogFooter className="-mx-4 -mb-4"><DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose><Button type="submit" disabled={savingInteraction} className="gap-2">{savingInteraction ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Registrar interação</Button></DialogFooter></form></DialogContent></Dialog>
    </div>
  );
}

function SectionEyebrow({ icon: Icon, label }: { icon: typeof Building2; label: string }) {
  return <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"><Icon size={14} className="text-primary" /> {label}</div>;
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return <div className="min-w-0"><div className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Icon size={14} className="text-primary" /> {label}</div><p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p></div>;
}

function InteractionTimeline({ events, onRegister }: { events: CrmEvent[]; onRegister: () => void }) {
  if (!events.length) return <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/25 p-8 text-center"><History className="text-muted-foreground/50" size={28} /><h3 className="mt-3 text-sm font-semibold">Nenhuma interação registrada</h3><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Registre uma ligação, reunião, e-mail ou conversa para começar a construir o histórico.</p><Button type="button" onClick={onRegister} className="mt-4 gap-2"><Plus size={14} /> Registrar interação</Button></div>;
  return <div className="space-y-5">{events.map((event) => <div key={event.id} className="relative border-l-2 border-primary/20 pl-5"><span className="absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-card bg-primary" /><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">{channelLabel(event.channelType)}</Badge><span className="text-xs text-muted-foreground">{formatDate(event.occurredAt)}</span></div><p className="mt-2 text-sm leading-relaxed">{event.summary}</p>{Boolean(event.nextContactAt) && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock size={13} /> Próximo contato: {formatDate(event.nextContactAt)}{event.source === "whatsapp" ? " · WhatsApp" : ""}</p>}</div>)}<Button type="button" variant="outline" onClick={onRegister} className="gap-2"><Plus size={14} /> Registrar outra interação</Button></div>;
}

function EquipmentPanel({ catalogItems, equipmentForm, setEquipmentForm, equipmentLinks, savingEquipment, onSubmit }: { catalogItems: CatalogItem[]; equipmentForm: EquipmentFormState; setEquipmentForm: React.Dispatch<React.SetStateAction<EquipmentFormState>>; equipmentLinks: EquipmentLink[]; savingEquipment: boolean; onSubmit: (event: FormEvent) => void }) {
  return <div className="space-y-5"><div><h3 className="text-sm font-semibold">Interesses e equipamentos instalados</h3><p className="mt-1 text-xs text-muted-foreground">Vincule o que esse contato compra, usa ou está avaliando.</p></div><form onSubmit={onSubmit} noValidate className="space-y-4 rounded-xl border border-border/70 bg-muted/25 p-4"><div><Label htmlFor="equipmentRelation">Relação</Label><select id="equipmentRelation" value={equipmentForm.relationType} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, relationType: event.target.value }))} className={`${fieldClassName()} w-full px-3`}><option value="interest">Interesse comercial</option><option value="installed">Equipamento instalado</option></select></div><div><Label htmlFor="catalogItem">Item do catálogo</Label><select id="catalogItem" value={equipmentForm.catalogItemId} onChange={(event) => { const item = catalogItems.find((catalog) => catalog.id === event.target.value); setEquipmentForm((previous) => ({ ...previous, catalogItemId: event.target.value, equipmentType: item?.itemType || previous.equipmentType, brand: item?.brand || previous.brand, model: item?.model || previous.model })); }} className={`${fieldClassName()} w-full px-3`}><option value="">Não encontrado no catálogo</option>{catalogItems.map((item) => <option key={item.id} value={item.id}>{[item.itemType, item.brand, item.model].filter(Boolean).join(" · ") || item.id}</option>)}</select></div><div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="equipmentType">Tipo</Label><Input id="equipmentType" value={equipmentForm.equipmentType} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, equipmentType: event.target.value }))} className={fieldClassName()} placeholder="Sensor" /></div><div><Label htmlFor="equipmentBrand">Marca</Label><Input id="equipmentBrand" value={equipmentForm.brand} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, brand: event.target.value }))} className={fieldClassName()} placeholder="Marca" /></div><div><Label htmlFor="equipmentModel">Modelo</Label><Input id="equipmentModel" value={equipmentForm.model} onChange={(event) => setEquipmentForm((previous) => ({ ...previous, model: event.target.value }))} className={fieldClassName()} placeholder="Modelo" /></div></div><Button type="submit" disabled={savingEquipment} variant="outline" className="w-full gap-2">{savingEquipment ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Vincular equipamento</Button></form>{equipmentLinks.length > 0 ? <div className="space-y-2">{equipmentLinks.map((link) => <div key={link.id} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{[link.equipmentType, link.brand, link.model].filter(Boolean).join(" · ") || "Equipamento sem descrição"}</p><p className="mt-1 text-xs text-muted-foreground">{link.relationType === "installed" ? "Instalado" : "Interesse"}{link.status === "pending_catalog" ? " · Pendente de catálogo" : ""}</p></div><PackageSearch size={16} className="shrink-0 text-muted-foreground" /></div>)}</div> : <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Nenhum equipamento vinculado ainda.</p>}</div>;
}
