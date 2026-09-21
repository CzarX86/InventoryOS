import { BigQuery } from "@google-cloud/bigquery";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { withEventErrorHandling } from "./lib/errors";

const BILLING_SOURCE = "gcp_billing_export";
const BILLING_TABLE_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export type BillingExportConfig = {
  projectId: string;
  dataset: string;
  table: string;
  location?: string;
};

export type NormalizedBillingRow = {
  monthKey: string;
  service: string;
  currency: string;
  grossCostUsd: number;
  creditsUsd: number;
  officialCostUsd: number;
  projectId: string | null;
};

export type BillingMonthSummary = {
  monthKey: string;
  currency: string;
  grossCostUsd: number;
  creditsUsd: number;
  officialCostUsd: number;
  rowCount: number;
  services: string[];
  projectIds: string[];
};

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
  return Number(value.toFixed(6));
}

function monthKeyFromValue(value: unknown): string | null {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sumCredits(value: unknown): number {
  if (!Array.isArray(value)) return toNumber(value);
  return value.reduce((total, credit) => total + toNumber(credit?.amount), 0);
}

export function normalizeBillingRow(row: any = {}): NormalizedBillingRow | null {
  const monthKey = monthKeyFromValue(row.usage_start_time || row.usage_start_date);
  if (!monthKey) return null;

  const grossCostUsd = toNumber(row.cost);
  const creditsUsd = sumCredits(row.credits);
  return {
    monthKey,
    service: String(row.service || row.service_description || "Unknown service"),
    currency: String(row.currency || "USD"),
    grossCostUsd: roundMoney(grossCostUsd),
    creditsUsd: roundMoney(creditsUsd),
    officialCostUsd: roundMoney(grossCostUsd + creditsUsd),
    projectId: row.project_id ? String(row.project_id) : null,
  };
}

export function summarizeBillingRows(rows: any[] = []): BillingMonthSummary[] {
  const summaries = new Map<string, BillingMonthSummary>();

  for (const rawRow of rows) {
    const row = normalizeBillingRow(rawRow);
    if (!row) continue;
    const current = summaries.get(row.monthKey) || {
      monthKey: row.monthKey,
      currency: row.currency,
      grossCostUsd: 0,
      creditsUsd: 0,
      officialCostUsd: 0,
      rowCount: 0,
      services: [],
      projectIds: [],
    };

    current.grossCostUsd = roundMoney(current.grossCostUsd + row.grossCostUsd);
    current.creditsUsd = roundMoney(current.creditsUsd + row.creditsUsd);
    current.officialCostUsd = roundMoney(current.officialCostUsd + row.officialCostUsd);
    current.rowCount += 1;
    if (!current.services.includes(row.service)) current.services.push(row.service);
    if (row.projectId && !current.projectIds.includes(row.projectId)) current.projectIds.push(row.projectId);
    summaries.set(row.monthKey, current);
  }

  return Array.from(summaries.values()).sort((left, right) => left.monthKey.localeCompare(right.monthKey));
}

export function getBillingExportConfig(env: Record<string, string | undefined> = process.env): BillingExportConfig | null {
  const projectId = env.BILLING_EXPORT_PROJECT_ID?.trim();
  const dataset = env.BILLING_EXPORT_DATASET?.trim();
  const table = env.BILLING_EXPORT_TABLE?.trim();
  if (!projectId || !dataset || !table) return null;

  return {
    projectId,
    dataset,
    table,
    location: env.BILLING_EXPORT_LOCATION?.trim() || "US",
  };
}

export function buildBillingExportQuery(config: BillingExportConfig): string {
  const tableIdentifier = `${config.projectId}.${config.dataset}.${config.table}`;
  if (!BILLING_TABLE_PATTERN.test(tableIdentifier)) {
    throw new Error("Billing Export table identifier is invalid.");
  }

  return `
    SELECT
      usage_start_time,
      cost,
      credits,
      currency,
      service.description AS service,
      project.id AS project_id
    FROM \`${tableIdentifier}\`
    WHERE usage_start_time >= TIMESTAMP(@from)
      AND usage_start_time < TIMESTAMP(@to)
      AND REGEXP_CONTAINS(LOWER(service.description), r'(vertex ai|generative ai|ai platform|gemini)')
  `;
}

function getBillingWindow(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return { from, to: now };
}

export const reconcileAiBillingExport = onSchedule(
  {
    schedule: "every 24 hours",
    timeZone: "UTC",
  },
  withEventErrorHandling(async (_event: any, logger: any) => {
    const config = getBillingExportConfig();
    if (!config) {
      logger.info("AI billing reconciliation skipped: Billing Export is not configured");
      return { status: "disabled" };
    }

    const { from, to } = getBillingWindow();
    const bigquery = new BigQuery({ projectId: config.projectId });
    const [rows] = await bigquery.query({
      query: buildBillingExportQuery(config),
      params: { from: from.toISOString(), to: to.toISOString() },
      location: config.location,
      useLegacySql: false,
    });
    const summaries = summarizeBillingRows(rows as any[]);
    const db = getFirestore();
    const syncedAt = Timestamp.now();
    const batch = db.batch();

    for (const summary of summaries) {
      batch.set(
        db.collection("system_billing_reconciliation").doc(summary.monthKey),
        {
          ...summary,
          source: BILLING_SOURCE,
          projectId: config.projectId,
          dataset: config.dataset,
          table: config.table,
          syncedAt,
        },
      );
      batch.set(
        db.collection("system_usage").doc(`ai_usage_summary_${summary.monthKey}`),
        {
          officialCostUsd: summary.officialCostUsd,
          officialCostCurrency: summary.currency,
          officialCostSource: BILLING_SOURCE,
          officialCostRows: summary.rowCount,
          officialCostSyncedAt: syncedAt,
        },
        { merge: true },
      );
    }

    if (summaries.length > 0) await batch.commit();
    logger.info("AI billing reconciliation completed", {
      source: BILLING_SOURCE,
      months: summaries.map((summary) => summary.monthKey),
      rowCount: rows.length,
    });
    return { status: "completed", months: summaries.length, rowCount: rows.length };
  }),
);
