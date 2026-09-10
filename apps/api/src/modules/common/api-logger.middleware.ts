import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { LoggerService } from './logger.service.js';

export default function apiLoggerMiddleware(app: FastifyInstance) {
  // We attach the response payload to the reply so we can access it in onResponse
  app.addHook('onSend', async (request: FastifyRequest, reply: FastifyReply, payload: string) => {
    try {
      if (payload && reply.getHeader('content-type')?.toString().includes('application/json')) {
        (reply as any).responsePayload = JSON.parse(payload);
      } else {
        (reply as any).responsePayload = payload;
      }
    } catch (e) {
      (reply as any).responsePayload = payload;
    }
    return payload;
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const userId = user?.id;

    LoggerService.logApiCall({
      direction: 'inward',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      requestPayload: request.body,
      responsePayload: (reply as any).responsePayload,
      latencyMs: Math.round(reply.elapsedTime),
      userId
    });
  });
}
