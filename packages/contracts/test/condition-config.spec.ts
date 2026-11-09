import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  BinaryConditionConfigSchema,
  BinaryConditionOperatorSchema,
  ConditionNodeConfigSchema,
  UnaryConditionConfigSchema,
  UnaryConditionOperatorSchema,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  type BinaryConditionConfig,
  type BinaryConditionOperator,
  type ConditionNodeConfig,
  type UnaryConditionConfig,
  type UnaryConditionOperator,
  type WorkflowGraph,
  type WorkflowNode,
} from '../src/index.js';

describe('Condition Node Configuration Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types matching schema declarations', () => {
      expectTypeOf<BinaryConditionOperator>().toEqualTypeOf<
        | 'equals'
        | 'not_equals'
        | 'greater_than'
        | 'less_than'
        | 'greater_than_or_equal'
        | 'less_than_or_equal'
        | 'contains'
        | 'not_contains'
      >();

      expectTypeOf<UnaryConditionOperator>().toEqualTypeOf<
        'is_empty' | 'is_not_empty' | 'is_null' | 'is_not_null'
      >();

      expectTypeOf<BinaryConditionConfig>().toMatchTypeOf<{
        operator: BinaryConditionOperator;
        left: unknown;
        right: unknown;
      }>();

      expectTypeOf<UnaryConditionConfig>().toMatchTypeOf<{
        operator: UnaryConditionOperator;
        left: unknown;
      }>();

      expectTypeOf<ConditionNodeConfig>().toEqualTypeOf<
        BinaryConditionConfig | UnaryConditionConfig
      >();
    });

    it('narrows configuration type based on operator discriminator', () => {
      const config = {
        operator: 'equals',
        left: { type: 'literal', value: 'alpha' },
        right: { type: 'literal', value: 'beta' },
      } as ConditionNodeConfig;

      if (config.operator === 'equals') {
        expectTypeOf(config).toEqualTypeOf<BinaryConditionConfig>();
      } else if (config.operator === 'is_null') {
        expectTypeOf(config).toEqualTypeOf<UnaryConditionConfig>();
      }
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts valid binary equals with literal operands', () => {
      const config: ConditionNodeConfig = {
        operator: 'equals',
        left: { type: 'literal', value: 'active' },
        right: { type: 'literal', value: 'active' },
      };
      const result = ConditionNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('2. accepts valid binary not_equals with input reference left and literal right', () => {
      const config: ConditionNodeConfig = {
        operator: 'not_equals',
        left: {
          type: 'reference',
          reference: {
            source: 'input',
            field: 'status',
            path: [],
          },
        },
        right: { type: 'literal', value: 'closed' },
      };
      const result = ConditionNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('3. accepts valid binary numeric comparison operators', () => {
      const operators: BinaryConditionOperator[] = [
        'greater_than',
        'less_than',
        'greater_than_or_equal',
        'less_than_or_equal',
      ];

      for (const operator of operators) {
        const config: ConditionNodeConfig = {
          operator,
          left: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'retryCount',
              path: [],
            },
          },
          right: { type: 'literal', value: 3 },
        };
        const result = ConditionNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      }
    });

    it('4. accepts valid binary string operators contains and not_contains', () => {
      const operators: BinaryConditionOperator[] = ['contains', 'not_contains'];

      for (const operator of operators) {
        const config: ConditionNodeConfig = {
          operator,
          left: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'tags',
              path: [],
            },
          },
          right: { type: 'literal', value: 'urgent' },
        };
        const result = ConditionNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      }
    });

    it('5. accepts valid binary condition with both operands as NodeOutputValueReference', () => {
      const config: ConditionNodeConfig = {
        operator: 'equals',
        left: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'node-llm-1',
            path: ['confidenceScore'],
          },
        },
        right: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'node-threshold-eval',
            path: ['minimumThreshold'],
          },
        },
      };
      const result = ConditionNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('6. accepts valid binary condition referencing deeply nested paths', () => {
      const config: ConditionNodeConfig = {
        operator: 'greater_than_or_equal',
        left: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'node-fetch-pr',
            path: ['pullRequest', 'diff', 'metrics', 'changedFiles'],
          },
        },
        right: { type: 'literal', value: 10 },
      };
      const result = ConditionNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('7. accepts valid binary condition with dotted node IDs in reference', () => {
      const config: ConditionNodeConfig = {
        operator: 'equals',
        left: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'step.fetch.pr.1',
            path: ['id'],
          },
        },
        right: { type: 'literal', value: 101 },
      };
      const result = ConditionNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('8. accepts valid unary is_empty and is_not_empty with reference operand', () => {
      const operators: UnaryConditionOperator[] = ['is_empty', 'is_not_empty'];

      for (const operator of operators) {
        const config: ConditionNodeConfig = {
          operator,
          left: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'assignees',
              path: [],
            },
          },
        };
        const result = ConditionNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      }
    });

    it('9. accepts valid unary is_null and is_not_null with reference operand', () => {
      const operators: UnaryConditionOperator[] = ['is_null', 'is_not_null'];

      for (const operator of operators) {
        const config: ConditionNodeConfig = {
          operator,
          left: {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'node-lookup-user',
              path: ['user', 'email'],
            },
          },
        };
        const result = ConditionNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      }
    });

    it('10. accepts literal values of various valid types without coercion', () => {
      const testCases = [
        { value: 'literal-string' },
        { value: 42 },
        { value: 3.14159 },
        { value: true },
        { value: false },
        { value: null },
        { value: ['item1', 'item2'] },
        { value: { nestedKey: 'nestedValue' } },
      ];

      for (const tc of testCases) {
        const config: ConditionNodeConfig = {
          operator: 'equals',
          left: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'payload',
              path: [],
            },
          },
          right: { type: 'literal', value: tc.value },
        };
        const result = ConditionNodeConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data).toEqual(config);
        }
      }
    });
  });

  describe('Negative Validation Tests', () => {
    it('11. rejects missing operator', () => {
      const malformed = {
        left: { type: 'literal', value: 1 },
        right: { type: 'literal', value: 2 },
      };
      const result = ConditionNodeConfigSchema.safeParse(malformed);
      expect(result.success).toBe(false);
    });

    it('12. rejects unsupported or speculative operators', () => {
      const unsupportedOperators = ['regex', 'matches', 'in', 'LIKE', 'EQUALS', 'not'];
      for (const operator of unsupportedOperators) {
        const malformed = {
          operator,
          left: { type: 'literal', value: 'a' },
          right: { type: 'literal', value: 'b' },
        };
        const result = ConditionNodeConfigSchema.safeParse(malformed);
        expect(result.success).toBe(false);
      }
    });

    it('13. rejects missing left operand on binary condition', () => {
      const malformed = {
        operator: 'equals',
        right: { type: 'literal', value: 'target' },
      };
      const result = ConditionNodeConfigSchema.safeParse(malformed);
      expect(result.success).toBe(false);
    });

    it('14. rejects missing right operand on binary condition', () => {
      const malformed = {
        operator: 'equals',
        left: { type: 'literal', value: 'target' },
      };
      const result = ConditionNodeConfigSchema.safeParse(malformed);
      expect(result.success).toBe(false);
    });

    it('15. rejects binary condition with explicit undefined right operand', () => {
      const malformed = {
        operator: 'equals',
        left: { type: 'literal', value: 'target' },
        right: undefined,
      };
      const result = ConditionNodeConfigSchema.safeParse(malformed);
      expect(result.success).toBe(false);
    });

    it('16. rejects unary condition containing a right operand', () => {
      const malformed = {
        operator: 'is_null',
        left: {
          type: 'reference',
          reference: {
            source: 'input',
            field: 'fieldName',
            path: [],
          },
        },
        right: { type: 'literal', value: null },
      };
      const result = ConditionNodeConfigSchema.safeParse(malformed);
      expect(result.success).toBe(false);
    });

    it('17. rejects malformed left or right ValueBinding', () => {
      const malformedLeft = {
        operator: 'equals',
        left: { type: 'invalid_type', value: 'val' },
        right: { type: 'literal', value: 'val' },
      };
      expect(ConditionNodeConfigSchema.safeParse(malformedLeft).success).toBe(false);

      const malformedRight = {
        operator: 'equals',
        left: { type: 'literal', value: 'val' },
        right: {
          type: 'reference',
          reference: {
            source: 'input',
            field: '', // Empty field violates identifier validation
            path: [],
          },
        },
      };
      expect(ConditionNodeConfigSchema.safeParse(malformedRight).success).toBe(false);
    });

    it('18. rejects legacy dotted string syntax in value references', () => {
      const legacyConfig = {
        operator: 'equals',
        left: {
          type: 'reference',
          reference: {
            source: 'node_output',
            nodeId: 'node-llm',
            path: 'body.user.email', // String instead of string[]
          },
        },
        right: { type: 'literal', value: 'admin@flowforge.dev' },
      };
      expect(ConditionNodeConfigSchema.safeParse(legacyConfig).success).toBe(false);
    });

    it('19. rejects branch target fields inside condition config', () => {
      const speculativeConfigs = [
        {
          operator: 'equals',
          left: { type: 'literal', value: 1 },
          right: { type: 'literal', value: 1 },
          trueTargetId: 'node-target-1',
        },
        {
          operator: 'equals',
          left: { type: 'literal', value: 1 },
          right: { type: 'literal', value: 1 },
          falseTargetId: 'node-target-2',
        },
        {
          operator: 'equals',
          left: { type: 'literal', value: 1 },
          right: { type: 'literal', value: 1 },
          trueBranch: 'node-target-1',
        },
        {
          operator: 'equals',
          left: { type: 'literal', value: 1 },
          right: { type: 'literal', value: 1 },
          falseBranch: 'node-target-2',
        },
        {
          operator: 'equals',
          left: { type: 'literal', value: 1 },
          right: { type: 'literal', value: 1 },
          sourceHandle: 'true',
        },
        {
          operator: 'equals',
          left: { type: 'literal', value: 1 },
          right: { type: 'literal', value: 1 },
          targetHandle: 'input',
        },
      ];

      for (const spec of speculativeConfigs) {
        expect(ConditionNodeConfigSchema.safeParse(spec).success).toBe(false);
      }
    });

    it('20. rejects unexpected extra properties in binary condition', () => {
      const extraProp = {
        operator: 'equals',
        left: { type: 'literal', value: 1 },
        right: { type: 'literal', value: 2 },
        description: 'Check if 1 equals 2',
      };
      expect(ConditionNodeConfigSchema.safeParse(extraProp).success).toBe(false);
    });

    it('21. rejects unexpected extra properties in unary condition', () => {
      const extraProp = {
        operator: 'is_null',
        left: { type: 'literal', value: null },
        extraField: 'not-allowed',
      };
      expect(ConditionNodeConfigSchema.safeParse(extraProp).success).toBe(false);
    });
  });

  describe('Boundary and Structural Integration Tests', () => {
    it('22. WorkflowNodeSchema accepts a draft CONDITION node with empty config', () => {
      const draftNode: WorkflowNode = {
        id: 'node-cond-draft',
        type: 'CONDITION',
        position: { x: 100, y: 100 },
        config: {},
      };
      const result = WorkflowNodeSchema.safeParse(draftNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(draftNode);
      }
    });

    it('23. ConditionNodeConfigSchema strictly rejects an empty object', () => {
      const result = ConditionNodeConfigSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('24. WorkflowGraphSchema accepts a graph containing a fully configured CONDITION node', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-input-1',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {
              fields: [
                {
                  name: 'score',
                  type: 'number',
                  required: true,
                },
              ],
            },
          },
          {
            id: 'node-cond-1',
            type: 'CONDITION',
            position: { x: 200, y: 0 },
            config: {
              operator: 'greater_than',
              left: {
                type: 'reference',
                reference: {
                  source: 'input',
                  field: 'score',
                  path: [],
                },
              },
              right: { type: 'literal', value: 80 },
            },
          },
          {
            id: 'node-out-high',
            type: 'OUTPUT',
            position: { x: 400, y: -100 },
            config: {
              payloadMapping: {
                status: { type: 'literal', value: 'PASSED' },
              },
            },
          },
          {
            id: 'node-out-low',
            type: 'OUTPUT',
            position: { x: 400, y: 100 },
            config: {
              payloadMapping: {
                status: { type: 'literal', value: 'FAILED' },
              },
            },
          },
        ],
        edges: [
          { id: 'edge-1', source: 'node-input-1', target: 'node-cond-1' },
          {
            id: 'edge-true',
            source: 'node-cond-1',
            target: 'node-out-high',
            conditionOutcome: 'TRUE',
          },
          {
            id: 'edge-false',
            source: 'node-cond-1',
            target: 'node-out-low',
            conditionOutcome: 'FALSE',
          },
        ],
      };

      const result = WorkflowGraphSchema.safeParse(graph);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(graph);
      }
    });

    it('25. confirms ConditionNodeConfig is strictly orthogonal to edge branch metadata', () => {
      const validConfig: ConditionNodeConfig = {
        operator: 'is_not_empty',
        left: {
          type: 'reference',
          reference: {
            source: 'input',
            field: 'comments',
            path: [],
          },
        },
      };

      // Validating config does not inspect or require any edge data
      const configResult = ConditionNodeConfigSchema.safeParse(validConfig);
      expect(configResult.success).toBe(true);

      // Condition config cannot contain edge information
      const configWithEdgeData = {
        ...validConfig,
        conditionOutcome: 'TRUE',
      };
      expect(ConditionNodeConfigSchema.safeParse(configWithEdgeData).success).toBe(false);
    });
  });

  describe('Direct Operator Enum Schemas Verification', () => {
    it('verifies BinaryConditionOperatorSchema parses valid values and rejects invalid', () => {
      expect(BinaryConditionOperatorSchema.safeParse('equals').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('not_equals').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('greater_than').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('less_than').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('greater_than_or_equal').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('less_than_or_equal').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('contains').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('not_contains').success).toBe(true);
      expect(BinaryConditionOperatorSchema.safeParse('invalid_op').success).toBe(false);
    });

    it('verifies UnaryConditionOperatorSchema parses valid values and rejects invalid', () => {
      expect(UnaryConditionOperatorSchema.safeParse('is_empty').success).toBe(true);
      expect(UnaryConditionOperatorSchema.safeParse('is_not_empty').success).toBe(true);
      expect(UnaryConditionOperatorSchema.safeParse('is_null').success).toBe(true);
      expect(UnaryConditionOperatorSchema.safeParse('is_not_null').success).toBe(true);
      expect(UnaryConditionOperatorSchema.safeParse('is_undefined').success).toBe(false);
    });

    it('verifies BinaryConditionConfigSchema directly', () => {
      const validBinary = {
        operator: 'equals' as const,
        left: { type: 'literal' as const, value: 1 },
        right: { type: 'literal' as const, value: 2 },
      };
      expect(BinaryConditionConfigSchema.safeParse(validBinary).success).toBe(true);
    });

    it('verifies UnaryConditionConfigSchema directly', () => {
      const validUnary = {
        operator: 'is_null' as const,
        left: { type: 'literal' as const, value: null },
      };
      expect(UnaryConditionConfigSchema.safeParse(validUnary).success).toBe(true);
    });
  });
});
