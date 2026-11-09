import { z } from 'zod';
import { WorkflowIdentifierSchema } from './identifier.js';

export const ConditionOutcomeSchema = z.enum(['TRUE', 'FALSE']);

export type ConditionOutcome = z.infer<typeof ConditionOutcomeSchema>;

export const WorkflowEdgeSchema = z
  .object({
    id: WorkflowIdentifierSchema,
    source: WorkflowIdentifierSchema,
    target: WorkflowIdentifierSchema,
    conditionOutcome: ConditionOutcomeSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if ('conditionOutcome' in data && data.conditionOutcome === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'conditionOutcome cannot be explicitly undefined',
        path: ['conditionOutcome'],
      });
    }
  });

export type WorkflowEdge = z.infer<typeof WorkflowEdgeSchema>;
