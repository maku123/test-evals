import Link from "next/link";

import { buttonVariants } from "@test-evals/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@test-evals/ui/components/card";

import { requireSession } from "@/lib/require-session";
import { serverFetch } from "@/lib/server-fetch";

import StartRunForm from "./start-run-form";

export default async function RunsPage() {
  await requireSession();

  const res = await serverFetch("/api/v1/runs");
  const runs = (await res.json()) as Array<any>;

  return (
    <div className="container mx-auto max-w-4xl px-4 py-6 grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Start a run</CardTitle>
        </CardHeader>
        <CardContent>
          <StartRunForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runs</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            runs
              .slice()
              .reverse()
              .map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 border rounded p-2">
                  <div className="grid">
                    <div className="font-medium">
                      <Link className="underline" href={`/runs/${r.id}` as any}>
                        {r.id}
                      </Link>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {r.strategy} · {r.model} · {r.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      className={buttonVariants({ variant: "secondary", size: "sm" })}
                      href={`/compare?left=${r.id}` as any}
                    >
                      Compare
                    </Link>
                  </div>
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

