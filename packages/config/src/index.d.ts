import 'dotenv/config';
import { z } from 'zod';
declare const EnvironmentSchema: z.ZodObject<{
    API_PORT: z.ZodDefault<z.ZodNumber>;
    WEB_ORIGIN: z.ZodDefault<z.ZodString>;
    DATABASE_URL: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>, z.ZodOptional<z.ZodString>>;
    REDIS_URL: z.ZodPipeline<z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>, z.ZodOptional<z.ZodString>>;
    SERPAPI_API_KEY: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
    SCRAPER_HEADLESS: z.ZodEffects<z.ZodDefault<z.ZodEnum<["true", "false"]>>, boolean, "true" | "false" | undefined>;
}, "strip", z.ZodTypeAny, {
    API_PORT: number;
    WEB_ORIGIN: string;
    SCRAPER_HEADLESS: boolean;
    DATABASE_URL?: string | undefined;
    REDIS_URL?: string | undefined;
    SERPAPI_API_KEY?: string | undefined;
}, {
    API_PORT?: number | undefined;
    WEB_ORIGIN?: string | undefined;
    DATABASE_URL?: string | undefined;
    REDIS_URL?: string | undefined;
    SERPAPI_API_KEY?: string | undefined;
    SCRAPER_HEADLESS?: "true" | "false" | undefined;
}>;
export type Env = z.infer<typeof EnvironmentSchema>;
export declare const env: Env;
export {};
