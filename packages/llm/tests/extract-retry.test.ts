import { beforeAll, describe, expect, mock, test } from "bun:test";
import { extractClinical } from "../src/extract";

// Mock Anthropic SDK module before importing it inside extract.ts
mock.module("@anthropic-ai/sdk", () => {
  class FakeAnthropic {
    messages = {
      create: async (_req: any) => {
        // Pop from static queue set by test
        const next = (globalThis as any).__anthropicQueue.shift();
        if (next instanceof Error) throw next;
        return next;
      },
    };
    constructor(_opts: any) {}
  }
  return { default: FakeAnthropic };
});

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["chief_complaint", "vitals", "medications", "diagnoses", "plan", "follow_up"],
  properties: {
    chief_complaint: { type: "string" },
    vitals: {
      type: "object",
      additionalProperties: false,
      required: ["bp", "hr", "temp_f", "spo2"],
      properties: {
        bp: { type: ["string", "null"] },
        hr: { type: ["integer", "null"] },
        temp_f: { type: ["number", "null"] },
        spo2: { type: ["integer", "null"] },
      },
    },
    medications: { type: "array", items: { type: "object" } },
    diagnoses: { type: "array", items: { type: "object" } },
    plan: { type: "array", items: { type: "string" } },
    follow_up: {
      type: "object",
      additionalProperties: false,
      required: ["interval_days", "reason"],
      properties: {
        interval_days: { type: ["integer", "null"] },
        reason: { type: ["string", "null"] },
      },
    },
  },
};

function msg(toolId: string, input: any) {
  return {
    content: [{ type: "tool_use", name: "extract_clinical_data", id: toolId, input }],
    usage: { input_tokens: 1, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  };
}

describe("extractClinical retry loop", () => {
  beforeAll(() => {
    (globalThis as any).__anthropicQueue = [];
  });

  test("retries on schema invalid then succeeds", async () => {
    (globalThis as any).__anthropicQueue = [
      msg("t1", { bad: true }),
      msg("t2", {
        chief_complaint: "cough",
        vitals: { bp: null, hr: null, temp_f: null, spo2: null },
        medications: [],
        diagnoses: [],
        plan: [],
        follow_up: { interval_days: null, reason: null },
      }),
    ];

    const res = await extractClinical("dummy", {
      transcript: "pt has cough",
      strategy: "zero_shot",
      model: "fake",
      extractionSchema: SCHEMA,
    });

    expect(res.schemaValid).toBe(true);
    expect(res.output?.chief_complaint).toBe("cough");
    expect(res.attempts.length).toBe(2);
    expect(res.attempts[0]!.validationErrors).not.toBeNull();
    expect(res.attempts[1]!.validationErrors).toBeNull();
  });
});

