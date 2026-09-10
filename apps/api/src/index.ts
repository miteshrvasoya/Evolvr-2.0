import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import cookie from '@fastify/cookie';
import { env } from './config/env.js';
import { sql } from './db/client.js';
import { startWorkers, stopWorkers } from './workers/index.js';
import { closeQueues } from './queues/index.js';
import authPlugin from './modules/auth/auth.plugin.js';
import authRoutes from './modules/auth/auth.routes.js';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
    crossOriginResourcePolicy: false, // allow loading local images
  });

  await app.register(cookie);

  // Ensure storage directory exists before registering plugin
  const storageDir = path.resolve(env.STORAGE_LOCAL_DIR);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  // Serve Local Storage
  await app.register(fastifyStatic, {
    root: storageDir,
    prefix: '/storage/',
  });

  // Global Auth Plugin (JWT + Decorator)
  await app.register(authPlugin);

  // Register API Routes
  await app.register(authRoutes, { prefix: '/api/auth' });

  const socialRoutes = await import('./modules/social/social.routes.js');
  const oauthRoutes = await import('./modules/social/oauth.routes.js');
  const analyticsRoutes = await import('./modules/social/analytics.routes.js');
  const goalRoutes = await import('./modules/strategy/goal.routes.js');
  const agentRoutes = await import('./modules/agent/agent.routes.js');
  const systemRoutes = await import('./modules/system/system.routes.js');
  const frontendRoutes = await import('./modules/system/frontend.routes.js');
  const settingsRoutes = await import('./modules/system/settings.routes.js');
  const apiLoggerMiddleware = await import('./modules/common/api-logger.middleware.js');
  const { LoggerService } = await import('./modules/common/logger.service.js');

  apiLoggerMiddleware.default(app);

  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    const user = (request as any).user;
    LoggerService.logError({
      errorMessage: error.message || 'Unknown error',
      stackTrace: error.stack,
      context: {
        url: request.url,
        method: request.method,
        body: request.body,
        query: request.query,
        params: request.params
      },
      userId: user?.id
    });
    reply.status(error.statusCode || 500).send({ error: error.message || 'Internal Server Error' });
  });

  await app.register(socialRoutes.default, { prefix: '/api' });
  await app.register(oauthRoutes.default, { prefix: '/api' });
  await app.register(analyticsRoutes.default, { prefix: '/api' });
  await app.register(goalRoutes.default, { prefix: '/api' });
  await app.register(agentRoutes.default, { prefix: '/api' });
  await app.register(systemRoutes.default, { prefix: '/api' });
  await app.register(frontendRoutes.default, { prefix: '/api' });
  await app.register(settingsRoutes.default, { prefix: '/api' });

  // Health check endpoint
  app.get('/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      service: 'evolvr-api',
    };
  });

  // API info
  app.get('/api', async () => {
    return {
      name: 'Evolvr API',
      version: '0.1.0',
      status: 'running',
    };
  });

  return app;
}

async function start() {
  const app = await buildApp();

  // Start background workers
  startWorkers();

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      await stopWorkers();
      await closeQueues();
      await app.close();
      await sql.end();
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during graceful shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    const address = await app.listen({
      port: env.PORT,
      host: '0.0.0.0',
    });
    app.log.info(`🚀 Evolvr API server listening on ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Start server when executed directly
start();
