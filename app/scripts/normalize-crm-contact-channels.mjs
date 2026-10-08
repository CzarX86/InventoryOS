#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { chmod, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NORMALIZER_PATH = pathToFileURL(path.resolve("src/lib/crmChannelNormalization.ts")).href;
const {
  canonicalPhoneKey,
  isValidEmailAddress,
  normalizeCorruptedPhoneLabel,
  normalizeEmailEntries,
  normalizePhoneEntries,
  normalizePhoneForStorage,
  phoneDigitsForStorage,
  parseEmailChannelValue,
  parsePhoneChannelValue,
} = await import(NORMALIZER_PATH);

const args = process.argv.slice(2);
const applyChanges = args.includes("--apply");
const labelsOnly = args.includes("--labels-only");
const projectIndex = args.indexOf("--project");
const projectId = projectIndex >= 0 ? args[projectIndex + 1] : "";

if (!projectId) throw new Error("Informe o projeto Firebase com --project.");
if (applyChanges && projectId !== "inventory-os-app") {
  throw new Error("A aplicação da migração está restrita ao projeto de produção inventory-os-app.");
}

const apiRoot = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents`;
const token = execFileSync("gcloud", ["auth", "print-access-token"], { encoding: "utf8" }).trim();

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Firestore REST ${response.status}: ${body.slice(0, 400)}`);
  }
  return response.status === 204 ? null : response.json();
}

async function listCollection(collectionId) {
  const result = [];
  let pageToken = "";
  do {
    const url = new URL(`${apiRoot}/${collectionId}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const page = await request(url);
    result.push(...(page.documents || []));
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return result;
}

function decodeValue(value) {
  if (Object.hasOwn(value, "stringValue")) return value.stringValue;
  if (Object.hasOwn(value, "integerValue")) return Number(value.integerValue);
  if (Object.hasOwn(value, "doubleValue")) return value.doubleValue;
  if (Object.hasOwn(value, "booleanValue")) return value.booleanValue;
  if (Object.hasOwn(value, "timestampValue")) return value.timestampValue;
  if (Object.hasOwn(value, "nullValue")) return null;
  if (Object.hasOwn(value, "arrayValue")) return (value.arrayValue.values || []).map(decodeValue);
  if (Object.hasOwn(value, "mapValue")) return decodeFields(value.mapValue.fields || {});
  return null;
}

function decodeFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]));
}

function encodeValue(value) {
  if (value == null) return { nullValue: null };
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  if (typeof value === "object") {
    return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, encodeValue(item)])) } };
  }
  return { stringValue: String(value) };
}

function encodeFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, encodeValue(value)]));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function documentId(document) {
  return document.name.split("/").at(-1);
}

function phoneSources(contact, channelDocuments) {
  const embedded = Array.isArray(contact.phoneNumbers) && contact.phoneNumbers.length
    ? contact.phoneNumbers
    : contact.phoneNumber ? [{ label: "Principal", value: contact.phoneNumber }] : [];
  const channels = channelDocuments.map((document) => {
    const data = decodeFields(document.fields);
    return { label: data.label || "Telefone", value: data.channelValue || "", hasWhatsapp: Boolean(data.hasWhatsapp) };
  });
  return [...embedded, ...channels];
}

function emailSources(contact, channelDocuments) {
  const embedded = Array.isArray(contact.emails) && contact.emails.length
    ? contact.emails
    : contact.email ? [{ label: "Principal", value: contact.email }] : [];
  const channels = channelDocuments.map((document) => {
    const data = decodeFields(document.fields);
    return { label: data.label || "E-mail", value: data.channelValue || "" };
  });
  return [...embedded, ...channels];
}

function preferredPhoneSources(contact, channelDocuments) {
  if (Array.isArray(contact.phoneNumbers) && contact.phoneNumbers.length) return contact.phoneNumbers;
  if (contact.phoneNumber) return [{ label: "Principal", value: contact.phoneNumber }];
  return channelDocuments.map((document) => {
    const data = decodeFields(document.fields);
    return { label: data.label || "Telefone", value: data.channelValue || "", hasWhatsapp: Boolean(data.hasWhatsapp) };
  });
}

function preferredEmailSources(contact, channelDocuments) {
  if (Array.isArray(contact.emails) && contact.emails.length) return contact.emails;
  if (contact.email) return [{ label: "Principal", value: contact.email }];
  return channelDocuments.map((document) => {
    const data = decodeFields(document.fields);
    return { label: data.label || "E-mail", value: data.channelValue || "" };
  });
}

function resourceName(collectionId, id) {
  return `projects/${projectId}/databases/(default)/documents/${collectionId}/${id}`;
}

function phoneChannelKey(value) {
  return canonicalPhoneKey(value) || String(value || "").trim().toLocaleLowerCase("pt-BR");
}

function emailChannelKey(value) {
  const normalized = String(value || "").trim();
  return isValidEmailAddress(normalized)
    ? normalized.toLocaleLowerCase("pt-BR")
    : `ambiguous:${normalized}`;
}

function channelWrites({ contactDocument, contact, documents, entries, type, writeOperations, stats }) {
  if (!entries.length && !documents.length) return;
  const collectionId = "contact_channels";
  const orderedDocuments = [...documents].sort((left, right) => {
    const leftData = decodeFields(left.fields);
    const rightData = decodeFields(right.fields);
    return Number(Boolean(rightData.isPrimary)) - Number(Boolean(leftData.isPrimary))
      || String(leftData.createdAt || "").localeCompare(String(rightData.createdAt || ""));
  });
  const keyFor = type === "phone" ? phoneChannelKey : emailChannelKey;
  const assigned = new Set();
  const entryForDocument = new Map();

  for (const entry of entries) {
    const key = keyFor(entry.value);
    const matching = orderedDocuments.find((document) => {
      if (assigned.has(document.name)) return false;
      const data = decodeFields(document.fields);
      const parsed = type === "phone"
        ? parsePhoneChannelValue(data.channelValue)
        : parseEmailChannelValue(data.channelValue);
      return parsed.values.some((value) => keyFor(value) === key);
    });
    if (matching) {
      assigned.add(matching.name);
      entryForDocument.set(matching.name, entry);
    }
  }

  const now = new Date().toISOString();
  entries.forEach((entry, index) => {
    const key = keyFor(entry.value);
    const existing = entryForDocument.size
      ? [...entryForDocument.entries()].find(([, assignedEntry]) => keyFor(assignedEntry.value) === key)?.[0]
      : undefined;
    if (existing) {
      const document = orderedDocuments.find((item) => item.name === existing);
      const data = decodeFields(document.fields);
      const channelFields = {
        channelValue: entry.value,
        label: entry.label || (type === "phone" ? "Telefone" : "E-mail"),
        isPrimary: index === 0,
        status: "active",
      };
      if (type === "phone") {
        channelFields.phoneDigits = entry.digits || null;
        channelFields.hasWhatsapp = Boolean(entry.hasWhatsapp);
      }
      if (Object.entries(channelFields).some(([key, value]) => stableJson(data[key]) !== stableJson(value))) {
        writeOperations.push({
          update: { name: document.name, fields: encodeFields(channelFields) },
          updateMask: { fieldPaths: Object.keys(channelFields) },
          currentDocument: { updateTime: document.updateTime },
        });
        stats.updatedChannels += 1;
      }
      return;
    }

    const newId = randomUUID().replaceAll("-", "");
    const channelFields = {
      type: "contact_channel",
      accountId: contact.companyId || null,
      companyId: contact.companyId || null,
      contactId: documentId(contactDocument),
      channelType: type,
      channelValue: entry.value,
      ...(type === "phone" ? { phoneDigits: entry.digits || null, hasWhatsapp: Boolean(entry.hasWhatsapp) } : {}),
      label: entry.label || (type === "phone" ? "Telefone" : "E-mail"),
      isPrimary: index === 0,
      status: "active",
      workspaceId: contact.workspaceId || null,
      ...(contact.ownerId ? { ownerId: contact.ownerId } : {}),
      createdAt: new Date(now),
    };
    writeOperations.push({
      update: { name: resourceName(collectionId, newId), fields: encodeFields(channelFields) },
      currentDocument: { exists: false },
    });
    stats.createdChannels += 1;
  });

  for (const document of orderedDocuments) {
    if (assigned.has(document.name)) continue;
    const data = decodeFields(document.fields);
    const value = String(data.channelValue || "").trim();
    if (!value) continue;
    const entry = entries.find((candidate) => keyFor(candidate.value) === keyFor(value));
    if (!entry) continue;
    // A duplicate channel document has no unique value. Remove only that redundant active channel row.
    writeOperations.push({ delete: document.name, currentDocument: { updateTime: document.updateTime } });
    stats.deletedDuplicateChannels += 1;
  }
}

const [rawContacts, rawChannels] = await Promise.all([
  listCollection("contacts"),
  listCollection("contact_channels"),
]);
const contactDocuments = rawContacts.map((document) => ({ document, data: decodeFields(document.fields) }));
const channelsByContact = new Map();
for (const document of rawChannels) {
  const data = decodeFields(document.fields);
  if (!data.contactId || !["phone", "email"].includes(data.channelType) || ["deleted", "inactive", "merged"].includes(data.status)) continue;
  const list = channelsByContact.get(data.contactId) || [];
  list.push(document);
  channelsByContact.set(data.contactId, list);
}

if (labelsOnly) {
  const stats = {
    contactsRead: contactDocuments.length,
    channelDocumentsRead: rawChannels.length,
    phoneEntriesRepaired: 0,
    contactDocumentsUpdated: 0,
    channelDocumentsUpdated: 0,
    phoneEntriesSetToCellular: 0,
    phoneEntriesSetToGenericTelephone: 0,
    channelLabelsSetToCellular: 0,
    channelLabelsSetToGenericTelephone: 0,
    writes: 0,
    mode: applyChanges ? "apply" : "dry-run",
  };
  const operations = [];
  const backupDocuments = new Map();

  const stageUpdate = (document, fields) => {
    operations.push({
      update: { name: document.name, fields: encodeFields(fields) },
      updateMask: { fieldPaths: Object.keys(fields) },
      currentDocument: { updateTime: document.updateTime },
    });
    backupDocuments.set(document.name, { name: document.name, updateTime: document.updateTime, fields: document.fields });
  };

  for (const { document, data: contact } of contactDocuments) {
    const phoneEntries = Array.isArray(contact.phoneNumbers) ? contact.phoneNumbers : [];
    if (!phoneEntries.length) continue;
    let changed = false;
    const repairedEntries = phoneEntries.map((entry) => {
      const originalLabel = String(entry?.label ?? "");
      const label = normalizeCorruptedPhoneLabel(originalLabel, entry?.value);
      if (label === originalLabel) return entry;
      changed = true;
      stats.phoneEntriesRepaired += 1;
      if (label === "Celular") stats.phoneEntriesSetToCellular += 1;
      if (label === "Telefone") stats.phoneEntriesSetToGenericTelephone += 1;
      return { ...entry, label };
    });
    if (changed) {
      stageUpdate(document, { phoneNumbers: repairedEntries });
      stats.contactDocumentsUpdated += 1;
    }
  }

  for (const document of rawChannels) {
    const channel = decodeFields(document.fields);
    if (channel.channelType !== "phone" || ["deleted", "inactive", "merged"].includes(channel.status)) continue;
    const originalLabel = String(channel.label ?? "");
    const label = normalizeCorruptedPhoneLabel(originalLabel, channel.channelValue);
    if (label === originalLabel) continue;
    if (label === "Celular") stats.channelLabelsSetToCellular += 1;
    if (label === "Telefone") stats.channelLabelsSetToGenericTelephone += 1;
    stageUpdate(document, { label });
    stats.channelDocumentsUpdated += 1;
  }

  stats.writes = operations.length;
  console.log(JSON.stringify(stats, null, 2));
  if (!applyChanges || !operations.length) process.exit(0);

  const backupPath = path.join(os.tmpdir(), `inventoryos-crm-phone-label-backup-${new Date().toISOString().replaceAll(":", "-")}.json`);
  await writeFile(backupPath, JSON.stringify({ projectId, createdAt: new Date().toISOString(), documents: [...backupDocuments.values()] }, null, 2), { mode: 0o600, flag: "wx" });
  await chmod(backupPath, 0o600);
  for (let offset = 0; offset < operations.length; offset += 450) {
    await request(`${apiRoot}:commit`, {
      method: "POST",
      body: JSON.stringify({ writes: operations.slice(offset, offset + 450) }),
    });
  }
  console.log(JSON.stringify({ applied: true, writes: operations.length, secureBackup: backupPath }, null, 2));
  process.exit(0);
}

const stats = {
  contactsRead: contactDocuments.length,
  channelsRead: rawChannels.length,
  changedContacts: 0,
  updatedChannels: 0,
  createdChannels: 0,
  deletedDuplicateChannels: 0,
  contactsWithSplitPhones: 0,
  phoneValuesSplit: 0,
  contactsWithSplitEmails: 0,
  emailValuesSplit: 0,
  duplicatePhonesRemoved: 0,
  duplicateEmailsRemoved: 0,
  ambiguousPhoneFields: 0,
  ambiguousEmailFields: 0,
  phoneLabelsRepaired: 0,
  phoneLabelsSetToCellular: 0,
  phoneLabelsSetToGenericTelephone: 0,
};

const operations = [];
const backupDocuments = [];
const details = [];
for (const { document, data: contact } of contactDocuments) {
  const operationStart = operations.length;
  const id = documentId(document);
  const contactChannels = channelsByContact.get(id) || [];
  const phoneDocuments = contactChannels.filter((channel) => decodeFields(channel.fields).channelType === "phone");
  const emailDocuments = contactChannels.filter((channel) => decodeFields(channel.fields).channelType === "email");
  const fieldsToUpdate = {};

  const phoneInput = phoneSources(contact, phoneDocuments);
  const primaryPhoneInput = preferredPhoneSources(contact, phoneDocuments);
  if (phoneInput.some((entry) => String(typeof entry === "string" ? entry : entry?.value || "").trim())) {
    const normalized = normalizePhoneEntries(phoneInput, contact.whatsappPhoneDigits || []);
    const phoneEntries = normalized.entries.map((entry) => {
      const value = normalizePhoneForStorage(entry.value);
      const digits = phoneDigitsForStorage(value);
      const label = normalizeCorruptedPhoneLabel(entry.label, value);
      if (label !== entry.label) {
        stats.phoneLabelsRepaired += 1;
        if (label === "Celular") stats.phoneLabelsSetToCellular += 1;
        if (label === "Telefone") stats.phoneLabelsSetToGenericTelephone += 1;
      }
      return { ...entry, label, value, digits };
    });
    const sourceQuality = normalizePhoneEntries(primaryPhoneInput, contact.whatsappPhoneDigits || []);
    if (sourceQuality.ambiguousValues) stats.ambiguousPhoneFields += 1;
    stats.duplicatePhonesRemoved += sourceQuality.duplicatesRemoved;
    const phoneSplits = primaryPhoneInput.map((entry) => parsePhoneChannelValue(typeof entry === "string" ? entry : entry?.value));
    if (phoneSplits.some((parsed) => parsed.values.length > 1)) stats.contactsWithSplitPhones += 1;
    stats.phoneValuesSplit += phoneSplits.reduce((sum, parsed) => sum + Math.max(0, parsed.values.length - 1), 0);

    const digits = phoneEntries.map((entry) => entry.digits).filter(Boolean);
    const priorDigits = Array.isArray(contact.phoneDigitsList) ? contact.phoneDigitsList : contact.phoneDigits ? [contact.phoneDigits] : [];
    const phoneDigitsList = [...new Set([
      ...digits,
      ...priorDigits.map(phoneDigitsForStorage).filter(Boolean),
    ])];
    const whatsappDigits = [...new Set([
      ...phoneEntries.filter((entry) => entry.hasWhatsapp).map((entry) => entry.digits),
      ...(Array.isArray(contact.whatsappPhoneDigits) ? contact.whatsappPhoneDigits : [])
        .map(phoneDigitsForStorage),
    ].filter(Boolean))];
    fieldsToUpdate.phoneNumbers = phoneEntries.map(({ label, value, hasWhatsapp }) => ({ label, value, hasWhatsapp }));
    fieldsToUpdate.phoneNumber = phoneEntries[0]?.value || null;
    fieldsToUpdate.phoneDigits = phoneEntries[0]?.digits || null;
    fieldsToUpdate.phoneDigitsList = phoneDigitsList;
    fieldsToUpdate.whatsappPhoneDigits = whatsappDigits;
    if (contact.status !== "deleted") {
      channelWrites({ contactDocument: document, contact, documents: phoneDocuments, entries: phoneEntries, type: "phone", writeOperations: operations, stats });
    }
  }

  const emailInput = emailSources(contact, emailDocuments);
  const primaryEmailInput = preferredEmailSources(contact, emailDocuments);
  if (emailInput.some((entry) => String(typeof entry === "string" ? entry : entry?.value || "").trim())) {
    const normalized = normalizeEmailEntries(emailInput);
    const emailEntries = normalized.entries;
    const sourceQuality = normalizeEmailEntries(primaryEmailInput);
    if (sourceQuality.ambiguousValues) stats.ambiguousEmailFields += 1;
    stats.duplicateEmailsRemoved += sourceQuality.duplicatesRemoved;
    const emailSplits = primaryEmailInput.map((entry) => parseEmailChannelValue(typeof entry === "string" ? entry : entry?.value));
    if (emailSplits.some((parsed) => parsed.values.length > 1)) stats.contactsWithSplitEmails += 1;
    stats.emailValuesSplit += emailSplits.reduce((sum, parsed) => sum + Math.max(0, parsed.values.length - 1), 0);

    const hasSafeEmail = emailEntries.some((entry) => isValidEmailAddress(entry.value));
    if (hasSafeEmail) {
      fieldsToUpdate.emails = emailEntries.map(({ label, value }) => ({ label, value }));
      fieldsToUpdate.email = emailEntries[0]?.value || null;
      if (contact.status !== "deleted") {
        channelWrites({ contactDocument: document, contact, documents: emailDocuments, entries: emailEntries, type: "email", writeOperations: operations, stats });
      }
    }
  }

  let changedFieldNames = [];
  if (Object.keys(fieldsToUpdate).length) {
    const current = decodeFields(document.fields);
    const changedFields = Object.fromEntries(Object.entries(fieldsToUpdate).filter(([key, value]) => stableJson(current[key]) !== stableJson(value)));
    if (Object.keys(changedFields).length) {
      changedFieldNames = Object.keys(changedFields);
      operations.push({
        update: { name: document.name, fields: encodeFields(changedFields) },
        updateMask: { fieldPaths: Object.keys(changedFields) },
        currentDocument: { updateTime: document.updateTime },
      });
      backupDocuments.push({ name: document.name, updateTime: document.updateTime, fields: document.fields });
      stats.changedContacts += 1;
    }
  }
  details.push({
    record: details.length + 1,
    embeddedPhones: Array.isArray(contact.phoneNumbers) ? contact.phoneNumbers.length : Number(Boolean(contact.phoneNumber)),
    embeddedEmails: Array.isArray(contact.emails) ? contact.emails.length : Number(Boolean(contact.email)),
    activePhoneChannels: phoneDocuments.length,
    activeEmailChannels: emailDocuments.length,
    normalizedPhones: fieldsToUpdate.phoneNumbers?.length ?? null,
    normalizedEmails: fieldsToUpdate.emails?.length ?? null,
    changedFields: changedFieldNames,
    operations: operations.length - operationStart,
  });
}

const changedChannelNames = new Set(operations.flatMap((operation) => operation.update?.name ? [operation.update.name] : operation.delete ? [operation.delete] : []));
for (const document of rawChannels) {
  if (changedChannelNames.has(document.name)) backupDocuments.push({ name: document.name, updateTime: document.updateTime, fields: document.fields });
}

const summary = { ...stats, operations: operations.length, mode: applyChanges ? "apply" : "dry-run" };
console.log(JSON.stringify(summary, null, 2));
if (args.includes("--details")) console.log(JSON.stringify({ records: details }, null, 2));

if (!applyChanges || !operations.length) process.exit(0);

const backupPath = path.join(os.tmpdir(), `inventoryos-crm-channel-backup-${new Date().toISOString().replaceAll(":", "-")}.json`);
await writeFile(backupPath, JSON.stringify({ projectId, createdAt: new Date().toISOString(), documents: backupDocuments }, null, 2), { mode: 0o600, flag: "wx" });
await chmod(backupPath, 0o600);

for (let offset = 0; offset < operations.length; offset += 450) {
  await request(`${apiRoot}:commit`, {
    method: "POST",
    body: JSON.stringify({ writes: operations.slice(offset, offset + 450) }),
  });
}

console.log(JSON.stringify({ applied: true, writes: operations.length, secureBackup: backupPath }, null, 2));
