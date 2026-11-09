import { z } from 'zod';

export const WORKFLOW_IDENTIFIER_MAX_LENGTH = 128;

export const WorkflowIdentifierSchema = z
  .string()
  .min(1, 'Identifier must not be empty')
  .max(
    WORKFLOW_IDENTIFIER_MAX_LENGTH,
    `Identifier must not exceed ${WORKFLOW_IDENTIFIER_MAX_LENGTH} characters`,
  )
  .refine((val) => val.trim().length > 0, {
    message: 'Identifier must not be whitespace-only',
  });

export type WorkflowIdentifier = z.infer<typeof WorkflowIdentifierSchema>;
