import { z } from 'zod';
import { WorkflowIdentifierSchema } from '../identifier.js';
import { ValueBindingSchema, ValueReferenceSchema } from '../primitives/value-binding.js';

export const TRANSFORM_CONFIG_MAX_RULES = 50;
export const TEMPLATE_MAX_SEGMENTS = 100;
export const TEMPLATE_TEXT_SEGMENT_MAX_LENGTH = 5000;
export const TEMPLATE_TOTAL_TEXT_MAX_LENGTH = 5000;

/**
 * Rule: json_pick
 * Extracts data from an upstream reference (input or node output) into targetKey,
 * with an optional JSON fallback if the path is missing.
 */
export const JsonPickTransformRuleSchema = z
  .object({
    operation: z.literal('json_pick'),
    targetKey: WorkflowIdentifierSchema,
    source: ValueReferenceSchema,
    fallbackValue: z.json().optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if ('fallbackValue' in data && data.fallbackValue === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'fallbackValue cannot be explicitly undefined',
        path: ['fallbackValue'],
      });
    }
  });

export type JsonPickTransformRule = z.infer<typeof JsonPickTransformRuleSchema>;

/**
 * Rule: json_set
 * Assigns an explicit ValueBinding (literal JSON or upstream reference) to targetKey.
 */
export const JsonSetTransformRuleSchema = z
  .object({
    operation: z.literal('json_set'),
    targetKey: WorkflowIdentifierSchema,
    value: ValueBindingSchema,
  })
  .strict();

export type JsonSetTransformRule = z.infer<typeof JsonSetTransformRuleSchema>;

/**
 * Text segment within a template_string rule.
 */
export const TemplateTextSegmentSchema = z
  .object({
    type: z.literal('text'),
    text: z
      .string()
      .min(1, 'Text segment must not be empty')
      .max(
        TEMPLATE_TEXT_SEGMENT_MAX_LENGTH,
        `Text segment must not exceed ${TEMPLATE_TEXT_SEGMENT_MAX_LENGTH} characters`,
      ),
  })
  .strict();

export type TemplateTextSegment = z.infer<typeof TemplateTextSegmentSchema>;

/**
 * Reference segment within a template_string rule.
 */
export const TemplateReferenceSegmentSchema = z
  .object({
    type: z.literal('reference'),
    reference: ValueReferenceSchema,
  })
  .strict();

export type TemplateReferenceSegment = z.infer<typeof TemplateReferenceSegmentSchema>;

/**
 * Discriminated union of template segments on `type`.
 */
export const TemplateSegmentSchema = z.discriminatedUnion('type', [
  TemplateTextSegmentSchema,
  TemplateReferenceSegmentSchema,
]);

export type TemplateSegment = z.infer<typeof TemplateSegmentSchema>;

/**
 * Rule: template_string
 * Concatenates an ordered sequence of static text segments and upstream value references into targetKey.
 */
export const TemplateStringTransformRuleSchema = z
  .object({
    operation: z.literal('template_string'),
    targetKey: WorkflowIdentifierSchema,
    segments: z
      .array(TemplateSegmentSchema)
      .min(1, 'Template must contain at least one segment')
      .max(
        TEMPLATE_MAX_SEGMENTS,
        `Template cannot contain more than ${TEMPLATE_MAX_SEGMENTS} segments`,
      ),
  })
  .strict()
  .superRefine((data, ctx) => {
    let totalTextLength = 0;
    for (const segment of data.segments) {
      if (segment.type === 'text') {
        totalTextLength += segment.text.length;
      }
    }
    if (totalTextLength > TEMPLATE_TOTAL_TEXT_MAX_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Total template text length (${totalTextLength}) exceeds maximum of ${TEMPLATE_TOTAL_TEXT_MAX_LENGTH} characters`,
        path: ['segments'],
      });
    }
  });

export type TemplateStringTransformRule = z.infer<typeof TemplateStringTransformRuleSchema>;

/**
 * Approved mathematical operators for V1 arithmetic transforms.
 */
export const MathOperatorSchema = z.enum(['add', 'subtract', 'multiply', 'divide']);

export type MathOperator = z.infer<typeof MathOperatorSchema>;

/**
 * Rule: math_op
 * Bounded binary arithmetic operation (+, -, *, /) between left and right operands.
 */
export const MathOpTransformRuleSchema = z
  .object({
    operation: z.literal('math_op'),
    targetKey: WorkflowIdentifierSchema,
    operator: MathOperatorSchema,
    left: ValueBindingSchema,
    right: ValueBindingSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    // Validate left operand if literal
    if (data.left.type === 'literal') {
      const leftVal = data.left.value;
      if (typeof leftVal !== 'number' || !Number.isFinite(leftVal)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Literal left operand must be a finite number',
          path: ['left', 'value'],
        });
      }
    }

    // Validate right operand if literal
    if (data.right.type === 'literal') {
      const rightVal = data.right.value;
      if (typeof rightVal !== 'number' || !Number.isFinite(rightVal)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Literal right operand must be a finite number',
          path: ['right', 'value'],
        });
      } else if (data.operator === 'divide' && rightVal === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Literal division by zero is not permitted',
          path: ['right', 'value'],
        });
      }
    }
  });

export type MathOpTransformRule = z.infer<typeof MathOpTransformRuleSchema>;

/**
 * Discriminated union of all supported transform rule variants based on `operation`.
 */
export const TransformRuleSchema = z.discriminatedUnion('operation', [
  JsonPickTransformRuleSchema,
  JsonSetTransformRuleSchema,
  TemplateStringTransformRuleSchema,
  MathOpTransformRuleSchema,
]);

export type TransformRule = z.infer<typeof TransformRuleSchema>;

/**
 * Strict configuration schema for the TRANSFORM workflow node.
 * Holds an array of 1 to 50 transform rules assembling output fields.
 */
export const TransformNodeConfigSchema = z
  .object({
    rules: z
      .array(TransformRuleSchema)
      .min(1, 'Transform node must contain at least one rule')
      .max(
        TRANSFORM_CONFIG_MAX_RULES,
        `Transform node cannot contain more than ${TRANSFORM_CONFIG_MAX_RULES} rules`,
      ),
  })
  .strict()
  .superRefine((data, ctx) => {
    const seenKeys = new Set<string>();
    for (let i = 0; i < data.rules.length; i++) {
      const rule = data.rules[i];
      if (!rule) continue;
      if (seenKeys.has(rule.targetKey)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate transform targetKey '${rule.targetKey}'`,
          path: ['rules', i, 'targetKey'],
        });
      } else {
        seenKeys.add(rule.targetKey);
      }
    }
  });

export type TransformNodeConfig = z.infer<typeof TransformNodeConfigSchema>;
