import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const runs = pgTable(
  "eval_runs",
  {
    id: text("id").primaryKey(),
    strategy: text("strategy").notNull(),
    model: text("model").notNull(),
    promptHash: text("prompt_hash").notNull(),
    status: text("status").notNull(),
    datasetFilter: text("dataset_filter"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    finishedAt: timestamp("finished_at"),
    totalsJson: jsonb("totals_json").$type<Record<string, unknown>>(),
  },
  (t) => [
    index("eval_runs_status_idx").on(t.status),
    index("eval_runs_startedAt_idx").on(t.startedAt),
  ],
);

export const caseResults = pgTable(
  "eval_case_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    transcriptId: text("transcript_id").notNull(),
    promptHash: text("prompt_hash").notNull(),
    strategy: text("strategy").notNull(),
    model: text("model").notNull(),
    predictionJson: jsonb("prediction_json").$type<Record<string, unknown>>(),
    schemaValid: boolean("schema_valid").notNull(),
    metricsJson: jsonb("metrics_json").$type<Record<string, unknown>>(),
    hallucinationJson: jsonb("hallucination_json").$type<Record<string, unknown>>(),
    tokensJson: jsonb("tokens_json").$type<Record<string, unknown>>(),
    attemptsJson: jsonb("attempts_json").$type<Record<string, unknown>[]>(),
    completedAt: timestamp("completed_at").defaultNow().notNull(),
  },
  (t) => [
    index("eval_case_results_runId_idx").on(t.runId),
    index("eval_case_results_transcriptId_idx").on(t.transcriptId),
    uniqueIndex("eval_case_results_idempotency_idx").on(
      t.strategy,
      t.model,
      t.transcriptId,
      t.promptHash,
    ),
  ],
);

export const runEvents = pgTable(
  "eval_run_events",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("eval_run_events_runId_idx").on(t.runId),
    uniqueIndex("eval_run_events_runId_seq_idx").on(t.runId, t.seq),
  ],
);

