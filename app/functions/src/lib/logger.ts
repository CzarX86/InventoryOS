import * as logger from "firebase-functions/logger";

export interface LogContext {
  ownerId?: string | null;
  accountId?: string | null;
  correlationId?: string | null;
  runId?: string | null;
  [key: string]: any;
}

/**
 * Industrial Structured Logger.
 * Ensures every log has context and correlation IDs for tracing.
 */
export class StructuredLogger {
  private context: LogContext;

  constructor(context: LogContext = {}) {
    this.context = {
      correlationId: context.correlationId || `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...context
    };
  }

  info(message: string, data: any = {}) {
    logger.info(message, { ...this.context, ...data });
  }

  warn(message: string, data: any = {}) {
    logger.warn(message, { ...this.context, ...data });
  }

  error(message: string, error?: any, data: any = {}) {
    logger.error(message, {
      ...this.context,
      ...data,
      errorMessage: error?.message || error,
      stack: error?.stack,
    });
  }

  getCorrelationId() {
    return this.context.correlationId;
  }
  
  getContext() {
    return this.context;
  }
}

export const createLogger = (context: LogContext = {}) => new StructuredLogger(context);

// Convenience exports for global usage without explicit instantiation
const defaultLogger = createLogger();
export const info = (message: string, data?: any) => defaultLogger.info(message, data);
export const warn = (message: string, data?: any) => defaultLogger.warn(message, data);
export const error = (message: string, err?: any, data?: any) => defaultLogger.error(message, err, data);
