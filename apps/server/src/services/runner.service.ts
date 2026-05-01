import { db } from "@test-evals/db";
import { caseResults, runEvents, runs } from "@test-evals/db/schema/eval";
import { and, asc, eq, gt, max } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Strategy } from "@test-evals/shared";
import { filterDataset, loadDataset, repoRootFromImportMeta } from "@test-evals/shared";
import { runExtraction } from "./extract.service";
import { evaluateCase } from "./evaluate.service";
import { Semaphore } from "./semaphore";

export type StartRunInput = {
  strategy: Strategy;
  model: string;
  datasetFilter?: string | null;
  force?: boolean;
};

const repoRoot = repoRootFromImportMeta(import.meta.url);
const dataset = loadDataset(repoRoot);

function nowMs() {
  return Date.now();
}

async function nextEventSeq(runId: string): Promise<number> {
  const rows = await db
    .select({ m: max(runEvents.seq) })
    .from(runEvents)
    .where(eq(runEvents.runId, runId));
  const m = rows[0]?.m ?? 0;
  return (m ?? 0) + 1;
}

async function emitEvent(runId: string, type: string, payload: Record<string, unknown>) {
  const seq = await nextEventSeq(runId);
  await db.insert(runEvents).values({
    id: randomUUID(),
    runId,
    seq,
    type,
    payloadJson: payload,
  });
}

async function idempotentLookup(params: {
  strategy: Strategy;
  model: string;
  transcriptId: string;
  promptHash: string;
}) {
  const rows = await db
    .select()
    .from(caseResults)
    .where(
      and(
        eq(caseResults.strategy, params.strategy),
        eq(caseResults.model, params.model),
        eq(caseResults.transcriptId, params.transcriptId),
        eq(caseResults.promptHash, params.promptHash),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function startRun(input: StartRunInput): Promise<{ id: string }> {
  const runId = randomUUID();
  await db.insert(runs).values({
    id: runId,
    strategy: input.strategy,
    model: input.model,
    promptHash: "pending",
    status: "running",
    datasetFilter: input.datasetFilter ?? null,
  });

  // fire and forget: run in background (Bun process stays alive)
  void runRun(runId, input).catch(async (e) => {
    await db
      .update(runs)
      .set({ status: "failed", finishedAt: new Date(), totalsJson: { error: String(e) } })
      .where(eq(runs.id, runId));
    await emitEvent(runId, "run_failed", { error: String(e) });
  });

  return { id: runId };
}

export async function resumeRun(runId: string, force?: boolean): Promise<{ id: string }> {
  const row = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  if (!row[0]) throw new Error("Run not found");
  await db.update(runs).set({ status: "running" }).where(eq(runs.id, runId));
  void runRun(runId, {
    strategy: row[0].strategy as Strategy,
    model: row[0].model,
    datasetFilter: row[0].datasetFilter,
    force,
  }).catch(async (e) => {
    await db
      .update(runs)
      .set({ status: "failed", finishedAt: new Date(), totalsJson: { error: String(e) } })
      .where(eq(runs.id, runId));
    await emitEvent(runId, "run_failed", { error: String(e) });
  });
  return { id: runId };
}

export async function runRun(runId: string, input: StartRunInput) {
  const started = nowMs();
  const cases = filterDataset(dataset, input.datasetFilter);
  const sem = new Semaphore(5);

  await emitEvent(runId, "run_started", { runId, total: cases.length });

  const results = await Promise.all(
    cases.map(async (c) => {
      const release = await sem.acquire();
      try {
        const extract = await runExtraction({
          transcript: c.transcript,
          strategy: input.strategy,
          model: input.model,
        });

        const promptHash = extract.promptHash;

        // update run prompt hash once known
        await db.update(runs).set({ promptHash }).where(eq(runs.id, runId));

        if (!input.force) {
          const cached = await idempotentLookup({
            strategy: input.strategy,
            model: input.model,
            transcriptId: c.id,
            promptHash,
          });
          if (cached) {
            await emitEvent(runId, "case_cached", { transcriptId: c.id });
            return cached;
          }
        }

        const evalRes = evaluateCase({
          prediction: extract.output,
          gold: c.gold,
          transcript: c.transcript,
          schemaValid: extract.schemaValid,
        });

        const rowId = randomUUID();
        await db.insert(caseResults).values({
          id: rowId,
          runId,
          transcriptId: c.id,
          promptHash,
          strategy: input.strategy,
          model: input.model,
          predictionJson: (extract.output ?? null) as unknown as Record<string, unknown>,
          schemaValid: extract.schemaValid,
          metricsJson: evalRes.metrics as unknown as Record<string, unknown>,
          hallucinationJson: evalRes.hallucination as unknown as Record<string, unknown>,
          tokensJson: extract.usageTotals as unknown as Record<string, unknown>,
          attemptsJson: extract.attempts as unknown as Record<string, unknown>[],
        });

        await emitEvent(runId, "case_completed", {
          transcriptId: c.id,
          metrics: evalRes.metrics,
          hallucination: evalRes.hallucination,
          schemaValid: extract.schemaValid,
        });

        return {
          id: rowId,
          transcriptId: c.id,
          metrics: evalRes.metrics,
          hallucination: evalRes.hallucination,
          schemaValid: extract.schemaValid,
          promptHash,
        };
      } finally {
        release();
      }
    }),
  );

  // summarize
  let sumComposite = 0;
  let n = 0;
  let halluc = 0;
  let schemaFail = 0;
  let inputTok = 0;
  let outputTok = 0;
  let cacheRead = 0;
  let cacheWrite = 0;

  for (const r of results) {
    const metrics = (r as any).metricsJson ? (r as any).metricsJson : (r as any).metrics;
    if (metrics?.composite != null) {
      sumComposite += Number(metrics.composite);
      n++;
    }
    const hall = (r as any).hallucinationJson ? (r as any).hallucinationJson : (r as any).hallucination;
    halluc += Number(hall?.count ?? 0);
    const sv = (r as any).schemaValid;
    if (!sv) schemaFail++;
    const tok = (r as any).tokensJson ? (r as any).tokensJson : null;
    if (tok) {
      inputTok += Number(tok.input_tokens ?? 0);
      outputTok += Number(tok.output_tokens ?? 0);
      cacheRead += Number(tok.cache_read_input_tokens ?? 0);
      cacheWrite += Number(tok.cache_creation_input_tokens ?? 0);
    }
  }

  const totals = {
    aggregateF1: n === 0 ? 0 : sumComposite / n,
    schemaFailureCount: schemaFail,
    hallucinationCount: halluc,
    totalTokens: { input: inputTok, output: outputTok, cache_read: cacheRead, cache_write: cacheWrite },
    costUsd: 0,
    wallTimeMs: nowMs() - started,
  };

  await db
    .update(runs)
    .set({ status: "completed", finishedAt: new Date(), totalsJson: totals })
    .where(eq(runs.id, runId));
  await emitEvent(runId, "run_completed", totals);
}

export async function listRuns() {
  return db.select().from(runs).orderBy(asc(runs.startedAt));
}

export async function getRun(runId: string) {
  const rows = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  return rows[0] ?? null;
}

export async function listCaseResults(runId: string) {
  return db.select().from(caseResults).where(eq(caseResults.runId, runId));
}

export async function getCaseResult(runId: string, transcriptId: string) {
  const rows = await db
    .select()
    .from(caseResults)
    .where(and(eq(caseResults.runId, runId), eq(caseResults.transcriptId, transcriptId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listEvents(runId: string, sinceSeq?: number) {
  const where = sinceSeq
    ? and(eq(runEvents.runId, runId), gt(runEvents.seq, sinceSeq))
    : eq(runEvents.runId, runId);
  return db.select().from(runEvents).where(where).orderBy(asc(runEvents.seq));
}

