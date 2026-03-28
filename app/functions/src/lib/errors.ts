import { createLogger, LogContext } from "./logger";
import { HttpsError } from "firebase-functions/v2/https";

/**
 * Universal Error Handling for Cloud Functions.
 * Supports both HTTP (req/res) and Event-based (event) functions.
 */

// For onRequest
export function withHttpErrorHandling(
  fn: (req: any, res: any, logger: any) => Promise<any>,
  baseContext: LogContext = {}
) {
  return async (req: any, res: any) => {
    const logger = createLogger({
      ...baseContext,
      correlationId: req.headers["x-correlation-id"],
    });

    try {
      return await fn(req, res, logger);
    } catch (error: any) {
      logger.error("HTTP Function execution failed", error);
      if (error instanceof HttpsError) throw error;
      
      // Send error response if not already sent
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          correlationId: logger.getCorrelationId(),
          message: "Check logs for more details"
        });
      }
    }
  };
}

// For onCall
export function withCallErrorHandling(
    fn: (request: any, logger: any) => Promise<any>,
    baseContext: LogContext = {}
  ) {
    return async (request: any) => {
      const logger = createLogger({
        ...baseContext,
        ownerId: request.auth?.uid,
      });
  
      try {
        return await fn(request, logger);
      } catch (error: any) {
        logger.error("Callable Function execution failed", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError("internal", `Internal error (CorrID: ${logger.getCorrelationId()})`);
      }
    };
  }

// For Event-based (onSchedule, onDocumentCreated, etc.)
export function withEventErrorHandling(
  fn: (event: any, logger: any) => Promise<any>,
  baseContext: LogContext = {}
) {
  return async (event: any) => {
    const logger = createLogger({
      ...baseContext,
      runId: event.id || event.params?.runId,
    });

    try {
      return await fn(event, logger);
    } catch (error: any) {
      logger.error("Event Function execution failed", error);
      // In events, we don't throw unless we want Firebase to retry.
      // For now, we just log and swallow to avoid infinite retry loops.
    }
  };
}
