import { z } from 'zod';
import { WorkflowIdentifierSchema } from '../identifier.js';

export const PROPERTY_PATH_MAX_DEPTH = 16;
export const PROPERTY_PATH_SEGMENT_MAX_LENGTH = 128;

/**
 * Validates a single property path segment.
 * Preserves authored text exactly without trimming or normalizing.
 * Permits dots, spaces, and punctuation within property names.
 */
export const PropertyPathSegmentSchema = z
  .string()
  .min(1, 'Path segment must not be empty')
  .max(
    PROPERTY_PATH_SEGMENT_MAX_LENGTH,
    `Path segment must not exceed ${PROPERTY_PATH_SEGMENT_MAX_LENGTH} characters`,
  );

export type PropertyPathSegment = z.infer<typeof PropertyPathSegmentSchema>;

/**
 * Literal binding containing raw JSON data.
 * Rejects undefined, functions, symbols, BigInt, and non-JSON values.
 */
export const LiteralBindingSchema = z
  .object({
    type: z.literal('literal'),
    value: z.json(),
  })
  .strict();

export type LiteralBinding = z.infer<typeof LiteralBindingSchema>;

/**
 * Explicit reference to a workflow execution input field.
 * An empty path `[]` targets the entire field value.
 */
export const InputValueReferenceSchema = z
  .object({
    source: z.literal('input'),
    field: WorkflowIdentifierSchema,
    path: z
      .array(PropertyPathSegmentSchema)
      .max(PROPERTY_PATH_MAX_DEPTH, `Path depth cannot exceed ${PROPERTY_PATH_MAX_DEPTH} segments`),
  })
  .strict();

export type InputValueReference = z.infer<typeof InputValueReferenceSchema>;

/**
 * Explicit reference to a previous workflow node's execution output.
 * An empty path `[]` targets the entire node output.
 */
export const NodeOutputValueReferenceSchema = z
  .object({
    source: z.literal('node_output'),
    nodeId: WorkflowIdentifierSchema,
    path: z
      .array(PropertyPathSegmentSchema)
      .max(PROPERTY_PATH_MAX_DEPTH, `Path depth cannot exceed ${PROPERTY_PATH_MAX_DEPTH} segments`),
  })
  .strict();

export type NodeOutputValueReference = z.infer<typeof NodeOutputValueReferenceSchema>;

/**
 * Discriminated union of all supported value references based on `source`.
 */
export const ValueReferenceSchema = z.discriminatedUnion('source', [
  InputValueReferenceSchema,
  NodeOutputValueReferenceSchema,
]);

export type ValueReference = z.infer<typeof ValueReferenceSchema>;

/**
 * Reference binding wrapping a structured ValueReference.
 */
export const ReferenceBindingSchema = z
  .object({
    type: z.literal('reference'),
    reference: ValueReferenceSchema,
  })
  .strict();

export type ReferenceBinding = z.infer<typeof ReferenceBindingSchema>;

/**
 * Top-level discriminated union of value bindings based on `type`.
 */
export const ValueBindingSchema = z.discriminatedUnion('type', [
  LiteralBindingSchema,
  ReferenceBindingSchema,
]);

export type ValueBinding = z.infer<typeof ValueBindingSchema>;
