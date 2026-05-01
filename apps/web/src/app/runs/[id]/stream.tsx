"use client";

import { useEffect, useMemo, useState } from "react";

import { serverBaseUrl } from "@/lib/server-url";

type EventRow = { id: number; type: string; payload: any };

export default function EventsPanel({ runId }: { runId: string }) {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const lastId = events.length ? events[events.length - 1]!.id : 0;
  const url = useMemo(() => {
    const base = serverBaseUrl();
    const u = new URL(`${base}/api/v1/runs/${runId}/events`);
    if (lastId) u.searchParams.set("since", String(lastId));
    return u.toString();
  }, [runId, lastId]);

  useEffect(() => {
    setError(null);
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = () => {
      // events use named event types; ignore default.
    };
    es.onerror = () => {
      es.close();
      // since endpoint closes after replay, treat close as non-fatal
    };
    const handler = (ev: MessageEvent) => {
      // not used
    };
    // Register common events
    const types = ["run_started", "case_completed", "case_cached", "run_failed", "run_completed"];
    for (const t of types) {
      es.addEventListener(t, (e: any) => {
        const idNum = Number((e as MessageEvent).lastEventId || "0");
        setEvents((prev) => [
          ...prev,
          { id: idNum, type: t, payload: JSON.parse((e as MessageEvent).data) },
        ]);
      });
    }
    return () => {
      es.removeEventListener("message", handler);
      es.close();
    };
  }, [url]);

  return (
    <div className="grid gap-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="max-h-64 overflow-auto rounded border p-2 font-mono text-xs">
        {events.length === 0 ? (
          <div className="text-muted-foreground">No events yet.</div>
        ) : (
          events.map((e) => (
            <div key={`${e.id}-${e.type}`} className="whitespace-pre-wrap">
              [{e.id}] {e.type} {JSON.stringify(e.payload)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

