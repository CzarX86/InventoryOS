"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.aggregateAiUsage = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const firestore_2 = require("firebase-admin/firestore");
const logger = __importStar(require("firebase-functions/logger"));
/**
 * Aggregates AI Usage into monthly summaries.
 * This makes the dashboard extremely cheap and fast.
 */
exports.aggregateAiUsage = (0, firestore_1.onDocumentWritten)("ai_runs/{runId}", async (event) => {
    const db = (0, firestore_2.getFirestore)();
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    // We only care if the run was completed just now
    if (!after || after.status !== "completed" || (before && before.status === "completed")) {
        return;
    }
    const cost = after.actualCostUsd || after.estimatedCostUsd || 0;
    const tokens = after.actualTotalTokenCount || after.estimatedTotalTokens || 0;
    // Use YYYYMM format for the summary document
    const date = new Date();
    const monthKey = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}`;
    const summaryRef = db.collection("system_usage").doc(`ai_usage_summary_${monthKey}`);
    try {
        const taskType = after.taskType || 'unknown';
        await summaryRef.set({
            month: monthKey,
            totalCostUsd: firestore_2.FieldValue.increment(cost),
            totalTokens: firestore_2.FieldValue.increment(tokens),
            totalRequests: firestore_2.FieldValue.increment(1),
            updatedAt: firestore_2.FieldValue.serverTimestamp(),
            lastRunId: event.params.runId,
            // Track top task type costs
            tasks: {
                [taskType]: {
                    cost: firestore_2.FieldValue.increment(cost),
                    count: firestore_2.FieldValue.increment(1)
                }
            }
        }, { merge: true });
        logger.info("Usage aggregated successfully", { monthKey, runId: event.params.runId });
    }
    catch (error) {
        logger.error("Usage aggregation failed", { error: error.message, runId: event.params.runId });
    }
});
//# sourceMappingURL=finops.js.map