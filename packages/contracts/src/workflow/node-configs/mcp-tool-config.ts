import { z } from 'zod';
import { WorkflowIdentifierSchema } from '../identifier.js';
import { ValueBindingSchema } from '../primitives/value-binding.js';

export const MCP_TOOL_NAME_MAX_LENGTH = 128;
export const MCP_TOOL_ARGUMENT_NAME_MAX_LENGTH = 128;
export const MCP_TOOL_MAX_ARGUMENTS = 50;
export const MCP_TOOL_TIMEOUT_MIN_MS = 500;
export const MCP_TOOL_TIMEOUT_MAX_MS = 300000;

/**
 * Validates an MCP tool identifier name.
 * Allows ordinary punctuation (underscores, hyphens, slashes, dots).
 */
export const McpToolNameSchema = z
  .string()
  .min(1, 'Tool name must not be empty')
  .max(MCP_TOOL_NAME_MAX_LENGTH, `Tool name must not exceed ${MCP_TOOL_NAME_MAX_LENGTH} characters`)
  .refine((val) => val.trim().length > 0, {
    message: 'Tool name must not be whitespace-only',
  });

export type McpToolName = z.infer<typeof McpToolNameSchema>;

/**
 * Validates an MCP tool parameter argument name.
 * Allows dots, hyphens, underscores, and spaces to match external JSON Schema property names.
 */
export const McpToolArgumentNameSchema = z
  .string()
  .min(1, 'Argument name must not be empty')
  .max(
    MCP_TOOL_ARGUMENT_NAME_MAX_LENGTH,
    `Argument name must not exceed ${MCP_TOOL_ARGUMENT_NAME_MAX_LENGTH} characters`,
  )
  .refine((val) => val.trim().length > 0, {
    message: 'Argument name must not be whitespace-only',
  });

export type McpToolArgumentName = z.infer<typeof McpToolArgumentNameSchema>;

/**
 * Strict configuration schema for the MCP_TOOL workflow node.
 * Binds an opaque workspace integration reference and external tool name to value bindings.
 */
export const McpToolNodeConfigSchema = z
  .object({
    integrationRef: WorkflowIdentifierSchema,
    toolName: McpToolNameSchema,
    arguments: z
      .record(McpToolArgumentNameSchema, ValueBindingSchema)
      .refine((args) => Object.keys(args).length <= MCP_TOOL_MAX_ARGUMENTS, {
        message: `arguments must not contain more than ${MCP_TOOL_MAX_ARGUMENTS} entries`,
      })
      .optional(),
    timeoutMs: z
      .number()
      .int({ message: 'timeoutMs must be an integer' })
      .min(MCP_TOOL_TIMEOUT_MIN_MS, `timeoutMs must be at least ${MCP_TOOL_TIMEOUT_MIN_MS} ms`)
      .max(MCP_TOOL_TIMEOUT_MAX_MS, `timeoutMs must not exceed ${MCP_TOOL_TIMEOUT_MAX_MS} ms`)
      .optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const optionalKeys = ['arguments', 'timeoutMs'] as const;
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

export type McpToolNodeConfig = z.infer<typeof McpToolNodeConfigSchema>;
