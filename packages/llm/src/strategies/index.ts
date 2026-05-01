import type { Strategy } from "@test-evals/shared";
import { cotStrategy } from "./cot";
import { fewShotStrategy } from "./few-shot";
import { zeroShotStrategy } from "./zero-shot";
import type { StrategyModule } from "./types";

const MAP: Record<Strategy, StrategyModule> = {
  zero_shot: zeroShotStrategy,
  few_shot: fewShotStrategy,
  cot: cotStrategy,
};

export function getStrategy(strategy: Strategy): StrategyModule {
  return MAP[strategy];
}

export type { StrategyModule };
