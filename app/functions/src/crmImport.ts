import * as XLSX from "xlsx";
import * as admin from "firebase-admin";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { withCallErrorHandling, withEventErrorHandling } from "./lib/errors";
import { buildOwnershipContext } from "./ownership";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_ROWS = 10_000;
const RETENTION_DAYS = 90;

export type CrmImportRow = {
  rowNumber: number;
  companyName: string;
  contactName: string;
  role: string;
  sector: string;
  locality: string;
  email: string;
  phone: string;
  hasWhatsapp: boolean;
  lastContactAt: string | null;
  nextContactAt: string | null;
  notes: string;
  address: {
    street: string;
    number: string;
    complement: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
  };
  errors: string[];
};

const HEADER_ALIASES: Record<string, string[]> = {
  companyName: ["empresa", "cliente", "company", "razao social", "razão social"],
  contactName: ["nome do contato", "contato", "responsavel", "responsável", "nome"],
  role: ["funcao", "função", "cargo"],
  sector: ["setor", "segmento", "area", "área"],
  locality: ["localidade", "cidade", "municipio", "município"],
  email: ["email", "e mail", "e-mail", "correio"],
  phone: ["telefone", "celular", "phone", "whatsapp"],
  hasWhatsapp: ["tem whatsapp", "possui whatsapp", "whatsapp ativo", "whatsapp?"],
  lastContactAt: ["ultimo contato", "último contato", "last contact"],
  nextContactAt: ["proximo contato", "próximo contato", "next contact"],
  notes: ["observacao", "observação", "notas", "comentarios", "comentários"],
  street: ["endereco", "endereço", "rua", "logradouro"],
  number: ["numero", "número"],
  complement: ["complemento"],
  neighborhood: ["bairro"],
  postalCode: ["cep", "codigo postal", "código postal"],
  city: ["cidade do endereco", "cidade do endereço"],
  state: ["uf", "estado"],
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeHeader(value: unknown) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase();
}

export function normalizePhone(value: unknown) {
  return normalizeText(value).replace(/\D/g, "");
}

export function normalizeBoolean(value: unknown) {
  const normalized = normalizeText(value).toLowerCase();
  return ["1", "true", "sim", "yes", "y", "x", "com whatsapp", "whatsapp"].includes(normalized);
}

export function normalizeImportDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const text = normalizeText(value);
  if (!text) return null;
  const brDate = text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (brDate) {
    const year = Number(brDate[3].length === 2 ? `20${brDate[3]}` : brDate[3]);
    const date = new Date(year, Number(brDate[2]) - 1, Number(brDate[1]), Number(brDate[4] || 0), Number(brDate[5] || 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function resolveHeader(headers: string[], field: string) {
  const aliases = (HEADER_ALIASES as Record<string, string[]>)[field] || [];
  return headers.findIndex((header) => aliases.includes(normalizeHeader(header)));
}

function fieldValue(row: unknown[], headerIndexes: Record<string, number>, field: string) {
  const index = headerIndexes[field];
  return index == null || index < 0 ? "" : row[index];
}

export function mapImportHeaders(headers: unknown[]) {
  const normalizedHeaders = headers.map((header) => normalizeText(header));
  return Object.keys(HEADER_ALIASES).reduce<Record<string, number>>((mapping, field) => {
    const index = resolveHeader(normalizedHeaders, field);
    if (index >= 0) mapping[field] = index;
    return mapping;
  }, {});
}

export function normalizeImportRows(headers: unknown[], rawRows: unknown[][]): CrmImportRow[] {
  const mapping = mapImportHeaders(headers);
  return rawRows.slice(0, MAX_ROWS).map((rawRow, index) => ({ rawRow, rowNumber: index + 2 })).filter(({ rawRow }) => rawRow.some((value) => normalizeText(value))).map(({ rawRow, rowNumber }) => {
    const companyName = normalizeText(fieldValue(rawRow, mapping, "companyName"));
    const contactName = normalizeText(fieldValue(rawRow, mapping, "contactName"));
    const email = normalizeEmail(fieldValue(rawRow, mapping, "email"));
    const phone = normalizeText(fieldValue(rawRow, mapping, "phone"));
    const parsedLast = normalizeImportDate(fieldValue(rawRow, mapping, "lastContactAt"));
    const parsedNext = normalizeImportDate(fieldValue(rawRow, mapping, "nextContactAt"));
    const errors: string[] = [];

    if (!companyName) errors.push("Empresa não informada");
    if (!contactName) errors.push("Nome do contato não informado");
    if (!email && !normalizePhone(phone)) errors.push("Informe e-mail ou telefone");
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.push("E-mail inválido");
    if (phone && normalizePhone(phone).length < 8) errors.push("Telefone inválido");
    if (fieldValue(rawRow, mapping, "lastContactAt") && !parsedLast) errors.push("Último contato inválido");
    if (fieldValue(rawRow, mapping, "nextContactAt") && !parsedNext) errors.push("Próximo contato inválido");

    return {
      rowNumber,
      companyName,
      contactName,
      role: normalizeText(fieldValue(rawRow, mapping, "role")),
      sector: normalizeText(fieldValue(rawRow, mapping, "sector")),
      locality: normalizeText(fieldValue(rawRow, mapping, "locality")),
      email,
      phone,
      hasWhatsapp: normalizeBoolean(fieldValue(rawRow, mapping, "hasWhatsapp")) || normalizeHeader(headers[mapping.phone]) === "whatsapp",
      lastContactAt: parsedLast,
      nextContactAt: parsedNext,
      notes: normalizeText(fieldValue(rawRow, mapping, "notes")),
      address: {
        street: normalizeText(fieldValue(rawRow, mapping, "street")),
        number: normalizeText(fieldValue(rawRow, mapping, "number")),
        complement: normalizeText(fieldValue(rawRow, mapping, "complement")),
        neighborhood: normalizeText(fieldValue(rawRow, mapping, "neighborhood")),
        postalCode: normalizeText(fieldValue(rawRow, mapping, "postalCode")),
        city: normalizeText(fieldValue(rawRow, mapping, "city")),
        state: normalizeText(fieldValue(rawRow, mapping, "state")),
      },
      errors,
    };
  });
}

export function parseCrmWorkbook(buffer: Buffer, fileName = "arquivo.xlsx") {
  if (!buffer?.length) throw new Error("O arquivo está vazio");
  if (buffer.length > MAX_FILE_SIZE_BYTES) throw new Error("O arquivo excede o limite de 10 MB");
  if (!/\.(xlsx|xls|csv)$/i.test(fileName)) throw new Error("Envie um arquivo .xlsx, .xls ou .csv");

  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true, raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Nenhuma planilha foi encontrada");
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: "", raw: true }) as unknown[][];
  const headers = rows.shift() || [];
  if (!headers.length) throw new Error("A primeira linha precisa conter os nomes das colunas");
  const normalizedRows = normalizeImportRows(headers, rows);
  if (normalizedRows.length > MAX_ROWS) throw new Error(`O arquivo excede o limite de ${MAX_ROWS.toLocaleString("pt-BR")} linhas`);
  return { sheetName, headers: headers.map((header) => normalizeText(header)), rows: normalizedRows };
}

export function countDuplicateCandidates(rows: CrmImportRow[]) {
  const seen = new Set<string>();
  let duplicates = 0;
  rows.forEach((row) => {
    const identity = normalizeEmail(row.email) || normalizePhone(row.phone) || `${normalizeText(row.companyName).toLowerCase()}::${normalizeText(row.contactName).toLowerCase()}`;
    if (seen.has(identity)) duplicates += 1;
    else seen.add(identity);
  });
  return duplicates;
}

async function countExistingMatches(rows: CrmImportRow[], workspaceId: string) {
  const db = getFirestore();
  const [accountsSnapshot, contactsSnapshot] = await Promise.all([
    db.collection("accounts").where("workspaceId", "==", workspaceId).limit(5000).get(),
    db.collection("contacts").where("workspaceId", "==", workspaceId).limit(5000).get(),
  ]);
  const companyNames = new Set(accountsSnapshot.docs.map((item) => normalizeText(item.data()?.name).toLowerCase()).filter(Boolean));
  const emails = new Set<string>();
  const phones = new Set<string>();
  contactsSnapshot.docs.forEach((item) => {
    const data = item.data();
    [data.email, ...(Array.isArray(data.emails) ? data.emails.map((entry: any) => entry?.value) : [])].map(normalizeEmail).filter(Boolean).forEach((value) => emails.add(value));
    [data.phoneDigits, ...(Array.isArray(data.phoneDigitsList) ? data.phoneDigitsList : []), ...(Array.isArray(data.phoneNumbers) ? data.phoneNumbers.map((entry: any) => entry?.value || entry?.number) : [])].map(normalizePhone).filter(Boolean).forEach((value) => phones.add(value));
  });
  return rows.filter((row) => companyNames.has(normalizeText(row.companyName).toLowerCase()) || emails.has(normalizeEmail(row.email)) || phones.has(normalizePhone(row.phone))).length;
}

function requireApproved(request: any) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Faça login para importar contatos.");
  if (request.auth.token?.accessApproved !== true) throw new HttpsError("permission-denied", "Seu acesso ainda não está aprovado.");
  const ownership = buildOwnershipContext(request.auth);
  if (!ownership.workspaceId) throw new HttpsError("failed-precondition", "Workspace não configurado.");
  return ownership;
}

function importJobPath(workspaceId: string, jobId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "contatos.xlsx";
  return `crm-imports/${workspaceId}/${jobId}/${safeName}`;
}

async function getImportJob(jobId: string, workspaceId: string) {
  const db = getFirestore();
  const snapshot = await db.collection("crm_import_jobs").doc(jobId).get();
  if (!snapshot.exists || snapshot.data()?.workspaceId !== workspaceId) throw new HttpsError("not-found", "Importação não encontrada.");
  return { ref: snapshot.ref, data: snapshot.data() || {} };
}

export const createCrmImportJob = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const ownership = requireApproved(request);
  const fileName = String(request.data?.fileName || "contatos.xlsx");
  const fileSize = Number(request.data?.fileSize || 0);
  if (!/\.(xlsx|xls|csv)$/i.test(fileName)) throw new HttpsError("invalid-argument", "Envie um arquivo .xlsx, .xls ou .csv.");
  if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > MAX_FILE_SIZE_BYTES) throw new HttpsError("invalid-argument", "O arquivo precisa ter entre 1 byte e 10 MB.");

  const db = getFirestore();
  const jobRef = db.collection("crm_import_jobs").doc();
  const storagePath = importJobPath(ownership.workspaceId as string, jobRef.id, fileName);
  const expiresAt = Timestamp.fromMillis(Date.now() + RETENTION_DAYS * 24 * 60 * 60 * 1000);
  await jobRef.set({
    type: "crm_import_job",
    workspaceId: ownership.workspaceId,
    accountId: ownership.defaultAccountId,
    ownerId: ownership.ownerId,
    status: "awaiting_upload",
    fileName,
    fileSize,
    storagePath,
    expiresAt,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.info("CRM import job created", { jobId: jobRef.id, workspaceId: ownership.workspaceId, fileName });
  return { jobId: jobRef.id, storagePath, expiresAt: expiresAt.toDate().toISOString() };
}));

export const validateCrmImport = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const ownership = requireApproved(request);
  const job = await getImportJob(String(request.data?.jobId || ""), ownership.workspaceId as string);
  const storagePath = String(job.data.storagePath || "");
  if (!storagePath) throw new HttpsError("failed-precondition", "Arquivo da importação não encontrado.");
  const [buffer] = await getStorage().bucket().file(storagePath).download();
  const parsed = parseCrmWorkbook(buffer, String(job.data.fileName || "contatos.xlsx"));
  const validRows = parsed.rows.filter((row) => row.errors.length === 0);
  const invalidRows = parsed.rows.filter((row) => row.errors.length > 0);
  const summary = { totalRows: parsed.rows.length, validRows: validRows.length, invalidRows: invalidRows.length, duplicateCandidates: countDuplicateCandidates(parsed.rows), existingMatches: await countExistingMatches(validRows, ownership.workspaceId as string) };
  await job.ref.set({ status: "ready", sheetName: parsed.sheetName, headers: parsed.headers, summary, preview: parsed.rows.slice(0, 20), errors: invalidRows.slice(0, 100), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logger.info("CRM import validated", { jobId: job.ref.id, ...summary });
  return { jobId: job.ref.id, headers: parsed.headers, summary, preview: parsed.rows.slice(0, 20), errors: invalidRows.slice(0, 100) };
}));

function mergeUniqueValues(existing: any[] = [], incoming: any[] = [], key: (value: any) => string) {
  const merged = [...existing];
  const known = new Set(existing.map(key).filter(Boolean));
  incoming.forEach((value) => {
    const identity = key(value);
    if (identity && !known.has(identity)) { merged.push(value); known.add(identity); }
  });
  return merged;
}

export async function importCrmRows(rows: CrmImportRow[], workspaceId: string, ownerId: string | null, jobId: string) {
  const db = getFirestore();
  const [accountsSnapshot, contactsSnapshot] = await Promise.all([
    db.collection("accounts").where("workspaceId", "==", workspaceId).limit(5000).get(),
    db.collection("contacts").where("workspaceId", "==", workspaceId).limit(5000).get(),
  ]);
  const accounts = new Map<string, { id: string; data: any }>();
  accountsSnapshot.docs.forEach((doc) => accounts.set(normalizeText(doc.data()?.name).toLowerCase(), { id: doc.id, data: doc.data() }));
  const contactsByEmail = new Map<string, { id: string; data: any }>();
  const contactsByPhone = new Map<string, { id: string; data: any }>();
  contactsSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    const emails = Array.isArray(data.emails) ? data.emails : [];
    const phones = Array.isArray(data.phoneNumbers) ? data.phoneNumbers : [];
    [data.email, ...emails.map((item: any) => item?.value)].map(normalizeEmail).filter(Boolean).forEach((value) => contactsByEmail.set(value, { id: doc.id, data }));
    [data.phoneDigits, ...(Array.isArray(data.phoneDigitsList) ? data.phoneDigitsList : []), ...phones.map((item: any) => normalizePhone(item?.value || item?.number))].map(normalizePhone).filter(Boolean).forEach((value) => contactsByPhone.set(value, { id: doc.id, data }));
  });

  let created = 0;
  let updated = 0;
  const importedRows: string[] = [];
  for (let offset = 0; offset < rows.length; offset += 400) {
    const batch = db.batch();
    rows.slice(offset, offset + 400).forEach((row) => {
      const accountKey = normalizeText(row.companyName).toLowerCase();
      let account = accounts.get(accountKey);
      const accountRef = account ? db.collection("accounts").doc(account.id) : db.collection("accounts").doc();
      const address = Object.values(row.address).some(Boolean) ? row.address : null;
      const accountPatch = { type: "account", name: row.companyName, normalizedName: accountKey, sector: row.sector || account?.data?.sector || null, locality: row.locality || account?.data?.locality || null, address: address || account?.data?.address || null, workspaceId, accountId: workspaceId, ownerId: account?.data?.ownerId || ownerId, source: "crm_import", updatedAt: FieldValue.serverTimestamp(), ...(account ? {} : { createdAt: FieldValue.serverTimestamp() }) };
      batch.set(accountRef, accountPatch, { merge: true });
      if (!account) { account = { id: accountRef.id, data: accountPatch }; accounts.set(accountKey, account); created += 1; }
      const emailKey = normalizeEmail(row.email);
      const phoneKey = normalizePhone(row.phone);
      const contact = (emailKey ? contactsByEmail.get(emailKey) : undefined) || (phoneKey ? contactsByPhone.get(phoneKey) : undefined);
      const contactRef = contact ? db.collection("contacts").doc(contact.id) : db.collection("contacts").doc();
      const oldPhones = Array.isArray(contact?.data?.phoneNumbers) ? contact.data.phoneNumbers : [];
      const oldEmails = Array.isArray(contact?.data?.emails) ? contact.data.emails : [];
      const phoneEntry = phoneKey ? { label: "Importado", value: row.phone, digits: phoneKey, hasWhatsapp: row.hasWhatsapp } : null;
      const emailEntry = emailKey ? { label: "Importado", value: row.email } : null;
      const phones = phoneEntry ? mergeUniqueValues(oldPhones, [phoneEntry], (value) => normalizePhone(value?.value || value?.number)) : oldPhones;
      const emails = emailEntry ? mergeUniqueValues(oldEmails, [emailEntry], (value) => normalizeEmail(value?.value)) : oldEmails;
      const contactPatch = { type: "contact", companyId: accountRef.id, accountId: workspaceId, workspaceId, ownerId: contact?.data?.ownerId || ownerId, name: row.contactName, displayName: row.contactName, role: row.role || contact?.data?.role || null, sector: row.sector || contact?.data?.sector || null, locality: row.locality || contact?.data?.locality || null, email: row.email || contact?.data?.email || null, emails, phoneNumber: row.phone || contact?.data?.phoneNumber || null, phoneDigits: phoneKey || contact?.data?.phoneDigits || null, phoneDigitsList: Array.from(new Set([...(contact?.data?.phoneDigitsList || []), ...(phoneKey ? [phoneKey] : [])])), phoneNumbers: phones, whatsappPhoneDigits: Array.from(new Set([...(contact?.data?.whatsappPhoneDigits || []), ...(row.hasWhatsapp && phoneKey ? [phoneKey] : [])])), notes: row.notes || contact?.data?.notes || null, lastContactAt: row.lastContactAt ? new Date(row.lastContactAt) : contact?.data?.lastContactAt || null, nextContactAt: row.nextContactAt ? new Date(row.nextContactAt) : contact?.data?.nextContactAt || null, nextContactSource: row.nextContactAt ? "import" : contact?.data?.nextContactSource || null, source: "crm_import", sourceImportJobId: jobId, updatedAt: FieldValue.serverTimestamp(), ...(contact ? {} : { createdAt: FieldValue.serverTimestamp() }) };
      batch.set(contactRef, contactPatch, { merge: true });
      if (!contact) { created += 1; } else { updated += 1; }
      if (emailKey) contactsByEmail.set(emailKey, { id: contactRef.id, data: contactPatch });
      if (phoneKey) contactsByPhone.set(phoneKey, { id: contactRef.id, data: contactPatch });
      importedRows.push(String(row.rowNumber));
    });
    await batch.commit();
  }
  return { created, updated, importedRows };
}

export const confirmCrmImport = onCall(withCallErrorHandling(async (request: any, logger: any) => {
  const ownership = requireApproved(request);
  const job = await getImportJob(String(request.data?.jobId || ""), ownership.workspaceId as string);
  if (!["ready", "partial"].includes(String(job.data.status))) throw new HttpsError("failed-precondition", "Valide a importação antes de confirmar.");
  const [buffer] = await getStorage().bucket().file(String(job.data.storagePath)).download();
  const parsed = parseCrmWorkbook(buffer, String(job.data.fileName || "contatos.xlsx"));
  const result = await importCrmRows(parsed.rows.filter((row) => row.errors.length === 0), ownership.workspaceId as string, ownership.ownerId, job.ref.id);
  const summary = { ...result, totalRows: parsed.rows.length, skippedRows: parsed.rows.filter((row) => row.errors.length > 0).length };
  await job.ref.set({ status: summary.skippedRows ? "partial" : "completed", importSummary: summary, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  logger.info("CRM import completed", { jobId: job.ref.id, workspaceId: ownership.workspaceId, ...summary });
  return summary;
}));

export const cleanupCrmImportFiles = onSchedule("every 24 hours", withEventErrorHandling(async (_event: any, logger: any) => {
  const db = getFirestore();
  const expired = await db.collection("crm_import_jobs").where("expiresAt", "<=", Timestamp.now()).limit(100).get();
  for (const job of expired.docs) {
    const storagePath = String(job.data()?.storagePath || "");
    if (storagePath) await getStorage().bucket().file(storagePath).delete({ ignoreNotFound: true });
    await job.ref.set({ status: "expired", fileDeletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  logger.info("CRM import retention cleanup completed", { expiredJobs: expired.size, retentionDays: RETENTION_DAYS });
}));

void admin;
