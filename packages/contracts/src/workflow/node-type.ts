import { z } from 'zod';

export const WorkflowNodeTypeSchema = z.enum([
  'INPUT',
  'TRANSFORM',
  'CONDITION',
  'LLM',
  'MCP_TOOL',
  'APPROVAL',
  'OUTPUT',
]);

export type WorkflowNodeType = z.infer<typeof WorkflowNodeTypeSchema>;
