import dotenv from "dotenv";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

// Prefer apps/server/.env in this monorepo (CLI + server dev).
dotenv.config({
  path: new URL("../../../apps/server/.env", import.meta.url).pathname,
});
// Fall back to process cwd .env (if present).
dotenv.config();

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    ANTHROPIC_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
