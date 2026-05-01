import { env } from "@test-evals/env/server";
import { repoRootFromImportMeta, loadExtractionSchema } from "@test-evals/shared";
import { extractClinical } from "@test-evals/llm";
import type { ExtractResult, Strategy } from "@test-evals/shared";

const repoRoot = repoRootFromImportMeta(import.meta.url);
const extractionSchema = loadExtractionSchema(repoRoot);

export async function runExtraction(params: {
  transcript: string;
  strategy: Strategy;
  model: string;
}): Promise<ExtractResult> {
  return extractClinical(env.ANTHROPIC_API_KEY, {
    transcript: params.transcript,
    strategy: params.strategy,
    model: params.model,
    extractionSchema,
  });
}

