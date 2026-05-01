import Link from "next/link";
import { buttonVariants } from "@test-evals/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@test-evals/ui/components/card";

import { requireSession } from "@/lib/require-session";
import { serverFetch } from "@/lib/server-fetch";

function avgComposite(cases: any[]): number {
  const vals = cases
    .map((c) => Number(c.metricsJson?.composite))
    .filter((n) => Number.isFinite(n));
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ left?: string; right?: string }>;
}) {
  await requireSession();
  const { left, right } = await searchParams;

  const leftCases = left ? ((await (await serverFetch(`/api/v1/runs/${left}/cases`)).json()) as any[]) : null;
  const rightCases = right ? ((await (await serverFetch(`/api/v1/runs/${right}/cases`)).json()) as any[]) : null;

  const leftScore = leftCases ? avgComposite(leftCases) : null;
  const rightScore = rightCases ? avgComposite(rightCases) : null;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 grid gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Compare runs</h1>
        <Link className={buttonVariants({ variant: "secondary" })} href={"/runs" as any}>
          Runs
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Selected</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm">
          <div>Left: {left ?? "—"}</div>
          <div>Right: {right ?? "—"}</div>
          <div className="pt-2">
            Left avg composite: {leftScore == null ? "—" : leftScore.toFixed(3)} | Right avg composite:{" "}
            {rightScore == null ? "—" : rightScore.toFixed(3)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This is a minimal compare view. Pick two run IDs and load:
          <pre className="mt-2 rounded border p-2 text-xs overflow-auto">{`/compare?left=<runIdA>&right=<runIdB>`}</pre>
        </CardContent>
      </Card>
    </div>
  );
}

