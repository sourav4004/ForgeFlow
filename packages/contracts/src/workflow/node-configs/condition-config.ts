import { z } from 'zod';
import { ValueBindingSchema } from '../primitives/value-binding.js';

/**
 * Approved operators for binary condition predicates.
 * Requires both left and right ValueBinding operands.
 */
export const BinaryConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'contains',
  'not_contains',
]);

export type BinaryConditionOperator = z.infer<typeof BinaryConditionOperatorSchema>;

/**
 * Binary condition configuration predicate.
 * Evaluates binary relationship between left and right operands.
 */
export const BinaryConditionConfigSchema = z
  .object({
    operator: BinaryConditionOperatorSchema,
    left: ValueBindingSchema,
    right: ValueBindingSchema,
  })
  .strict();

export type BinaryConditionConfig = z.infer<typeof BinaryConditionConfigSchema>;

/**
 * Approved operators for unary condition predicates.
 * Requires left ValueBinding operand only; right operand is forbidden.
 */
export const UnaryConditionOperatorSchema = z.enum([
  'is_empty',
  'is_not_empty',
  'is_null',
  'is_not_null',
]);

export type UnaryConditionOperator = z.infer<typeof UnaryConditionOperatorSchema>;

/**
 * Unary condition configuration predicate.
 * Evaluates unary status on left operand.
 */
export const UnaryConditionConfigSchema = z
  .object({
    operator: UnaryConditionOperatorSchema,
    left: ValueBindingSchema,
  })
  .strict();

export type UnaryConditionConfig = z.infer<typeof UnaryConditionConfigSchema>;

/**
 * Strict configuration schema for the CONDITION workflow node.
 * Supports binary and unary condition predicate variants.
 * Branch routing targets are forbidden inside config and belong strictly on WorkflowEdge.
 */
export const ConditionNodeConfigSchema = z.union([
  BinaryConditionConfigSchema,
  UnaryConditionConfigSchema,
]);

export type ConditionNodeConfig = z.infer<typeof ConditionNodeConfigSchema>;
