import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  OUTPUT_CONFIG_MAX_FIELDS,
  OutputNodeConfigSchema,
  WorkflowGraphSchema,
  WorkflowNodeSchema,
  type OutputNodeConfig,
  type ValueBinding,
  type WorkflowGraph,
  type WorkflowNode,
} from '../src/index.js';

describe('OUTPUT Node Configuration Schema', () => {
  describe('TypeScript Type Inference Verification', () => {
    it('infers exact types matching schema declarations', () => {
      expectTypeOf<OutputNodeConfig>().toMatchTypeOf<{
        payloadMapping: Record<string, ValueBinding>;
      }>();

      expectTypeOf<OutputNodeConfig['payloadMapping']>().toMatchTypeOf<
        Record<string, ValueBinding>
      >();
    });
  });

  describe('Positive Validation Tests', () => {
    it('1. accepts a valid literal output mapping', () => {
      const config: OutputNodeConfig = {
        payloadMapping: {
          status: { type: 'literal', value: 'COMPLETED' },
          code: { type: 'literal', value: 200 },
        },
      };
      const result = OutputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('2. accepts a valid input-reference output mapping', () => {
      const config: OutputNodeConfig = {
        payloadMapping: {
          originalPrNumber: {
            type: 'reference',
            reference: {
              source: 'input',
              field: 'pullRequestNumber',
              path: [],
            },
          },
        },
      };
      const result = OutputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('3. accepts a valid node-output-reference mapping', () => {
      const config: OutputNodeConfig = {
        payloadMapping: {
          summary: {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'llm.v1',
              path: ['result', 'summary'],
            },
          },
        },
      };
      const result = OutputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('4. accepts mixed literal and reference mappings', () => {
      const config: OutputNodeConfig = {
        payloadMapping: {
          summary: {
            type: 'reference',
            reference: {
              source: 'node_output',
              nodeId: 'analyze-pr',
              path: ['summary'],
            },
          },
          approved: {
            type: 'literal',
            value: false,
          },
          meta: {
            type: 'literal',
            value: { version: '1.0.0' },
          },
        },
      };
      const result = OutputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(config);
      }
    });

    it('5. preserves mapping keys with casing and allowed identifier characters', () => {
      const config: OutputNodeConfig = {
        payloadMapping: {
          'output-key_1': { type: 'literal', value: 'value1' },
          'CamelCase.Key#v2': { type: 'literal', value: 'value2' },
        },
      };
      const result = OutputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payloadMapping['output-key_1']).toBeDefined();
        expect(result.data.payloadMapping['CamelCase.Key#v2']).toBeDefined();
      }
    });
  });

  describe('Negative Validation Tests', () => {
    it('6. rejects a configuration missing payloadMapping', () => {
      const result = OutputNodeConfigSchema.safeParse({});
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('payloadMapping'))).toBe(true);
      }
    });

    it('7. rejects an empty payloadMapping object', () => {
      const result = OutputNodeConfigSchema.safeParse({ payloadMapping: {} });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.message.includes('between 1 and 50 entries')),
        ).toBe(true);
      }
    });

    it('8. rejects non-object payloadMapping values', () => {
      expect(OutputNodeConfigSchema.safeParse({ payloadMapping: 'not-an-object' }).success).toBe(
        false,
      );

      expect(OutputNodeConfigSchema.safeParse({ payloadMapping: null }).success).toBe(false);

      expect(OutputNodeConfigSchema.safeParse({ payloadMapping: [1, 2, 3] }).success).toBe(false);
    });

    it('9. rejects more than 50 output mapping fields', () => {
      const oversizedMapping: Record<string, ValueBinding> = {};
      for (let i = 0; i <= OUTPUT_CONFIG_MAX_FIELDS; i++) {
        oversizedMapping[`field_${i}`] = {
          type: 'literal',
          value: i,
        };
      }
      const result = OutputNodeConfigSchema.safeParse({
        payloadMapping: oversizedMapping,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.message.includes(`between 1 and ${OUTPUT_CONFIG_MAX_FIELDS}`),
          ),
        ).toBe(true);
      }
    });

    it('10. rejects invalid mapping keys (empty or whitespace-only)', () => {
      expect(
        OutputNodeConfigSchema.safeParse({
          payloadMapping: {
            '': { type: 'literal', value: 'bad-key' },
          },
        }).success,
      ).toBe(false);

      expect(
        OutputNodeConfigSchema.safeParse({
          payloadMapping: {
            '   ': { type: 'literal', value: 'whitespace-key' },
          },
        }).success,
      ).toBe(false);
    });

    it('11. rejects invalid binding values in payloadMapping', () => {
      expect(
        OutputNodeConfigSchema.safeParse({
          payloadMapping: {
            res: 'plain-string-instead-of-binding',
          },
        }).success,
      ).toBe(false);

      expect(
        OutputNodeConfigSchema.safeParse({
          payloadMapping: {
            res: { type: 'unknown_type', value: 123 },
          },
        }).success,
      ).toBe(false);

      expect(
        OutputNodeConfigSchema.safeParse({
          payloadMapping: {
            res: {
              type: 'reference',
              reference: { source: 'input', field: 'pr' }, // missing path
            },
          },
        }).success,
      ).toBe(false);
    });

    it('12. rejects unexpected outer configuration properties via strict validation', () => {
      const result = OutputNodeConfigSchema.safeParse({
        payloadMapping: {
          result: { type: 'literal', value: 'ok' },
        },
        terminateWorkflow: true, // Redundant flag must be rejected
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.message.includes('terminateWorkflow'))).toBe(true);
      }
    });

    it('13. confirms no implicit defaults are inserted into parsed configuration', () => {
      const config: OutputNodeConfig = {
        payloadMapping: {
          status: { type: 'literal', value: 'OK' },
        },
      };
      const result = OutputNodeConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(Object.keys(result.data)).toEqual(['payloadMapping']);
      }
    });

    it('14. confirms OUTPUT configuration validation remains separate from graph topology', () => {
      // Config schema only validates the payload mapping object itself, not graph edges
      const validConfig: OutputNodeConfig = {
        payloadMapping: {
          finalResult: { type: 'literal', value: 'done' },
        },
      };
      expect(OutputNodeConfigSchema.safeParse(validConfig).success).toBe(true);
    });
  });

  describe('Boundary & Draft Compatibility Tests', () => {
    it('confirms a draft OUTPUT node with config: {} still passes WorkflowNodeSchema', () => {
      const draftNode: WorkflowNode = {
        id: 'node-out',
        type: 'OUTPUT',
        position: { x: 500, y: 300 },
        config: {},
      };
      const result = WorkflowNodeSchema.safeParse(draftNode);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.config).toEqual({});
      }
    });

    it('confirms the same empty config fails OutputNodeConfigSchema', () => {
      const emptyConfig = {};
      const result = OutputNodeConfigSchema.safeParse(emptyConfig);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('payloadMapping'))).toBe(true);
      }
    });

    it('confirms WorkflowGraphSchema continues validating structure independently', () => {
      const graph: WorkflowGraph = {
        nodes: [
          {
            id: 'node-in',
            type: 'INPUT',
            position: { x: 0, y: 0 },
            config: {},
          },
          {
            id: 'node-out',
            type: 'OUTPUT',
            position: { x: 200, y: 0 },
            config: {},
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-in',
            target: 'node-out',
          },
        ],
      };
      expect(WorkflowGraphSchema.safeParse(graph).success).toBe(true);
    });
  });
});
