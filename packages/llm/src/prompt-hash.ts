import { createHash } from "node:crypto";

export function sha256Hex(parts: string[]): string {
  const h = createHash("sha256");
  for (const p of parts) {
    h.update(p);
    h.update("\n---\n");
  }
  return h.digest("hex");
}
