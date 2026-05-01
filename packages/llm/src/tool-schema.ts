/** Strip metadata Anthropic tool input_schema may reject. */
export function schemaForAnthropicTool(schema: object): object {
  const s = structuredClone(schema) as Record<string, unknown>;
  delete s.$schema;
  delete s.$id;
  return s;
}

export const EXTRACTION_TOOL_NAME = "extract_clinical_data" as const;
