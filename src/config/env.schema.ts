import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  GROQ_API_KEY: z.string().optional(),
  GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(3_600_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  ALLOWED_ORIGINS: z.string().default(''),
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v) => {
      if (v === 'false' || v === '') return false;
      if (v === 'true') return true;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : v;
    }),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}
