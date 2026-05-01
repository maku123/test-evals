import { z } from "zod";
import { startRun } from "../services/runner.service";

const args = process.argv.slice(2);

function getArg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = args.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const schema = z.object({
  strategy: z.enum(["zero_shot", "few_shot", "cot"]),
  model: z.string().min(1),
  filter: z.string().optional().nullable(),
});

async function main() {
  const parsed = schema.safeParse({
    strategy: getArg("strategy") ?? "zero_shot",
    model: getArg("model") ?? "claude-haiku-4-5-20251001",
    filter: getArg("filter"),
  });
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    process.exit(1);
  }

  const { id } = await startRun({
    strategy: parsed.data.strategy,
    model: parsed.data.model,
    datasetFilter: parsed.data.filter ?? null,
    force: getArg("force") === "true",
  });

  console.log(`Started run: ${id}`);
  console.log(`Strategy: ${parsed.data.strategy}`);
  console.log(`Model: ${parsed.data.model}`);
  if (parsed.data.filter) console.log(`Filter: ${parsed.data.filter}`);
  console.log("Use the dashboard or API to watch progress.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

