import Anthropic from "@anthropic-ai/sdk";
import type { Message, MessageParam } from "@anthropic-ai/sdk/resources";
import type {
  AttemptTrace,
  ExtractResult,
  ExtractionOutput,
  Strategy,
} from "@test-evals/shared";
import { loadSchemaValidator, validateExtraction } from "@test-evals/shared";
import { withAnthropicBackoff } from "./backoff";
import { sha256Hex } from "./prompt-hash";
import { getStrategy } from "./strategies";
import {
  EXTRACTION_TOOL_NAME,
  schemaForAnthropicTool,
} from "./tool-schema";

const MAX_ATTEMPTS = 3;

function toAttemptUsage(usage: Message["usage"] | undefined): AttemptTrace["usage"] {
  if (!usage) return null;
  const base: NonNullable<AttemptTrace["usage"]> = {
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
  };
  if (usage.cache_creation_input_tokens != null) {
    base.cache_creation_input_tokens = usage.cache_creation_input_tokens;
  }
  if (usage.cache_read_input_tokens != null) {
    base.cache_read_input_tokens = usage.cache_read_input_tokens;
  }
  return base;
}

function sumUsage(
  a: ExtractResult["usageTotals"],
  b: Message["usage"] | undefined,
): ExtractResult["usageTotals"] {
  if (!b) return a;
  return {
    input_tokens: a.input_tokens + (b.input_tokens ?? 0),
    output_tokens: a.output_tokens + (b.output_tokens ?? 0),
    cache_creation_input_tokens:
      a.cache_creation_input_tokens +
      (b.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens:
      a.cache_read_input_tokens + (b.cache_read_input_tokens ?? 0),
  };
}

function emptyUsage(): ExtractResult["usageTotals"] {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_creation_input_tokens: 0,
    cache_read_input_tokens: 0,
  };
}

function findToolUse(message: Message): {
  id: string;
  input: unknown;
} | null {
  for (const block of message.content) {
    if (block.type === "tool_use" && block.name === EXTRACTION_TOOL_NAME) {
      return { id: block.id, input: block.input };
    }
  }
  return null;
}

export async function extractClinical(
  apiKey: string,
  params: {
    transcript: string;
    strategy: Strategy;
    model: string;
    extractionSchema: object;
  },
): Promise<ExtractResult> {
  loadSchemaValidator(params.extractionSchema);
  const client = new Anthropic({ apiKey });
  const mod = getStrategy(params.strategy);
  const cachedSystem = mod.buildCachedSystemBlock();
  const toolSchema = schemaForAnthropicTool(params.extractionSchema);
  const promptHash = sha256Hex([
    params.strategy,
    cachedSystem,
    JSON.stringify(toolSchema),
  ]);

  const tool = {
    name: EXTRACTION_TOOL_NAME,
    description:
      "Return the clinical extraction as structured JSON matching the provided input schema.",
    input_schema: toolSchema as Anthropic.Tool.InputSchema,
  };

  const attempts: AttemptTrace[] = [];
  let usageTotals = emptyUsage();

  const messages: MessageParam[] = [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Transcript to extract from:\n\n${params.transcript}`,
        },
      ],
    },
  ];

  let lastOutput: ExtractionOutput | null = null;
  let schemaValid = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const message = await withAnthropicBackoff(() =>
      client.messages.create({
        model: params.model,
        max_tokens: 16_384,
        system: [
          {
            type: "text",
            text: cachedSystem,
            cache_control: { type: "ephemeral" },
          },
        ],
        tools: [tool],
        tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
        messages,
      }),
    );

    usageTotals = sumUsage(usageTotals, message.usage);

    const tu = findToolUse(message);
    if (!tu) {
      attempts.push({
        attempt,
        requestSummary: `messages.create (attempt ${attempt})`,
        responseSummary: "No tool_use block in assistant message",
        validationErrors: null,
        usage: toAttemptUsage(message.usage),
      });
      messages.push({
        role: "assistant",
        content: message.content,
      });
      messages.push({
        role: "user",
        content: [
          {
            type: "text",
            text: `You must call the tool "${EXTRACTION_TOOL_NAME}" with valid input matching the schema.`,
          },
        ],
      });
      continue;
    }

    const v = validateExtraction(tu.input);
    attempts.push({
      attempt,
      requestSummary: `messages.create (attempt ${attempt})`,
      responseSummary: `tool_use ${EXTRACTION_TOOL_NAME}`,
      validationErrors: v.valid ? null : v.errors,
      usage: toAttemptUsage(message.usage),
    });

    messages.push({
      role: "assistant",
      content: message.content,
    });

    if (v.valid) {
      lastOutput = v.value;
      schemaValid = true;
      break;
    }

    if (attempt >= MAX_ATTEMPTS) {
      lastOutput = null;
      schemaValid = false;
      break;
    }

    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: tu.id,
          is_error: true,
          content: v.errors.join("\n"),
        },
      ],
    });
  }

  return {
    output: lastOutput,
    schemaValid,
    attempts,
    promptHash,
    usageTotals,
  };
}
