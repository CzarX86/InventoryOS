import { collection, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { app, db } from "@/lib/firebase";

const FIREBASE_VERSION = "12.10.0";

function getMessagingConfigQuery() {
  const params = new URLSearchParams({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  });

  return params.toString();
}

function buildTokenDocId(userId, token) {
  return `${userId}_${token.replace(/[^a-zA-Z0-9]/g, "").slice(0, 80)}`;
}

export async function isPushSupported() {
  if (typeof window === "undefined") return false;
  const { isSupported } = await import("firebase/messaging");
  return isSupported();
}

export async function registerAdminPushToken(user) {
  if (!db || !user?.uid) {
    throw new Error("Usuario invalido para notificacoes.");
  }

  if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
    throw new Error("NEXT_PUBLIC_FIREBASE_VAPID_KEY nao configurada.");
  }

  const supported = await isPushSupported();
  if (!supported) {
    throw new Error("Push notifications nao sao suportadas neste navegador.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissao de notificacao negada pelo navegador.");
  }

  const swUrl = `/firebase-messaging-sw.js?${getMessagingConfigQuery()}&v=${FIREBASE_VERSION}`;
  const registration = await navigator.serviceWorker.register(swUrl, {
    scope: "/firebase-cloud-messaging-push-scope",
  });

  const { getMessaging, getToken } = await import("firebase/messaging");
  const messaging = getMessaging(app);
  const token = await getToken(messaging, {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });

  if (!token) {
    throw new Error("Nao foi possivel registrar o dispositivo para notificacoes.");
  }

  const tokenDocId = buildTokenDocId(user.uid, token);
  await setDoc(doc(collection(db, "admin_device_tokens"), tokenDocId), {
    userId: user.uid,
    userEmail: user.email || null,
    token,
    enabled: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    userAgent: navigator.userAgent,
  }, { merge: true });

  return {
    tokenDocId,
    token,
  };
}
