import { z } from 'zod';
import { WorkflowIdentifierSchema } from './identifier.js';
import { WorkflowNodeTypeSchema } from './node-type.js';

export const WorkflowNodePositionSchema = z
  .object({
    x: z.number().finite({ message: 'Coordinate x must be a finite number' }),
    y: z.number().finite({ message: 'Coordinate y must be a finite number' }),
  })
  .strict();

export type WorkflowNodePosition = z.infer<typeof WorkflowNodePositionSchema>;

export const WorkflowNodeConfigSchema = z.record(z.string(), z.json());

export type WorkflowNodeConfig = z.infer<typeof WorkflowNodeConfigSchema>;

export const WorkflowNodeSchema = z
  .object({
    id: WorkflowIdentifierSchema,
    type: WorkflowNodeTypeSchema,
    position: WorkflowNodePositionSchema,
    config: WorkflowNodeConfigSchema,
  })
  .strict();

export type WorkflowNode = z.infer<typeof WorkflowNodeSchema>;
