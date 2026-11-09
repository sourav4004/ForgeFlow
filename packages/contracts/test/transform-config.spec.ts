import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  InputNodeConfigSchema,
  JsonPickTransformRuleSchema,
  JsonSetTransformRuleSchema,
  MathOpTransformRuleSchema,
  MathOperatorSchema,
  OutputNodeConfigSchema,
  TEMPLATE_MAX_SEGMENTS,
  TEMPLATE_TOTAL_TEXT_MAX_LENGTH,
  TRANSFORM_CONFIG_MAX_RULES,
  TemplateReferenceSegmentSchema,
  TemplateSegmentSchema,
  TemplateStringTransformRuleSchema,
  TemplateTextSegmentSchema,
  TransformNodeConfigSchema,
  TransformRuleSchema,
  ValueBindingSchema,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  type JsonPickTransformRule,
  type JsonSetTransformRule,
  type MathOpTransformRule,
  type MathOperator,
  type TemplateReferenceSegment,
  type TemplateSegment,
  type TemplateStringTransformRule,
  type TemplateTextSegment,
  type TransformNodeConfig,
  type TransformRule,
  type WorkflowGraph,
  type WorkflowNode,
} from '../src/index.js';

describe('TRANSFORM Node Configuration Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types for all transform operations and segments', () => {
      expectTypeOf<MathOperator>().toEqualTypeOf<'add' | 'subtract' | 'multiply' | 'divide'>();

      expectTypeOf<TemplateTextSegment>().toMatchTypeOf<{
        type: 'text';
        text: string;
      }>();

      expectTypeOf<TemplateReferenceSegment>().toMatchTypeOf<{
        type: 'reference';
        reference: unknown;
      }>();

      expectTypeOf<TemplateSegment>().toEqualTypeOf<
        TemplateTextSegment | TemplateReferenceSegment
      >();

      expectTypeOf<JsonPickTransformRule['operation']>().toEqualTypeOf<'json_pick'>();
      expectTypeOf<JsonSetTransformRule['operation']>().toEqualTypeOf<'json_set'>();
      expectTypeOf<TemplateStringTransformRule['operation']>().toEqualTypeOf<'template_string'>();
      expectTypeOf<MathOpTransformRule['operation']>().toEqualTypeOf<'math_op'>();

      expectTypeOf<TransformRule>().toEqualTypeOf<
        | JsonPickTransformRule
        | JsonSetTransformRule
        | TemplateStringTransformRule
        | MathOpTransformRule
      >();

      expectTypeOf<TransformNodeConfig>().toMatchTypeOf<{
        rules: TransformRule[];
      }>();
    });

    it('narrows TransformRule by operation at compile time', () => {
      const getTestRule = (): TransformRule => ({
        operation: 'json_pick',
        targetKey: 'extractedKey',
        source: {
          source: 'input',
          field: 'repo',
          path: ['owner'],
        },
      });

      const rule = getTestRule();
      if (rule.operation === 'json_pick') {
        expectTypeOf(rule.operation).toEqualTypeOf<'json_pick'>();
        expectTypeOf(rule).toEqualTypeOf<JsonPickTransformRule>();
      } else if (rule.operation === 'json_set') {
        expectTypeOf(rule.operation).toEqualTypeOf<'json_set'>();
        expectTypeOf(rule).toEqualTypeOf<JsonSetTransformRule>();
      } else if (rule.operation === 'template_string') {
        expectTypeOf(rule.operation).toEqualTypeOf<'template_string'>();
        expectTypeOf(rule).toEqualTypeOf<TemplateStringTransformRule>();
      } else {
        expectTypeOf(rule.operation).toEqualTypeOf<'math_op'>();
        expectTypeOf(rule).toEqualTypeOf<MathOpTransformRule>();
      }
    });

    it('narrows TemplateSegment by type at compile time', () => {
      const getTestSegment = (): TemplateSegment => ({
        type: 'text',
        text: 'hello',
      });

      const seg = getTestSegment();
      if (seg.type === 'text') {
        expectTypeOf(seg.type).toEqualTypeOf<'text'>();
        expectTypeOf(seg).toEqualTypeOf<TemplateTextSegment>();
      } else {
        expectTypeOf(seg.type).toEqualTypeOf<'reference'>();
        expectTypeOf(seg).toEqualTypeOf<TemplateReferenceSegment>();
      }
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts a valid json_pick with input reference', () => {
      const rule: JsonPickTransformRule = {
        operation: 'json_pick',
        targetKey: 'senderId',
        source: {
          source: 'input',
          field: 'payload',
          path: ['sender', 'id'],
        },
      };
      const result = JsonPickTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rule);
      }
    });

    it('2. accepts a valid json_pick with node-output reference', () => {
      const rule: JsonPickTransformRule = {
        operation: 'json_pick',
        targetKey: 'summaryText',
        source: {
          source: 'node_output',
          nodeId: 'llm-summary',
          path: ['result', 'summary'],
        },
      };
      const result = JsonPickTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rule);
      }
    });

    it('3. accepts a valid json_pick with JSON fallbackValue', () => {
      const rule: JsonPickTransformRule = {
        operation: 'json_pick',
        targetKey: 'fallbackStatus',
        source: {
          source: 'input',
          field: 'metadata',
          path: ['status'],
        },
        fallbackValue: 'UNKNOWN',
      };
      const result = JsonPickTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.fallbackValue).toBe('UNKNOWN');
      }
    });

    it('4. accepts a valid json_set with literal binding', () => {
      const rule: JsonSetTransformRule = {
        operation: 'json_set',
        targetKey: 'environment',
        value: {
          type: 'literal',
          value: 'production',
        },
      };
      const result = JsonSetTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rule);
      }
    });

    it('5. accepts a valid json_set with structured reference', () => {
      const rule: JsonSetTransformRule = {
        operation: 'json_set',
        targetKey: 'originalPr',
        value: {
          type: 'reference',
          reference: {
            source: 'input',
            field: 'prNumber',
            path: [],
          },
        },
      };
      const result = JsonSetTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rule);
      }
    });

    it('6. accepts a valid template_string with only text segments', () => {
      expect(TemplateSegmentSchema.safeParse({ type: 'text', text: 'Hello, ' }).success).toBe(true);
      expect(
        TemplateSegmentSchema.safeParse({
          type: 'reference',
          reference: { source: 'input', field: 'prNumber', path: [] },
        }).success,
      ).toBe(true);

      const rule: TemplateStringTransformRule = {
        operation: 'template_string',
        targetKey: 'staticMessage',
        segments: [
          { type: 'text', text: 'Hello, ' },
          { type: 'text', text: 'World!' },
        ],
      };
      const result = TemplateStringTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.segments).toHaveLength(2);
      }
    });

    it('7. accepts a valid template_string with mixed text and reference segments', () => {
      const rule: TemplateStringTransformRule = {
        operation: 'template_string',
        targetKey: 'reviewGreeting',
        segments: [
          { type: 'text', text: 'Review PR #' },
          {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'pullRequestNumber',
              path: [],
            },
          },
          { type: 'text', text: ' by author ' },
          {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'transform-sender',
              path: ['login'],
            },
          },
        ],
      };
      const result = TemplateStringTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.segments).toHaveLength(4);
      }
    });

    it('8. preserves literal text containing "{{input.value}}" unchanged without interpolation', () => {
      const rule: TemplateStringTransformRule = {
        operation: 'template_string',
        targetKey: 'templateCode',
        segments: [{ type: 'text', text: 'Example syntax: {{input.value}} here' }],
      };
      const result = TemplateStringTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        const seg = result.data.segments[0];
        expect(seg).toBeDefined();
        if (seg?.type === 'text') {
          expect(seg.text).toBe('Example syntax: {{input.value}} here');
        }
      }
    });

    it('9. supports template reference with dotted node IDs', () => {
      const rule: TemplateStringTransformRule = {
        operation: 'template_string',
        targetKey: 'msg',
        segments: [
          {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'llm.v1.prod',
              path: ['summary'],
            },
          },
        ],
      };
      const result = TemplateStringTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        const seg = result.data.segments[0];
        expect(seg).toBeDefined();
        if (seg?.type === 'reference') {
          if (seg.reference.source === 'node_output') {
            expect(seg.reference.nodeId).toBe('llm.v1.prod');
          }
        }
      }
    });

    it('10. preserves template property path segments containing dots and spaces', () => {
      const rule: TemplateStringTransformRule = {
        operation: 'template_string',
        targetKey: 'msg',
        segments: [
          {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'node-1',
              path: ['data.result', 'first name', 'item-id#1'],
            },
          },
        ],
      };
      const result = TemplateStringTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        const seg = result.data.segments[0];
        expect(seg).toBeDefined();
        if (seg?.type === 'reference') {
          expect(seg.reference.path).toEqual(['data.result', 'first name', 'item-id#1']);
        }
      }
    });

    it('11. accepts a valid math_op with literal numbers', () => {
      const rule: MathOpTransformRule = {
        operation: 'math_op',
        targetKey: 'offset',
        operator: 'add',
        left: { type: 'literal', value: 100 },
        right: { type: 'literal', value: 25 },
      };
      const result = MathOpTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rule);
      }
    });

    it('12. accepts a valid math_op with reference operands', () => {
      const rule: MathOpTransformRule = {
        operation: 'math_op',
        targetKey: 'nextPage',
        operator: 'add',
        left: {
          type: 'reference',
          reference: {
            source: 'input',
            field: 'currentPage',
            path: [],
          },
        },
        right: {
          type: 'literal',
          value: 1,
        },
      };
      const result = MathOpTransformRuleSchema.safeParse(rule);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(rule);
      }
    });

    it('13. accepts all four mathematical operators', () => {
      const operators: MathOperator[] = ['add', 'subtract', 'multiply', 'divide'];
      for (const op of operators) {
        expect(MathOperatorSchema.safeParse(op).success).toBe(true);
        const rule: MathOpTransformRule = {
          operation: 'math_op',
          targetKey: 'calcResult',
          operator: op,
          left: { type: 'literal', value: 10 },
          right: { type: 'literal', value: 2 },
        };
        expect(MathOpTransformRuleSchema.safeParse(rule).success).toBe(true);
      }
    });

    it('14. accepts a full TransformNodeConfig with multiple distinct rules', () => {
      const config: TransformNodeConfig = {
        rules: [
          {
            operation: 'json_pick',
            targetKey: 'pickedSender',
            source: {
              source: 'input',
              field: 'payload',
              path: ['sender'],
            },
          },
          {
            operation: 'json_set',
            targetKey: 'version',
            value: { type: 'literal', value: '1.0' },
          },
          {
            operation: 'template_string',
            targetKey: 'fullTitle',
            segments: [
              { type: 'text', text: 'PR: ' },
              {
                type: 'reference',
                reference: {
                  source: 'input',
                  field: 'title',
                  path: [],
                },
              },
            ],
          },
          {
            operation: 'math_op',
            targetKey: 'incrementedCount',
            operator: 'add',
            left: { type: 'literal', value: 5 },
            right: { type: 'literal', value: 1 },
          },
        ],
      };
      const result = TransformNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rules).toHaveLength(4);
      }
    });

    it('15. preserves authored values and identifiers exactly without mutation', () => {
      const authored = {
        rules: [
          {
            operation: 'template_string' as const,
            targetKey: 'Custom.Target_Key#1',
            segments: [
              {
                type: 'text' as const,
                text: '  Exact whitespace preserved  ',
              },
            ],
          },
        ],
      };
      const result = TransformNodeConfigSchema.safeParse(authored);
      expect(result.success).toBe(true);
      if (result.success) {
        const rule = result.data.rules[0];
        expect(rule).toBeDefined();
        expect(rule?.targetKey).toBe('Custom.Target_Key#1');
        if (rule?.operation === 'template_string') {
          const seg = rule.segments[0];
          expect(seg).toBeDefined();
          if (seg?.type === 'text') {
            expect(seg.text).toBe('  Exact whitespace preserved  ');
          }
        }
      }
    });
  });

  describe('Negative Validation Tests', () => {
    it('16. rejects a configuration missing rules', () => {
      const result = TransformNodeConfigSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('rules'))).toBe(true);
      }
    });

    it('17. rejects an empty rules array', () => {
      const result = TransformNodeConfigSchema.safeParse({ rules: [] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('at least one rule'))).toBe(true);
      }
    });

    it('18. rejects more than 50 rules', () => {
      const oversizedRules = Array.from({ length: TRANSFORM_CONFIG_MAX_RULES + 1 }, (_, i) => ({
        operation: 'json_set' as const,
        targetKey: `key_${i}`,
        value: { type: 'literal' as const, value: i },
      }));
      const result = TransformNodeConfigSchema.safeParse({
        rules: oversizedRules,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes(`${TRANSFORM_CONFIG_MAX_RULES} rules`),
          ),
        ).toBe(true);
      }
    });

    it('19. rejects duplicate targetKey across rules', () => {
      const config = {
        rules: [
          {
            operation: 'json_set' as const,
            targetKey: 'duplicateKey',
            value: { type: 'literal' as const, value: 'first' },
          },
          {
            operation: 'json_set' as const,
            targetKey: 'uniqueKey',
            value: { type: 'literal' as const, value: 'second' },
          },
          {
            operation: 'json_pick' as const,
            targetKey: 'duplicateKey',
            source: {
              source: 'input' as const,
              field: 'data',
              path: [],
            },
          },
        ],
      };
      const result = TransformNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        const issue = result.error.issues.find(
          (i) => i.path.join('.') === 'rules.2.targetKey' && i.message.includes('Duplicate'),
        );
        expect(issue).toBeDefined();
      }
    });

    it('20. rejects invalid targetKey (empty or whitespace-only)', () => {
      expect(
        JsonSetTransformRuleSchema.safeParse({
          operation: 'json_set',
          targetKey: '',
          value: { type: 'literal', value: 1 },
        }).success,
      ).toBe(false);

      expect(
        JsonSetTransformRuleSchema.safeParse({
          operation: 'json_set',
          targetKey: '   ',
          value: { type: 'literal', value: 1 },
        }).success,
      ).toBe(false);
    });

    it('21. rejects an unsupported operation discriminator', () => {
      const result = TransformRuleSchema.safeParse({
        operation: 'unsupported_op',
        targetKey: 'res',
      });
      expect(result.success).toBe(false);
    });

    it('22. rejects missing operation-specific required fields', () => {
      // json_pick missing source
      expect(
        JsonPickTransformRuleSchema.safeParse({
          operation: 'json_pick',
          targetKey: 'res',
        }).success,
      ).toBe(false);

      // json_set missing value
      expect(
        JsonSetTransformRuleSchema.safeParse({
          operation: 'json_set',
          targetKey: 'res',
        }).success,
      ).toBe(false);

      // template_string missing segments
      expect(
        TemplateStringTransformRuleSchema.safeParse({
          operation: 'template_string',
          targetKey: 'res',
        }).success,
      ).toBe(false);

      // math_op missing operator or operands
      expect(
        MathOpTransformRuleSchema.safeParse({
          operation: 'math_op',
          targetKey: 'res',
          operator: 'add',
        }).success,
      ).toBe(false);
    });

    it('23. rejects extra operation-specific properties via strict validation', () => {
      expect(
        JsonPickTransformRuleSchema.safeParse({
          operation: 'json_pick',
          targetKey: 'res',
          source: { source: 'input', field: 'pr', path: [] },
          extraProperty: 'forbidden',
        }).success,
      ).toBe(false);

      expect(
        JsonSetTransformRuleSchema.safeParse({
          operation: 'json_set',
          targetKey: 'res',
          value: { type: 'literal', value: 1 },
          extraProperty: 'forbidden',
        }).success,
      ).toBe(false);
    });

    it('24. rejects invalid or legacy free-form dotted reference strings', () => {
      expect(
        JsonPickTransformRuleSchema.safeParse({
          operation: 'json_pick',
          targetKey: 'res',
          source: 'nodes.llm.v1.output.summary',
        }).success,
      ).toBe(false);

      expect(
        TemplateReferenceSegmentSchema.safeParse({
          type: 'reference',
          reference: '{{input.value}}',
        }).success,
      ).toBe(false);
    });

    it('25. rejects explicitly undefined fallbackValue in json_pick', () => {
      const result = JsonPickTransformRuleSchema.safeParse({
        operation: 'json_pick',
        targetKey: 'res',
        source: { source: 'input', field: 'pr', path: [] },
        fallbackValue: undefined,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('fallbackValue'))).toBe(true);
      }
    });

    it('26. rejects non-JSON fallbackValue in json_pick', () => {
      expect(
        JsonPickTransformRuleSchema.safeParse({
          operation: 'json_pick',
          targetKey: 'res',
          source: { source: 'input', field: 'pr', path: [] },
          fallbackValue: () => 'forbidden',
        }).success,
      ).toBe(false);

      expect(
        JsonPickTransformRuleSchema.safeParse({
          operation: 'json_pick',
          targetKey: 'res',
          source: { source: 'input', field: 'pr', path: [] },
          fallbackValue: Symbol('test'),
        }).success,
      ).toBe(false);
    });

    it('27. rejects empty template segments array', () => {
      const result = TemplateStringTransformRuleSchema.safeParse({
        operation: 'template_string',
        targetKey: 'res',
        segments: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('at least one segment'))).toBe(
          true,
        );
      }
    });

    it('28. rejects more than 100 template segments', () => {
      const oversizedSegments = Array.from({ length: TEMPLATE_MAX_SEGMENTS + 1 }, (_, i) => ({
        type: 'text' as const,
        text: `seg_${i}`,
      }));
      const result = TemplateStringTransformRuleSchema.safeParse({
        operation: 'template_string',
        targetKey: 'res',
        segments: oversizedSegments,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes(`${TEMPLATE_MAX_SEGMENTS} segments`)),
        ).toBe(true);
      }
    });

    it('29. rejects empty template text segment', () => {
      const result = TemplateTextSegmentSchema.safeParse({
        type: 'text',
        text: '',
      });
      expect(result.success).toBe(false);
    });

    it('30. rejects excessive total template text length exceeding 5000 characters', () => {
      const longText1 = 'a'.repeat(3000);
      const longText2 = 'b'.repeat(2500);
      const result = TemplateStringTransformRuleSchema.safeParse({
        operation: 'template_string',
        targetKey: 'res',
        segments: [
          { type: 'text', text: longText1 },
          { type: 'text', text: longText2 },
        ],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes(`${TEMPLATE_TOTAL_TEXT_MAX_LENGTH} characters`),
          ),
        ).toBe(true);
      }
    });

    it('31. rejects malformed template reference segment', () => {
      expect(
        TemplateReferenceSegmentSchema.safeParse({
          type: 'reference',
          reference: {
            source: 'input',
            // missing field
            path: [],
          },
        }).success,
      ).toBe(false);
    });

    it('32. rejects an unapproved mathematical operator', () => {
      expect(
        MathOpTransformRuleSchema.safeParse({
          operation: 'math_op',
          targetKey: 'res',
          operator: 'modulo',
          left: { type: 'literal', value: 10 },
          right: { type: 'literal', value: 2 },
        }).success,
      ).toBe(false);
    });

    it('33. rejects non-numeric arithmetic literal operands', () => {
      // String literal in left
      expect(
        MathOpTransformRuleSchema.safeParse({
          operation: 'math_op',
          targetKey: 'res',
          operator: 'add',
          left: { type: 'literal', value: '10' },
          right: { type: 'literal', value: 5 },
        }).success,
      ).toBe(false);

      // Boolean literal in right
      expect(
        MathOpTransformRuleSchema.safeParse({
          operation: 'math_op',
          targetKey: 'res',
          operator: 'add',
          left: { type: 'literal', value: 10 },
          right: { type: 'literal', value: true },
        }).success,
      ).toBe(false);

      // Null literal in left
      expect(
        MathOpTransformRuleSchema.safeParse({
          operation: 'math_op',
          targetKey: 'res',
          operator: 'add',
          left: { type: 'literal', value: null },
          right: { type: 'literal', value: 5 },
        }).success,
      ).toBe(false);

      // NaN in left
      expect(
        MathOpTransformRuleSchema.safeParse({
          operation: 'math_op',
          targetKey: 'res',
          operator: 'add',
          left: { type: 'literal', value: NaN },
          right: { type: 'literal', value: 5 },
        }).success,
      ).toBe(false);
    });

    it('34. rejects a literal zero denominator for division at configuration time', () => {
      const result = MathOpTransformRuleSchema.safeParse({
        operation: 'math_op',
        targetKey: 'divZero',
        operator: 'divide',
        left: { type: 'literal', value: 100 },
        right: { type: 'literal', value: 0 },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('division by zero'))).toBe(true);
      }
    });

    it('35. rejects unknown top-level configuration properties via strict validation', () => {
      const result = TransformNodeConfigSchema.safeParse({
        rules: [
          {
            operation: 'json_set',
            targetKey: 'k',
            value: { type: 'literal', value: 1 },
          },
        ],
        extraConfigKey: 'forbidden',
        code: 'eval("forbidden")',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('extraConfigKey'))).toBe(true);
      }
    });
  });

  describe('Boundary & Draft Compatibility Tests', () => {
    it('36. confirms a draft TRANSFORM node with config: {} still passes WorkflowNodeSchema', () => {
      const draftNode: WorkflowNode = {
        id: 'node-transform-1',
        type: 'TRANSFORM',
        position: { x: 250, y: 150 },
        config: {},
      };
      const result = WorkflowNodeSchema.safeParse(draftNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toEqual({});
      }
    });

    it('37. confirms the same empty config fails TransformNodeConfigSchema', () => {
      const emptyConfig = {};
      const result = TransformNodeConfigSchema.safeParse(emptyConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('rules'))).toBe(true);
      }
    });

    it('38. confirms existing INPUT and OUTPUT configs continue passing', () => {
      const validIn = {
        fields: [{ name: 'f1', type: 'string', required: true }],
      };
      const validOut = {
        payloadMapping: {
          res: { type: 'literal', value: 123 },
        },
      };
      expect(InputNodeConfigSchema.safeParse(validIn).success).toBe(true);
      expect(OutputNodeConfigSchema.safeParse(validOut).success).toBe(true);
    });

    it('39. confirms value-binding schemas remain intact and reusable', () => {
      const lit = { type: 'literal' as const, value: { nested: true } };
      expect(ValueBindingSchema.safeParse(lit).success).toBe(true);
    });

    it('40. confirms existing workflow graph tests continue passing independently', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-in',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: 'node-tx',
            type: 'TRANSFORM',
            position: { x: 100, y: 0 },
            config: {},
          },
        ],
        edges: [
          {
            id: 'e1',
            source: 'node-in',
            target: 'node-tx',
          },
        ],
      };
      expect(WorkflowGraphSchema.safeParse(graph).success).toBe(true);
    });
  });
});
