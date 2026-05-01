import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { randomUUID } from "node:crypto";

// Mock extraction + evaluation so runner can execute without Anthropic.
mock.module("../src/services/extract.service", () => {
  return {
    runExtraction: async (_p: any) => ({
      output: {
        chief_complaint: "x",
        vitals: { bp: null, hr: null, temp_f: null, spo2: null },
        medications: [],
        diagnoses: [],
        plan: [],
        follow_up: { interval_days: null, reason: null },
      },
      schemaValid: true,
      attempts: [],
      promptHash: "test_prompt_hash",
      usageTotals: { input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
    }),
  };
});

// Import after mocks
import { db } from "@test-evals/db";
import { caseResults, runEvents, runs } from "@test-evals/db/schema/eval";
import { eq } from "drizzle-orm";
import { runRun, startRun } from "../src/services/runner.service";

describe("runner idempotency/resume (integration)", () => {
  let runId: string;

  beforeEach(async () => {
    runId = randomUUID();
    await db.insert(runs).values({
      id: runId,
      strategy: "zero_shot",
      model: "fake",
      promptHash: "pending",
      status: "running",
      datasetFilter: "case_001",
    });
  });

  afterEach(async () => {
    await db.delete(runEvents).where(eq(runEvents.runId, runId));
    await db.delete(caseResults).where(eq(caseResults.runId, runId));
    await db.delete(runs).where(eq(runs.id, runId));
  });

  test("runRun writes a case result and emits events", async () => {
    await runRun(runId, { strategy: "zero_shot", model: "fake", datasetFilter: "case_001" });
    const cr = await db.select().from(caseResults).where(eq(caseResults.runId, runId));
    expect(cr.length).toBe(1);
    const ev = await db.select().from(runEvents).where(eq(runEvents.runId, runId));
    expect(ev.length).toBeGreaterThan(0);
  });

  test("idempotency returns cached case result on second run", async () => {
    await runRun(runId, { strategy: "zero_shot", model: "fake", datasetFilter: "case_001" });

    const runId2 = randomUUID();
    await db.insert(runs).values({
      id: runId2,
      strategy: "zero_shot",
      model: "fake",
      promptHash: "pending",
      status: "running",
      datasetFilter: "case_001",
    });

    await runRun(runId2, { strategy: "zero_shot", model: "fake", datasetFilter: "case_001" });
    const cr2 = await db.select().from(caseResults).where(eq(caseResults.runId, runId2));
    // Since idempotency is global by (strategy, model, transcriptId, promptHash),
    // this second run should not insert a duplicate row; it will emit case_cached.
    expect(cr2.length).toBe(0);

    await db.delete(runEvents).where(eq(runEvents.runId, runId2));
    await db.delete(caseResults).where(eq(caseResults.runId, runId2));
    await db.delete(runs).where(eq(runs.id, runId2));
  });
});

