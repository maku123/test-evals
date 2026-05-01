import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Walk up from `startDir` until `data/schema.json` exists (monorepo root).
 */
export function findRepoRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 12; i++) {
    const schemaPath = join(dir, "data", "schema.json");
    if (existsSync(schemaPath)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not find repo root (data/schema.json) starting from ${startDir}`,
  );
}

export function repoRootFromImportMeta(importMetaUrl: string): string {
  return findRepoRoot(dirname(fileURLToPath(importMetaUrl)));
}
