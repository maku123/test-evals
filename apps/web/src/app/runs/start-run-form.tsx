"use client";

import { useState } from "react";

import { Button } from "@test-evals/ui/components/button";
import { Input } from "@test-evals/ui/components/input";
import { Label } from "@test-evals/ui/components/label";

import { serverBaseUrl } from "@/lib/server-url";

export default function StartRunForm() {
  const [strategy, setStrategy] = useState<"zero_shot" | "few_shot" | "cot">("zero_shot");
  const [model, setModel] = useState("claude-haiku-4-5-20251001");
  const [datasetFilter, setDatasetFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onStart() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${serverBaseUrl()}/api/v1/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          strategy,
          model,
          datasetFilter: datasetFilter.trim() ? datasetFilter.trim() : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ? JSON.stringify(data.error) : "Failed");
      setLastRunId(data.id);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label>Strategy</Label>
        <div className="flex gap-2">
          {(["zero_shot", "few_shot", "cot"] as const).map((s) => (
            <Button
              key={s}
              type="button"
              variant={strategy === s ? "default" : "secondary"}
              size="sm"
              onClick={() => setStrategy(s)}
            >
              {s}
            </Button>
          ))}
        </div>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="model">Model</Label>
        <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="filter">Dataset filter (optional)</Label>
        <Input
          id="filter"
          placeholder="e.g. 01"
          value={datasetFilter}
          onChange={(e) => setDatasetFilter(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={onStart} disabled={loading}>
          {loading ? "Starting…" : "Start run"}
        </Button>
        {lastRunId ? <span className="text-sm">Started: {lastRunId}</span> : null}
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

