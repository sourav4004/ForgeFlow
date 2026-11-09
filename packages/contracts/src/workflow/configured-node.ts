import { z } from 'zod';
import { WorkflowNodeSchema } from './workflow-node.js';
import { InputNodeConfigSchema } from './node-configs/input-config.js';
import { TransformNodeConfigSchema } from './node-configs/transform-config.js';
import { ConditionNodeConfigSchema } from './node-configs/condition-config.js';
import { LlmNodeConfigSchema } from './node-configs/llm-config.js';
import { McpToolNodeConfigSchema } from './node-configs/mcp-tool-config.js';
import { ApprovalNodeConfigSchema } from './node-configs/approval-config.js';
import { OutputNodeConfigSchema } from './node-configs/output-config.js';

/**
 * Fully configured INPUT workflow node schema.
 */
export const ConfiguredInputNodeSchema = z
  .object({
    id: WorkflowNodeSchema.shape.id,
    type: z.literal('INPUT'),
    position: WorkflowNodeSchema.shape.position,
    config: InputNodeConfigSchema,
  })
  .strict();

export type ConfiguredInputNode = z.infer<typeof ConfiguredInputNodeSchema>;

/**
 * Fully configured TRANSFORM workflow node schema.
 */
export const ConfiguredTransformNodeSchema = z
  .object({
    id: WorkflowNodeSchema.shape.id,
    type: z.literal('TRANSFORM'),
    position: WorkflowNodeSchema.shape.position,
    config: TransformNodeConfigSchema,
  })
  .strict();

export type ConfiguredTransformNode = z.infer<typeof ConfiguredTransformNodeSchema>;

/**
 * Fully configured CONDITION workflow node schema.
 */
export const ConfiguredConditionNodeSchema = z
  .object({
    id: WorkflowNodeSchema.shape.id,
    type: z.literal('CONDITION'),
    position: WorkflowNodeSchema.shape.position,
    config: ConditionNodeConfigSchema,
  })
  .strict();

export type ConfiguredConditionNode = z.infer<typeof ConfiguredConditionNodeSchema>;

/**
 * Fully configured LLM workflow node schema.
 */
export const ConfiguredLlmNodeSchema = z
  .object({
    id: WorkflowNodeSchema.shape.id,
    type: z.literal('LLM'),
    position: WorkflowNodeSchema.shape.position,
    config: LlmNodeConfigSchema,
  })
  .strict();

export type ConfiguredLlmNode = z.infer<typeof ConfiguredLlmNodeSchema>;

/**
 * Fully configured MCP_TOOL workflow node schema.
 */
export const ConfiguredMcpToolNodeSchema = z
  .object({
    id: WorkflowNodeSchema.shape.id,
    type: z.literal('MCP_TOOL'),
    position: WorkflowNodeSchema.shape.position,
    config: McpToolNodeConfigSchema,
  })
  .strict();

export type ConfiguredMcpToolNode = z.infer<typeof ConfiguredMcpToolNodeSchema>;

/**
 * Fully configured APPROVAL workflow node schema.
 */
export const ConfiguredApprovalNodeSchema = z
  .object({
    id: WorkflowNodeSchema.shape.id,
    type: z.literal('APPROVAL'),
    position: WorkflowNodeSchema.shape.position,
    config: ApprovalNodeConfigSchema,
  })
  .strict();

export type ConfiguredApprovalNode = z.infer<typeof ConfiguredApprovalNodeSchema>;

/**
 * Fully configured OUTPUT workflow node schema.
 */
export const ConfiguredOutputNodeSchema = z
  .object({
    id: WorkflowNodeSchema.shape.id,
    type: z.literal('OUTPUT'),
    position: WorkflowNodeSchema.shape.position,
    config: OutputNodeConfigSchema,
  })
  .strict();

export type ConfiguredOutputNode = z.infer<typeof ConfiguredOutputNodeSchema>;

/**
 * Discriminated union of all seven fully configured workflow node variants,
 * discriminated on property `type`.
 *
 * Validates that a node has a valid ID, coordinates, and complete type-appropriate configuration.
 * Does not perform graph-level validation (cycles, reachability, dangling references,
 * branch completeness), which belongs to Milestone 2B.
 */
export const ConfiguredWorkflowNodeSchema = z.discriminatedUnion('type', [
  ConfiguredInputNodeSchema,
  ConfiguredTransformNodeSchema,
  ConfiguredConditionNodeSchema,
  ConfiguredLlmNodeSchema,
  ConfiguredMcpToolNodeSchema,
  ConfiguredApprovalNodeSchema,
  ConfiguredOutputNodeSchema,
]);

export type ConfiguredWorkflowNode = z.infer<typeof ConfiguredWorkflowNodeSchema>;
