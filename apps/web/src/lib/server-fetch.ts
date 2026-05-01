import { headers } from "next/headers";
import { serverBaseUrl } from "./server-url";

export async function serverFetch(path: string, init?: RequestInit) {
  const h = await headers();
  const url = `${serverBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    // Forward cookies to the API server for auth-gated endpoints.
    headers: {
      ...(init?.headers ?? {}),
      cookie: h.get("cookie") ?? "",
    },
    cache: "no-store",
  });
}

