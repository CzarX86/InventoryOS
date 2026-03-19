import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { describeAppError } from "@/lib/errors";

const SENSITIVE_KEY_PATTERN = /(api.?key|token|authorization|secret|password|credential|cookie|base64|inlineData|audio|image)/i;
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || "local";

function truncate(value, max = 800) {
  if (typeof value !== "string") return value;
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function sanitizeValue(value, depth = 0) {
  if (value == null) return value;
  if (depth > 4) return "[truncated-depth]";

  if (typeof value === "string") {
    if (value.length > 2000) return "[truncated-string]";
    if (value.startsWith("data:")) return "[redacted-data-url]";
    return truncate(value, 500);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map(item => sanitizeValue(item, depth + 1));
  }

  if (typeof File !== "undefined" && value instanceof File) {
    return {
      name: value.name,
      type: value.type,
      size: value.size,
    };
  }

  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return {
      type: value.type,
      size: value.size,
    };
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 40)
        .map(([key, nested]) => [
          key,
          SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : sanitizeValue(nested, depth + 1),
        ])
    );
  }

  return truncate(String(value), 300);
}

export function buildErrorId(prefix = "ERR") {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function buildTicketId(prefix = "TKT") {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${date}-${suffix}`;
}

export function buildClientContext(extra = {}) {
  if (typeof window === "undefined") {
    return sanitizeValue(extra);
  }

  return sanitizeValue({
    route: window.location.pathname,
    href: window.location.href,
    online: navigator.onLine,
    userAgent: navigator.userAgent,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    appVersion: APP_VERSION,
    ...extra,
  });
}

export function buildTechnicalDetails(error) {
  return {
    technicalMessage: truncate(
      error?.message ||
      error?.cause?.message ||
      "Unknown error",
      1000
    ),
    stack: truncate(error?.stack || error?.cause?.stack || "", 4000),
    errorCode: error?.code || error?.cause?.code || null,
    httpStatus: Number(error?.status || error?.httpStatus || error?.cause?.status || 0) || null,
  };
}

export function buildAppErrorReport({
  error,
  source,
  action,
  user = null,
  context = {},
  errorId = buildErrorId(),
}) {
  const currentUser = user || auth?.currentUser || null;
  const description = describeAppError(error, context.errorContext || "generic");
  const technical = buildTechnicalDetails(error);

  return {
    errorId,
    status: "open",
    severity: description.severity,
    category: description.category,
    source,
    action,
    userId: currentUser?.uid || null,
    userEmail: currentUser?.email || null,
    role: currentUser?.role || null,
    humanMessage: description.humanMessage,
    knownReason: description.knownReason,
    userActions: description.userActions,
    technicalMessage: technical.technicalMessage,
    stack: technical.stack,
    errorCode: technical.errorCode,
    httpStatus: technical.httpStatus,
    clientContext: buildClientContext(context.clientContext || {}),
    reproductionContext: sanitizeValue(context.reproductionContext || {}),
    reportedByUser: false,
    reportedAt: null,
    ticketId: null,
    adminNotified: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export async function recordAppError(params) {
  if (!db) {
    return buildAppErrorReport(params);
  }

  const report = buildAppErrorReport(params);
  await setDoc(doc(db, "error_reports", report.errorId), report);
  return report;
}

export async function escalateErrorReport(errorId, user = null) {
  if (!db || !errorId) return null;

  const currentUser = user || auth?.currentUser || null;
  const errorRef = doc(db, "error_reports", errorId);
  const errorSnap = await getDoc(errorRef);
  if (!errorSnap.exists()) return null;

  const errorData = errorSnap.data();
  const ticketId = errorData.ticketId || buildTicketId();
  const ticketRef = doc(db, "support_tickets", ticketId);

  await setDoc(ticketRef, {
    ticketId,
    errorId,
    status: "open",
    priority: errorData.severity === "high" ? "high" : "normal",
    assignedAdminId: null,
    lastUpdatedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    createdByUserId: currentUser?.uid || null,
    createdByUserEmail: currentUser?.email || null,
    notificationStatus: "pending",
  }, { merge: true });

  await updateDoc(errorRef, {
    reportedByUser: true,
    reportedAt: serverTimestamp(),
    ticketId,
    updatedAt: serverTimestamp(),
  });

  return {
    errorId,
    ticketId,
  };
}

export async function updateErrorStatus(errorId, status, ticketId = null) {
  if (!db || !errorId) return;

  await updateDoc(doc(db, "error_reports", errorId), {
    status,
    updatedAt: serverTimestamp(),
  });

  if (ticketId) {
    await updateDoc(doc(db, "support_tickets", ticketId), {
      status,
      lastUpdatedAt: serverTimestamp(),
    });
  }
}

export function toUserFacingError(report) {
  if (!report) return null;
  return {
    errorId: report.errorId,
    humanMessage: report.humanMessage,
    knownReason: report.knownReason,
    userActions: report.userActions || [],
    category: report.category,
    severity: report.severity,
    reportedByUser: Boolean(report.reportedByUser),
    ticketId: report.ticketId || null,
  };
}
