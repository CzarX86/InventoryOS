import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type DeletedCrmContact = {
  id: string;
  contactId: string;
  displayName?: string | null;
  previousStatus?: string | null;
  deletedAt?: unknown;
  deletedBy?: string | null;
  status: "deleted" | "restored";
};

function requireFunctions() {
  if (!functions) throw new Error("Firebase Functions indisponível neste ambiente.");
  return functions;
}

export async function deleteCrmContact(contactId: string) {
  const callable = httpsCallable<{ contactId: string }, { contactId: string; deletionId: string; status: string }>(requireFunctions(), "deleteCrmContact");
  const result = await callable({ contactId });
  return result.data;
}

export async function listDeletedCrmContacts() {
  const callable = httpsCallable<Record<string, never>, { items: DeletedCrmContact[] }>(requireFunctions(), "listDeletedCrmContacts");
  const result = await callable({});
  return result.data;
}

export async function restoreCrmContact(deletionId: string) {
  const callable = httpsCallable<{ deletionId: string }, { contactId: string; deletionId: string; status: string }>(requireFunctions(), "restoreCrmContact");
  const result = await callable({ deletionId });
  return result.data;
}
