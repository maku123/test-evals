/** Matches data/schema.json */
export type Vitals = {
  bp: string | null;
  hr: number | null;
  temp_f: number | null;
  spo2: number | null;
};

export type Medication = {
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
};

export type Diagnosis = {
  description: string;
  icd10?: string;
};

export type FollowUp = {
  interval_days: number | null;
  reason: string | null;
};

export type ExtractionOutput = {
  chief_complaint: string;
  vitals: Vitals;
  medications: Medication[];
  diagnoses: Diagnosis[];
  plan: string[];
  follow_up: FollowUp;
};

export type Strategy = "zero_shot" | "few_shot" | "cot";

export type DatasetCase = {
  id: string;
  transcript: string;
  gold: ExtractionOutput;
};

export type AttemptTrace = {
  attempt: number;
  requestSummary: string;
  responseSummary: string;
  validationErrors: string[] | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  } | null;
};

export type ExtractResult = {
  output: ExtractionOutput | null;
  schemaValid: boolean;
  attempts: AttemptTrace[];
  promptHash: string;
  usageTotals: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
};

export type FieldMetrics = {
  chief_complaint: number;
  vitals: number;
  medications: { precision: number; recall: number; f1: number };
  diagnoses: { precision: number; recall: number; f1: number; icd10_bonus: number };
  plan: { precision: number; recall: number; f1: number };
  follow_up: number;
  composite: number;
};

export type HallucinationReport = {
  count: number;
  paths: string[];
};

export type EvaluateCaseResult = {
  metrics: FieldMetrics;
  hallucination: HallucinationReport;
  schemaInvalid: boolean;
};

export type RunStatus = "pending" | "running" | "completed" | "failed";

export type RunTotals = {
  aggregateF1: number;
  perField: Omit<FieldMetrics, "composite"> & { composite?: never };
  schemaFailureCount: number;
  hallucinationCount: number;
  totalTokens: {
    input: number;
    output: number;
    cache_read: number;
    cache_write: number;
  };
  costUsd: number;
  wallTimeMs: number;
};
