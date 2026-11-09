import { z } from 'zod';
import { ReferenceBindingSchema } from '../primitives/value-binding.js';

export const LLM_PROVIDER_MAX_LENGTH = 50;
export const LLM_MODEL_MAX_LENGTH = 100;
export const LLM_PROMPT_LITERAL_MAX_LENGTH = 10000;
export const LLM_SYSTEM_INSTRUCTION_MAX_LENGTH = 5000;
export const LLM_TEMPERATURE_MIN = 0;
export const LLM_TEMPERATURE_MAX = 2;
export const LLM_MAX_TOKENS_MIN = 1;
export const LLM_MAX_TOKENS_MAX = 16384;

/**
 * Literal prompt binding strictly requiring a non-empty, non-whitespace-only string.
 * Preserves exact authored whitespace, newlines, and content up to 10,000 characters.
 */
export const LlmPromptLiteralBindingSchema = z
  .object({
    type: z.literal('literal'),
    value: z
      .string()
      .min(1, 'Prompt literal must not be empty')
      .max(
        LLM_PROMPT_LITERAL_MAX_LENGTH,
        `Prompt literal must not exceed ${LLM_PROMPT_LITERAL_MAX_LENGTH} characters`,
      )
      .refine((val) => val.trim().length > 0, {
        message: 'Prompt literal must not be whitespace-only',
      }),
  })
  .strict();

export type LlmPromptLiteralBinding = z.infer<typeof LlmPromptLiteralBindingSchema>;

/**
 * Discriminated union of prompt bindings based on `type`.
 * Supports literal text prompts or structured workflow references (inputs or upstream node outputs).
 */
export const LlmPromptBindingSchema = z.discriminatedUnion('type', [
  LlmPromptLiteralBindingSchema,
  ReferenceBindingSchema,
]);

export type LlmPromptBinding = z.infer<typeof LlmPromptBindingSchema>;

/**
 * Approved V1 response format modes for LLM nodes.
 */
export const LlmResponseFormatSchema = z.enum(['text', 'json']);

export type LlmResponseFormat = z.infer<typeof LlmResponseFormatSchema>;

/**
 * Strict configuration schema for the LLM workflow node.
 * Provider-agnostic, with zero hardcoded vendor enums or embedded credentials.
 */
export const LlmNodeConfigSchema = z
  .object({
    provider: z
      .string()
      .min(1, 'Provider must not be empty')
      .max(
        LLM_PROVIDER_MAX_LENGTH,
        `Provider must not exceed ${LLM_PROVIDER_MAX_LENGTH} characters`,
      )
      .refine((val) => val.trim().length > 0, {
        message: 'Provider must not be whitespace-only',
      }),
    model: z
      .string()
      .min(1, 'Model must not be empty')
      .max(LLM_MODEL_MAX_LENGTH, `Model must not exceed ${LLM_MODEL_MAX_LENGTH} characters`)
      .refine((val) => val.trim().length > 0, {
        message: 'Model must not be whitespace-only',
      }),
    prompt: LlmPromptBindingSchema,
    systemInstruction: z
      .string()
      .min(1, 'System instruction must not be empty')
      .max(
        LLM_SYSTEM_INSTRUCTION_MAX_LENGTH,
        `System instruction must not exceed ${LLM_SYSTEM_INSTRUCTION_MAX_LENGTH} characters`,
      )
      .refine((val) => val.trim().length > 0, {
        message: 'System instruction must not be whitespace-only',
      })
      .optional(),
    temperature: z
      .number()
      .finite({ message: 'Temperature must be a finite number' })
      .min(LLM_TEMPERATURE_MIN, `Temperature must be at least ${LLM_TEMPERATURE_MIN}`)
      .max(LLM_TEMPERATURE_MAX, `Temperature must not exceed ${LLM_TEMPERATURE_MAX}`)
      .optional(),
    maxTokens: z
      .number()
      .int({ message: 'Max tokens must be an integer' })
      .min(LLM_MAX_TOKENS_MIN, `Max tokens must be at least ${LLM_MAX_TOKENS_MIN}`)
      .max(LLM_MAX_TOKENS_MAX, `Max tokens must not exceed ${LLM_MAX_TOKENS_MAX}`)
      .optional(),
    responseFormat: LlmResponseFormatSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const optionalKeys = [
      'systemInstruction',
      'temperature',
      'maxTokens',
      'responseFormat',
    ] as const;
    for (const key of optionalKeys) {
      if (key in data && data[key] === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${key} cannot be explicitly undefined`,
          path: [key],
        });
      }
    }
  });

export type LlmNodeConfig = z.infer<typeof LlmNodeConfigSchema>;
