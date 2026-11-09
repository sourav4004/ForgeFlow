import { z } from 'zod';
import { WorkflowEdgeSchema } from './workflow-edge.js';
import { WorkflowNodeSchema } from './workflow-node.js';

export const WorkflowGraphSchema = z
  .object({
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
  })
  .strict();

export type WorkflowGraph = z.infer<typeof WorkflowGraphSchema>;
