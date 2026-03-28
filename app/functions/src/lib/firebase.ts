import { getFirestore, FieldValue } from "firebase-admin/firestore";

/**
 * Shared Firestore instance.
 * Assumes admin.initializeApp() has been called in index.ts.
 */
export const db = getFirestore();
export { FieldValue };
