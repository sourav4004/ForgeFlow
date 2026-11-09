import { z } from 'zod';
import { WorkflowIdentifierSchema } from '../identifier.js';
import { ValueBindingSchema } from '../primitives/value-binding.js';

export const OUTPUT_CONFIG_MAX_FIELDS = 50;

/**
 * Strict configuration schema for the OUTPUT workflow node.
 * Maps output payload field names (satisfying WorkflowIdentifierSchema) to ValueBinding definitions.
 */
export const OutputNodeConfigSchema = z
  .object({
    payloadMapping: z.record(WorkflowIdentifierSchema, ValueBindingSchema).refine(
      (mapping) => {
        const keys = Object.keys(mapping);
        return keys.length >= 1 && keys.length <= OUTPUT_CONFIG_MAX_FIELDS;
      },
      {
        message: `payloadMapping must contain between 1 and ${OUTPUT_CONFIG_MAX_FIELDS} entries`,
      },
    ),
  })
  .strict();

export type OutputNodeConfig = z.infer<typeof OutputNodeConfigSchema>;
