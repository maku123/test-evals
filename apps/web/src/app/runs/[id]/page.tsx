import Link from "next/link";

import { buttonVariants } from "@test-evals/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@test-evals/ui/components/card";

import { requireSession } from "@/lib/require-session";
import { serverFetch } from "@/lib/server-fetch";

import EventsPanel from "./stream";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const runRes = await serverFetch(`/api/v1/runs/${id}`);
  const run = await runRes.json();
  const casesRes = await serverFetch(`/api/v1/runs/${id}/cases`);
  const cases = (await casesRes.json()) as Array<any>;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 grid gap-6">
      <div className="flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">Run {id}</h1>
          <p className="text-sm text-muted-foreground">
            {run.strategy} · {run.model} · {run.status}
          </p>
        </div>
        <div className="flex gap-2">
          <Link className={buttonVariants({ variant: "secondary" })} href={"/runs" as any}>
            Back
          </Link>
          <Link className={buttonVariants({ variant: "default" })} href={`/compare?left=${id}` as any}>
            Compare
          </Link>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live events (SSE replay)</CardTitle>
        </CardHeader>
        <CardContent>
          <EventsPanel runId={id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases stored for this run yet.</p>
          ) : (
            cases.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded p-2">
                <div className="grid">
                  <div className="font-medium">
                    <Link className="underline" href={`/runs/${id}/cases/${c.transcriptId}` as any}>
                      {c.transcriptId}
                    </Link>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    schemaValid: {String(c.schemaValid)}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  composite: {c.metricsJson?.composite ?? "—"}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

