# NOTES

This repo started as a Bun/Turborepo scaffold with auth + Postgres/Drizzle wiring. I implemented the HEALOSBENCH **evaluation harness** pieces described in `README.md`:

- **Extractor**: Anthropic tool-use with schema validation + retry-with-feedback (max 3), prompt caching, prompt hashing.
- **Evaluator**: per-field metrics (fuzzy string, numeric tolerance, set-based P/R/F1), and a simple grounding-based hallucination detector.
- **Runner + API**: start/resume runs, store results in Postgres, emit replayable SSE events.
- **Dashboard**: minimal pages for runs list, run detail (with SSE replay), case detail, and a minimal compare view.
- **CLI**: `bun run eval -- --strategy=...` to start a run from the terminal.
- **Tests**: unit + light integration tests (including retry path, fuzzy med normalization, idempotency).

## How to run

```bash
bun install
bun run db:push

# server (port 3000) + web (port 3001)
bun run dev
```

## CLI run

```bash
# one strategy
bun run eval -- --strategy=zero_shot --model=claude-haiku-4-5-20251001
```

## API

- `POST /api/v1/runs` `{ strategy, model, datasetFilter?, force? }`
- `POST /api/v1/runs/:id/resume`
- `GET /api/v1/runs/:id/events` (SSE replay; reconnect with `?since=<seq>`)

## Rate-limit / backoff strategy (429)

The LLM call wrapper retries on retryable statuses (`429`, `503`, `529`) with exponential backoff and jitter (see `packages/llm/src/backoff.ts`). Runner concurrency is limited to 5 in-flight cases via a semaphore.

## Results table (fill after running with a real key)

Run these three commands (with a valid `ANTHROPIC_API_KEY` in `apps/server/.env`) and paste the aggregate results:

```bash
bun run eval -- --strategy=zero_shot --model=claude-haiku-4-5-20251001
bun run eval -- --strategy=few_shot  --model=claude-haiku-4-5-20251001
bun run eval -- --strategy=cot       --model=claude-haiku-4-5-20251001
```

| Strategy | Model | Avg composite | Schema fail rate | Hallucinations | Cost (USD) | Cache read tokens |
| --- | --- | --- | --- | --- | --- | --- |
| zero_shot | claude-haiku-4-5-20251001 | TODO | TODO | TODO | TODO | TODO |
| few_shot  | claude-haiku-4-5-20251001 | TODO | TODO | TODO | TODO | TODO |
| cot       | claude-haiku-4-5-20251001 | TODO | TODO | TODO | TODO | TODO |

## Surprises / observations (placeholder)

- TODO: Which strategy wins on which fields (chief complaint vs meds vs plan).
- TODO: Where grounding/hallucination detector was too strict/too lenient.

## Next steps (not implemented)

- True streaming SSE (keep-open connection + incremental flush) instead of replay-and-close.
- Rich compare view (per-field deltas + winner callouts) and real case-level diff UI.
- Proper cost computation from token pricing.

