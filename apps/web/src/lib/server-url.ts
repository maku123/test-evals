import { env } from "@test-evals/env/web";

export function serverBaseUrl(): string {
  return env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, "");
}

