import { Hono } from "hono";
import { z } from "zod";
import {
  getCaseResult,
  getRun,
  listCaseResults,
  listEvents,
  listRuns,
  resumeRun,
  startRun,
} from "../services/runner.service";

export const runsRouter = new Hono();

const startSchema = z.object({
  strategy: z.enum(["zero_shot", "few_shot", "cot"]),
  model: z.string().min(1),
  datasetFilter: z.string().optional().nullable(),
  force: z.boolean().optional(),
});

runsRouter.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  const { id } = await startRun(parsed.data);
  return c.json({ id });
});

runsRouter.post("/:id/resume", async (c) => {
  const id = c.req.param("id");
  const force = c.req.query("force") === "true";
  const out = await resumeRun(id, force);
  return c.json(out);
});

runsRouter.get("/", async (c) => {
  const rows = await listRuns();
  return c.json(rows);
});

runsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  const row = await getRun(id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

runsRouter.get("/:id/cases", async (c) => {
  const id = c.req.param("id");
  const rows = await listCaseResults(id);
  return c.json(rows);
});

runsRouter.get("/:id/cases/:transcriptId", async (c) => {
  const id = c.req.param("id");
  const transcriptId = c.req.param("transcriptId");
  const row = await getCaseResult(id, transcriptId);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

runsRouter.get("/:id/events", async (c) => {
  const id = c.req.param("id");
  const since = c.req.query("since");
  const sinceSeq = since ? Number(since) : undefined;

  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const encoder = new TextEncoder();
  const events = await listEvents(id, Number.isFinite(sinceSeq) ? sinceSeq : undefined);

  const stream = new ReadableStream({
    start(controller) {
      for (const e of events) {
        controller.enqueue(encoder.encode(`id: ${e.seq}\n`));
        controller.enqueue(encoder.encode(`event: ${e.type}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(e.payloadJson)}\n\n`));
      }
      // This endpoint currently replays DB events and closes. UI can reconnect with ?since=.
      controller.close();
    },
  });

  return new Response(stream, { headers: c.res.headers });
});

