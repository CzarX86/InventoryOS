import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId,
);

/** @type {import("firebase/app").FirebaseApp | undefined} */
let app;
/** @type {import("firebase/auth").Auth | undefined} */
let auth;
/** @type {import("firebase/firestore").Firestore | undefined} */
let db;
/** @type {import("firebase/storage").FirebaseStorage | undefined} */
let storage;
/** @type {import("firebase/functions").Functions | undefined} */
let functions;

const googleProvider = new GoogleAuthProvider();
const shouldUseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const firestoreEmulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || "127.0.0.1";
const firestoreEmulatorPort = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || 8080);
const storageEmulatorHost = process.env.NEXT_PUBLIC_STORAGE_EMULATOR_HOST || "127.0.0.1";
const storageEmulatorPort = Number(process.env.NEXT_PUBLIC_STORAGE_EMULATOR_PORT || 9199);
const authEmulatorHost = process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const functionsEmulatorHost = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST || "127.0.0.1";
const functionsEmulatorPort = Number(process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001);
const localAuthBypass = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_AUTH_BYPASS === "true";

// The local auth bypass deliberately disables Firebase as well, so a fake
// development user can never read or write a real project by accident.
if (typeof window !== "undefined" && hasFirebaseConfig && !localAuthBypass) {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);

  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    db = getFirestore(app);
  }

  storage = getStorage(app);
  functions = getFunctions(app);

  if (shouldUseEmulators) {
    connectAuthEmulator(auth, `http://${authEmulatorHost}`);

    if (!window.__inventoryOsFirestoreEmulatorConnected) {
      connectFirestoreEmulator(db, firestoreEmulatorHost, firestoreEmulatorPort);
      window.__inventoryOsFirestoreEmulatorConnected = true;
    }

    if (!window.__inventoryOsStorageEmulatorConnected) {
      connectStorageEmulator(storage, storageEmulatorHost, storageEmulatorPort);
      window.__inventoryOsStorageEmulatorConnected = true;
    }

    if (!window.__inventoryOsFunctionsEmulatorConnected) {
      connectFunctionsEmulator(functions, functionsEmulatorHost, functionsEmulatorPort);
      window.__inventoryOsFunctionsEmulatorConnected = true;
    }
  }
}

export { app, auth, db, storage, functions, googleProvider };
