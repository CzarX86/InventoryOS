/**
 * AI Orchestrator Core Types
 * Based on Schema documented in docs/architecture.md
 */

export type TaskStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;
  order: number;
  parameters?: Record<string, any>;
  result?: any;
  error?: string;
  dependencies?: string[]; // IDs of other tasks
}

export interface TaskPlan {
  id: string;
  goal: string;
  tasks: Task[];
  metadata: {
    model: string;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * FinOps / Cost Tracking Types
 */
export interface AiUsageSummary {
  month: string; // YYYYMM
  totalCostUsd: number;
  totalTokens: number;
  totalRequests: number;
  tasks: Record<string, {
    cost: number;
    count: number;
  }>;
  updatedAt: any; // Firestore serverTimestamp
}
