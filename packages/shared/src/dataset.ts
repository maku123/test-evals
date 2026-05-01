import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "jsonc-parser";
import type { DatasetCase } from "./types";
import { loadSchemaValidator, validateExtraction } from "./schema-validator";

const CASE_RE = /^case_(\d+)\.txt$/;

export function loadExtractionSchema(repoRoot: string): object {
  const raw = readFileSync(join(repoRoot, "data", "schema.json"), "utf-8");
  const parsed = parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Failed to parse data/schema.json");
  }
  return parsed as object;
}

export function loadDataset(repoRoot: string): DatasetCase[] {
  const schema = loadExtractionSchema(repoRoot);
  loadSchemaValidator(schema);

  const transcriptsDir = join(repoRoot, "data", "transcripts");
  const goldDir = join(repoRoot, "data", "gold");
  const files = readdirSync(transcriptsDir).filter((f) => CASE_RE.test(f));

  const cases: DatasetCase[] = [];
  for (const file of files) {
    const m = file.match(CASE_RE);
    if (!m) continue;
    const id = `case_${m[1]}`;
    const transcript = readFileSync(join(transcriptsDir, file), "utf-8");
    const goldRaw = readFileSync(join(goldDir, `${id}.json`), "utf-8");
    const goldParsed = JSON.parse(goldRaw) as unknown;
    const v = validateExtraction(goldParsed);
    if (!v.valid) {
      throw new Error(`Invalid gold for ${id}: ${v.errors.join("; ")}`);
    }
    cases.push({
      id,
      transcript,
      gold: v.value,
    });
  }
  cases.sort((a, b) => a.id.localeCompare(b.id));
  return cases;
}

export function filterDataset(
  cases: DatasetCase[],
  filter?: string | null,
): DatasetCase[] {
  if (!filter?.trim()) return cases;
  const f = filter.trim().toLowerCase();
  return cases.filter((c) => c.id.toLowerCase().includes(f));
}
