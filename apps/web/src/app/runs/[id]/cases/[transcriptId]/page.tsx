import { Card, CardContent, CardHeader, CardTitle } from "@test-evals/ui/components/card";
import { requireSession } from "@/lib/require-session";
import { serverFetch } from "@/lib/server-fetch";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; transcriptId: string }>;
}) {
  await requireSession();
  const { id, transcriptId } = await params;

  const res = await serverFetch(`/api/v1/runs/${id}/cases/${transcriptId}`);
  const row = await res.json();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>
            Case {transcriptId} · Run {id}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Schema valid</div>
            <div className="font-mono text-sm">{String(row.schemaValid)}</div>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Metrics</div>
            <pre className="overflow-auto rounded border p-2 text-xs">
              {JSON.stringify(row.metricsJson, null, 2)}
            </pre>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Hallucination</div>
            <pre className="overflow-auto rounded border p-2 text-xs">
              {JSON.stringify(row.hallucinationJson, null, 2)}
            </pre>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Prediction</div>
            <pre className="overflow-auto rounded border p-2 text-xs">
              {JSON.stringify(row.predictionJson, null, 2)}
            </pre>
          </div>
          <div className="grid gap-1">
            <div className="text-sm text-muted-foreground">Attempts trace</div>
            <pre className="overflow-auto rounded border p-2 text-xs">
              {JSON.stringify(row.attemptsJson, null, 2)}
            </pre>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

