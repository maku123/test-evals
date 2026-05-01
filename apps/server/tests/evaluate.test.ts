import { describe, expect, test } from "bun:test";
import { evaluateCase, detectHallucinations } from "../src/services/evaluate.service";

test("med normalization matches BID vs twice daily", () => {
  const transcript = "Start metformin 500 mg BID by mouth.";
  const gold = {
    chief_complaint: "diabetes follow-up",
    vitals: { bp: null, hr: null, temp_f: null, spo2: null },
    medications: [{ name: "metformin", dose: "500mg", frequency: "twice daily", route: "PO" }],
    diagnoses: [{ description: "type 2 diabetes", icd10: "E11.9" }],
    plan: ["start metformin"],
    follow_up: { interval_days: 30, reason: "recheck A1c" },
  };
  const pred = {
    ...gold,
    medications: [{ name: "Metformin", dose: "500 mg", frequency: "BID", route: "by mouth" }],
  };

  const out = evaluateCase({ prediction: pred as any, gold: gold as any, transcript, schemaValid: true });
  expect(out.metrics.medications.f1).toBe(1);
});

test("set-F1 basic correctness", () => {
  const transcript = "Do A. Do B.";
  const gold = {
    chief_complaint: "x",
    vitals: { bp: null, hr: null, temp_f: null, spo2: null },
    medications: [],
    diagnoses: [],
    plan: ["alpha", "beta"],
    follow_up: { interval_days: null, reason: null },
  };
  const pred = {
    ...gold,
    plan: ["alpha", "gamma"],
  };
  const out = evaluateCase({ prediction: pred as any, gold: gold as any, transcript, schemaValid: true });
  expect(out.metrics.plan.precision).toBeCloseTo(0.5, 5);
  expect(out.metrics.plan.recall).toBeCloseTo(0.5, 5);
  expect(out.metrics.plan.f1).toBeCloseTo(0.5, 5);
});

test("hallucination detector flags unsupported value", () => {
  const transcript = "Patient denies fever.";
  const pred = {
    chief_complaint: "headache",
    vitals: { bp: null, hr: null, temp_f: null, spo2: null },
    medications: [],
    diagnoses: [],
    plan: [],
    follow_up: { interval_days: null, reason: null },
  };
  const h = detectHallucinations(pred as any, transcript);
  expect(h.count).toBeGreaterThan(0);
});

test("hallucination detector does not flag grounded value", () => {
  const transcript = "Patient reports sore throat.";
  const pred = {
    chief_complaint: "sore throat",
    vitals: { bp: null, hr: null, temp_f: null, spo2: null },
    medications: [],
    diagnoses: [],
    plan: [],
    follow_up: { interval_days: null, reason: null },
  };
  const h = detectHallucinations(pred as any, transcript);
  expect(h.count).toBe(0);
});

