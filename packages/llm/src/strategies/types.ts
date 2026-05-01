import type { Strategy } from "@test-evals/shared";

export type StrategyModule = {
  id: Strategy;
  /** Cached system block (instructions + optional few-shot text). */
  buildCachedSystemBlock(): string;
};
