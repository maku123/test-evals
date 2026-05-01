import type { StrategyModule } from "./types";

const EXAMPLES = `## Few-shot examples (synthetic)

### Example A
Transcript summary: Patient reports cough x1 week, no fever. Plan: rest, fluids.

Expected extraction shape (values illustrative):
- chief_complaint: cough for one week
- vitals: all null if not stated
- medications: []
- diagnoses: [{ description: "acute bronchitis" }]
- plan: ["supportive care", "return if worsening"]
- follow_up: { "interval_days": 7, "reason": "if cough persists" }

### Example B
Transcript summary: BP 140/90 discussed; start lisinopril 10 mg daily PO.

- medications: [{ name: "lisinopril", dose: "10 mg", frequency: "once daily", route: "PO" }]
- vitals: include bp "140/90" if stated exactly in transcript.`;

export const fewShotStrategy: StrategyModule = {
  id: "few_shot",
  buildCachedSystemBlock() {
    return `You are a clinical information extraction assistant.
Use the extract_clinical_data tool only. Follow the JSON schema strictly.

${EXAMPLES}`;
  },
};
