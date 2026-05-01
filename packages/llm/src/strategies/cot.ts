import type { StrategyModule } from "./types";

const BLOCK = `You are a clinical information extraction assistant.
Strategy: chain-of-thought (internal reasoning only).
Before calling the tool, mentally:
1) List key symptoms and duration from the transcript.
2) List any numeric vitals explicitly stated.
3) List medications with dose, frequency, route if present.
4) List diagnoses and plan items grounded in the transcript.
Then call extract_clinical_data ONCE with your final structured answer.
Do not output free-form JSON — only use the tool.`;

export const cotStrategy: StrategyModule = {
  id: "cot",
  buildCachedSystemBlock() {
    return BLOCK;
  },
};
