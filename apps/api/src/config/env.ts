import { z } from 'zod';

const envSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  NEXT_PUBLIC_API_URL: z.string().default('http://localhost:3001'),

  // Database
  DATABASE_URL: z.string().default('postgresql://evolvr:evolvr@localhost:5432/evolvr'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Auth
  JWT_SECRET: z.string().default('change-me-to-a-random-32-char-string'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ADMIN_EMAIL: z.string().email().default('admin@example.com'),
  ADMIN_PASSWORD_HASH: z.string().default(''),

  // LLM Providers
  LLM_PROVIDER: z.enum(['openrouter', 'gemini', 'openai', 'anthropic']).default('openrouter'),
  OPENROUTER_API_KEY: z.string().default(''),
  OPENROUTER_BASE_URL: z.string().default('https://openrouter.ai/api/v1'),
  OPENROUTER_DEFAULT_MODEL: z.string().default('openai/gpt-4o-mini'),
  OPENROUTER_STRONG_MODEL: z.string().default('anthropic/claude-3-5-sonnet'),

  GEMINI_API_KEY: z.string().default(''),
  GEMINI_DEFAULT_MODEL: z.string().default('gemini-1.5-flash'),
  GEMINI_STRONG_MODEL: z.string().default('gemini-1.5-pro'),

  OPENAI_API_KEY: z.string().default(''),
  OPENAI_DEFAULT_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_STRONG_MODEL: z.string().default('gpt-4o'),

  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_DEFAULT_MODEL: z.string().default('claude-3-haiku-20240307'),
  ANTHROPIC_STRONG_MODEL: z.string().default('claude-3-5-sonnet-20241022'),

  // Research Provider
  RESEARCH_PROVIDER: z.enum(['serper', 'tavily']).default('serper'),
  SERPER_API_KEY: z.string().default(''),
  TAVILY_API_KEY: z.string().default(''),

  // Instagram / Meta
  META_APP_ID: z.string().default(''),
  META_APP_SECRET: z.string().default(''),
  INSTAGRAM_APP_ID: z.string().default(''),
  INSTAGRAM_APP_SECRET: z.string().default(''),
  META_WEBHOOK_VERIFY_TOKEN: z.string().default('change-me-random-string'),
  INSTAGRAM_REDIRECT_URI: z.string().default('http://localhost:3001/api/oauth/instagram/callback'),
  INSTAGRAM_API_VERSION: z.string().default('v21.0'),

  // Object Storage
  STORAGE_PROVIDER: z.enum(['local', 's3', 'r2']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./storage'),
  STORAGE_BUCKET: z.string().default('evolvr-assets'),
  STORAGE_ENDPOINT: z.string().default(''),
  STORAGE_ACCESS_KEY: z.string().default(''),
  STORAGE_SECRET_KEY: z.string().default(''),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_PUBLIC_URL: z.string().default(''),

  // Media Generation
  MEDIA_PROVIDER: z.enum(['stub', 'openai-dall-e', 'stability-ai']).default('stub'),
  STABILITY_API_KEY: z.string().default(''),

  // Encryption
  ENCRYPTION_KEY: z.string().default('0000000000000000000000000000000000000000000000000000000000000000'),

  // Simulation Mode
  SIMULATION_MODE: z.preprocess((val: unknown) => {
    if (typeof val === 'string') return val === 'true' || val === '1';
    if (typeof val === 'boolean') return val;
    return false;
  }, z.boolean().default(false)),

  // Observability
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['pretty', 'json']).default('pretty'),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
