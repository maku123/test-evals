import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import type { ErrorObject } from "ajv";
import type { ExtractionOutput } from "./types";

let compiled: ReturnType<typeof createValidator> | null = null;

function createValidator(schema: object) {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return validate;
}

export function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) return [];
  return errors.map((e) => {
    const path = e.instancePath || "/";
    return `${path}: ${e.message ?? "invalid"}`;
  });
}

export function loadSchemaValidator(schemaJson: object) {
  compiled = createValidator(schemaJson);
}

export function validateExtraction(
  data: unknown,
): { valid: true; value: ExtractionOutput } | { valid: false; errors: string[] } {
  if (!compiled) {
    throw new Error("loadSchemaValidator() must be called first");
  }
  const ok = compiled(data);
  if (ok) {
    return { valid: true, value: data as ExtractionOutput };
  }
  return { valid: false, errors: formatAjvErrors(compiled.errors) };
}
