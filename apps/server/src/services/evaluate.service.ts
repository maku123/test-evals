import type {
  EvaluateCaseResult,
  ExtractionOutput,
  FieldMetrics,
  HallucinationReport,
} from "@test-evals/shared";

function normText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s: string): Set<string> {
  return new Set(normText(s).split(" ").filter(Boolean));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function fuzzyScore(a: string | null | undefined, b: string | null | undefined): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  return jaccard(tokenSet(a), tokenSet(b));
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function f1(precision: number, recall: number): number {
  if (precision === 0 && recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

function normalizeDose(s: string | null): string | null {
  if (s == null) return null;
  return normText(s).replace(/\s+/g, "");
}

function normalizeFreq(s: string | null): string | null {
  if (s == null) return null;
  const t = normText(s);
  const map: Array<[RegExp, string]> = [
    [/\bbid\b/g, "twice daily"],
    [/\btid\b/g, "three times daily"],
    [/\bqid\b/g, "four times daily"],
    [/\bqd\b|\bdaily\b|\bonce daily\b/g, "once daily"],
    [/\bprn\b/g, "as needed"],
  ];
  let out = t;
  for (const [re, rep] of map) out = out.replace(re, rep);
  return out;
}

function medsMatch(a: ExtractionOutput["medications"][number], b: ExtractionOutput["medications"][number]): boolean {
  const nameOk = fuzzyScore(a.name, b.name) >= 0.75;
  const doseOk = normalizeDose(a.dose) === normalizeDose(b.dose);
  const freqOk = normalizeFreq(a.frequency) === normalizeFreq(b.frequency);
  return nameOk && doseOk && freqOk;
}

function setPRF<T>(pred: T[], gold: T[], eq: (a: T, b: T) => boolean): { precision: number; recall: number; f1: number } {
  const matchedGold = new Set<number>();
  let tp = 0;
  for (const p of pred) {
    let found = -1;
    for (let i = 0; i < gold.length; i++) {
      if (matchedGold.has(i)) continue;
      const g = gold[i];
      if (g != null && eq(p, g)) {
        found = i;
        break;
      }
    }
    if (found !== -1) {
      matchedGold.add(found);
      tp++;
    }
  }
  const precision = pred.length === 0 ? (gold.length === 0 ? 1 : 0) : tp / pred.length;
  const recall = gold.length === 0 ? 1 : tp / gold.length;
  return { precision, recall, f1: f1(precision, recall) };
}

function scoreVitals(pred: ExtractionOutput["vitals"], gold: ExtractionOutput["vitals"]): number {
  const parts: number[] = [];
  // bp exact after normalization
  const bpPred = pred.bp == null ? null : normText(pred.bp);
  const bpGold = gold.bp == null ? null : normText(gold.bp);
  parts.push(bpPred === bpGold ? 1 : (bpPred == null && bpGold == null ? 1 : 0));

  const numTol = (p: number | null, g: number | null, tol: number): number => {
    if (p == null && g == null) return 1;
    if (p == null || g == null) return 0;
    return Math.abs(p - g) <= tol ? 1 : 0;
  };
  parts.push(numTol(pred.hr, gold.hr, 2));
  parts.push(numTol(pred.temp_f, gold.temp_f, 0.2));
  parts.push(numTol(pred.spo2, gold.spo2, 1));

  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function scoreFollowUp(pred: ExtractionOutput["follow_up"], gold: ExtractionOutput["follow_up"]): number {
  const interval = pred.interval_days === gold.interval_days ? 1 : 0;
  const reason = fuzzyScore(pred.reason ?? null, gold.reason ?? null);
  return (interval + reason) / 2;
}

function scoreDiagnoses(pred: ExtractionOutput["diagnoses"], gold: ExtractionOutput["diagnoses"]): {
  precision: number;
  recall: number;
  f1: number;
  icd10_bonus: number;
} {
  const base = setPRF(
    pred,
    gold,
    (a, b) => fuzzyScore(a.description, b.description) >= 0.75,
  );

  // Bonus credit: fraction of matched pairs where icd10 matches exactly (when gold has icd10).
  let bonus = 0;
  let denom = 0;
  for (const g of gold) {
    if (!g.icd10) continue;
    denom++;
    const match = pred.find((p) => fuzzyScore(p.description, g.description) >= 0.75);
    if (match?.icd10 && match.icd10 === g.icd10) bonus++;
  }
  const icd10_bonus = denom === 0 ? 0 : bonus / denom;
  return { ...base, icd10_bonus };
}

function flattenLeafStrings(obj: unknown, path: string[] = []): Array<{ path: string; value: string }> {
  if (obj == null) return [];
  if (typeof obj === "string") return [{ path: path.join("."), value: obj }];
  if (Array.isArray(obj)) {
    return obj.flatMap((v, i) => flattenLeafStrings(v, [...path, String(i)]));
  }
  if (typeof obj === "object") {
    const out: Array<{ path: string; value: string }> = [];
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      out.push(...flattenLeafStrings(v, [...path, k]));
    }
    return out;
  }
  return [];
}

export function detectHallucinations(pred: ExtractionOutput, transcript: string): HallucinationReport {
  const t = normText(transcript);
  const leaves = flattenLeafStrings(pred);
  const paths: string[] = [];
  for (const leaf of leaves) {
    const v = normText(leaf.value);
    if (!v) continue;
    // simple grounding: substring on normalized transcript, or token Jaccard >= 0.6
    const grounded = t.includes(v) || jaccard(tokenSet(v), tokenSet(t)) >= 0.6;
    if (!grounded) paths.push(leaf.path);
  }
  return { count: paths.length, paths };
}

export function evaluateCase(params: {
  prediction: ExtractionOutput | null;
  gold: ExtractionOutput;
  transcript: string;
  schemaValid: boolean;
}): EvaluateCaseResult {
  if (!params.schemaValid || !params.prediction) {
    const zeros: FieldMetrics = {
      chief_complaint: 0,
      vitals: 0,
      medications: { precision: 0, recall: 0, f1: 0 },
      diagnoses: { precision: 0, recall: 0, f1: 0, icd10_bonus: 0 },
      plan: { precision: 0, recall: 0, f1: 0 },
      follow_up: 0,
      composite: 0,
    };
    return { metrics: zeros, hallucination: { count: 0, paths: [] }, schemaInvalid: true };
  }

  const pred = params.prediction;
  const gold = params.gold;

  const chief = clamp01(fuzzyScore(pred.chief_complaint, gold.chief_complaint));
  const vitals = clamp01(scoreVitals(pred.vitals, gold.vitals));
  const meds = setPRF(pred.medications, gold.medications, medsMatch);
  const diags = scoreDiagnoses(pred.diagnoses, gold.diagnoses);
  const plan = setPRF(
    pred.plan,
    gold.plan,
    (a, b) => fuzzyScore(a, b) >= 0.75,
  );
  const follow = clamp01(scoreFollowUp(pred.follow_up, gold.follow_up));

  const composite =
    (chief +
      vitals +
      meds.f1 +
      diags.f1 +
      plan.f1 +
      follow) /
    6;

  return {
    metrics: {
      chief_complaint: chief,
      vitals,
      medications: meds,
      diagnoses: diags,
      plan,
      follow_up: follow,
      composite,
    },
    hallucination: detectHallucinations(pred, params.transcript),
    schemaInvalid: false,
  };
}

