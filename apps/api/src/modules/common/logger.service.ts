import { sql } from '../../db/client.js';

interface ApiLogData {
  direction: 'inward' | 'outward';
  method: string;
  url: string;
  statusCode: number;
  requestPayload?: any;
  responsePayload?: any;
  latencyMs: number;
  userId?: string;
}

interface ErrorLogData {
  errorMessage: string;
  stackTrace?: string;
  context?: any;
  userId?: string;
}

const redactSensitiveData = (data: any): any => {
  if (!data) return data;
  if (typeof data !== 'object') return data;
  
  const redacted = { ...data };
  const sensitiveKeys = ['password', 'token', 'authorization', 'apiKey', 'api_key', 'client_secret', 'secret'];
  
  for (const key of Object.keys(redacted)) {
    if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
      redacted[key] = redactSensitiveData(redacted[key]);
    }
  }
  return redacted;
};

export class LoggerService {
  /**
   * Logs an API call (inward or outward) to the database asynchronously.
   */
  static logApiCall(data: ApiLogData) {
    const redactedRequest = redactSensitiveData(data.requestPayload);
    const redactedResponse = redactSensitiveData(data.responsePayload);

    // Fire and forget
    sql`
      INSERT INTO api_logs (
        direction, method, url, status_code, request_payload, 
        response_payload, latency_ms, user_id
      ) VALUES (
        ${data.direction}, ${data.method}, ${data.url}, ${data.statusCode}, 
        ${sql.json(redactedRequest || {})}, ${sql.json(redactedResponse || {})}, 
        ${data.latencyMs}, ${data.userId || null}
      )
    `.catch(err => {
      console.error('[LoggerService] Failed to insert API log:', err);
    });
  }

  /**
   * Logs an error to the database asynchronously.
   */
  static logError(data: ErrorLogData) {
    const redactedContext = redactSensitiveData(data.context);

    // Fire and forget
    sql`
      INSERT INTO error_logs (
        error_message, stack_trace, context, user_id
      ) VALUES (
        ${data.errorMessage}, ${data.stackTrace || null}, 
        ${sql.json(redactedContext || {})}, ${data.userId || null}
      )
    `.catch(err => {
      console.error('[LoggerService] Failed to insert error log:', err);
    });
  }
}
