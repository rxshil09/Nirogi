import 'dotenv/config';
import { z } from 'zod';

// Helper: treat an empty string the same as a missing value for optional fields.
const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v : undefined))
  .pipe(z.string().url().optional());

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v : undefined));

const EnvironmentSchema = z.object({
  // API
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.trim())
    .refine(
      (v) => v === '*' || z.string().url().safeParse(v).success,
      { message: 'WEB_ORIGIN must be "*" or a valid URL' }
    ),

  // Database
  DATABASE_URL: optionalUrl,

  // Redis / BullMQ (optional — app degrades gracefully without it)
  REDIS_URL: optionalUrl,

  // SerpAPI (optional — adapters fall back to fixtures without it)
  SERPAPI_API_KEY: optionalString,

  // Worker
  SCRAPER_HEADLESS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvironmentSchema>;

export const env: Env = EnvironmentSchema.parse(process.env);
