import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default function auditLogger(app: FastifyInstance) {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    // Only log mutating requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const user = (request as any).user;
      const userId = user?.id || 'anonymous';
      
      app.log.info({
        audit: true,
        method: request.method,
        url: request.url,
        userId,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
        // Be careful not to log sensitive data like passwords
        body: request.url.includes('/login') ? '[REDACTED]' : request.body,
      }, 'Audit Log');
    }
  });
}
