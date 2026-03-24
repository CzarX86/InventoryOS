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
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Only initialize if we're in the browser or have a valid project ID
let app;
let auth;
let db;
let storage;
let functions;

const googleProvider = new GoogleAuthProvider(); // Define googleProvider here
const shouldUseEmulators = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === "true";
const firestoreEmulatorHost = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST || "127.0.0.1";
const firestoreEmulatorPort = Number(process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_PORT || 8080);
const storageEmulatorHost = process.env.NEXT_PUBLIC_STORAGE_EMULATOR_HOST || "127.0.0.1";
const storageEmulatorPort = Number(process.env.NEXT_PUBLIC_STORAGE_EMULATOR_PORT || 9199);
const authEmulatorHost = process.env.NEXT_PUBLIC_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const functionsEmulatorHost = process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_HOST || "127.0.0.1";
const functionsEmulatorPort = Number(process.env.NEXT_PUBLIC_FUNCTIONS_EMULATOR_PORT || 5001);

if (typeof window !== "undefined") {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
  
  // Enable offline persistence for Firestore
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (error) {
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
