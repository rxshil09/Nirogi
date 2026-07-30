import 'dotenv/config';
import { z } from 'zod';

// Helper: treat an empty string the same as a missing value for optional fields.
const optionalUrl = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))
  .pipe(
    z
      .string()
      .refine(
        (v) => {
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        { message: 'Invalid connection URL format' }
      )
      .optional()
  );

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const EnvironmentSchema = z.object({
  // API
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .transform((v) => v.trim())
    .refine(
      (v) => v === '*' || v.split(',').every((origin) => z.string().url().safeParse(origin.trim()).success || origin.trim() === '*'),
      { message: 'WEB_ORIGIN must be "*" or valid URL(s)' }
    ),

  // Database
  DATABASE_URL: optionalUrl,

  // Redis / BullMQ (optional — app degrades gracefully without it)
  REDIS_URL: optionalUrl,

  // SerpAPI (optional — adapters fall back to fixtures without it)
  SERPAPI_API_KEY: optionalString,

  // Worker
  SCRAPER_HEADLESS: z
    .union([z.boolean(), z.string()])
    .optional()
    .default('true')
    .transform((v) => {
      if (typeof v === 'boolean') return v;
      const s = v.trim().toLowerCase();
      return s === 'true' || s === '1';
    }),
});

export type Env = z.infer<typeof EnvironmentSchema>;

export const env: Env = EnvironmentSchema.parse(process.env);
