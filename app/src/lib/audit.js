import { addDoc, collection, deleteDoc, doc, setDoc, serverTimestamp } from "firebase/firestore";

export function createAuditTaskId(prefix = "task") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function normalizeUsageMetadata(usage = null) {
  if (!usage) return null;

  return {
    promptTokenCount: Number(usage.promptTokenCount) || 0,
    candidatesTokenCount: Number(usage.candidatesTokenCount) || 0,
    totalTokenCount: Number(usage.totalTokenCount) || 0,
    cachedContentTokenCount: Number(usage.cachedContentTokenCount) || 0,
  };
}

export function sumUsageMetadata(entries = []) {
  return entries.reduce(
    (acc, entry) => {
      const usage = normalizeUsageMetadata(entry?.usage);
      if (!usage) return acc;

      acc.promptTokenCount += usage.promptTokenCount;
      acc.candidatesTokenCount += usage.candidatesTokenCount;
      acc.totalTokenCount += usage.totalTokenCount;
      acc.cachedContentTokenCount += usage.cachedContentTokenCount;
      acc.calls.push({
        model: entry.model || null,
        source: entry.source || null,
        step: entry.step || null,
        usage,
      });
      return acc;
    },
    {
      promptTokenCount: 0,
      candidatesTokenCount: 0,
      totalTokenCount: 0,
      cachedContentTokenCount: 0,
      calls: [],
    }
  );
}

export function createTaskLedger({
  taskId,
  actorId,
  taskType = "NEW_PRODUCT",
  source = "inventory-create",
}) {
  return {
    taskId,
    actorId,
    taskType,
    source,
    promptTokenCount: 0,
    candidatesTokenCount: 0,
    totalTokenCount: 0,
    cachedContentTokenCount: 0,
    calls: [],
  };
}

export function appendTaskUsageCall(ledger, call) {
  const next = { ...ledger };
  const usage = normalizeUsageMetadata(call?.usage || call?.tokenUsage);

  if (!usage) return next;

  next.promptTokenCount += usage.promptTokenCount;
  next.candidatesTokenCount += usage.candidatesTokenCount;
  next.totalTokenCount += usage.totalTokenCount;
  next.cachedContentTokenCount += usage.cachedContentTokenCount;
  next.calls = [
    ...(ledger.calls || []),
    {
      source: call?.source || ledger.source || null,
      model: call?.model || null,
      step: call?.step || null,
      usage,
    },
  ];

  return next;
}

export function buildTaskUsageRecord(ledger, extra = {}) {
  return {
    taskId: ledger.taskId,
    actorId: ledger.actorId,
    taskType: ledger.taskType,
    source: ledger.source,
    promptTokenCount: ledger.promptTokenCount,
    candidatesTokenCount: ledger.candidatesTokenCount,
    totalTokenCount: ledger.totalTokenCount,
    cachedContentTokenCount: ledger.cachedContentTokenCount,
    calls: ledger.calls,
    ...extra,
  };
}

export function buildActivityEvent({
  actionType,
  actorId,
  actorEmail = null,
  targetType,
  targetId,
  before = null,
  after = null,
  reversible = false,
  metadata = {},
}) {
  return {
    actionType,
    actorId,
    actorEmail,
    targetType,
    targetId,
    before,
    after,
    reversible,
    metadata,
    createdAt: serverTimestamp(),
  };
}

export function buildUndoDescriptor(activity) {
  if (!activity?.reversible) return null;

  switch (activity.actionType) {
    case "CREATE_ITEM":
      return {
        actionType: "DELETE_ITEM",
        targetPath: ["inventory", activity.targetId],
        payload: null,
      };
    case "UPDATE_ITEM":
      return {
        actionType: "RESTORE_ITEM",
        targetPath: ["inventory", activity.targetId],
        payload: activity.before,
      };
    case "DELETE_ITEM":
      return {
        actionType: "RESTORE_ITEM",
        targetPath: ["inventory", activity.targetId],
        payload: activity.before,
      };
    default:
      return null;
  }
}

export function isActivityUndone(activityId, activityLogs = []) {
  return activityLogs.some(log => log?.actionType === "UNDO_ACTION" && log?.metadata?.targetActivityId === activityId);
}

export function sanitizeInventorySnapshot(snapshot) {
  if (!snapshot) return snapshot;
  const { id, date, ...rest } = snapshot;
  return rest;
}

export async function appendActivityEvent(db, event) {
  if (!db) return null;

  return addDoc(collection(db, "activity_log"), event);
}

export async function persistTaskUsage(db, ledger, extra = {}) {
  if (!db) return null;

  return addDoc(collection(db, "task_ai_usage"), {
    ...buildTaskUsageRecord(ledger, extra),
    createdAt: serverTimestamp(),
  });
}

export async function logInventoryActivity(db, event) {
  return appendActivityEvent(db, event);
}

export async function logTaskCompletion(db, ledger, extra = {}) {
  const taskUsageRef = await persistTaskUsage(db, ledger, extra);
  await appendActivityEvent(db, {
    actionType: "AI_TASK_COMPLETE",
    actorId: ledger.actorId,
    actorEmail: extra.actorEmail || null,
    targetType: "task_ai_usage",
    targetId: taskUsageRef?.id || ledger.taskId,
    before: null,
    after: buildTaskUsageRecord(ledger, extra),
    reversible: false,
    metadata: {
      taskId: ledger.taskId,
      itemId: extra.itemId || null,
      relatedActionType: extra.relatedActionType || "CREATE_ITEM",
    },
  });

  return taskUsageRef;
}

export async function undoActivityEvent(db, activity, actor) {
  if (!db) {
    return null;
  }

  const undoDescriptor = buildUndoDescriptor(activity);
  if (!undoDescriptor) {
    return null;
  }

  const targetRef = doc(db, undoDescriptor.targetPath[0], undoDescriptor.targetPath[1]);

  if (undoDescriptor.actionType === "DELETE_ITEM") {
    await deleteDoc(targetRef);
  } else {
    await setDoc(targetRef, {
      ...sanitizeInventorySnapshot(undoDescriptor.payload),
      updatedAt: serverTimestamp(),
    }, { merge: false });
  }

  return appendActivityEvent(db, {
    actionType: "UNDO_ACTION",
    actorId: actor?.uid || actor?.id || null,
    actorEmail: actor?.email || null,
    targetType: activity.targetType,
    targetId: activity.targetId,
    before: activity.after,
    after: activity.before,
    reversible: false,
    metadata: {
      targetActivityId: activity.id,
      undoActionType: undoDescriptor.actionType,
      originalActionType: activity.actionType,
    },
  });
}
